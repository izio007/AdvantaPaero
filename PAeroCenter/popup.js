'use strict';
const $ = id => document.getElementById(id);
let tabId, currentId = null, selectedId = null, refreshing = false, actionBusy = false;
const statuses = {running:'Сбор выполняется', recording:'Идёт запись обмена', stopping:'Останавливается…',
  completed:'Сбор завершён', partial:'Завершено с замечаниями', error:'Ошибка / частичный результат',
  stopped:'Остановлено', interrupted:'Прервано'};
const phases = {structure:'Сбор и раскрытие дерева', hours:'Запрос показателей трудозатрат', network:'Пассивная запись XHR/Fetch', done:'Операция завершена'};
async function api(type, extra = {}) {
  const response = await chrome.runtime.sendMessage({type, tabId, ...extra});
  if (!response?.ok) throw new Error(response?.error || 'Нет ответа от движка'); return response.data;
}
function notice(text, success = false) {
  $('message').textContent=text; $('message').hidden=!text; $('message').classList.toggle('success',success);
}
async function refresh() {
  if (refreshing || tabId == null) return; refreshing=true;
  try {
    const data = await api('STATE',selectedId ? {id:selectedId} : {}), job=data.job;
    currentId=job?.id || null;
    const busy=job && ['running','recording','stopping'].includes(job.status);
    $('status').textContent=job ? statuses[job.status] || job.status : 'Готов к запуску';
    $('rows').textContent=job?.collected || 0; $('processed').textContent=job?.processed || 0; $('requests').textContent=job?.network?.count || 0;
    $('phase').textContent=job ? [phases[job.phase] || '', job.hoursErrors ? `Ошибок часов: ${job.hoursErrors}` : '', job.network?.reason || ''].filter(Boolean).join(' · ') : 'Откройте страницу со структурой проекта в ADVANTA.';
    const warnings=[...(job?.warnings || [])];
    if (job?.network?.errors) warnings.push(`Ошибок сетевого журнала: ${job.network.errors}`);
    if (job?.network?.omitted) warnings.push(`Ответов без сохранённого тела: ${job.network.omitted} (формат/размер/доступность)`);
    $('warnings').textContent=warnings.join('\n'); $('warnings').hidden=!warnings.length;
    for (const id of ['start','screen','recordOnly']) $(id).disabled=Boolean(busy || actionBusy);
    $('stop').disabled=!busy || job.tabId !== tabId || actionBusy;
    $('csv').disabled=!job?.collected; $('json').disabled=!job;
    const select=$('history'), value=selectedId || '';
    const keys=data.history.map(j=>j.id).join(',');
    if (select.dataset.keys !== keys) {
      select.replaceChildren(new Option('Текущая вкладка / последний запуск',''));
      for (const j of data.history) select.add(new Option(`${new Date(j.startedAt).toLocaleString('ru-RU')} · ${statuses[j.status] || j.status} · ${j.collected} строк`,j.id));
      select.dataset.keys=keys;
    }
    select.value=value;
  } catch(error) { notice(error.message); }
  finally { refreshing=false; }
}
async function action(fn) {
  if (actionBusy) return; actionBusy=true; notice('');
  try { await fn(); } catch(error) { notice(error.message); }
  finally { actionBusy=false; await refresh(); }
}
function options(mode) { return {mode, hours:$('hours').checked, record:$('record').checked, autoCsv:$('autoCsv').checked}; }
for (const [id,mode] of [['start','full'],['screen','screen'],['recordOnly','record']]) {
  $(id).addEventListener('click',()=>action(async()=>{
    selectedId=null; await api('START',{options:options(mode)});
  }));
}
$('stop').addEventListener('click',()=>action(()=>api('STOP')));
$('csv').addEventListener('click',()=>action(async()=>{await api('EXPORT',{id:currentId,format:'csv'});notice('CSV передан в загрузки Chrome.',true);}));
$('json').addEventListener('click',()=>action(async()=>{await api('EXPORT',{id:currentId,format:'json'});notice('JSON передан в загрузки Chrome. Это рабочие данные, не публичный файл.',true);}));
$('probe').addEventListener('click',()=>action(async()=>{
  const d=await api('PROBE'); $('diagnostic').hidden=false;
  $('diagnostic').textContent=`ADVANTA распознана: ${d.supported ? 'да' : 'нет'}\nДерево: ${d.tree ? 'да' : 'нет'}\nСтроки сейчас в DOM: ${d.visibleRows}\nКнопки раскрытия: ${d.expandButtons}\nКлюч состояния: ${d.viewStatePresent ? 'есть' : 'нет'}\nКлюч контроллера: ${d.controllerPresent ? 'есть' : 'нет'}\nCallback: ${d.callbackId}`;
}));
$('diagFile').addEventListener('click',()=>action(async()=>{await api('EXPORT_DIAGNOSTIC');notice('Диагностика передана в загрузки Chrome.',true);}));
$('clear').addEventListener('click',()=>action(async()=>{
  if (!confirm('Удалить ВСЕ результаты и сетевые журналы PAeroCenter из этого браузера? Скачанные файлы и исходники не затрагиваются.')) return;
  await api('CLEAR'); selectedId=null;
}));
$('history').addEventListener('change',()=>{selectedId=$('history').value || null; void refresh();});
(async()=>{
  try {
    const params=new URL(location.href).searchParams;
    // Supports an extension UI tab as well as the normal action popup.
    if (params.has('tab')) tabId=Number(params.get('tab'));
    else { const [tab]=await chrome.tabs.query({active:true,currentWindow:true}); tabId=tab?.id; }
    if (!Number.isInteger(tabId)) throw new Error('Не удалось определить рабочую вкладку');
    const tab=await chrome.tabs.get(tabId);
    $('target').textContent=tab.url ? new URL(tab.url).origin : 'Выбранная вкладка';
    await refresh(); setInterval(()=>{void refresh();},1000);
  } catch(error) { notice(error.message); }
})();
