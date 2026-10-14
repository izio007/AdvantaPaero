прототип 1
(async () => {
  console.log('🔬 [ПРОТОТИП] Запуск концепта раздельного сбора часов (Родитель + 3 Потомка)...');

  const viewStateKey = document.getElementById('__VIEWSTATE_KEY')?.value;
  const controllerKey = document.getElementById('__CONTROLLER_KEY')?.value;

  if (!viewStateKey || !controllerKey) {
    console.error('❌ Ключи авторизации не найдены. Запустите на странице таблицы.');
    return;
  }

  // 1. Автоматически собираем первые 3 дочерних проекта, видимых в таблице
  const links = Array.from(document.querySelectorAll('project-tree [class*="_projectLink_"]')).slice(0, 3);
  const targets = links.map(el => {
    const href = el.getAttribute('href') || '';
    const uidMatch = href.match(/uid=([^&]+)/);
    return {
      code: el.closest('[class*="_treeItem_"]')?.querySelector('[class*="_projectCode_"], [class*="_projectNumber_"]')?.textContent.trim() || '?',
      name: el.textContent.trim(),
      uid: uidMatch ? uidMatch[1] : href,
      url: href.startsWith('http') ? href : window.location.origin + href
    };
  });

  if (targets.length === 0) {
    console.error('❌ Дочерние строки не найдены в таблице на экране.');
    return;
  }

  // 2. Универсальная функция отправки пакета с динамическим parameter
  async function testFetch(label, url, targetUid) {
    try {
      const payload = new URLSearchParams();
      payload.append('__EVENTTARGET', '');
      payload.append('__EVENTARGUMENT', '');
      payload.append('__LASTFOCUS', '');
      payload.append('__VIEWSTATE_KEY', viewStateKey);
      payload.append('__CONTROLLER_KEY', controllerKey);
      payload.append('__VIEWSTATE', '');
      payload.append('__VIEWSTATEENCRYPTED', '');
      payload.append('__CALLBACKID', 'ctl34$cbKeyMeasureWidgets');
      
      // Формируем параметр: для родителя пустой "", для потомков — их UID
      const paramValue = targetUid ? `c0:{"id":0,"result":{"data":"","parameter":"${targetUid}"}}` : 'c0:{"id":0,"result":{"data":"","parameter":""}}';
      payload.append('__CALLBACKPARAM', paramValue);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-MicrosoftAjax': 'Delta=true',
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': '*/*'
        },
        body: payload
      });

      if (!response.ok) return `[Ошибка HTTP ${response.status}]`;

      const text = await response.text();
      const markerIdx = text.indexOf('/*DX*/');
      if (markerIdx === -1) return '[Пакет /*DX*/ не найден в ответе]';

      const cleanJson = text.substring(text.indexOf('{', markerIdx), text.lastIndexOf('}') + 1);
      const outerData = Function('return ' + cleanJson)();
      
      if (outerData?.result?.data) {
        const innerWidgets = Function('return ' + outerData.result.data)();
        return innerWidgets; // Возвращаем сырой распарсенный массив виджетов
      }
      return '[Нет данных внутри result.data]';
    } catch (e) {
      return `[Ошибка конвейера: ${e.message}]`;
    }
  }

  // --- ШАГ А: Запрос часов РОДИТЕЛЯ (Текущая страница, пустой параметр) ---
  console.log('⏳ 1. Запрашиваем интегральные часы РОДИТЕЛЯ текущей страницы...');
  const parentHours = await testFetch('РОДИТЕЛЬ', window.location.href, null);
  console.log('📊 [ОТВЕТ] СЫРЫЕ ДАННЫЕ РОДИТЕЛЯ:', parentHours);

  // --- ШАГ Б: Последовательный опрос 3-х потомков с передачей их UID ---
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    console.log(`\n⏳ ${i + 2}. Запрашиваем часы ПОТОМКА [${t.code}] "${t.name}" (UID: ${t.uid})...`);
    
    // Бьем по ссылке потомка, но передаем его личный UID в пакет
    const childHours = await testFetch(t.code, t.url, t.uid);
    console.log(`📊 [ОТВЕТ] СЫРЫЕ ДАННЫЕ ПОТОМКА ${t.code}:`, childHours);
    
    // Пауза 300мс, чтобы сервер успевал переводить дыхание
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n🔬 [КОНЕЦ ПРОТОТИПА] Все 4 тестовых точки опрошены. Анализируем сырые логи выше.');
})();
