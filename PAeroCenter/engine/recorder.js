/* Passive CDP Network observer. Does not replay, modify, block, or reroute traffic.
 * Not a full HAR recorder: same-origin XHR/Fetch only, structured bodies only.
 */
(() => {
  'use strict';
  const C = PAeroCore, DB = PAeroStore, sessions = new Map();
  const MAX_RECORDS = 1000, MAX_BYTES = 4 * 1024 * 1024;
  const command = (tabId, method, params = {}) => chrome.debugger.sendCommand({tabId}, method, params);
  const snapshot = s => ({active:!s.stopped, count:s.count, bytes:s.bytes, errors:s.errors,
    omitted:s.omitted, reason:s.reason || '', scope:'same-origin XHR/Fetch; structured bodies only'});
  async function save(s, row) {
    if (s.count >= MAX_RECORDS) { s.reason = 'Лимит 1000 записей'; return false; }
    const bytes = new TextEncoder().encode(JSON.stringify(row)).length;
    if (s.bytes + bytes > MAX_BYTES) { s.reason = 'Лимит журнала 4 МиБ'; return false; }
    await DB.addRecord({...row, jobId:s.jobId}); s.bytes += bytes; s.count++; return true;
  }
  async function finish(s, requestId, note = '', responseBody = false) {
    const row = s.pending.get(requestId); if (!row) return;
    s.pending.delete(requestId); row.finishedAt = Date.now();
    if (note) row.note = note;
    if (responseBody) {
      try {
        if (row.response && C.sameOrigin(row.response.url, s.origin)) {
          if (row.encodedBytes > 512 * 1024) row.body = {format:'omitted', reason:'Передано больше 512 КиБ'};
          else {
            const data = await command(s.tabId, 'Network.getResponseBody', {requestId});
            let text = data.body || '';
            if (data.base64Encoded) {
              if (text.length > 700000) text = '';
              else text = new TextDecoder().decode(Uint8Array.from(atob(text), c => c.charCodeAt(0)));
            }
            row.body = C.safeBody(text, row.response.mimeType);
            if (JSON.stringify(row.body).length > 128 * 1024) row.body = {format:'omitted', reason:'Структура больше 128 КиБ'};
          }
        }
      } catch (_) { s.errors++; row.body = {format:'unavailable', reason:'Chrome не предоставил тело ответа'}; }
    }
    if (row.body?.format === 'omitted' || row.body?.format === 'unavailable') s.omitted++;
    const saved = await save(s, row);
    if (!saved && !s.stopped) {
      s.stopped = true;
      // Drop in-flight requests only with an explicit count/reason, never silently claim full capture.
      const dropped = s.pending.size; s.pending.clear(); s.reason += dropped ? `; незавершённых: ${dropped}` : '';
      try { await chrome.debugger.detach({tabId:s.tabId}); } catch (_) {}
      s.notify(s.jobId, snapshot(s));
    }
  }
  async function process(s, method, p) {
    if (s.stopped) return;
    if (method === 'Network.requestWillBeSent') {
      if (s.pending.has(p.requestId)) await finish(s, p.requestId, `Перенаправление${p.redirectResponse ? ' HTTP ' + p.redirectResponse.status : ''}`);
      if (!['Fetch','XHR'].includes(p.type) || !C.sameOrigin(p.request?.url, s.origin)) return;
      if (s.pending.size >= 200) { s.errors++; return; }
      s.pending.set(p.requestId, {requestId:p.requestId, startedAt:Math.round((p.wallTime || Date.now()/1000)*1000),
        resourceType:p.type, method:p.request.method, url:C.safeUrl(p.request.url),
        requestHeaders:C.safeHeaders(p.request.headers),
        requestBody:C.safeBody(p.request.postData || '', p.request.headers?.['Content-Type'] || p.request.headers?.['content-type'] || ''),
        postDataUnavailable:Boolean(p.request.hasPostData && !p.request.postData)});
    } else if (method === 'Network.responseReceived') {
      const row = s.pending.get(p.requestId); if (!row) return;
      row.response = {status:p.response.status, url:C.safeUrl(p.response.url), mimeType:p.response.mimeType,
        fromDiskCache:Boolean(p.response.fromDiskCache), fromServiceWorker:Boolean(p.response.fromServiceWorker),
        headers:C.safeHeaders(p.response.headers)};
    } else if (method === 'Network.loadingFinished') {
      const row = s.pending.get(p.requestId); if (row) row.encodedBytes = p.encodedDataLength;
      await finish(s, p.requestId, '', true);
    } else if (method === 'Network.loadingFailed') {
      s.errors += s.pending.has(p.requestId) ? 1 : 0;
      await finish(s, p.requestId, `Ошибка загрузки: ${C.scrubString(p.errorText || 'unknown')}`);
    }
  }
  chrome.debugger.onEvent.addListener((source, method, params) => {
    if (source.sessionId) return; // Child targets/workers are deliberately out of scope.
    const s = sessions.get(source.tabId); if (!s || s.stopped) return;
    s.queue = s.queue.then(() => process(s, method, params || {})).catch(error => {
      s.errors++; s.reason = `Ошибка записи журнала: ${C.scrubString(error.message)}`;
      s.notify(s.jobId, snapshot(s));
    });
  });
  chrome.debugger.onDetach.addListener((source, reason) => {
    const s = sessions.get(source.tabId); if (!s || s.stopped) return;
    s.stopped = true; s.reason = `Отладчик отключён: ${reason}`;
    s.queue = s.queue.then(async () => {
      for (const id of [...s.pending.keys()]) await finish(s, id, 'Отладчик отключён; запрос не завершён');
      s.notify(s.jobId, snapshot(s));
    }).catch(() => {});
  });
  globalThis.PAeroRecorder = {
    async start(tabId, origin, jobId, notify) {
      const prev = sessions.get(tabId); if (prev && !prev.stopped) throw new Error('Запись уже запущена');
      await chrome.debugger.attach({tabId}, '1.3');
      const s = {tabId, origin, jobId, notify, pending:new Map(), queue:Promise.resolve(), count:0, bytes:0, errors:0, omitted:0, stopped:false};
      sessions.set(tabId, s);
      try { await command(tabId, 'Network.enable', {maxTotalBufferSize:8*1024*1024, maxResourceBufferSize:1024*1024, maxPostDataSize:128*1024}); }
      catch (error) { s.stopped=true; sessions.delete(tabId); try { await chrome.debugger.detach({tabId}); } catch (_) {} throw error; }
      return snapshot(s);
    },
    async stop(tabId, reason = 'Остановлено') {
      const s = sessions.get(tabId); if (!s) return null;
      // Preserve events already queued before the stop operation.
      await s.queue; s.stopped = true; s.reason = s.reason || reason;
      for (const id of [...s.pending.keys()]) await finish(s, id, 'Запись остановлена до завершения запроса');
      try { await chrome.debugger.detach({tabId}); } catch (_) {}
      const info = snapshot(s); sessions.delete(tabId); return info;
    },
    stats(tabId) { const s = sessions.get(tabId); return s ? snapshot(s) : null; },
    activeTabs() { return [...sessions.values()].filter(s => !s.stopped).map(s => s.tabId); }
  };
})();
