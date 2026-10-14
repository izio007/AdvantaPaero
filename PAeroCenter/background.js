'use strict';
importScripts('engine/core.js', 'engine/store.js', 'engine/recorder.js');
const C = PAeroCore, DB = PAeroStore, R = PAeroRecorder;
const mutations = new Map(), starting = new Set();
// Per-job serialization prevents a slow checkpoint from overwriting final state.
function mutate(id, fn) {
  const p = (mutations.get(id) || Promise.resolve()).catch(() => {}).then(async () => {
    const job = await DB.get(id); if (!job) throw new Error('Запуск не найден');
    await fn(job); await DB.put(job); return job;
  });
  mutations.set(id, p); p.finally(() => { if (mutations.get(id) === p) mutations.delete(id); }).catch(() => {});
  return p;
}
const running = job => job && ['running','recording','stopping'].includes(job.status);
function summary(job) {
  if (!job) return null;
  const {rows, ...rest} = job;
  return {...rest, collected:rows?.length || job.collected || 0, network:R.stats(job.tabId) || job.network};
}
async function latest(tabId) {
  const jobs = await DB.list(); return jobs.filter(j => tabId == null || j.tabId === tabId).sort((a,b) => b.startedAt-a.startedAt)[0] || null;
}
async function probe(tabId) {
  if (!Number.isInteger(tabId)) throw new Error('Откройте вкладку ADVANTA и нажмите значок расширения');
  const tab = await chrome.tabs.get(tabId);
  if (!/^https?:\/\//i.test(tab.url || '')) throw new Error('Нужна обычная HTTP/HTTPS-страница ADVANTA');
  await chrome.scripting.executeScript({target:{tabId, frameIds:[0]}, world:'ISOLATED', files:['engine/core.js','engine/collector.js']});
  const result = await chrome.scripting.executeScript({target:{tabId, frameIds:[0]}, world:'ISOLATED', func:() => globalThis.PAeroCollector.inspect()});
  return {tab, diagnostic:result[0]?.result};
}
function networkNotice(id, info) {
  void mutate(id, job => {
    job.network = info;
    if (job.mode === 'record' && !info.active) { job.status='stopped'; job.finishedAt=Date.now(); }
  }).catch(() => {});
}
async function downloadText(text, kind, id, extension) {
  // Data URL avoids depending on the lifetime of a popup or an offscreen document.
  const filename = `PAeroCenter/${kind}-${id}.${extension}`;
  return chrome.downloads.download({url:`data:${extension === 'csv' ? 'text/csv' : 'application/json'};charset=utf-8,${encodeURIComponent(text)}`,
    filename, conflictAction:'uniquify', saveAs:false});
}
async function autoExport(id) {
  const job = await DB.get(id);
  if (!job?.rows?.length || !job.autoCsv || job.autoExportAttempted) return;
  await mutate(id, j => { j.autoExportAttempted = true; });
  try {
    const downloadId = await downloadText(C.toCsv(job.rows, job.status), 'structure', id, 'csv');
    await mutate(id, j => { j.downloadId = downloadId; });
  } catch (error) {
    await mutate(id, j => { j.warnings.push(`CSV не скачан: ${C.scrubString(error.message)}. Используйте кнопку CSV.`); });
  }
}
async function start(tabId, options) {
  if (starting.has(tabId)) throw new Error('Запуск уже выполняется');
  starting.add(tabId);
  try {
    const old = await latest(tabId); if (running(old)) throw new Error('Сначала остановите текущую операцию');
    const {tab, diagnostic} = await probe(tabId);
    if (!diagnostic?.supported) throw new Error('Не распознана ADVANTA. Нажмите «Проверить страницу»');
    const id = new Date().toISOString().replace(/[-:.]/g,'') + '-' + crypto.randomUUID().slice(0,8);
    const mode = ['record','screen'].includes(options.mode) ? options.mode : 'full';
    const job = {id, version:C.VERSION, tabId, origin:new URL(tab.url).origin, page:C.safeUrl(tab.url),
      startedAt:Date.now(), updatedAt:Date.now(), mode, status:mode === 'record' ? 'recording' : 'running',
      phase:mode === 'record' ? 'network' : 'structure', warnings:[], rows:[], expanded:0, processed:0, hoursErrors:0,
      autoCsv:options.autoCsv !== false, diagnostic, network:null};
    await DB.put(job); await chrome.storage.local.set({lastJobId:id});
    if (mode === 'record' || options.record === true) {
      try { const info = await R.start(tabId, job.origin, id, networkNotice); await mutate(id,j => { j.network = info; }); }
      catch (error) {
        const message = `Запись обмена недоступна: ${C.scrubString(error.message)}`;
        await mutate(id,j => { j.warnings.push(message); if (mode === 'record') { j.status='error'; j.phase='done'; } });
        if (mode === 'record') throw new Error(message);
      }
    }
    if (mode !== 'record') {
      try {
        await chrome.scripting.executeScript({target:{tabId, frameIds:[0]}, world:'ISOLATED',
          func:input => { globalThis.PAeroCollector.start(input); return true; }, args:[{id, options:{mode, hours:options.hours === true}}]});
      } catch (error) {
        const info = await R.stop(tabId, 'Ошибка запуска сборщика');
        await mutate(id, j => { j.status='error'; j.phase='done'; j.network=info || j.network; j.warnings.push(C.scrubString(error.message)); });
        throw error;
      }
    }
    return summary(await DB.get(id));
  } finally { starting.delete(tabId); }
}
async function interrupt(tabId, reason) {
  const job = await latest(tabId); if (!running(job)) return;
  const info = await R.stop(tabId, reason);
  await mutate(job.id, j => { if (!running(j)) return; j.status='interrupted'; j.phase='done'; j.finishedAt=Date.now(); j.network=info || j.network; j.warnings.push(reason + '; доступны последние сохранённые строки'); });
}
async function stop(tabId) {
  const job = await latest(tabId); if (!running(job)) return summary(job);
  if (job.mode !== 'record') {
    await mutate(job.id, j => { if (running(j)) j.status='stopping'; });
    try {
      const reply = await chrome.tabs.sendMessage(tabId,{type:'STOP_COLLECTOR',id:job.id}, {frameId:0});
      if (reply?.ok) return summary(await DB.get(job.id));
    } catch (_) {}
  }
  const info = await R.stop(tabId);
  await mutate(job.id,j => { j.status='stopped'; j.phase='done'; j.finishedAt=Date.now(); j.network=info || j.network; });
  return summary(await DB.get(job.id));
}
async function route(m, sender) {
  if (m.type === 'COLLECTOR_EVENT') {
    if (!sender.tab || sender.frameId !== 0) throw new Error('Неверный отправитель');
    const existing = await DB.get(m.id);
    if (!existing || sender.tab.id !== existing.tabId || !C.sameOrigin(sender.url, existing.origin)) throw new Error('Событие другого запуска/сайта');
    const job = await mutate(m.id, j => {
      if (!running(j)) return;
      const st = m.state || {};
      for (const key of ['phase','collected','expanded','processed','hoursErrors','updatedAt']) if (st[key] !== undefined) j[key] = st[key];
      j.warnings = [...new Set([...j.warnings,...(st.warnings || [])])].slice(0,100);
      if (Array.isArray(m.rows)) j.rows = m.rows.slice(0,5000);
      if (m.final) {
        j.status = ['completed','partial','error','stopped'].includes(st.status) ? st.status : 'error';
        if (j.status === 'completed' && j.warnings.length) j.status='partial';
        j.finishedAt=Date.now();
      }
    });
    if (m.final && !running(job)) {
      const info = await R.stop(job.tabId, 'Сбор завершён');
      await mutate(job.id,j => { j.network=info || j.network; });
      await autoExport(job.id);
    }
    return {saved:true};
  }
  // Page scripts cannot drive privileged commands. Only extension UI pages can.
  if (!sender.url?.startsWith(chrome.runtime.getURL(''))) throw new Error('Команда разрешена только интерфейсу расширения');
  if (m.type === 'PROBE') return (await probe(m.tabId)).diagnostic;
  if (m.type === 'START') return start(m.tabId, m.options || {});
  if (m.type === 'STOP') return stop(m.tabId);
  if (m.type === 'STATE') {
    let job = m.id ? await DB.get(m.id) : await latest(m.tabId);
    if (running(job) && job.mode !== 'record' && Date.now()-job.updatedAt > 15000 && !starting.has(job.tabId)) {
      let alive = false;
      try { const pong=await chrome.tabs.sendMessage(job.tabId,{type:'COLLECTOR_PING'}, {frameId:0}); alive=pong?.running && pong.id===job.id; } catch (_) {}
      if (!alive) { await interrupt(job.tabId,'Исполнитель больше не отвечает (вкладка или расширение перезапущены)'); job=await DB.get(job.id); }
    }
    if (running(job) && job.mode === 'record' && !R.stats(job.tabId)) {
      await interrupt(job.tabId,'Сессия записи прервана'); job=await DB.get(job.id);
    }
    return {job:summary(job), history:(await DB.list()).sort((a,b)=>b.startedAt-a.startedAt).slice(0,20).map(summary)};
  }
  if (m.type === 'EXPORT') {
    const job = await DB.get(m.id); if (!job) throw new Error('Нет сохранённого результата');
    if (m.format === 'csv') return {downloadId:await downloadText(C.toCsv(job.rows,job.status),'structure',job.id,'csv')};
    const data = C.scrub({...job, networkRecords:await DB.records(job.id), exportNotice:'Локальные рабочие данные. Маскирование не гарантирует обезличивание. Не публиковать без проверки.'});
    return {downloadId:await downloadText(JSON.stringify(data,null,2),'report',job.id,'json')};
  }
  if (m.type === 'EXPORT_DIAGNOSTIC') {
    const diagnostic = (await probe(m.tabId)).diagnostic;
    return {downloadId:await downloadText(JSON.stringify(C.scrub(diagnostic),null,2),'diagnostic',String(Date.now()),'json')};
  }
  if (m.type === 'CLEAR') {
    if ((await DB.list()).some(running) || starting.size) throw new Error('Сначала остановите активные операции');
    await DB.clear(); await chrome.storage.local.remove('lastJobId'); return {cleared:true};
  }
  throw new Error('Неизвестная команда');
}
chrome.runtime.onMessage.addListener((m,sender,reply) => {
  if (sender.id !== chrome.runtime.id || !m || typeof m.type !== 'string') return;
  route(m,sender).then(data=>reply({ok:true,data})).catch(error=>reply({ok:false,error:C.scrubString(error.message)}));
  return true;
});
chrome.tabs.onRemoved.addListener(tabId => { void interrupt(tabId,'Вкладка закрыта').catch(()=>{}); });
chrome.tabs.onUpdated.addListener((tabId,change) => {
  if (change.status === 'loading') void interrupt(tabId,'Страница перезагружена или начат переход').catch(()=>{});
});
chrome.runtime.onStartup.addListener(() => {
  void DB.list().then(async jobs => { for (const job of jobs.filter(running)) await mutate(job.id,j=>{
    j.status='interrupted'; j.phase='done'; j.finishedAt=Date.now(); j.warnings.push('Браузер перезапущен; автоматического возобновления нет');
  }); });
});
