/* Page adapter. Injected only into the explicitly selected tab, in ISOLATED world.
 * UI may close; this controller, timers and AbortController stay with the page.
 */
(() => {
  'use strict';
  if (globalThis.PAeroCollector) return;
  const C = globalThis.PAeroCore;
  const S = {
    root: 'project-tree', row: '[class*="_treeItem_"]', content: '[class*="_treeItemContent_"]',
    link: '[class*="_projectLink_"]', scroll: '[class*="_projectsListWrapper_"]',
    code: '[class*="_projectCode_"], [class*="_projectNumber_"]',
    status: '.ui-status__list-item-text', priority: '[class*="_priority_item_"]',
    dates: '[class*="_date_"]', users: '[class*="_userName_"]',
    expand: 'img[src*="plusGray"], [aria-expanded="false"][role="button"]'
  };
  let active = null;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const txt = node => node?.textContent?.replace(/\s+/g, ' ').trim() || null;
  const visible = node => Boolean(node && node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
  const compact = value => typeof value === 'string' ? value.slice(0, 4000) : value;
  function inspect() {
    const root = document.querySelector(S.root);
    return {version: C.VERSION, supported: Boolean(root || document.getElementById('__CONTROLLER_KEY')),
      url: C.safeUrl(location.href), title: document.title.slice(0, 200), tree: Boolean(root),
      visibleRows: root?.querySelectorAll(S.row).length || 0,
      expandButtons: root?.querySelectorAll(S.expand).length || 0,
      viewStatePresent: Boolean(document.getElementById('__VIEWSTATE_KEY')?.value),
      controllerPresent: Boolean(document.getElementById('__CONTROLLER_KEY')?.value),
      callbackId: 'ctl34$cbKeyMeasureWidgets', busy: Boolean(active), selectors: S};
  }
  function check(job) {
    if (job.stop) throw new Error('Остановлено пользователем');
    if (location.href !== job.url) throw new Error('Страница изменилась; сбор остановлен');
    if (Date.now() - job.started > job.options.maxMinutes * 60000) throw new Error('Достигнут лимит времени; сохранён частичный результат');
  }
  function warn(job, message) {
    message = C.scrubString(String(message)).slice(0, 400);
    if (!job.warnings.includes(message) && job.warnings.length < 100) job.warnings.push(message);
  }
  function orderedRows(job) {
    const result = C.orderRows([...job.rows.values()], job.edges);
    if (result.cycle) warn(job, 'Порядок строк менялся во время сбора; иерархический порядок восстановлен частично');
    return result.rows;
  }
  async function send(job, final = false) {
    const includeRows = final || Date.now() - job.lastCheckpoint > 4000;
    const rows = includeRows ? orderedRows(job) : undefined;
    const state = {phase: job.phase, status: job.status, collected: job.rows.size,
      expanded: job.expanded, processed: job.processed, hoursErrors: job.hoursErrors,
      warnings: [...job.warnings], updatedAt: Date.now()};
    if (includeRows) job.lastCheckpoint = Date.now();
    try {
      const answer = await chrome.runtime.sendMessage({type: 'COLLECTOR_EVENT', id: job.id, state,
        rows, final});
      if (!answer?.ok) throw new Error(answer?.error || 'Движок не подтвердил сохранение');
    } catch (error) {
      // A local result is retained in this isolated world for recovery, never posted to the page.
      warn(job, `Не удалось сохранить checkpoint: ${error.message}`);
      if (final) console.error('[PAeroCenter] Результат остался в памяти вкладки; откройте расширение и сохраните повторно.');
    }
  }
  function put(job, row) {
    if (!row.uid) return;
    if (!job.rows.has(row.uid) && job.rows.size >= job.options.maxNodes) {
      warn(job, `Лимит ${job.options.maxNodes} строк: результат может быть неполным`); return;
    }
    const prev = job.rows.get(row.uid);
    if (prev) { for (const [k, v] of Object.entries(row)) if (v != null && v !== '') prev[k] = compact(v); }
    else job.rows.set(row.uid, {...row, hoursStatus: 'not-requested', planHours: null, factHours: null, allocatedHours: null, error: ''});
  }
  function projectLink(raw, job) {
    try {
      const url = new URL(raw, job.url);
      if (!C.sameOrigin(url.href, job.origin)) return null;
      const uid = url.searchParams.get('uid');
      if (!uid) return null;
      return {uid, link: C.safeUrl(url.href)};
    } catch (_) { return null; }
  }
  function collectScreen(job) {
    const root = document.querySelector(S.root);
    if (!root) return;
    let previous = null;
    for (const item of root.querySelectorAll(S.row)) {
      const box = item.querySelector(S.content) || item;
      const link = box.querySelector(S.link), identity = projectLink(link?.getAttribute('href'), job);
      if (!identity || !txt(link)) continue;
      // Keep ordering constraints across virtualized windows. New children must be
      // exported between their parent and the next sibling, not at the end of a Map.
      if (previous && previous !== identity.uid) {
        if (!job.edges.has(previous)) job.edges.set(previous, new Set());
        job.edges.get(previous).add(identity.uid);
      }
      previous = identity.uid;
      const users = box.querySelectorAll(S.users), dates = box.querySelectorAll(S.dates);
      const progress = [...box.querySelectorAll('[class*="_wrapper_"], [class*="progress"], [role="progressbar"]')]
        .map(el => txt(el)).find(t => t && /^\d+(?:[.,]\d+)?\s*%$/.test(t));
      const ariaLevel = Number(item.getAttribute('aria-level'));
      // Indentation divisor retained from the user's sample; not a server hierarchy key.
      const level = ariaLevel > 0 ? ariaLevel - 1 : Math.round((parseFloat(item.style.marginLeft || '0') || 0) / 26);
      put(job, {...identity, level, code: txt(box.querySelector(S.code)), name: compact(txt(link)),
        status: txt(box.querySelector(S.status)), priority: box.querySelector(S.priority)?.getAttribute('title')?.replace(/^Приоритет:\s*/, '') || null,
        progress: progress || null, manager: txt(users[0]), executor: txt(users[1]),
        planStart: txt(dates[0]), planEnd: txt(dates[1]), factStart: txt(dates[2]), factEnd: txt(dates[3]),
        source: 'dom', levelSource: ariaLevel > 0 ? 'aria-level' : 'indentation-26px'});
    }
  }
  function collectParent(job) {
    const identity = projectLink(job.url, job); if (!identity) return;
    put(job, {...identity, level: -1, code: null, name: document.title.trim(), source: 'active-page',
      status: txt(document.querySelector('#ctl34_cpProgressBar_projectPercentBar')),
      progress: txt(document.querySelector('#ctl34_cpProgressBar_projectPercentLabel'))});
  }
  function scrollElement(root) {
    const explicit = root.querySelector(S.scroll);
    if (explicit && explicit.scrollHeight > explicit.clientHeight + 2) return explicit;
    for (let el = explicit || root; el && el !== document.body; el = el.parentElement) {
      if (el.clientHeight > 0 && el.scrollHeight > el.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)) return el;
    }
    return document.scrollingElement;
  }
  async function settle(job, root, min = 300, max = 1600) {
    const start = Date.now(); let changed = start;
    const observer = new MutationObserver(() => { changed = Date.now(); collectScreen(job); });
    observer.observe(root, {subtree: true, childList: true, attributes: true});
    try {
      do { await sleep(100); check(job); }
      while (Date.now() - start < max && (Date.now() - start < min || Date.now() - changed < 250 || root.querySelector('[aria-busy="true"]')));
    } finally { observer.disconnect(); }
  }
  async function walk(job) {
    const root = document.querySelector(S.root);
    if (!root) { warn(job, 'Дерево project-tree не найдено: собрана только текущая карточка'); return; }
    const scroll = scrollElement(root), attempts = new Map();
    scroll.scrollTop = 0; await settle(job, root);
    const observer = new MutationObserver(() => collectScreen(job));
    observer.observe(root, {childList: true, subtree: true});
    let stable = 0, lastSize = -1;
    try {
      for (;;) {
        check(job); if (!root.isConnected) throw new Error('Дерево удалено со страницы');
        collectScreen(job);
        if (job.rows.size >= job.options.maxNodes) { warn(job, 'Сканирование остановлено по лимиту строк'); break; }
        let button = null, key = null;
        for (const el of root.querySelectorAll(S.expand)) {
          if (!visible(el)) continue;
          const row = el.closest(S.row);
          const identity = projectLink(row?.querySelector(S.link)?.getAttribute('href'), job);
          const id = identity?.uid; if (!id) continue; // never click an unidentified control
          if ((attempts.get(id) || 0) < 3) { button = el; key = id; break; }
        }
        if (button) {
          attempts.set(key, (attempts.get(key) || 0) + 1);
          button.scrollIntoView({block: 'nearest'});
          await sleep(100); check(job);
          for (const type of ['mousedown', 'mouseup', 'click']) button.dispatchEvent(new MouseEvent(type, {bubbles:true, cancelable:true, view:window, button:0, buttons:type === 'mousedown' ? 1 : 0}));
          job.expanded++; await settle(job, root, 650, 5000); collectScreen(job); stable = 0;
        } else {
          const before = scroll.scrollTop;
          scroll.scrollTop = before + Math.max(100, Math.floor((scroll.clientHeight || innerHeight) * 0.65));
          await settle(job, root, 350, 1600); collectScreen(job);
          const atBottom = scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 3;
          if (atBottom && Math.abs(scroll.scrollTop - before) < 2 && lastSize === job.rows.size) stable++;
          else stable = 0;
          lastSize = job.rows.size;
          if (stable >= 6) break;
        }
        if (Date.now() - job.lastUpdate > 1000) { job.lastUpdate = Date.now(); await send(job); }
      }
      for (const [id, n] of attempts) if (n >= 3) warn(job, `Ветвь ${id}: три попытки раскрытия; проверьте полноту`);
    } finally { observer.disconnect(); }
  }
  async function request(job, url, options = {}) {
    check(job);
    if (!C.sameOrigin(url, job.origin)) throw new Error('Запрос за пределы выбранного origin заблокирован');
    const controller = new AbortController(); job.controllers.add(controller);
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(url, {...options, signal: controller.signal, credentials: 'same-origin', redirect: 'error', cache: 'no-store'});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const limit = 2 * 1024 * 1024;
      if (Number(response.headers.get('content-length')) > limit) throw new Error('Ответ больше 2 МиБ');
      // Bound decoded data too, including compressed/chunked responses.
      const reader = response.body.getReader(), decoder = new TextDecoder();
      let text = '', size = 0;
      for (;;) {
        const {value, done} = await reader.read(); if (done) break;
        size += value.length; if (size > limit) { await reader.cancel(); throw new Error('Ответ больше 2 МиБ'); }
        text += decoder.decode(value, {stream: true}); check(job);
      }
      return text + decoder.decode();
    } catch (error) {
      if (job.stop) throw new Error('Остановлено пользователем');
      if (error.name === 'AbortError') throw new Error('Тайм-аут запроса 20 секунд');
      throw error;
    } finally { clearTimeout(timer); job.controllers.delete(controller); }
  }
  function keysFrom(doc) {
    const read = id => doc.getElementById(id)?.value || '';
    const keys = {view: read('__VIEWSTATE_KEY'), controller: read('__CONTROLLER_KEY'), validation: read('__EVENTVALIDATION')};
    if (!keys.view || !keys.controller) throw new Error('Не найдены ключи состояния карточки (возможна страница входа)');
    return keys;
  }
  async function hours(job, row) {
    // Never reuse the parent's state keys for a different card.
    const currentUid = new URL(job.url).searchParams.get('uid');
    let keys;
    if (row.uid === currentUid) keys = keysFrom(document);
    else {
      const html = await request(job, row.link);
      const doc = new DOMParser().parseFromString(html, 'text/html');
      keys = keysFrom(doc);
    }
    const payload = new URLSearchParams({
      __EVENTTARGET:'', __EVENTARGUMENT:'', __LASTFOCUS:'', __VIEWSTATE_KEY:keys.view,
      __CONTROLLER_KEY:keys.controller, __VIEWSTATE:'', __VIEWSTATEENCRYPTED:'',
      __CALLBACKID:'ctl34$cbKeyMeasureWidgets',
      __CALLBACKPARAM:'c0:{"id":0,"result":{"data":"","parameter":""}}'
    });
    if (keys.validation) payload.set('__EVENTVALIDATION', keys.validation);
    const text = await request(job, row.link, {method:'POST', headers:{
      'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8',
      'X-MicrosoftAjax':'Delta=true', 'X-Requested-With':'XMLHttpRequest', 'Accept':'*/*'
    }, body: payload});
    return C.hoursFromWidgets(C.unpackWidgets(text));
  }
  async function run(job) {
    let pulse;
    try {
      pulse = setInterval(() => { void send(job); }, 5000);
      collectParent(job); collectScreen(job); await send(job);
      if (job.options.mode === 'full') await walk(job);
      if (!job.rows.size) throw new Error('Не удалось распознать строки. Нажмите «Проверить страницу»');
      if (job.options.hours) {
        job.phase = 'hours'; await send(job);
        const rows = [...job.rows.values()]; let consecutiveErrors = 0;
        for (const row of rows) {
          check(job);
          if (job.processed >= job.options.maxHours) { warn(job, `Лимит ${job.options.maxHours} карточек с часами: оставшиеся не запрошены`); break; }
          try {
            const h = await hours(job, row);
            row.planHours = h.plan; row.factHours = h.fact; row.allocatedHours = h.alloc;
            row.hoursStatus = h.mapping === 'widget-id' ? 'widget-id' : 'positional-unverified';
            if (h.mapping !== 'widget-id') warn(job, 'Часть часов сопоставлена по порядку виджетов из старого образца; нужна сверка с экраном');
            consecutiveErrors = 0;
          } catch (error) {
            check(job); row.hoursStatus = 'error'; row.error = C.scrubString(error.message).slice(0, 300);
            job.hoursErrors++; consecutiveErrors++;
            if (consecutiveErrors >= 3) { warn(job, 'Три ошибки часов подряд: сетевой сбор остановлен, структура сохранена'); job.processed++; break; }
          }
          job.processed++; await send(job); await sleep(job.options.delayMs);
        }
      }
      orderedRows(job);
      job.status = job.warnings.length || job.hoursErrors ? 'partial' : 'completed'; job.phase = 'done';
    } catch (error) {
      job.status = job.stop ? 'stopped' : 'error'; job.phase = 'done'; warn(job, error.message);
    } finally {
      clearInterval(pulse); await send(job, true); active = null; globalThis.PAeroCollector.last = job;
    }
  }
  function start(input) {
    if (active) throw new Error('В этой вкладке уже идёт сбор');
    const diag = inspect(); if (!diag.supported) throw new Error('Не распознана страница ADVANTA');
    const options = {mode: input.options?.mode === 'screen' ? 'screen' : 'full', hours: input.options?.hours === true,
      maxNodes: 5000, maxHours: 1000, maxMinutes: 30, delayMs: 600};
    const job = {id: input.id, options, url: location.href, origin: location.origin, started: Date.now(),
      phase: 'structure', status: 'running', rows: new Map(), edges: new Map(), warnings: [], expanded: 0, processed: 0,
      hoursErrors: 0, lastUpdate: 0, lastCheckpoint: 0, controllers: new Set(), stop: false};
    active = job; void run(job); return {started: true, id: job.id};
  }
  function stop(id) {
    if (active && (!id || active.id === id)) { active.stop = true; for (const controller of active.controllers) controller.abort(); return true; }
    return false;
  }
  globalThis.PAeroCollector = {start, stop, inspect, last: null, status: () => active ? {id:active.id, running:true} : {running:false}};
  chrome.runtime.onMessage.addListener((m, sender, reply) => {
    if (sender.id !== chrome.runtime.id) return;
    if (m.type === 'STOP_COLLECTOR') { reply({ok:stop(m.id)}); return; }
    if (m.type === 'COLLECTOR_PING') { reply(globalThis.PAeroCollector.status()); return; }
    if (m.type === 'RECOVER_COLLECTOR' && globalThis.PAeroCollector.last?.id === m.id) {
      send(globalThis.PAeroCollector.last, true).then(() => reply({ok:true})); return true;
    }
  });
})();
