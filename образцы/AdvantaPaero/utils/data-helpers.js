export function parseActiveParentMetadata(storageMap) {
  const parentUrl = window.location.href;
  const parentUid = parentUrl.match(/uid=([^&]+)/) ? parentUrl.match(/uid=([^&]+)/)[1] : 'PARENT_NODE';
  storageMap.set(parentUid, {
    level: -1, code: '0', name: (document.title || 'Родитель').replace(/[\r\n\t]/g, '').trim(), link: parentUrl,
    status: document.querySelector('.projectStatistics #ctl34_cpProgressBar_projectPercentBar')?.textContent.trim() || '-',
    priority: '-', progress: document.querySelector('.projectStatistics #ctl34_cpProgressBar_projectPercentLabel')?.textContent.trim() || '0%',
    manager: '-', executor: '-', planStart: '-', planEnd: '-', factStart: '-', factEnd: '-',
    planHours: '-', factHours: '-', allocatedHours: '-'
  });
  return parentUid;
}

export function parseActiveScreenHours() {
  const sписано = document.querySelector('[data-widgetid="cc8a35f0-e2d9-4e91-99c8-6bc061b6c377"]');
  const распред = document.querySelector('[data-widgetid="d67821dd-8739-494e-b638-c0d6a58e5388"]');
  return {
    fact: sписано ? sписано.querySelector('.number1')?.textContent.trim() : '-',
    plan: sписано ? sписано.querySelector('.number2')?.textContent.trim() : '-',
    alloc: распред ? распред.querySelector('.number1')?.textContent.trim() : '-'
  };
}

export function generateAndDownloadCsvFile(storageMap, filename) {
  const headers = ["Уровень вложенности", "Код проекта", "Название проекта", "Ссылка", "Статус", "Приоритет", "Процент выполнения", "Руководитель", "Исполнитель", "План: Начало", "План: Окончание", "Факт: Начало", "Факт: Окончание", "План: Трудоемкость", "Списано в табель", "Распределено на задачи"];
  const csvRows = [headers.join(";")];
  
  storageMap.forEach(row => {
    csvRows.push([row.level, `"${row.code}"`, `"${row.name.replace(/"/g, '""')}"`, `"=ГИПЕРССЫЛКА(""${row.link}"";""ПроектЦентр"")"`, `"${row.status}"`, `"${row.priority}"`, `"${row.progress}"`, `"${row.manager}"`, `"${row.executor}"`, `"${row.planStart}"`, `"${row.planEnd}"`, `"${row.factStart}"`, `"${row.factEnd}"`, `"${row.planHours}"`, `"${row.factHours}"`, `"${row.allocatedHours}"`].join(";"));
  });

  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
}
