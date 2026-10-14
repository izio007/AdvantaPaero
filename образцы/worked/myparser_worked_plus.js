(async () => {
  console.log('🚀 Робот-раскрытчик запущен. Начинаем пошаговое раскрытие веток...');

  const parentContainer = document.querySelector('project-tree');
  // Находим контейнер скролла таблицы
  const scrollContainer = parentContainer ? parentContainer.querySelector('[class*="projectsListWrapper"]') || parentContainer : window;

  let lastScrollTop = -1;
  let noChangeCounter = 0;
  let totalExpanded = 0;

  // Функция для имитации реального клика мыши
  const humanClick = (element) => {
    const events = ['mousedown', 'click', 'mouseup'];
    events.forEach(eventType => {
      element.dispatchEvent(new MouseEvent(eventType, {
        bubbles: true, cancelable: true, view: window, buttons: 1
      }));
    });
  };

  // Главный цикл: скроллим и раскрываем, пока не упремся в самый низ страницы
  while (noChangeCounter < 10) {
    // Находим все серые плюсики, видимые на текущем экране
    const plusButtons = Array.from(document.querySelectorAll('img._switchImage_nz6me_8'));
    let expandedOnThisStep = 0;

    for (let btn of plusButtons) {
      // Кликаем только если кнопка видима и это плюс (а не минус)
      if (btn.offsetHeight > 0 && btn.src.includes('plusGray')) {
        btn.scrollIntoView({ block: 'center' }); // Мягко фокусируемся
        await new Promise(r => setTimeout(r, 100));

        humanClick(btn);
        expandedOnThisStep++;
        totalExpanded++;

        // Пауза 500мс, чтобы сервер успел вернуть данные (200 OK вместо 403)
        await new Promise(resolve => setTimeout(resolve, 500)); 
      }
    }

    // Если на этом экране больше нечего раскрывать, скроллим вниз
    const currentScrollTop = scrollContainer === window ? window.scrollY : scrollContainer.scrollTop;
    
    if (currentScrollTop === lastScrollTop && expandedOnThisStep === 0) {
      noChangeCounter++; // Если застряли и ничего не раскрыли — инкрементируем выход
    } else {
      noChangeCounter = 0;
      lastScrollTop = currentScrollTop;
    }

    // Смещаем экран на 300 пикселей вниз, чтобы подгрузить новые строки Virtual Scroll
    if (scrollContainer === window) {
      window.scrollBy(0, 300);
    } else {
      scrollContainer.scrollTop += 300;
    }

    console.log(`[Прогресс] Раскрыто веток на этом шаге: ${expandedOnThisStep}. Всего раскрыто: ${totalExpanded}`);
    await new Promise(resolve => setTimeout(resolve, 300)); // Пауза для стабильности рендеринга React
  }

  console.log(`🏁 Все доступные уровни раскрыты! Всего развернуто веток: ${totalExpanded}.`);
  console.log(`ℹ️ Теперь вы можете запустить ваш первый скрипт (который собирал name и link) или написать "собираем данные", чтобы выгрузить полную таблицу.`);
})();