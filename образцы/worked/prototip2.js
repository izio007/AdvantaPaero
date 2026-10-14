(async () => {
  if (!window.globalResults || window.globalResults.size === 0) {
    console.error('❌ Ошибка: База структуры пуста. Сначала запустите Часть №1.');
    return;
  }

  console.time('⏳ Чистое время сбора по реалистичной модели');
  console.log('📡 Запуск промышленного конвейера... Модель: 750мс на батч из 4 нод...');

  async function fetchHoursFromRawHtml(projectUrl) {
    const failValues = { plan: '-', fact: '-', alloc: '-' };
    try {
      const response = await fetch(projectUrl);
      if (!response.ok) return failValues;
      
      const htmlText = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');

      const sписаноBlock = doc.querySelector('[data-widgetid="cc8a35f0-e2d9-4e91-99c8-6bc061b6c377"]');
      const распредBlock = doc.querySelector('[data-widgetid="d67821dd-8739-494e-b638-c0d6a58e5388"]');

      let plan = '-';
      let fact = '-';
      let alloc = '-';

      if (sписаноBlock) {
        const num1 = sписаноBlock.querySelector('.number1');
        const num2 = sписаноBlock.querySelector('.number2');
        fact = num1 ? num1.textContent.trim() : '-';
        plan = num2 ? num2.textContent.trim() : '-';
      }

      if (распредBlock) {
        const num1 = распредBlock.querySelector('.number1');
        alloc = num1 ? num1.textContent.trim() : '-';
      }

      return { plan, fact, alloc };
    } catch (err) {
      return failValues;
    }
  }

  const BATCH_SIZE = 4; 
  const keys = Array.from(window.globalResults.keys());
  const totalProjects = window.globalResults.size;

  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    const batchKeys = keys.slice(i, i + BATCH_SIZE);
    
    const batchPromises = batchKeys.map(async (uid) => {
      const project = window.globalResults.get(uid);
      const hours = await fetchHoursFromRawHtml(project.link);
      
      project.planHours = hours.plan;
      project.factHours = hours.fact;
      project.allocatedHours = hours.alloc;
      window.globalResults.set(uid, project);
    });

    // Запускаем пакет из 4-х fetch одновременно
    await Promise.all(batchPromises);

    // 🔥 РЕАЛИСТИЧНЫЙ ДРОССЕЛЬ (THROTTLE): Пауза 750мс между пакетами.
    // Суммирует 500мс сети + 150мс бэкенда + 50мс движка JS + 50мс зазора на стабилизацию WebSockets.
    await new Promise(resolve => setTimeout(resolve, 750));

    const currentProgress = Math.min(i + BATCH_SIZE, totalProjects);
    console.log(`[Конвейер] Обработан пакет. Прогресс: ${currentProgress}/${totalProjects}`);
  }

  console.timeEnd('⏳ Чистое время сбора по реалистичной модели');
  console.log('🏁 Сбор полностью завершен! Экспорт в CSV...');

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
  
  console.log('🎉 ОТЧЕТ ВЫГРУЖЕН! Скорость сетевого пула сбалансирована под тайминги КБ.');
})();