/* Shared, dependency-free data layer. Loaded as a classic script, not an ES module.
 * No eval, Function, remote scripts or runtime package downloads.
 */
(() => {
  'use strict';
  if (globalThis.PAeroCore) return;
  const VERSION = '2.0.0';
  const SECRET = /password|passwd|pwd|secret|token|cookie|authorization|credential|session|viewstate|controller|csrf|xsrf|eventvalidation|api[_-]?key|private[_-]?key|signature|ticket/i;
  const MASK = '[REDACTED]';

  // Restricted data-literal parser for DevExpress responses that are not valid JSON.
  // Supports objects, arrays, strings (single/double quotes), finite numbers,
  // booleans, null, comments and trailing commas. Executable expressions are rejected.
  function parseLiteral(input, prefix = false) {
    if (typeof input !== 'string' || input.length > 2 * 1024 * 1024) throw new Error('Размер/тип пакета не поддерживается');
    let pos = 0, count = 0;
    const bad = () => { throw new Error(`Неподдерживаемый формат данных: позиция ${pos}`); };
    const ws = () => {
      for (;;) {
        while (/\s/.test(input[pos] || '') && pos < input.length) pos++;
        if (input.slice(pos, pos + 2) === '//') { const e = input.indexOf('\n', pos + 2); pos = e < 0 ? input.length : e + 1; }
        else if (input.slice(pos, pos + 2) === '/*') { const e = input.indexOf('*/', pos + 2); if (e < 0) bad(); pos = e + 2; }
        else return;
      }
    };
    function string() {
      const quote = input[pos++]; let value = '';
      while (pos < input.length) {
        let c = input[pos++];
        if (c === quote) return value;
        if (c === '\n' || c === '\r') bad();
        if (c !== '\\') { value += c; continue; }
        c = input[pos++];
        const escaped = {n:'\n', r:'\r', t:'\t', b:'\b', f:'\f', v:'\v', '\\':'\\', "'":"'", '"':'"', '/':'/'};
        if (Object.hasOwn(escaped, c)) value += escaped[c];
        else if (c === 'u' || c === 'x') {
          const size = c === 'u' ? 4 : 2, hex = input.slice(pos, pos + size);
          if (hex.length !== size || !/^[\da-f]+$/i.test(hex)) bad();
          value += String.fromCharCode(parseInt(hex, 16)); pos += size;
        } else if (c === '\n') { /* escaped line continuation */ }
        else if (c === '\r') { if (input[pos] === '\n') pos++; }
        else if (c === '0' && !/\d/.test(input[pos] || '')) value += '\0';
        else bad();
      }
      bad();
    }
    function value(depth = 0) {
      if (depth > 64 || ++count > 100000) throw new Error('Слишком сложный пакет');
      ws(); const c = input[pos];
      if (c === '"' || c === "'") return string();
      if (c === '[') {
        pos++; ws(); const out = [];
        if (input[pos] === ']') { pos++; return out; }
        for (;;) {
          out.push(value(depth + 1)); ws();
          if (input[pos] === ']') { pos++; return out; }
          if (input[pos++] !== ',') bad(); ws();
          if (input[pos] === ']') { pos++; return out; }
        }
      }
      if (c === '{') {
        pos++; ws(); const out = Object.create(null);
        if (input[pos] === '}') { pos++; return out; }
        for (;;) {
          ws(); let key;
          if (input[pos] === '"' || input[pos] === "'") key = string();
          else {
            const m = /^[A-Za-z_$][\w$]*/.exec(input.slice(pos)); if (!m) bad();
            key = m[0]; pos += key.length;
          }
          if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Запрещённое имя поля');
          ws(); if (input[pos++] !== ':') bad();
          out[key] = value(depth + 1); ws();
          if (input[pos] === '}') { pos++; return out; }
          if (input[pos++] !== ',') bad(); ws();
          if (input[pos] === '}') { pos++; return out; }
        }
      }
      const rest = input.slice(pos);
      for (const [word, v] of [['true', true], ['false', false], ['null', null]]) {
        if (rest.startsWith(word) && !/[\w$]/.test(rest[word.length] || '')) { pos += word.length; return v; }
      }
      const n = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(rest);
      if (n) { pos += n[0].length; const number = Number(n[0]); if (!Number.isFinite(number)) bad(); return number; }
      bad();
    }
    const result = value(); ws();
    if (!prefix && pos !== input.length) bad();
    return result;
  }
  function parseDX(text) {
    if (typeof text !== 'string') throw new Error('Пустой ответ ADVANTA');
    const marker = text.indexOf('/*DX*/');
    if (marker < 0) throw new Error('В ответе нет маркера /*DX*/ (проверьте вход и callback)');
    const start = text.indexOf('{', marker + 6);
    if (start < 0) throw new Error('Не найден объект callback');
    // Some DevExpress versions append non-data framing. Only the first value is read.
    return parseLiteral(text.slice(start), true);
  }
  function unpackWidgets(text) {
    const outer = parseDX(text);
    let widgets = outer?.result?.data;
    if (typeof widgets === 'string') widgets = parseLiteral(widgets);
    if (!Array.isArray(widgets) || !widgets.length || widgets.some(w => !w || typeof w !== 'object')) {
      throw new Error('Ответ callback не содержит ожидаемый массив виджетов');
    }
    return widgets;
  }
  const HOURS_ID = 'cc8a35f0-e2d9-4e91-99c8-6bc061b6c377';
  const ALLOC_ID = 'd67821dd-8739-494e-b638-c0d6a58e5388';
  function hoursFromWidgets(widgets) {
    const identity = w => String(w.WidgetId ?? w.WidgetID ?? w.widgetId ?? w.Id ?? w.ID ?? w.id ?? '').toLowerCase();
    const knownHours = widgets.find(w => identity(w) === HOURS_ID);
    const knownAlloc = widgets.find(w => identity(w) === ALLOC_ID);
    const first = knownHours || widgets[0];
    const second = knownAlloc || (!knownHours ? widgets[1] : null);
    const read = (o, n, t) => { const v = o?.[n] ?? o?.[t]; return typeof v === 'number' || typeof v === 'string' ? v : null; };
    const fact = read(first, 'Number1', 'Text1'), plan = read(first, 'Number2', 'Text2');
    const alloc = read(second, 'Number1', 'Text1');
    if (plan == null && fact == null && alloc == null) throw new Error('В виджетах нет полей Number1/Number2/Text1/Text2');
    return {plan, fact, alloc, mapping: knownHours && (!second || knownAlloc) ? 'widget-id' : 'positional-unverified'};
  }
  function scrubString(text) {
    return String(text)
      .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9+/_.=\-]+/gi, MASK)
      .replace(/\beyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\b/g, MASK)
      .replace(/((?:token|password|secret|sessionid|api[_-]?key|__VIEWSTATE_KEY|__CONTROLLER_KEY)\s*[=:]\s*)[^\s&;"'<>]+/gi, `$1${MASK}`);
  }
  function scrub(value, depth = 0) {
    if (depth > 32) return '[DEPTH LIMIT]';
    if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
    if (typeof value === 'string') {
      if (value.length > 512 * 1024) return '[LARGE STRING OMITTED]';
      const t = value.trim();
      // Unpack serialized structures BEFORE masking. Handles result.data and nested JSON.
      if ((t[0] === '{' || t[0] === '[') && t.length > 1) {
        try { return JSON.stringify(scrub(parseLiteral(t), depth + 1)); } catch (_) { return '[UNPARSED STRUCTURED STRING OMITTED]'; }
      }
      if (/^https?:\/\//i.test(t)) return safeUrl(t);
      return scrubString(value);
    }
    if (Array.isArray(value)) return value.map(v => scrub(v, depth + 1));
    if (typeof value === 'object') {
      const out = Object.create(null);
      for (const [key, v] of Object.entries(value)) out[key] = SECRET.test(key) && typeof v !== 'boolean' ? MASK : scrub(v, depth + 1);
      return out;
    }
    return null;
  }
  function safeUrl(raw, base) {
    try {
      const u = new URL(raw, base); if (!/^https?:$/.test(u.protocol)) return '[NON-HTTP URL]';
      u.username = ''; u.password = ''; u.hash = '';
      for (const key of [...u.searchParams.keys()]) if (SECRET.test(key) || /^key$/i.test(key)) u.searchParams.set(key, MASK);
      return u.href;
    } catch (_) { return '[INVALID URL]'; }
  }
  function sameOrigin(raw, origin) {
    try { const u = new URL(raw, origin); return /^https?:$/.test(u.protocol) && u.origin === origin && !u.username && !u.password; }
    catch (_) { return false; }
  }
  function safeBody(text, mime = '') {
    if (typeof text !== 'string' || !text) return {format: 'empty', data: null};
    if (text.length > 512 * 1024) return {format: 'omitted', reason: 'Тело больше 512 КиБ'};
    try {
      if (text.includes('/*DX*/')) return {format: 'devexpress-data', data: scrub(parseDX(text))};
      if (/json/i.test(mime) || /^[\s]*[\[{]/.test(text)) return {format: 'data', data: scrub(parseLiteral(text))};
      if (/application\/x-www-form-urlencoded/i.test(mime)) {
        const out = Object.create(null);
        for (const [key, value] of new URLSearchParams(text)) {
          const v = SECRET.test(key) ? MASK : scrub(value);
          if (!Object.hasOwn(out, key)) out[key] = v;
          else out[key] = Array.isArray(out[key]) ? [...out[key], v] : [out[key], v];
        }
        return {format: 'form', data: out};
      }
    } catch (_) { return {format: 'omitted', reason: 'Формат не разобран безопасно; исходное тело не сохранено'}; }
    return {format: 'omitted', reason: 'HTML, произвольный текст и бинарные тела не сохраняются'};
  }
  function safeHeaders(headers = {}) {
    const out = Object.create(null);
    for (const [key, value] of Object.entries(headers)) {
      if (/^(content-type|content-length|accept|x-requested-with|x-microsoftajax)$/i.test(key)) out[key.toLowerCase()] = scrubString(value).slice(0, 500);
    }
    return out;
  }
  const columns = [
    ['level','Уровень вложенности'], ['code','Код проекта'], ['name','Название проекта'], ['link','Ссылка'],
    ['status','Статус'], ['priority','Приоритет'], ['progress','Процент выполнения'], ['manager','Руководитель'],
    ['executor','Исполнитель'], ['planStart','План: Начало'], ['planEnd','План: Окончание'],
    ['factStart','Факт: Начало'], ['factEnd','Факт: Окончание'], ['planHours','План: Трудоемкость'],
    ['factHours','Списано в табель'], ['allocatedHours','Распределено на задачи'], ['uid','UID'],
    ['hoursStatus','Достоверность/статус часов'], ['error','Ошибка'], ['runStatus','Статус запуска']
  ];
  function csvCell(v) {
    if (v == null) return '""';
    let s = String(v);
    // Never turn server-controlled cells into formulas. URLs stay plain text.
    if (typeof v !== 'number' && /^[\s\uFEFF]*[=+\-@]/u.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function toCsv(rows, runStatus = '') {
    return '\uFEFF' + [columns.map(c => csvCell(c[1])).join(';'), ...rows.map(row => columns.map(([key]) => csvCell(key === 'runStatus' ? runStatus : row[key])).join(';'))].join('\r\n');
  }
  function orderRows(rows, edges) {
    const byId = new Map(rows.map(r => [r.uid, r]));
    const degree = new Map(rows.map(r => [r.uid, 0]));
    const next = new Map();
    for (const [from, toList] of edges) {
      if (!byId.has(from)) continue;
      const targets = [...new Set(toList)].filter(to => to !== from && byId.has(to));
      next.set(from, targets);
      for (const to of targets) degree.set(to, degree.get(to) + 1);
    }
    const ready = rows.filter(r => degree.get(r.uid) === 0).map(r => r.uid), out = [], visited = new Set();
    for (let i = 0; i < ready.length; i++) {
      const id = ready[i]; visited.add(id); out.push(byId.get(id));
      for (const to of next.get(id) || []) {
        degree.set(to, degree.get(to) - 1); if (degree.get(to) === 0) ready.push(to);
      }
    }
    const cycle = out.length !== rows.length;
    if (cycle) for (const row of rows) if (!visited.has(row.uid)) out.push(row);
    return {rows: out, cycle};
  }
  const api = {VERSION, parseLiteral, parseDX, unpackWidgets, hoursFromWidgets, HOURS_ID, ALLOC_ID,
    scrub, scrubString, safeUrl, sameOrigin, safeBody, safeHeaders, toCsv, csvCell, orderRows};
  globalThis.PAeroCore = Object.freeze(api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
