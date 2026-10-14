(async () => {
  console.log('🚀 Запуск универсального сборщика (устойчивого к динамическим хэшам)...');
  
  const parentContainer = document.querySelector('project-tree');
  const scrollContainer = parentContainer ? parentContainer.querySelector('[class*="_projectsListWrapper_"]') || parentContainer : window;
  
  const globalResults = new Map(); // Мапа исключает дублирование строк при виртуальном скролле
  let lastScrollTop = -1;
  let noChangeCounter = 0;

  function collectVisibleItems() {
    // Находим контейнеры строк, которые начинаются на _treeItem_ или содержат его
    const items = Array.from(document.querySelectorAll('project-tree [class*="_treeItem_"]'));
    
    items.forEach(item => {
      // Игнорируем внешнюю обертку, если она попала в выборку (ищем именно контентную часть)
      const contentBox = item.querySelector('[class*="_treeItemContent_"]') || item;

      // 1. Извлекаем Название и Ссылку проекта
      const nameElem = contentBox.querySelector('[class*="_projectLink_"]');
      const name = nameElem ? nameElem.textContent.trim() : '';
      const link = nameElem ? nameElem.getAttribute('href') : '';
      
      if (!name || !link) return;

      // Вытаскиваем UID из ссылки проекта для точной дедупликации
      const uidMatch = link.match(/uid=([^&]+)/);
      const uid = uidMatch ? uidMatch[1] : link;

      // 2. РАСЧЕТ ВЛОЖЕННОСТИ: парсим margin-left из инлайновых стилей
      const marginLeftStr = item.style.marginLeft || "0px";
      const marginLeftPx = parseInt(marginLeftStr, 10) || 0;
      const level = Math.round(marginLeftPx / 26); // Шаг вложенности в ПроЦентре равен точно 26px

      // 3. Код проекта (если выведен отдельным тегом)
      const codeElem = contentBox.querySelector('[class*="_projectCode_"]') || contentBox.querySelector('[class*="_projectNumber_"]');
      const code = codeElem ? codeElem.textContent.trim() : '-';

      // 4. Приоритет (извлекаем из title элемента приоритета)
      const priorityItem = contentBox.querySelector('[class*="_priority_item_"]');
      let priority = priorityItem ? priorityItem.getAttribute('title') || '-' : '-';
      priority = priority.replace('Приоритет: ', ''); // Очищаем текст от префикса

      // 5. Статус проекта (ищем по стабильному UI-классу компонента статуса)
      const statusElem = contentBox.querySelector('.ui-status__list-item-text');
      const status = statusElem ? statusElem.textContent.trim() : '-';

      // 6. Процент выполнения (первый простой текстовый контейнер-обертка перед датами)
      const progressElem = contentBox.querySelector('[class*="_wrapper_"]');
      let progress = '0%';
      if (progressElem && progressElem.textContent.includes('%')) {
        progress = progressElem.textContent.trim();
      }

      // 7. ДАТЫ (План/Факт идут строго по порядку в контейнерах дат, содержащих класс _date_)
      const dateNodes = Array.from(contentBox.querySelectorAll('[class*="_date_"]'));
      const planStart = dateNodes[0] ? dateNodes[0].textContent.trim() : '-';
      const planEnd   = dateNodes[1] ? dateNodes[1].textContent.trim() : '-';
      const factStart = dateNodes[2] ? dateNodes[2].textContent.trim() : '-';
      const factEnd   = dateNodes[3] ? dateNodes[3].textContent.trim() : '-';

      // 8. ОТВЕТСТВЕННЫЕ (Идут строго по порядку: [0] - Руководитель, [1] - Исполнитель)
      const userNodes = Array.from(contentBox.querySelectorAll('[class*="_userName_"]'));
      const manager  = userNodes[0] ? userNodes[0].textContent.trim() : '-';
      const executor = userNodes[1] ? userNodes[1].textContent.trim() : '-';

      // Визуальный сдвиг названия пробелами для красивой иерархии в Excel
      const indentedName = "  ".repeat(level) + name;

      globalResults.set(uid, {
        level,
        code,
        name: indentedName,
        link,
        status,
        priority,
        progress,
        manager,
        executor,
        planStart,
        planEnd,
        factStart,
        factEnd
      });
    });
  }

  // Цикл прокрутки Virtual Scroll для захвата всех данных страницы
  while (noChangeCounter < 8) {
    collectVisibleItems();

    const currentScrollTop = scrollContainer === window ? window.scrollY : scrollContainer.scrollTop;
    
    if (currentScrollTop === lastScrollTop) {
      noChangeCounter++;
    } else {
      noChangeCounter = 0;
      lastScrollTop = currentScrollTop;
    }

    // Шагаем по 300px вниз, чтобы Virtual Scroll успевал плавно подгружать DOM
    if (scrollContainer === window) {
      window.scrollBy(0, 300);
    } else {
      scrollContainer.scrollTop += 300;
    }

    console.log(`[Сбор данных] Сканируем дерево... Уникальных проектов в базе: ${globalResults.size}`);
    await new Promise(resolve => setTimeout(resolve, 180)); 
  }

  console.log('🏁 Сканирование завершено! Формируем стабильный CSV...');

  // Конвертация в CSV (Родная кодировка Windows-1251 для MS Excel)
  const finalArray = Array.from(globalResults.values());
  
const win1251CharMap = {
  'А': 192, 'Б': 193, 'В': 194, 'Г': 195, 'Д': 196, 'Е': 197, 'Ж': 198, 'З': 199,
  'И': 200, 'Й': 201, 'К': 202, 'Л': 203, 'М': 204, 'Н': 205, 'О': 206, 'П': 207,
  'Р': 208, 'С': 209, 'Т': 210, 'У': 211, 'Ф': 212, 'Х': 213, 'Ц': 214, 'Ч': 215,
  'Ш': 216, 'Щ': 217, 'Ъ': 218, 'Ы': 219, 'Ь': 220, 'Э': 221, 'Ю': 222, 'Я': 223,
  'а': 224, 'б': 225, 'в': 226, 'г': 227, 'д': 228, 'е': 229, 'ж': 230, 'з': 231,
  'и': 232, 'й': 233, 'к': 234, 'л': 235, 'м': 236, 'н': 237, 'о': 238, 'п': 239,
  'р': 240, 'с': 241, 'т': 242, 'у': 243, 'ф': 244, 'х': 245, 'ц': 246, 'ч': 247,
  'ш': 248, 'щ': 249, 'ъ': 250, 'ы': 251, 'ь': 252, 'э': 253, 'ю': 254, 'я': 255,
  '№': 185, 'Ё': 168, 'ё': 184,
  ' ': 32, '"': 34, "'": 39, '-': 45, '_': 95, '.': 46, ',': 44, ';': 59, ':': 58, '=': 61,
  '(': 40, ')': 41, '[': 91, ']': 93, '{': 123, '}': 125, '`': 96, '~': 126,
  '–': 150, '—': 151, '«': 171, '»': 187, '•': 183, '…': 133, '©': 169, '®': 174,
  '±': 177, '×': 215, '÷': 247, '°': 176, '²': 178, '³': 179, 'µ': 181,
  '0': 48, '1': 49, '2': 50, '3': 51, '4': 52, '5': 53, '6': 54, '7': 55, '8': 56, '9': 57,
  'A': 65, 'B': 66, 'C': 67, 'D': 68, 'E': 69, 'F': 70, 'G': 71, 'H': 72, 'I': 73, 'J': 74,
  'K': 75, 'L': 76, 'M': 77, 'N': 78, 'O': 79, 'P': 80, 'Q': 81, 'R': 82, 'S': 83, 'T': 84,
  'U': 85, 'V': 86, 'W': 87, 'X': 88, 'Y': 89, 'Z': 90,
  'a': 97, 'b': 98, 'c': 99, 'd': 100, 'e': 101, 'f': 102, 'g': 103, 'h': 104, 'i': 105,
  'j': 106, 'k': 107, 'l': 108, 'm': 109, 'n': 110, 'o': 111, 'p': 112, 'q': 113, 'r': 114,
  's': 115, 't': 116, 'u': 117, 'v': 118, 'w': 119, 'x': 120, 'y': 121, 'z': 122,
  '+': 43, '*': 42, '/': 47, '\\': 92, '|': 124, '<': 60, '>': 62, '?': 63, '@': 64,
  '$': 36, '%': 37, '&': 38, '#': 35, '§': 167
};

  const headers = [
    "Уровень вложенности", "Код проекта", "Название проекта", "Ссылка", 
    "Статус", "Приоритет", "Процент выполнения", "Руководитель", 
    "Исполнитель", "План: Начало", "План: Окончание", "Факт: Начало", "Факт: Окончание"
  ];

  const csvRows = [headers.join(";")];
  finalArray.forEach(row => {
    csvRows.push([
      row.level,
      `"${row.code}"`,
      `"${row.name.replace(/"/g, '""')}"`,
      `"=ГИПЕРССЫЛКА(""${row.link}"";""ПроектЦентр"")"`,
      `"${row.status}"`,
      `"${row.priority}"`,
      `"${row.progress}"`,
      `"${row.manager}"`,
      `"${row.executor}"`,
      `"${row.planStart}"`,
      `"${row.planEnd}"`,
      `"${row.factStart}"`,
      `"${row.factEnd}"`
    ].join(";"));
  });

  const byteArray = new Uint8Array(csvRows.join('\n').split('').map(c => win1251CharMap[c] || c.charCodeAt(0)));
  const blob = new Blob([byteArray], { type: 'text/csv; charset=windows-1251' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'PROCENTR_DATABASE_EXPORT.csv';
  a.click();

  console.log(`🎉 ГОТОВО! Скачан файл 'PROCENTR_DATABASE_EXPORT.csv'. Извлечено уникальных проектов: ${finalArray.length}`);
})();