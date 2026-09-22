// OAuth-токен Метрики НЕ хранится в коде: файл лежит в публичном репозитории.
// Задайте его в Apps Script: Настройки проекта → Свойства скрипта →
// свойство METRIKA_TOKEN (значение — токен, без кавычек).
var TOKEN_PROP = 'METRIKA_TOKEN';
var TOKEN_CACHE = null;

// Подчёркивание в конце имени скрывает функцию из списка запуска Apps Script
function getToken_() {
  if (!TOKEN_CACHE) TOKEN_CACHE = PropertiesService.getScriptProperties().getProperty(TOKEN_PROP);
  if (!TOKEN_CACHE) throw new Error('Не задан токен Метрики: Настройки проекта → Свойства скрипта → ' + TOKEN_PROP);
  return TOKEN_CACHE;
}

var METRIKA_BRANDS = [
  {
    name: 'Стоматология',
    sheetId: '18_wK4ym4OvY5YuCtTI7ZmEZhbrxXdGcflIL8sIQxxMo',
    counterId: '99736023'
  },
  {
    name: 'Здоровенок',
    sheetId: '1CsSX3R0eA0mHTM8R3VDTyjenU_buDnQwlgZ6xPVkCK0',
    counterId: '64562653'
  },
  {
    name: 'Косметология',
    sheetId: '1oBZmlZyeWIoRfuTCZfenWu1V9wr68ynvpYwz8nK6-I0',
    counterId: '96724116'
  },
  {
    name: 'КДЛ',
    sheetId: '1_tiSoa0L4IYDpmqFQ5uomsgqMuChsDMv9pxQTowUQV0',
    counterId: '64976680'
  },
  {
    name: 'Дино',
    sheetId: '1rWn4O1OG4iQQVZakrHlfEhp0bkC0aqFXu0MjcFTfkQk',
    counterId: '91758152'
  },
  {
    name: 'Офтальмология',
    sheetId: '1QYetwmeWqpntHSpeu7fs6rKE-H-ojNj-P368Yl0o4BM',
    counterId: '102016053'
  },
  {
    name: 'Клиника',
    sheetId: '10VLpClABfSUCZIVoQjGKn7Di1OqYdS8ymtMdkUqgpJM',
    // Несколько счётчиков: каждый центр пишется в листы с суффиксом _<suffix>
    centers: [
      { suffix: 'clinic',    counterId: '100047448' },
      { suffix: 'women',     counterId: '100047613' },
      { suffix: 'men',       counterId: '100047528' },
      { suffix: 'mammology', counterId: '100047497' },
      { suffix: 'neurology', counterId: '100047581' }
    ]
  }
];

// --- Настройки защиты от лимита времени Apps Script ---
// Лимит одного выполнения — 6 минут (обычный аккаунт). Доработав до порога,
// скрипт сохраняет очередь и ставит одноразовый триггер на продолжение.
var MAX_RUNTIME_MS = 4 * 60 * 1000;  // порог работы одного куска
var WATCHDOG_MIN   = 8;              // страховочный триггер на случай жёсткого обрыва
var MAX_ATTEMPTS   = 2;              // сколько раз пробовать одну единицу, потом пропуск

var PROP_QUEUE  = 'metrika_queue';
var PROP_REPORT = 'metrika_report';
var PROP_ERRORS = 'metrika_errors';

function normalizeMonthDate(interval) {
  var end = interval[1];
  return end.substring(0, 7) + '-01';
}

// --- Полное обновление всех листов ---
function metrikaStomatologyFull()  { updateMetrikaBrand(METRIKA_BRANDS[0], true); }
function metrikaStomatologyNew()   { updateMetrikaBrand(METRIKA_BRANDS[0], false); }
function metrikaZdorovenokFull()   { updateMetrikaBrand(METRIKA_BRANDS[1], true); }
function metrikaZdorovenokNew()    { updateMetrikaBrand(METRIKA_BRANDS[1], false); }
function metrikaKosmetologiyaFull(){ updateMetrikaBrand(METRIKA_BRANDS[2], true); }
function metrikaKosmetologiyaNew() { updateMetrikaBrand(METRIKA_BRANDS[2], false); }
function metrikaKdlFull()          { updateMetrikaBrand(METRIKA_BRANDS[3], true); }
function metrikaKdlNew()           { updateMetrikaBrand(METRIKA_BRANDS[3], false); }
function metrikaDinoFull()         { updateMetrikaBrand(METRIKA_BRANDS[4], true); }
function metrikaDinoNew()          { updateMetrikaBrand(METRIKA_BRANDS[4], false); }
function metrikaOftalmFull()       { updateMetrikaBrand(METRIKA_BRANDS[5], true); }
function metrikaOftalmNew()        { updateMetrikaBrand(METRIKA_BRANDS[5], false); }
function metrikaKlinikaFull()       { updateMetrikaBrand(METRIKA_BRANDS[6], true); }   // ВНИМАНИЕ: все 5 центров за раз могут не успеть (лимит времени) — для первой заливки см. функции по центрам ниже
function metrikaKlinikaNew()        { updateMetrikaBrand(METRIKA_BRANDS[6], false); }

// --- Клиника по одному центру (первичная заливка, чтобы уложиться в лимит времени) ---
function metrikaKlinikaClinicFull()    { updateMetrikaCenter(METRIKA_BRANDS[6], 'clinic', true); }
function metrikaKlinikaClinicNew()     { updateMetrikaCenter(METRIKA_BRANDS[6], 'clinic', false); }
function metrikaKlinikaWomenFull()     { updateMetrikaCenter(METRIKA_BRANDS[6], 'women', true); }
function metrikaKlinikaWomenNew()      { updateMetrikaCenter(METRIKA_BRANDS[6], 'women', false); }
function metrikaKlinikaMenFull()       { updateMetrikaCenter(METRIKA_BRANDS[6], 'men', true); }
function metrikaKlinikaMenNew()        { updateMetrikaCenter(METRIKA_BRANDS[6], 'men', false); }
function metrikaKlinikaMammologyFull() { updateMetrikaCenter(METRIKA_BRANDS[6], 'mammology', true); }
function metrikaKlinikaMammologyNew()  { updateMetrikaCenter(METRIKA_BRANDS[6], 'mammology', false); }
function metrikaKlinikaNeurologyFull() { updateMetrikaCenter(METRIKA_BRANDS[6], 'neurology', true); }
function metrikaKlinikaNeurologyNew()  { updateMetrikaCenter(METRIKA_BRANDS[6], 'neurology', false); }

// Бренд, чьи запросы выполняются сейчас (для привязки ошибок в отчёте)
var CURRENT_BRAND = '';
// Ошибки API, собранные за текущий запуск
var RUN_ERRORS = [];

// --- Ежемесячное обновление: очередь с автопродолжением ---
// Бренд с центрами разбивается на отдельные единицы — по центру на единицу,
// чтобы ни один кусок работы заведомо не упирался в лимит времени.
function runMonthlyUpdate() {
  var queue = [];
  for (var i = 0; i < METRIKA_BRANDS.length; i++) {
    var brand = METRIKA_BRANDS[i];
    if (brand.centers) {
      for (var c = 0; c < brand.centers.length; c++) {
        queue.push({ brand: i, center: brand.centers[c].suffix, tries: 0 });
      }
    } else {
      queue.push({ brand: i, center: null, tries: 0 });
    }
  }
  var props = PropertiesService.getScriptProperties();
  props.setProperty(PROP_QUEUE, JSON.stringify(queue));
  props.setProperty(PROP_REPORT, '[]');
  props.setProperty(PROP_ERRORS, '[]');
  Logger.log('Очередь на обновление: ' + queue.length + ' единиц');
  processMetrikaQueue();
}

// Точка входа для одноразового триггера-продолжения
function continueMonthlyUpdate() {
  processMetrikaQueue();
}

function processMetrikaQueue() {
  var started = new Date().getTime();
  var props = PropertiesService.getScriptProperties();

  // Страховка: если выполнение оборвётся жёстко (таймаут внутри одной единицы
  // или исключение), этот триггер подхватит работу с сохранённого места.
  removeTriggersFor('continueMonthlyUpdate');
  scheduleContinuation(WATCHDOG_MIN);

  var queue  = JSON.parse(props.getProperty(PROP_QUEUE) || '[]');
  var report = JSON.parse(props.getProperty(PROP_REPORT) || '[]');

  while (queue.length) {
    if (new Date().getTime() - started > MAX_RUNTIME_MS) {
      saveQueueState(queue, report);
      Logger.log('Пауза по времени. Осталось единиц: ' + queue.length);
      removeTriggersFor('continueMonthlyUpdate');
      scheduleContinuation(1);
      return;
    }

    var item  = queue[0];
    var brand = METRIKA_BRANDS[item.brand];
    var label = brand.name + (item.center ? '/' + item.center : '');

    item.tries = (item.tries || 0) + 1;
    if (item.tries > MAX_ATTEMPTS) {
      Logger.log(label + ': пропущено после ' + MAX_ATTEMPTS + ' неудачных попыток');
      RUN_ERRORS = JSON.parse(props.getProperty(PROP_ERRORS) || '[]');
      RUN_ERRORS.push({ brand: label, detail: 'не удалось обработать за ' + MAX_ATTEMPTS + ' попытки'
        + (item.lastError ? ' (' + item.lastError + ')' : '') + ' — запустите вручную' });
      props.setProperty(PROP_ERRORS, JSON.stringify(RUN_ERRORS));
      queue.shift();
      report.push({ name: label, traffic: null, sources: null, adv: null, pages: null });
      saveQueueState(queue, report);
      continue;
    }
    // Попытка фиксируется ДО работы: если выполнение оборвётся, продолжение
    // будет знать, что эта единица уже пробовалась.
    saveQueueState(queue, report);

    RUN_ERRORS = JSON.parse(props.getProperty(PROP_ERRORS) || '[]');
    var stats;
    try {
      stats = item.center
        ? updateMetrikaCenter(brand, item.center, false)
        : updateMetrikaBrand(brand, false);
    } catch (e) {
      // Исключение (сбой Sheets, ответ не JSON, нет токена и т.п.): не ждём
      // страховочный триггер 8 минут, а сразу пробуем единицу ещё раз или,
      // исчерпав попытки, пропускаем её с этой ошибкой в отчёте.
      // Ошибки API этой попытки отбрасываем — повтор соберёт их заново.
      // Повтор безопасен: уже записанные месяцы при повторе пропускаются.
      item.lastError = String((e && e.message) || e);
      Logger.log(label + ': исключение — ' + item.lastError);
      saveQueueState(queue, report);
      continue;
    }
    props.setProperty(PROP_ERRORS, JSON.stringify(RUN_ERRORS));

    queue.shift();
    report.push(stats);
    saveQueueState(queue, report);
  }

  removeTriggersFor('continueMonthlyUpdate');
  RUN_ERRORS = JSON.parse(props.getProperty(PROP_ERRORS) || '[]');
  sendMonthlyReport(report);
  clearQueueState();
}

function saveQueueState(queue, report) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty(PROP_QUEUE, JSON.stringify(queue));
  props.setProperty(PROP_REPORT, JSON.stringify(report));
}

function clearQueueState() {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty(PROP_QUEUE);
  props.deleteProperty(PROP_REPORT);
  props.deleteProperty(PROP_ERRORS);
}

// Сбросить залипшее состояние и убрать триггеры-продолжения
function resetMonthlyQueue() {
  removeTriggersFor('continueMonthlyUpdate');
  clearQueueState();
  Logger.log('Очередь сброшена, триггеры-продолжения удалены');
}

// Показать, что осталось в очереди (для проверки после сбоя)
function showMonthlyQueue() {
  var raw = PropertiesService.getScriptProperties().getProperty(PROP_QUEUE);
  if (!raw) { Logger.log('Очередь пуста — обновление завершено'); return; }
  var queue = JSON.parse(raw);
  Logger.log('Осталось единиц: ' + queue.length);
  for (var i = 0; i < queue.length; i++) {
    var brand = METRIKA_BRANDS[queue[i].brand];
    Logger.log('  ' + brand.name + (queue[i].center ? '/' + queue[i].center : '') + ' (попыток: ' + (queue[i].tries || 0) + ')');
  }
}

function scheduleContinuation(minutes) {
  ScriptApp.newTrigger('continueMonthlyUpdate').timeBased().after(minutes * 60 * 1000).create();
  Logger.log('Продолжение запланировано через ' + minutes + ' мин');
}

function removeTriggersFor(fnName) {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === fnName) ScriptApp.deleteTrigger(triggers[i]);
  }
}

// Письмо с итогом ежемесячного обновления
function sendMonthlyReport(report) {
  var email = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail();
  var hasError = false;
  var lines = [];
  for (var i = 0; i < report.length; i++) {
    var s = report[i];
    var errs = RUN_ERRORS.filter(function(e) { return e.brand === s.name; });
    if (errs.length) hasError = true;
    lines.push(s.name + ': '
      + 'traffic ' + fmtCount(s.traffic) + ', '
      + 'sources ' + fmtCount(s.sources) + ', '
      + 'adv ' + fmtCount(s.adv) + ', '
      + 'pages ' + fmtCount(s.pages)
      + '  ' + (errs.length ? '⚠️ проверить' : '✅'));
    for (var e = 0; e < errs.length; e++) lines.push('      ! ' + errs[e].detail);
  }
  var head = hasError
    ? '⚠️ Были ошибки — проверьте журнал и таблицы'
    : '✅ Все бренды обновлены без ошибок';
  var body = head + '\n\n' + lines.join('\n')
    + '\n\nЖурнал выполнений: https://script.google.com/home/executions';
  MailApp.sendEmail(email, (hasError ? '⚠️' : '✅') + ' Метрика: ежемесячное обновление', body);
  Logger.log('Отчёт отправлен на ' + email);
}

// null/undefined → «—» (нет новых данных), число → «+N»
function fmtCount(n) {
  return (n === null || n === undefined) ? '—' : '+' + n;
}

function createMonthlyTrigger() {
  removeTriggersFor('runMonthlyUpdate');
  removeTriggersFor('continueMonthlyUpdate');
  ScriptApp.newTrigger('runMonthlyUpdate').timeBased().onMonthDay(2).atHour(9).create();
  Logger.log('Триггер создан: 2-е число каждого месяца в 9:00');
}

// Возвращает список «единиц обработки» бренда: для обычного бренда — один счётчик
// без суффикса, для бренда с центрами — по счётчику на каждый центр с суффиксом _<suffix>
function brandUnits(brand) {
  if (brand.centers) {
    return brand.centers.map(function(c) {
      return { counterId: c.counterId, suffix: '_' + c.suffix };
    });
  }
  return [{ counterId: brand.counterId, suffix: '' }];
}

function updateMetrikaBrand(brand, overwrite) {
  Logger.log('=== ' + brand.name + (overwrite ? ' [ПОЛНАЯ ПЕРЕЗАПИСЬ]' : ' [ТОЛЬКО НОВОЕ]') + ' ===');
  CURRENT_BRAND = brand.name;
  var ss = SpreadsheetApp.openById(brand.sheetId);
  var stats = { name: brand.name, traffic: null, sources: null, adv: null, pages: null };
  var units = brandUnits(brand);
  for (var u = 0; u < units.length; u++) {
    if (units[u].suffix) Logger.log('--- центр ' + units[u].suffix + ' (счётчик ' + units[u].counterId + ') ---');
    updateMain(units[u].counterId, units[u].suffix, ss, overwrite, stats);
    updatePages(units[u].counterId, units[u].suffix, ss, overwrite, stats);
  }
  Logger.log('=== ' + brand.name + ' готово ===');
  return stats;
}

// Обновить ОДИН центр бренда с центрами — чтобы уложиться в лимит времени Apps Script
function updateMetrikaCenter(brand, centerSuffix, overwrite) {
  Logger.log('=== ' + brand.name + ' / центр ' + centerSuffix + (overwrite ? ' [ПЕРЕЗАПИСЬ]' : ' [НОВОЕ]') + ' ===');
  CURRENT_BRAND = brand.name + '/' + centerSuffix;
  var ss = SpreadsheetApp.openById(brand.sheetId);
  var center = null;
  for (var i = 0; i < (brand.centers || []).length; i++) {
    if (brand.centers[i].suffix === centerSuffix) { center = brand.centers[i]; break; }
  }
  var stats = { name: brand.name + '/' + centerSuffix, traffic: null, sources: null, adv: null, pages: null };
  if (!center) {
    // Возвращаем пустую статистику, а не undefined: иначе падает письмо-отчёт
    Logger.log('Центр не найден: ' + centerSuffix);
    RUN_ERRORS.push({ brand: stats.name, detail: 'центр «' + centerSuffix + '» не найден в METRIKA_BRANDS' });
    return stats;
  }
  var suffix = '_' + center.suffix;
  updateMain(center.counterId, suffix, ss, overwrite, stats);
  updatePages(center.counterId, suffix, ss, overwrite, stats);
  Logger.log('=== ' + brand.name + ' / ' + centerSuffix + ' готово ===');
  return stats;
}

function updateSourcesBlock(counterId, ss, range, suffix) {
  suffix = suffix || '';
  var errorsBefore = RUN_ERRORS.length;
  var sources = fetchBytime(counterId, 'ym:s:visits', 'ym:s:trafficSource', range[0], range[1], 'lastsign');
  var sourceRows = [];
  if (sources.time_intervals && sources.data) {
    for (var i = 0; i < sources.data.length; i++) {
      var row = sources.data[i];
      if (!row.dimensions || !row.dimensions[0]) continue;
      for (var t = 0; t < sources.time_intervals.length; t++) {
        var dateLabel = normalizeMonthDate(sources.time_intervals[t]);
        if (row.metrics[0][t] > 0) sourceRows.push([dateLabel, row.dimensions[0].name, row.metrics[0][t], '']);
      }
    }
  }

  var SUB_SOURCES = [
    { dim: 'ym:s:sourceEngine', filter: "ym:s:trafficSource=='social'", parent: 'Переходы из социальных сетей' },
    { dim: 'ym:s:messenger',            filter: null, parent: 'Переходы из мессенджеров' },
    { dim: 'ym:s:recommendationSystem', filter: null, parent: 'Переходы из рекомендательных систем' }
  ];
  for (var s = 0; s < SUB_SOURCES.length; s++) {
    var cfg = SUB_SOURCES[s];
    var resp = fetchBytime(counterId, 'ym:s:visits', cfg.dim, range[0], range[1], 'lastsign', cfg.filter);
    if (resp.time_intervals && resp.data) {
      for (var i = 0; i < resp.data.length; i++) {
        var row = resp.data[i];
        if (!row.dimensions || !row.dimensions[0]) continue;
        var name = row.dimensions[0].name;
        if (!name || name === '(none)' || name === 'не определено') continue;
        for (var t = 0; t < resp.time_intervals.length; t++) {
          var dateLabel = normalizeMonthDate(resp.time_intervals[t]);
          if (row.metrics[0][t] > 0) sourceRows.push([dateLabel, name, row.metrics[0][t], cfg.parent]);
        }
      }
    }
  }
  // Если упал хоть один из четырёх запросов, блок не пишем совсем: иначе месяц
  // запишется без детализации, а следующий запуск начнёт со следующего месяца
  // и дыра останется навсегда. Без записи месяц будет запрошен повторно.
  if (RUN_ERRORS.length > errorsBefore) {
    Logger.log('metrika_sources' + suffix + ': были ошибки API — лист не обновлён, данные будут запрошены при следующем запуске');
    return 0;
  }
  // одна запись в лист вместо четырёх — каждый вызов setValues стоит времени
  return appendToSheet(ss, 'metrika_sources' + suffix, ['date','source','visits','parent'], sourceRows);
}

// Полный диапазон — для режима overwrite
function getFullDateRange() {
  var now = new Date();
  var lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
  return ['2025-01-01', formatLocalDate(lastDay)];
}

// Умный диапазон — только с месяца после последнего имеющегося
// Возвращает null если данные уже актуальны
function getSmartDateRange(existingDates) {
  var now = new Date();
  var lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
  var end = formatLocalDate(lastDay);

  if (existingDates.size === 0) {
    return ['2025-01-01', end];
  }

  var months = Array.from(existingDates).sort();
  var latest = months[months.length - 1]; // 'yyyy-MM'

  var year = parseInt(latest.substring(0, 4));
  var month = parseInt(latest.substring(5, 7)) + 1;
  if (month > 12) { month = 1; year++; }
  var start = year + '-' + ('0' + month).slice(-2) + '-01';

  if (start > end) return null;
  return [start, end];
}

function updateMain(counterId, suffix, ss, overwrite, stats) {
  suffix = suffix || '';
  // --- metrika_traffic ---
  if (overwrite) clearSheet(ss, 'metrika_traffic' + suffix);
  var existingTraffic = overwrite ? new Set() : getExistingDates(ss, 'metrika_traffic' + suffix);
  var trafficRange = overwrite ? getFullDateRange() : getSmartDateRange(existingTraffic);
  if (trafficRange) {
    var traffic = fetchBytime(counterId,
      'ym:s:visits,ym:s:pageviews,ym:s:users,ym:s:bounceRate,ym:s:avgVisitDurationSeconds',
      null, trafficRange[0], trafficRange[1]);
    var trafficRows = [];
    if (traffic.time_intervals && traffic.data && traffic.data[0]) {
      var m = traffic.data[0].metrics;
      for (var t = 0; t < traffic.time_intervals.length; t++) {
        var dateLabel = normalizeMonthDate(traffic.time_intervals[t]);
        trafficRows.push([dateLabel, m[0][t], m[1][t], m[2][t], Math.round(m[3][t]*10)/10, Math.round(m[4][t])]);
      }
    }
    var trafficCount = appendToSheet(ss, 'metrika_traffic' + suffix, ['date','visits','pageviews','users','bounceRate','avgDuration'], trafficRows);
    if (stats) stats.traffic = (stats.traffic || 0) + trafficCount;
  } else {
    Logger.log('metrika_traffic' + suffix + ': нет новых данных');
  }

  // --- metrika_sources ---
  if (overwrite) clearSheet(ss, 'metrika_sources' + suffix);
  var existingSources = overwrite ? new Set() : getExistingDates(ss, 'metrika_sources' + suffix);
  var sourcesRange = overwrite ? getFullDateRange() : getSmartDateRange(existingSources);
  if (sourcesRange) {
    var srcCount = updateSourcesBlock(counterId, ss, sourcesRange, suffix);
    if (stats) stats.sources = (stats.sources || 0) + srcCount;
  } else {
    Logger.log('metrika_sources' + suffix + ': нет новых данных');
  }

  // --- metrika_adv ---
  if (overwrite) clearSheet(ss, 'metrika_adv' + suffix);
  var existingAdv = overwrite ? new Set() : getExistingDates(ss, 'metrika_adv' + suffix);
  var advRange = overwrite ? getFullDateRange() : getSmartDateRange(existingAdv);
  if (advRange) {
    var adv = fetchBytime(counterId,
      'ym:s:visits,ym:s:users,ym:s:bounceRate,ym:s:avgVisitDurationSeconds',
      'ym:s:LastSignAdvEngine', advRange[0], advRange[1]);
    var advRows = [];
    if (adv.time_intervals && adv.data) {
      for (var i = 0; i < adv.data.length; i++) {
        var row = adv.data[i];
        if (!row.dimensions || !row.dimensions[0]) continue;
        for (var t = 0; t < adv.time_intervals.length; t++) {
          var dateLabel = normalizeMonthDate(adv.time_intervals[t]);
          if (row.metrics[0][t] > 0) advRows.push([dateLabel, row.dimensions[0].name, row.metrics[0][t], row.metrics[1][t], Math.round(row.metrics[2][t]*10)/10, Math.round(row.metrics[3][t])]);
        }
      }
    }
    var advCount = appendToSheet(ss, 'metrika_adv' + suffix, ['date','advSystem','visits','users','bounceRate','avgDuration'], advRows);
    if (stats) stats.adv = (stats.adv || 0) + advCount;
  } else {
    Logger.log('metrika_adv' + suffix + ': нет новых данных');
  }
}

function updatePages(counterId, suffix, ss, overwrite, stats) {
  suffix = suffix || '';
  if (overwrite) clearSheet(ss, 'metrika_pages' + suffix);
  var existingPages = overwrite ? new Set() : getExistingDates(ss, 'metrika_pages' + suffix);
  var months = getCompletedMonths();
  var pageRows = [];
  for (var mi = 0; mi < months.length; mi++) {
    var mo = months[mi];
    var monthKey = mo.label.substring(0, 7);
    if (existingPages.has(monthKey)) { Logger.log('Пропуск ' + monthKey + ' — уже есть'); continue; }
    Logger.log('Загружаем страницы за ' + monthKey + ' ' + ('metrika_pages' + suffix));
    var pages = fetchData(counterId,
      'ym:s:visits,ym:s:bounceRate,ym:s:avgVisitDurationSeconds',
      'ym:s:startURLPath', mo.date1, mo.date2);
    if (pages.data) {
      for (var i = 0; i < pages.data.length; i++) {
        var row = pages.data[i];
        if (!row.dimensions || !row.dimensions[0]) continue;
        pageRows.push([mo.label, row.dimensions[0].name, row.metrics[0], Math.round(row.metrics[1]*10)/10, Math.round(row.metrics[2])]);
      }
    }
  }
  var pagesCount = appendToSheet(ss, 'metrika_pages' + suffix, ['date','page','visits','bounceRate','avgDuration'], pageRows);
  if (stats) stats.pages = (stats.pages || 0) + pagesCount;
}

function fetchBytime(counterId, metrics, dimensions, date1, date2, attribution, filters) {
  var url = 'https://api-metrika.yandex.net/stat/v1/data/bytime' +
    '?id=' + counterId +
    '&metrics=' + encodeURIComponent(metrics) +
    '&date1=' + date1 + '&date2=' + date2 +
    '&group=month&lang=ru&limit=200';
  if (dimensions) url += '&dimensions=' + encodeURIComponent(dimensions);
  if (attribution) url += '&attribution=' + attribution;
  if (filters) url += '&filters=' + encodeURIComponent(filters);
  return fetchWithRetry(url);
}

function fetchData(counterId, metrics, dimensions, date1, date2) {
  var url = 'https://api-metrika.yandex.net/stat/v1/data' +
    '?id=' + counterId +
    '&metrics=' + encodeURIComponent(metrics) +
    '&dimensions=' + encodeURIComponent(dimensions) +
    '&date1=' + date1 + '&date2=' + date2 +
    '&sort=' + encodeURIComponent('-' + metrics.split(',')[0]) +
    '&lang=ru&limit=30';
  return fetchWithRetry(url);
}

// Запрос с автоповтором: при 429 и 5xx (лимит запросов, сбой сервера)
// повторяет с паузой, при ошибке данных (напр. «запрос слишком сложный») —
// с более грубым семплированием: full → medium → low.
// Ошибки доступа (401/403) семплированием не лечатся — прекращаем сразу.
function fetchWithRetry(baseUrl) {
  var accuracies = ['full', 'medium', 'low'];
  var data;
  for (var a = 0; a < accuracies.length; a++) {
    var url = baseUrl + '&accuracy=' + accuracies[a];
    Logger.log('GET ' + url);
    var res, code;
    for (var t = 0; t < 3; t++) {
      res = UrlFetchApp.fetch(url, { headers: { Authorization: 'OAuth ' + getToken_() }, muteHttpExceptions: true });
      code = res.getResponseCode();
      if (code !== 429 && code < 500) break;
      Logger.log('HTTP ' + code + ' — пауза ' + (t + 1) + ' сек');
      Utilities.sleep(1000 * (t + 1));
    }
    data = parseApiResponse(res, code);
    if (!data.errors) return data;
    Logger.log('Ошибка (accuracy=' + accuracies[a] + '): ' + JSON.stringify(data.errors));
    if (code === 401 || code === 403) {
      Logger.log('HTTP ' + code + ' — проблема с токеном или доступом к счётчику, повторять бессмысленно');
      break;
    }
  }
  Logger.log('Не удалось получить данные');
  RUN_ERRORS.push({ brand: CURRENT_BRAND, detail: JSON.stringify(data.errors) });
  return data;
}

// Ответ API → объект. Сбойный ответ (HTML-страница 502 и т.п.) превращаем
// в обычную ошибку API, чтобы он не ронял всё выполнение на JSON.parse
function parseApiResponse(res, code) {
  var text = res.getContentText();
  try {
    return JSON.parse(text);
  } catch (e) {
    return { errors: [{ message: 'HTTP ' + code + ': ответ не JSON — ' + text.substring(0, 120) }] };
  }
}

function formatLocalDate(d) {
  var year = d.getFullYear();
  var month = ('0' + (d.getMonth() + 1)).slice(-2);
  var day = ('0' + d.getDate()).slice(-2);
  return year + '-' + month + '-' + day;
}

function getCompletedMonths() {
  var now = new Date();
  var months = [];
  for (var i = 13; i >= 1; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    var year = d.getFullYear();
    var month = ('0' + (d.getMonth() + 1)).slice(-2);
    var lastDay = new Date(year, d.getMonth() + 1, 0).getDate();
    months.push({ date1: year+'-'+month+'-01', date2: year+'-'+month+'-'+lastDay, label: year+'-'+month+'-01' });
  }
  return months;
}

function getExistingDates(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return new Set();
  var dates = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  // Пояс таблицы, а не скрипта: дата «1-е число 00:00» хранится в поясе таблицы,
  // и в другом поясе она может прочитаться как последний день прошлого месяца
  var tz = ss.getSpreadsheetTimeZone();
  var set = new Set();
  dates.forEach(function(row) {
    if (!row[0]) return;
    var key = row[0] instanceof Date
      ? Utilities.formatDate(row[0], tz, 'yyyy-MM')
      : String(row[0]).substring(0, 7);
    set.add(key);
  });
  return set;
}

function clearSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (sheet) { sheet.clearContents(); Logger.log(name + ': очищен'); }
}

// Запись пачкой: один вызов setValues вместо appendRow на каждую строку
// (appendRow — отдельный вызов Sheets API, на сотнях строк это минуты)
function appendToSheet(ss, name, headers, rows) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) { sheet = ss.insertSheet(name); sheet.appendRow(headers); }
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  if (rows.length) {
    var width = headers.length;
    var values = rows.map(function(r) {
      var out = r.slice(0, width);
      while (out.length < width) out.push('');
      return out;
    });
    sheet.getRange(sheet.getLastRow() + 1, 1, values.length, width).setValues(values);
  }
  Logger.log(name + ': добавлено ' + rows.length + ' строк');
  return rows.length;
}
