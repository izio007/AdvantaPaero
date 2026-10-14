# Проверки PAeroCenter 2.0.0

Дата: 14 октября 2026 года.

## Итог

**55 из 55 проверок Node.js пройдены. 15 из 15 проверок DOM/интерфейса в Chromium пройдены.**

Это не подтверждение работы на производственной ADVANTA. Сетевой транспорт, местоположение страницы и Chrome API в выполненных проверках имитировались. Отчёт не является аудитом безопасности или сертификатом готовности к эксплуатации.

## Проверено

Node.js 22.16.0: ограниченный parser; JSON/DX; запрет исполняемых выражений; нули и неизвестные часы; сопоставление виджетов; маскирование; form-urlencoded; фильтр origin; CSV; порядок дерева; манифест; логика recorder при смоделированных CDP-событиях; лимит записей; обработка отсутствующего тела; поведение background при смоделированных Chrome API; защита от повторного старта и позднего checkpoint; отказ политики debugger.

Chromium 144.0.7559.96: настоящий DOM, MutationObserver, прокрутка, события мыши, таймеры, DOMParser, TextDecoder/Response и отрисовка интерфейса. Синтетическое виртуализированное дерево: 12 родителей и 24 ребёнка. Имена одинаковые, UID разные. Серверные ответы представлены локальной тестовой функцией fetch; это не HTTP-запросы к ADVANTA.

Выполненные браузерные проверки:

1. DOM adapter recognizes ADVANTA-shaped fixture
2. collector completes on real DOM with mocked transport
3. virtualized tree: 36 distinct UID collected
4. CSV hierarchy order stays parent-children-sibling
5. equal names preserve different projects
6. manager, executor, dates and progress preserved
7. per-card state used, all 36 mock hours correct
8. widget IDs used instead of array order
9. periodic checkpoints exist
10. CSV format contains all rows and BOM
11. invalid callback stops after three consecutive failures
12. failed hours remain null, never fabricated zeros
13. Stop saves partial rows and does not report success
14. duplicate start rejected
15. popup renders and displays a saved job via mocked API

## Не проверено / заблокировано

Попытка загрузки фактического расширения и перехода к локальному HTTP-стенду в Chromium не завершилась: среда применяет административную блокировку (`ERR_BLOCKED_BY_ADMINISTRATOR`). Ограничения не изменялись и не обходились. Поэтому фактическое выполнение chrome.scripting/debugger/downloads в установке расширения и IndexedDB расширения здесь не подтверждено. Для этих границ использованы явно обозначенные имитации; подготовлен отдельный `extension_integration.py`, но его результат не включён в успешные проверки.

Не проверены: действительный origin вашей ADVANTA, текущий DOM, реальные пакеты DevExpress, серверная семантика показателей, авторизация, корпоративные политики Chrome, локальная установка пользователем через activeTab, полнота дерева на конкретном сервере и очень большие объёмы.

## Первая проверка внутри периметра

На небольшой структуре сравните видимые строки, затем три карточки с часами с экраном. Убедитесь, что UID различаются и часы не повторяют родителя. Проверьте остановку, закрытие только popup, CSV, непустой сетевой журнал и отказ/отключение debugger. Если появилась ошибка, используйте диагностику; не публикуйте рабочие дампы и токены в открытом репозитории.

Сырые результаты автоматических проверок: `tests/results-unit.tap` и `tests/results-browser.json`.
