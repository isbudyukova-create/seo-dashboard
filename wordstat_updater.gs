// ─── КОНФИГУРАЦИЯ ──────────────────────────────────────────────────────────
//
// Выгрузка помесячной частоты запросов из Вордстата (Yandex Search API v2)
// в общую таблицу Wordstat. Список запросов — лист wordstat_queries
// (колонки «Группа», «Запрос»), результат — лист wordstat
// (Месяц | Группа | Запрос | Частота), перезаписывается целиком.
//
// API-ключ НЕ хранится в коде: Настройки проекта → Свойства скрипта →
// WORDSTAT_API_KEY = <секретный ключ сервисного аккаунта>

var WORDSTAT_SHEET_ID = '10rkYmnCrMATEzz3tQDLpuQItgW-IxI9dqodTUkiCnFU';
var FOLDER_ID         = 'b1gi139uocf6sl23ffqj';   // каталог в организации organization-sadokclinic
var REGIONS           = ['11079'];                // Нижегородская область
var FROM_DATE         = '2025-01-01';             // начало истории; конец — последний полный месяц

var QUERIES_SHEET = 'wordstat_queries';
var DATA_SHEET    = 'wordstat';
var API_URL       = 'https://searchapi.api.cloud.yandex.net/v2/wordstat/dynamics';

// ─── ТОЧКИ ВХОДА ───────────────────────────────────────────────────────────

function updateWordstat() {
  var key = PropertiesService.getScriptProperties().getProperty('WORDSTAT_API_KEY');
  if (!key) throw new Error('Не задано свойство скрипта WORDSTAT_API_KEY');

  var ss      = SpreadsheetApp.openById(WORDSTAT_SHEET_ID);
  var queries = readQueries(ss);
  var from    = FROM_DATE;
  Logger.log('Запросов: ' + queries.length + ', с ' + from);

  var rows = [], failed = [];
  for (var i = 0; i < queries.length; i++) {
    var q = queries[i];
    var results = fetchDynamics(key, q.query, from);
    if (!results) { failed.push(q.query); continue; }
    results.forEach(function (r) {
      rows.push([r.date.slice(0, 10), q.group, q.query, parseInt(r.count, 10) || 0]);
    });
    Utilities.sleep(200);
  }

  // Если не ответил ни один запрос — старые данные не трогаем
  if (!rows.length) throw new Error('Вордстат не вернул данных, лист не изменён');

  writeData(ss, rows);
  Logger.log('Записано строк: ' + rows.length);
  if (failed.length) Logger.log('Без данных (' + failed.length + '): ' + failed.join(', '));
}

// Раз в месяц, 5-го: прошлый месяц появляется в Вордстате не в первый день.
// Полная перезапись заодно подхватывает правки Яндекса задним числом
var TRIGGER_DAY = 5;

function createMonthlyTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'updateWordstat') ScriptApp.deleteTrigger(triggers[i]);
  }
  ScriptApp.newTrigger('updateWordstat')
    .timeBased().onMonthDay(TRIGGER_DAY).atHour(7).create();
  Logger.log('Триггер создан: ' + TRIGGER_DAY + '-го числа каждого месяца в 7:00');
}

// ─── ОСНОВНАЯ ЛОГИКА ───────────────────────────────────────────────────────

function readQueries(ss) {
  var sheet = ss.getSheetByName(QUERIES_SHEET);
  if (!sheet) throw new Error('Нет листа ' + QUERIES_SHEET);
  var values = sheet.getDataRange().getValues();
  var head   = values[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var gi = head.indexOf('группа'), qi = head.indexOf('запрос');
  if (gi < 0 || qi < 0) throw new Error('В листе ' + QUERIES_SHEET + ' нужны колонки «Группа» и «Запрос»');

  var seen = {}, list = [];
  for (var r = 1; r < values.length; r++) {
    var group = String(values[r][gi]).trim().toLowerCase();
    var query = String(values[r][qi]).trim().toLowerCase().replace(/\s+/g, ' ');
    if (!group || !query) continue;
    var k = group + '|' + query;
    if (seen[k]) continue;
    seen[k] = true;
    list.push({ group: group, query: query });
  }
  return list;
}

// Частота по месяцам; без toDate API отдаёт месяцы по последний полный.
// null — запрос не удался после повторов
function fetchDynamics(key, phrase, from) {
  var payload = {
    phrase:   phrase,
    period:   'PERIOD_MONTHLY',
    fromDate: from + 'T00:00:00Z',
    regions:  REGIONS,
    folderId: FOLDER_ID
  };
  for (var attempt = 1; attempt <= 3; attempt++) {
    var resp = UrlFetchApp.fetch(API_URL, {
      method: 'post',
      contentType: 'application/json; charset=utf-8',
      headers: { Authorization: 'Api-Key ' + key },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    var code = resp.getResponseCode();
    if (code === 200) return JSON.parse(resp.getContentText()).results || [];
    Logger.log('«' + phrase + '»: HTTP ' + code + ' (попытка ' + attempt + ') ' + resp.getContentText().slice(0, 200));
    if (code === 400 || code === 401 || code === 403) return null;  // повтор не поможет
    Utilities.sleep(2000 * attempt);
  }
  return null;
}

function writeData(ss, rows) {
  var sheet = ss.getSheetByName(DATA_SHEET) || ss.insertSheet(DATA_SHEET);
  sheet.clearContents();
  rows.sort(function (a, b) {
    return a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : a[0] < b[0] ? -1 : 1;
  });
  var data = [['Месяц', 'Группа', 'Запрос', 'Частота']].concat(rows);
  // Месяц пишем текстом: иначе Таблицы превратят его в дату с форматом локали
  sheet.getRange(1, 1, data.length, 1).setNumberFormat('@');
  sheet.getRange(1, 1, data.length, 4).setValues(data);
}
