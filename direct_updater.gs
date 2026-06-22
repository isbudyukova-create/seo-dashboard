// ─── КОНФИГУРАЦИЯ ──────────────────────────────────────────────────────────

var TOKENS = {
  'stom_dino':  'y0__wgBEIWWzoEFGNqLQyDumNfxF6nn9_jU4hBDZD5AqXVB6LVGrOuV',  // Стоматология + Дино
  // 'zdorovenok': 'TOKEN_ЗДЕСЬ',  // добавить позже
};

var DIRECT_BRANDS = [
  {
    name:    'Стоматология',
    sheetId: '18_wK4ym4OvY5YuCtTI7ZmEZhbrxXdGcflIL8sIQxxMo',
    token:   TOKENS['stom_dino'],
    filter:  ''   // уточнить после первого запуска — посмотреть какие кампании приходят
  },
  // Дино — тот же токен, другой фильтр. Раскомментировать после теста стоматологии:
  // { name: 'Дино', sheetId: '1rWn4O1OG4iQQVZakrHlfEhp0bkC0aqFXu0MjcFTfkQk', token: TOKENS['stom_dino'], filter: 'Дино' },
  // Здоровенок — добавить токен:
  // { name: 'Здоровенок', sheetId: '1CsSX3R0eA0mHTM8R3VDTyjenU_buDnQwlgZ6xPVkCK0', token: TOKENS['zdorovenok'], filter: '' },
];

// ─── ТОЧКИ ВХОДА ───────────────────────────────────────────────────────────

function directStomatologyFull() { updateDirectBrand(DIRECT_BRANDS[0], true); }
function directStomatologyNew()  { updateDirectBrand(DIRECT_BRANDS[0], false); }

function runWeeklyUpdate() {
  for (var i = 0; i < DIRECT_BRANDS.length; i++) {
    updateDirectBrand(DIRECT_BRANDS[i], false);
    if (i < DIRECT_BRANDS.length - 1) Utilities.sleep(3000);
  }
}

function createWeeklyTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) ScriptApp.deleteTrigger(triggers[i]);
  ScriptApp.newTrigger('runWeeklyUpdate')
    .timeBased().everyWeeks(1).onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).create();
  Logger.log('Триггер создан: каждый понедельник в 8:00');
}

// ─── ОСНОВНАЯ ЛОГИКА ───────────────────────────────────────────────────────

function updateDirectBrand(brand, overwrite) {
  Logger.log('=== ' + brand.name + (overwrite ? ' [ПОЛНАЯ ПЕРЕЗАПИСЬ]' : ' [ТОЛЬКО НОВОЕ]') + ' ===');
  var ss    = SpreadsheetApp.openById(brand.sheetId);
  var token = brand.token;
  if (!token) throw new Error('Нет токена для бренда: ' + brand.name);

  if (overwrite) clearSheet(ss, 'direct_weekly');
  var existingWeeks = overwrite ? new Set() : getExistingWeeks(ss, 'direct_weekly');

  var dates  = getDateRange();
  var daily  = fetchDirectReport(token, dates[0], dates[1]);
  var weekly = aggregateToWeekly(daily, brand.filter, existingWeeks);

  appendToSheet(ss, 'direct_weekly',
    ['date','campaign','sov','impressions','clicks','cost','ctr','cpc','bounces','conversions','conv_rate','cpa'],
    weekly
  );
  Logger.log('=== ' + brand.name + ' готово ===');
}

// ─── API ДИРЕКТА ───────────────────────────────────────────────────────────

function fetchDirectReport(token, dateFrom, dateTo) {
  var body = JSON.stringify({
    params: {
      SelectionCriteria: { DateFrom: dateFrom, DateTo: dateTo },
      FieldNames: ['Date','CampaignName','Impressions','Clicks','Cost','ImpressionShare','BounceRate','Conversions'],
      ReportName:    'DashboardSync',
      ReportType:    'CAMPAIGN_PERFORMANCE_REPORT',
      DateRangeType: 'CUSTOM_DATE',
      Format:        'TSV',
      IncludeVAT:    'YES',
      IncludeDiscount: 'NO'
    }
  });

  var options = {
    method:      'post',
    contentType: 'application/json',
    headers: {
      'Authorization':       'Bearer ' + token,
      'Accept-Language':     'ru',
      'skipReportHeader':    'true',
      'skipColumnHeader':    'false',
      'skipReportSummary':   'true',
      'returnMoneyInMicros': 'false',
      'processingMode':      'auto'
    },
    payload:            body,
    muteHttpExceptions: true
  };

  var resp, attempts = 0;
  do {
    resp = UrlFetchApp.fetch('https://api.direct.yandex.com/json/v5/reports', options);
    Logger.log('HTTP ' + resp.getResponseCode());
    if (resp.getResponseCode() === 202) Utilities.sleep(10000);
    attempts++;
  } while (resp.getResponseCode() === 202 && attempts < 12);

  if (resp.getResponseCode() !== 200) {
    throw new Error('Direct API ошибка ' + resp.getResponseCode() + ': ' + resp.getContentText().slice(0, 300));
  }

  var rows    = resp.getContentText().trim().split('\n');
  var headers = rows[0].split('\t');
  return rows.slice(1).map(function(r) {
    var cells = r.split('\t');
    var obj   = {};
    headers.forEach(function(h, i) { obj[h] = cells[i] || ''; });
    return obj;
  });
}

// ─── АГРЕГАЦИЯ ПО НЕДЕЛЯМ ──────────────────────────────────────────────────

function aggregateToWeekly(daily, filter, existingWeeks) {
  var weekMap = {};
  var flt     = (filter || '').toLowerCase();

  daily.forEach(function(row) {
    var campaign = row['CampaignName'] || '';
    if (flt && campaign.toLowerCase().indexOf(flt) === -1) return;

    var date    = new Date(row['Date']);
    var monday  = getMonday(date);
    var weekKey = formatDate(monday) + '|' + campaign;
    if (existingWeeks.has(weekKey)) return;

    if (!weekMap[weekKey]) {
      weekMap[weekKey] = { date: formatDate(monday), campaign: campaign,
                           impr: 0, clicks: 0, cost: 0, conv: 0,
                           sovSum: 0, sovCnt: 0, bounceSum: 0, bounceCnt: 0 };
    }
    var w = weekMap[weekKey];
    w.impr   += parseInt(row['Impressions'])  || 0;
    w.clicks += parseInt(row['Clicks'])       || 0;
    w.cost   += parseFloat(row['Cost'])       || 0;
    w.conv   += parseInt(row['Conversions'])  || 0;
    var sov   = row['ImpressionShare'];
    if (sov && sov !== '--') { w.sovSum += parseFloat(sov); w.sovCnt++; }
    var br    = row['BounceRate'];
    if (br  && br  !== '--') { w.bounceSum += parseFloat(br);  w.bounceCnt++; }
  });

  return Object.keys(weekMap).sort().map(function(key) {
    var w        = weekMap[key];
    var sov      = w.sovCnt    > 0 ? +(w.sovSum / w.sovCnt).toFixed(1)             : 0;
    var ctr      = w.impr      > 0 ? +(w.clicks / w.impr * 100).toFixed(2)         : 0;
    var cpc      = w.clicks    > 0 ? Math.round(w.cost / w.clicks)                 : 0;
    var bounces  = w.bounceCnt > 0 ? +(w.bounceSum / w.bounceCnt / 100).toFixed(4) : 0;
    var convRate = w.clicks    > 0 ? +(w.conv / w.clicks * 100).toFixed(2)         : 0;
    var cpa      = w.conv      > 0 ? Math.round(w.cost / w.conv)                   : 0;
    return [w.date, w.campaign, sov, w.impr, w.clicks, Math.round(w.cost), ctr, cpc, bounces, w.conv, convRate, cpa];
  });
}

// ─── ХЕЛПЕРЫ ───────────────────────────────────────────────────────────────

function getExistingWeeks(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return new Set();
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  var tz   = Session.getScriptTimeZone();
  var set  = new Set();
  data.forEach(function(row) {
    if (!row[0]) return;
    var d = row[0] instanceof Date ? Utilities.formatDate(row[0], tz, 'yyyy-MM-dd') : String(row[0]);
    set.add(d + '|' + (row[1] || ''));
  });
  return set;
}

function getDateRange() {
  var now     = new Date();
  var lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
  return ['2025-01-01', formatDate(lastDay)];
}

function getMonday(d) {
  var day  = d.getDay();
  var diff = (day === 0 ? -6 : 1 - day);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
}

function formatDate(d) {
  var y   = d.getFullYear();
  var m   = ('0' + (d.getMonth() + 1)).slice(-2);
  var day = ('0' + d.getDate()).slice(-2);
  return y + '-' + m + '-' + day;
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
