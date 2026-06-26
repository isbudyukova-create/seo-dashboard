var TOKEN = 'y0__wgBEPjhm7YDGNqLQyCJi7PmF1BREbtLc_MmoXT3bgQ8kVRqwVOp';

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
  }
];

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

// --- Только источники (metrika_sources) ---
function metrikaStomatologySourcesFull()  { updateSourcesOnly(METRIKA_BRANDS[0], true); }
function metrikaStomatologySourcesNew()   { updateSourcesOnly(METRIKA_BRANDS[0], false); }
function metrikaZdorovenokSourcesFull()   { updateSourcesOnly(METRIKA_BRANDS[1], true); }
function metrikaZdorovenokSourcesNew()    { updateSourcesOnly(METRIKA_BRANDS[1], false); }
function metrikaKosmetologiyaSourcesFull(){ updateSourcesOnly(METRIKA_BRANDS[2], true); }
function metrikaKosmetologiyaSourcesNew() { updateSourcesOnly(METRIKA_BRANDS[2], false); }
function metrikaKdlSourcesFull()          { updateSourcesOnly(METRIKA_BRANDS[3], true); }
function metrikaKdlSourcesNew()           { updateSourcesOnly(METRIKA_BRANDS[3], false); }
function metrikaDinoSourcesFull()         { updateSourcesOnly(METRIKA_BRANDS[4], true); }
function metrikaDinoSourcesNew()          { updateSourcesOnly(METRIKA_BRANDS[4], false); }
function metrikaOftalmSourcesFull()       { updateSourcesOnly(METRIKA_BRANDS[5], true); }
function metrikaOftalmSourcesNew()        { updateSourcesOnly(METRIKA_BRANDS[5], false); }

// Перезаписать metrika_sources у всех брендов (для миграции)
function runAllSourcesFull() {
  for (var i = 0; i < METRIKA_BRANDS.length; i++) {
    updateSourcesOnly(METRIKA_BRANDS[i], true);
    if (i < METRIKA_BRANDS.length - 1) Utilities.sleep(3000);
  }
}

function runMonthlyUpdate() {
  for (var i = 0; i < METRIKA_BRANDS.length; i++) {
    updateMetrikaBrand(METRIKA_BRANDS[i], false);
    if (i < METRIKA_BRANDS.length - 1) Utilities.sleep(3000);
  }
}

function createMonthlyTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) ScriptApp.deleteTrigger(triggers[i]);
  ScriptApp.newTrigger('runMonthlyUpdate').timeBased().onMonthDay(2).atHour(9).create();
  Logger.log('Триггер создан: 2-е число каждого месяца в 9:00');
}

function updateMetrikaBrand(brand, overwrite) {
  Logger.log('=== ' + brand.name + (overwrite ? ' [ПОЛНАЯ ПЕРЕЗАПИСЬ]' : ' [ТОЛЬКО НОВОЕ]') + ' ===');
  var ss = SpreadsheetApp.openById(brand.sheetId);
  updateMain(brand, ss, overwrite);
  Utilities.sleep(2000);
  updatePages(brand, ss, overwrite);
  Logger.log('=== ' + brand.name + ' готово ===');
}

function updateSourcesOnly(brand, overwrite) {
  Logger.log('=== ' + brand.name + ' [ТОЛЬКО SOURCES' + (overwrite ? ', ПЕРЕЗАПИСЬ' : ', НОВОЕ') + '] ===');
  var ss = SpreadsheetApp.openById(brand.sheetId);
  if (overwrite) clearSheet(ss, 'metrika_sources');
  var existingSources = overwrite ? new Set() : getExistingDates(ss, 'metrika_sources');
  var sourcesRange = overwrite ? getFullDateRange() : getSmartDateRange(existingSources);
  if (!sourcesRange) { Logger.log('metrika_sources: нет новых данных'); return; }
  updateSourcesBlock(brand.counterId, ss, sourcesRange);
  Logger.log('=== ' + brand.name + ' sources готово ===');
}

function updateSourcesBlock(counterId, ss, range) {
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
  appendToSheet(ss, 'metrika_sources', ['date','source','visits','parent'], sourceRows);

  var SUB_SOURCES = [
    { dim: 'ym:s:sourceEngine', filter: "ym:s:trafficSource=='social'", parent: 'Переходы из социальных сетей' },
    { dim: 'ym:s:messenger',            filter: null, parent: 'Переходы из мессенджеров' },
    { dim: 'ym:s:recommendationSystem', filter: null, parent: 'Переходы из рекомендательных систем' }
  ];
  for (var s = 0; s < SUB_SOURCES.length; s++) {
    var cfg = SUB_SOURCES[s];
    var resp = fetchBytime(counterId, 'ym:s:visits', cfg.dim, range[0], range[1], 'lastsign', cfg.filter);
    var subRows = [];
    if (resp.time_intervals && resp.data) {
      for (var i = 0; i < resp.data.length; i++) {
        var row = resp.data[i];
        if (!row.dimensions || !row.dimensions[0]) continue;
        var name = row.dimensions[0].name;
        if (!name || name === '(none)' || name === 'не определено') continue;
        for (var t = 0; t < resp.time_intervals.length; t++) {
          var dateLabel = normalizeMonthDate(resp.time_intervals[t]);
          if (row.metrics[0][t] > 0) subRows.push([dateLabel, name, row.metrics[0][t], cfg.parent]);
        }
      }
    }
    if (subRows.length) appendToSheet(ss, 'metrika_sources', ['date','source','visits','parent'], subRows);
  }
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

function updateMain(brand, ss, overwrite) {
  // --- metrika_traffic ---
  if (overwrite) clearSheet(ss, 'metrika_traffic');
  var existingTraffic = overwrite ? new Set() : getExistingDates(ss, 'metrika_traffic');
  var trafficRange = overwrite ? getFullDateRange() : getSmartDateRange(existingTraffic);
  if (trafficRange) {
    var traffic = fetchBytime(brand.counterId,
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
    appendToSheet(ss, 'metrika_traffic', ['date','visits','pageviews','users','bounceRate','avgDuration'], trafficRows);
  } else {
    Logger.log('metrika_traffic: нет новых данных');
  }

  // --- metrika_sources ---
  if (overwrite) clearSheet(ss, 'metrika_sources');
  var existingSources = overwrite ? new Set() : getExistingDates(ss, 'metrika_sources');
  var sourcesRange = overwrite ? getFullDateRange() : getSmartDateRange(existingSources);
  if (sourcesRange) {
    updateSourcesBlock(brand.counterId, ss, sourcesRange);
  } else {
    Logger.log('metrika_sources: нет новых данных');
  }

  // --- metrika_adv ---
  if (overwrite) clearSheet(ss, 'metrika_adv');
  var existingAdv = overwrite ? new Set() : getExistingDates(ss, 'metrika_adv');
  var advRange = overwrite ? getFullDateRange() : getSmartDateRange(existingAdv);
  if (advRange) {
    var adv = fetchBytime(brand.counterId,
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
    appendToSheet(ss, 'metrika_adv', ['date','advSystem','visits','users','bounceRate','avgDuration'], advRows);
  } else {
    Logger.log('metrika_adv: нет новых данных');
  }
}

function updatePages(brand, ss, overwrite) {
  if (overwrite) clearSheet(ss, 'metrika_pages');
  var existingPages = overwrite ? new Set() : getExistingDates(ss, 'metrika_pages');
  var months = getCompletedMonths();
  var pageRows = [];
  for (var mi = 0; mi < months.length; mi++) {
    var mo = months[mi];
    var monthKey = mo.label.substring(0, 7);
    if (existingPages.has(monthKey)) { Logger.log('Пропуск ' + monthKey + ' — уже есть'); continue; }
    Logger.log('Загружаем страницы за ' + monthKey);
    var pages = fetchData(brand.counterId,
      'ym:s:visits,ym:s:bounceRate,ym:s:avgVisitDurationSeconds',
      'ym:s:startURLPath', mo.date1, mo.date2);
    if (pages.data) {
      for (var i = 0; i < pages.data.length; i++) {
        var row = pages.data[i];
        if (!row.dimensions || !row.dimensions[0]) continue;
        pageRows.push([mo.label, row.dimensions[0].name, row.metrics[0], Math.round(row.metrics[1]*10)/10, Math.round(row.metrics[2])]);
      }
    }
    Utilities.sleep(500);
  }
  appendToSheet(ss, 'metrika_pages', ['date','page','visits','bounceRate','avgDuration'], pageRows);
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

// Запрос с автоповтором: при ошибке (напр. «запрос слишком сложный»)
// повторяет с более грубым семплированием — full → medium → low
function fetchWithRetry(baseUrl) {
  var accuracies = ['full', 'medium', 'low'];
  var data;
  for (var a = 0; a < accuracies.length; a++) {
    var url = baseUrl + '&accuracy=' + accuracies[a];
    Logger.log('GET ' + url);
    var res = UrlFetchApp.fetch(url, { headers: { Authorization: 'OAuth ' + TOKEN }, muteHttpExceptions: true });
    data = JSON.parse(res.getContentText());
    if (!data.errors) return data;
    Logger.log('Ошибка (accuracy=' + accuracies[a] + '): ' + JSON.stringify(data.errors));
    if (a < accuracies.length - 1) Utilities.sleep(1000);
  }
  Logger.log('Не удалось получить данные даже с accuracy=low');
  return data;
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
  var tz = Session.getScriptTimeZone();
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

function appendToSheet(ss, name, headers, rows) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) { sheet = ss.insertSheet(name); sheet.appendRow(headers); }
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  for (var i = 0; i < rows.length; i++) sheet.appendRow(rows[i]);
  Logger.log(name + ': добавлено ' + rows.length + ' строк');
}
