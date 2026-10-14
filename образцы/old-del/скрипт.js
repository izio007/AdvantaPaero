(() => {
  // Шаг 1. Находим контейнер
  const parentContainer = document.querySelector('project-tree');
  if (!parentContainer) {
    console.error('❌ Не найден контейнер project-tree');
    return;
  }
  console.log('✅ Найден контейнер project-tree');

  // Шаг 2. Находим обёртку списка
  const listWrapper = parentContainer.querySelector('[class*="projectsListWrapper"]');
  if (!listWrapper) {
    console.error('❌ Не найдена обёртка списка проектов');
    return;
  }

  // Шаг 3. Находим все элементы списка
  const items = Array.from(listWrapper.querySelectorAll('[class*="treeItem"]'));
  if (items.length === 0) {
    console.error('❌ Не найдены элементы списка проектов');
    return;
  }
  console.log(`🔎 Найдено элементов для парсинга: \${items.length}`);


const results = [];
const seenNames = new Set(); // Храним уже добавленные названия


items.forEach(item => {
  const nameElem = item.querySelector('[class*="projectName"] a');
  const name = nameElem ? nameElem.textContent.trim() : '';
  const linkElem = item.querySelector('[class*="projectLink"]');
  const link = linkElem ? linkElem.getAttribute('href') : '';

  // Пропускаем пустые строки и дубликаты
  if (!name || seenNames.has(name)) {
    return;
  }

  seenNames.add(name);
  results.push({ name, link });
});

// Шаг 4. СОХРАНЕНИЕ В КОДИРОВКЕ ANSI (Windows-1251)


// Таблица соответствия символов Windows-1251
const win1251CharMap = {
  'А': 192, 'Б': 193, 'В': 194, 'Г': 195, 'Д': 196, 'Е': 197, 'Ж': 198, 'З': 199,
  'И': 200, 'Й': 201, 'К': 202, 'Л': 203, 'М': 204, 'Н': 205, 'О': 206, 'П': 207,
  'Р': 208, 'С': 209, 'Т': 210, 'У': 211, 'Ф': 212, 'Х': 213, 'Ц': 214, 'Ч': 215,
  'Ш': 216, 'Щ': 217, 'Ъ': 218, 'Ы': 219, 'Ь': 220, 'Э': 221, 'Ю': 222, 'Я': 223,
  'а': 224, 'б': 225, 'в': 226, 'г': 227, 'д': 228, 'е': 229, 'ж': 230, 'з': 231,
  'и': 232, 'й': 233, 'к': 234, 'л': 235, 'м': 236, 'н': 237, 'о': 238, 'п': 239,
  'р': 240, 'с': 241, 'т': 242, 'у': 243, 'ф': 244, 'х': 245, 'ц': 246, 'ч': 247,
  'ш': 248, 'щ': 249, 'ъ': 250, 'ы': 251, 'ь': 252, 'э': 253, 'ю': 254, 'я': 255,
  'ё': 184, 'Ё': 168, '–': 150, '—': 151, '«': 171, '»': 187, '№': 185,
  // Основные ASCII-символы (0–127) остаются без изменений
};

// Функция преобразования строки в массив байтов Windows-1251
function stringToWin1251Bytes(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    // Для ASCII-символов (0–127) берём код напрямую
    if (char.charCodeAt(0) < 128) {
      bytes.push(char.charCodeAt(0));
    } else {
      // Для кириллицы и спецсимволов берём код из таблицы
      bytes.push(win1251CharMap[char] || 63); // 63 = '?' для неизвестных символов
    }
  }
  return new Uint8Array(bytes);
}

// Формируем CSV-строку
const csvContent = `name;link\n` + results.map(row => `${row.name};${row.link}`).join('\n');

// Преобразуем строку в байты Windows-1251
const byteArray = stringToWin1251Bytes(csvContent);

// Создаём Blob с байтами
const blob = new Blob([byteArray], {
  type: 'text/csv; charset=windows-1251'
});

const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'projects_data.csv';
a.click();
URL.revokeObjectURL(url);

console.log(`✅ Готово! Файл сохранён как "projects_data.csv". Обработано: ${results.length} строк.`);

})();