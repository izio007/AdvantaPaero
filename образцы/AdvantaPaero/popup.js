// Слушатели событий для всех кнопок интерфейса
document.getElementById('btnExpand').addEventListener('click', () => inject('scenarios/sc-expand-tree.js'));
document.getElementById('btnCollapse').addEventListener('click', () => inject('scenarios/sc-collapse-tree.js'));

document.getElementById('btnBaseCsv').addEventListener('click', () => inject('scenarios/sc-export-base.js'));
document.getElementById('btnFullCsv').addEventListener('click', () => inject('scenarios/sc-export-full.js'));

document.getElementById('btnAnalyseHours').addEventListener('click', () => inject('scenarios/sc-analyse-hours.js'));
document.getElementById('btnLoadChart').addEventListener('click', () => inject('scenarios/sc-load-chart.js'));

document.getElementById('btnCopyTask').addEventListener('click', () => inject('scenarios/sc-copy-row.js'));
document.getElementById('btnEditTask').addEventListener('click', () => inject('scenarios/sc-edit-task.js'));

/**
 * Универсальная функция внедрения (инжекта) скриптов автоматизации на активную вкладку
 * @param {string} scenarioPath - Относительный путь к файлу сценария .js
 */
async function inject(scenarioPath) {
  // Находим текущую активную вкладку браузера
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  // Безопасное исполнение изолированного скрипта автоматизации
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: [scenarioPath]
  });
}
