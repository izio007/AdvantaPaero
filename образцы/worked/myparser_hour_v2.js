async function processFirstRow() {
  try {
    // 1. Получаем первую ссылку из таблицы
    const firstLink = document.querySelector('table tr:first-child a');
    if (!firstLink) {
      throw new Error('Не найдена первая ссылка в таблице');
    }

    // 2. Открываем новую вкладку с проектом
    const newTab = window.open(firstLink.href, '_blank');
    
    // Ждем загрузки новой вкладки
    await new Promise(resolve => setTimeout(resolve, 2000)); // ждем 2 секунды
    
    // Переключаемся на новую вкладку
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      chrome.tabs.update(tabs[0].id, { active: true });
    });

    // 3. Извлекаем ключи авторизации уже на странице проекта
    const viewStateKey = document.getElementById('__VIEWSTATE_KEY')?.value;
    const controllerKey = document.getElementById('__CONTROLLER_KEY')?.value;
    
    if (!viewStateKey || !controllerKey) {
      throw new Error('Отсутствуют ключи авторизации');
    }

    // 4. Получаем dm+json
    const dmJson = await getDmJson(window.location.href, viewStateKey, controllerKey);
    
    console.log('Полученный dm+json:', dmJson);
    return dmJson;
  } catch (error) {
    console.error('Ошибка при обработке первой строки:', error);
  }
}

async function getDmJson(url, viewStateKey, controllerKey) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-MicrosoftAjax': 'Delta=true',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': '*/*'
      },
      body: new URLSearchParams({
        '__VIEWSTATE_KEY': viewStateKey,
        '__CONTROLLER_KEY': controllerKey,
        '__CALLBACKID': 'ctl34$cbKeyMeasureWidgets',
        '__CALLBACKPARAM': 'c0:'
      })
    });

    const text = await response.text();
    const start = text.indexOf('/*DX*/');
    if (start === -1) {
      throw new Error('Не найден маркер DX в ответе');
    }

    const jsonStart = text.indexOf('{', start);
    const jsonEnd = text.lastIndexOf('}');
    const dmJson = text.slice(jsonStart, jsonEnd + 1);
    
    try {
      return JSON.parse(dmJson.replace(/(?<!\\)'/g, '"'));
    } 
    catch(e) {
      throw new Error('Ошибка парсинга JSON:', e);
    }
  } 
  catch(error) {
    throw new Error('Ошибка запроса:', error);
  }
}

// Запуск обработки
processFirstRow();
