(() => {
  const parentContainer = document.querySelector('project-tree');
  if (!parentContainer) {
    console.error('Не найден контейнер project-tree');
    return;
  }
  console.log('Найден контейнер project-tree');

  const listWrapper = parentContainer.querySelector('[class*="projectsListWrapper"]');
  if (!listWrapper) {
    console.error('Не найдена обёртка списка проектов');
    return;
  }

  const items = Array.from(listWrapper.querySelectorAll('[class*="draggable"]'));
  if (items.length === 0) {
    console.error('Не найдены элементы списка проектов');
    return;
  }
  console.log(`Найдено элементов: ${items.length}`);

  const results = [];
  const headers = [
    'Название', 'Ссылка', 'Приоритет', 'Статус', 'Выполнено',
    'Планируемая дата начала', 'Планируемая дата окончания',
    'Фактическая дата начала', 'Фактическая дата окончания',
    'Руководитель', 'Исполнитель'
  ];

  console.log('Заголовки:', headers);

  items.forEach((item, index) => {
    const projectData = {
      name: getProjectName(item),
      link: getProjectLink(item),
      priority: getPriority(item),
      status: getStatus(item),
      completed: getCompleted(item),
      plannedStart: getPlannedStart(item),
      plannedEnd: getPlannedEnd(item),
      actualStart: getActualStart(item),
      actualEnd: getActualEnd(item),
      owner: getOwner(item),
      executor: getExecutor(item)
    };

    console.log(`Элемент #${index + 1}:`, projectData);
    results.push(projectData);
  });

// 1. Название проекта
function getProjectName(item) {
  const nameLink = item.querySelector('.projectName a');
  return nameLink ? nameLink.textContent : '';
}

// 2. Ссылка на проект
function getProjectLink(item) {
  const nameLink = item.querySelector('.projectName a');
  return nameLink ? nameLink.getAttribute('href') : '';
}

// 3. Приоритет
function getPriority(item) {
  const priority = item.querySelector('.priority');
  return priority ? priority.textContent : '';
}

// 4. Статус
function getStatus(item) {
  const status = item.querySelector('.status');
  return status ? status.textContent : '';
}

// 5. Выполнено
function getCompleted(item) {
  const completed = item.querySelector('.completed');
  return completed ? completed.textContent : '';
}

// 6. Даты
function getPlannedStart(item) {
  const wrappers = item.querySelectorAll('.wrapper');
  return wrappers[0] ? wrappers[0].textContent : '';
}

function getPlannedEnd(item) {
  const wrappers = item.querySelectorAll('.wrapper');
  return wrappers[1] ? wrappers[1].textContent : '';
}

function getActualStart(item) {
  const wrappers = item.querySelectorAll('.wrapper');
  return wrappers[2] ? wrappers[2].textContent : '';
}

function getActualEnd(item) {
  const wrappers = item.querySelectorAll('.wrapper');
  return wrappers[3] ? wrappers[3].textContent : '';
}

// 7. Руководитель и Исполнитель
function getOwner(item) {
  const userNames = item.querySelectorAll('.userName');
  return userNames[0] ? userNames[0].textContent : '';
}

function getExecutor(item) {
  const userNames = item.querySelectorAll('.userName');
  return userNames[1] ? userNames[1].textContent : '';
}




  const csvContent = [
    headers.join(';'),
    ...results.map(row => headers.map(header => {
      const key = header.toLowerCase().replace(/\s+/g, '');
      const value = row[key] || '';
      return `"${value.replace(/"/g, '""')}"`;
    }).join(';'))
  ].join('\r\n');

  console.log('Формируемый CSV:', csvContent);

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = 'projects_export.csv';

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log('Экспорт завершён. Файл: projects_export.csv');
  console.log(`Обработано: ${results.length} записей.`);
})();
