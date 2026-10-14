(() => {
// 1. Получаем основной контейнер через ID
const projectHolder = document.querySelector('#projects-manager-holder');
if (!projectHolder) {
  console.error('Основной контейнер не найден!');
  return;
}

const projectList = projectHolder.querySelector('[class^="_projectTreeView_"] [class^="_toolbar_"] ...'); // Вставьте сюда ваш полный селектор
const allData = [];

// Функция поиска иконок раскрытия
function findExpandIcons() {
  return projectList.querySelectorAll(
    'img[src*="plusGray.png"], ' +
    '[class^="_switchImage_"][src*="plusGray.png"]'
  );
}

// Рекурсивное раскрытие вложенности
function expandTree() {
  // Находим все иконки раскрытия
  const plusIcons = findExpandIcons();

  if (plusIcons.length === 0) {
    // Все раскрыто — собираем данные
    collectData();
    return;
  }

  // Кликаем все иконки раскрытия
  plusIcons.forEach(icon => {
    try {
      icon.click();
    } catch (error) {
      console.warn('Ошибка при клике:', error);
    }
  });

  // Ждём подгрузку и повторяем
  setTimeout(expandTree, 1500);
}

// Остальной код остается без изменений...

// Запуск
expandTree();


// Экспорт в CSV (раскомментируйте)
/*
const csv = [
  'Название,Ссылка,Приоритет,Статус,Выполнено,Планируемая дата начала,Планируемая дата окончания,Фактическая дата начала,Фактическая дата окончания,Руководитель,Исполнитель',
  ...allData.map(row => Object.values(row).map(v => `"${v}"`).join(',')).join('\n')
].join('\n');

const blob = new Blob([csv], { type: 'text/csv' });
window.open(URL.createObjectURL(blob), '_blank');
*/
})();
