(async () => {
  if (!window.globalResults || window.globalResults.size === 0) {
    console.error('❌ Ошибка: База структуры пуста. Сначала запустите Часть №1.');
    return;
  }

  console.time('⏳ Время работы сетевого пула');
  console.log('📡 Запуск пула воркеров... Сбор часов по активированным нодам страницы...');

  async function fetchProjectHours(projectUrl) {
    const failValues = { plan: '-', fact: '-', alloc: '-' };
    try {
      const payload = new URLSearchParams();
      payload.append('__EVENTTARGET', '');
      payload.append('__EVENTARGUMENT', '');
      payload.append('__LASTFOCUS', '');
      payload.append('__VIEWSTATE_KEY', window.viewStateKey);
      payload.append('__CONTROLLER_KEY', window.controllerKey);
      payload.append('__VIEWSTATE', '');
      payload.append('__VIEWSTATEENCRYPTED', '');
      payload.append('__CALLBACKID', 'ctl34$cbKeyMeasureWidgets');
      payload.append('__CALLBACKPARAM', 'c0:{"id":0,"result":{"data":"","parameter":""}}');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 секунд на запрос

      const response = await fetch(projectUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-MicrosoftAjax': 'Delta=true',
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': '*/*'
        },
        body: payload,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) return failValues;

      const resultText = await response.text();
      const markerIndex = resultText.indexOf('/*DX*/');
      if (markerIndex === -1) return failValues;

      const dxPayload = resultText.substring(markerIndex);
      let firstBrace = dxPayload.indexOf('{');
      let lastBrace = dxPayload.lastIndexOf('}');
      if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) return failValues;

      const cleanJsonString = dxPayload.substring(firstBrace, lastBrace + 1);

      let outerData = Function('return ' + cleanJsonString)();

      if (outerData && outerData.result && outerData.result.data) {
        // Распаковываем массив виджетов через Function для обхода одинарных кавычек
        const innerWidgets = Function('return ' + outerData.result.data)();

        let plan = '-', fact = '-', alloc = '-';
        
        if (Array.isArray(innerWidgets) && innerWidgets.length > 0) {
          // ИСПРАВЛЕНО: Читаем свойства объектов строго по индексам элементов массива
          if (innerWidgets.length >= 2) {
              const w1 = innerWidgets[0]; // Виджет "Списано в табель"
              const w2 = innerWidgets[1]; // Виджет "Распределено на задачи"
              
              fact = w1 && w1.Number1 !== undefined ? w1.Number1 : (w1 && w1.Text1 ? w1.Text1 : '-');
              plan = w1 && w1.Number2 !== undefined ? w1.Number2 : (w1 && w1.Text2 ? w1.Text2 : '-');
              alloc = w2 && w2.Number1 !== undefined ? w2.Number1 : (w2 && w2.Text1 ? w2.Text1 : '-');
          } else if (innerWidgets.length === 1) {
              const w0 = innerWidgets[0];
              fact = w0 && w0.Number1 !== undefined ? w0.Number1 : (w0 && w0.Text1 ? w0.Text1 : '-');
              plan = w0 && w0.Number2 !== undefined ? w0.Number2 : (w0 && w0.Text2 ? w0.Text2 : '-');
          }
        }
        return { plan, fact, alloc };
      }
    } catch (error) {
      return failValues;
    }
    return failValues;
  }

  const CONCURRENCY_LIMIT = 5; 
  const keys = Array.from(window.globalResults.keys());
  let currentIdx = 0;
  let processedCount = 0;
  const totalProjects = window.globalResults.size;

  async function worker() {
    while (currentIdx < keys.length) {
      const idx = currentIdx++;
      processedCount++;
      
      const uid = keys[idx];
      const project = window.globalResults.get(uid);
      
      const hours = await fetchProjectHours(project.link);
      
      project.planHours = hours.plan;
      project.factHours = hours.fact;
      project.allocatedHours = hours.alloc;
      window.globalResults.set(uid, project);

      if (processedCount % 10 === 0 || processedCount === totalProjects) {
        console.log(`[Пул воркеров] Обработано карточек: ${processedCount}/${totalProjects}`);
      }
    }
  }

  const pool = Array.from({ length: CONCURRENCY_LIMIT }, () => worker);
  await Promise.all(pool.map(w => w()));

  console.timeEnd('⏳ Время работы сетевого пула');
  console.log('🏁 Сбор завершен! Экспорт в CSV (UTF-8 + BOM)...');

  const headers = ["Уровень вложенности", "Код проекта", "Название проекта", "Ссылка", "Статус", "Приоритет", "Процент выполнения", "Руководитель", "Исполнитель", "План: Начало", "План: Окончание", "Факт: Начало", "Факт: Окончание", "План: Трудоемкость", "Списано в табель", "Распределено на задачи"];
  const csvRows = [headers.join(";")];

  window.globalResults.forEach(row => {
    csvRows.push([
      row.level, `"${row.code}"`, `"${row.name.replace(/"/g, '""')}"`, `"=ГИПЕРССЫЛКА(""${row.link}"";""ПроектЦентр"")"`,
      `"${row.status}"`, `"${row.priority}"`, `"${row.progress}"`, `"${row.manager}"`, `"${row.executor}"`,
      `"${row.planStart}"`, `"${row.planEnd}"`, `"${row.factStart}"`, `"${row.factEnd}"`,
      `"${row.planHours}"`, `"${row.factHours}"`, `"${row.allocatedHours}"`
    ].join(";"));
  });

  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'PROCENTR_TOTAL_ANALYTICS_TIME.csv';
  document.body.appendChild(a); a.click(); a.remove();
  
  console.log('🎉 ОТЧЕТ ВЫГРУЖЕН! Проверьте заполненные колонки часов в PROCENTR_TOTAL_ANALYTICS_TIME.csv');
})();
