/**
 * Farm Records – Google Sheet server
 *
 * Paste this whole file into Extensions > Apps Script in the farm Google Sheet.
 * See SETUP.md in the GitHub repository for step-by-step instructions.
 *
 * The app sends entries here; this script saves them in the "Events" tab and
 * rebuilds the "Animals" and "Summary" tabs. Lists such as animal types, staff
 * names and treatment types are edited in the "Settings" tab.
 */

// The web address of the app (GitHub Pages). Used to make the one-click setup link.
const APP_ADDRESS = 'https://YOUR-GITHUB-USERNAME.github.io/farm-records/';

const SHEET = { events: 'Events', animals: 'Animals', summary: 'Summary', settings: 'Settings' };

// Columns in the Events tab: [internal name, column heading]. Columns can be moved around
// in the Sheet, but don't rename the headings.
const COLUMNS = [
  ['eventDate', 'Date'],
  ['type', 'Event'],
  ['species', 'Animal type'],
  ['animalId', 'Tag / batch no.'],
  ['count', 'Count'],
  ['breed', 'Breed'],
  ['sex', 'Sex'],
  ['motherId', 'Mother tag'],
  ['source', 'Bought from / source'],
  ['price', 'Price paid (NPR)'],
  ['treatmentType', 'Treatment type'],
  ['medicine', 'Medicine / product'],
  ['weightKg', 'Weight (kg)'],
  ['cause', 'Cause of death / loss'],
  ['buyer', 'Buyer'],
  ['salePrice', 'Sale price (NPR)'],
  ['notes', 'Notes'],
  ['photoUrl', 'Photo'],
  ['recordedBy', 'Recorded by'],
  ['device', 'Device'],
  ['recordedAt', 'Recorded at'],
  ['receivedAt', 'Uploaded at'],
  ['id', 'Entry ID'],
];
const TEXT_FIELDS = ['animalId', 'motherId', 'breed', 'source', 'medicine', 'buyer', 'notes', 'recordedBy', 'device', 'id'];
const NUMBER_FIELDS = ['count', 'price', 'weightKg', 'salePrice'];
const DATE_FIELDS = ['eventDate'];
const TIME_FIELDS = ['recordedAt', 'receivedAt'];

const DEFAULT_SETTINGS = [
  ['species', 'Pig', 'सुँगुर', 'Individual'],
  ['species', 'Goat', 'बाख्रा', 'Individual'],
  ['species', 'Pheasant', 'कालिज (फिजेन्ट)', 'Batch'],
  ['species', 'Chicken', 'कुखुरा', 'Batch'],
  ['staff', 'Farm manager', '', ''],
  ['treatment', 'Vaccination', 'खोप', ''],
  ['treatment', 'Deworming', 'जुकाको औषधि', ''],
  ['treatment', 'Medicine', 'औषधि', ''],
  ['treatment', 'Vitamins / supplements', 'भिटामिन / पूरक आहार', ''],
  ['treatment', 'Vet visit', 'पशु चिकित्सक जाँच', ''],
  ['treatment', 'Other', 'अन्य', ''],
  ['cause', 'Illness', 'रोग', ''],
  ['cause', 'Predator / wild animal', 'जङ्गली जनावर', ''],
  ['cause', 'Injury', 'चोटपटक', ''],
  ['cause', 'Weather (cold / heat)', 'मौसम (चिसो / गर्मी)', ''],
  ['cause', 'Lost / stolen', 'हराएको / चोरी', ''],
  ['cause', 'Unknown', 'थाहा छैन', ''],
  ['cause', 'Other', 'अन्य', ''],
];

// ---------------------------------------------------------------- menu

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Farm Records')
    .addItem('1. Set up sheets', 'setupSheets')
    .addItem('2. Show app setup link', 'showSetupLink')
    .addSeparator()
    .addItem('Refresh Animals & Summary', 'rebuildAll')
    .addItem('Change farm key (disconnects all devices)', 'resetKey')
    .addToUi();
}

function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const summary = ss.getSheetByName(SHEET.summary) || ss.insertSheet(SHEET.summary, 0);
  const animals = ss.getSheetByName(SHEET.animals) || ss.insertSheet(SHEET.animals, 1);
  const events = ss.getSheetByName(SHEET.events) || ss.insertSheet(SHEET.events, 2);
  const settings = ss.getSheetByName(SHEET.settings) || ss.insertSheet(SHEET.settings, 3);

  if (events.getLastRow() === 0) {
    events.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS.map(function (c) { return c[1]; })]);
    styleHeader_(events, COLUMNS.length);
  }
  if (settings.getLastRow() === 0) {
    settings.getRange(1, 1, 1, 4).setValues([['List', 'English', 'Nepali', 'Option']]);
    settings.getRange(2, 1, DEFAULT_SETTINGS.length, 4).setValues(DEFAULT_SETTINGS);
    styleHeader_(settings, 4);
    settings.getRange('F1').setValue('How to use this tab');
    settings.getRange('F2:F7').setValues([
      ['Each row is one choice in a dropdown in the app.'],
      ['List: species = animal types, staff = people entering data, treatment = treatment types, cause = causes of death / loss.'],
      ['For species, Option must be "Individual" (each animal has its own tag) or "Batch" (counted as a group).'],
      ['Nepali is optional – if blank, only English is shown.'],
      ['Changes reach the app the next time it uploads (or press the status button in the app).'],
      ['Do not rename an animal type once it has records – add a new one instead.'],
    ]);
    settings.getRange('F1').setFontWeight('bold');
    settings.setColumnWidth(6, 520);
  }
  // Remove the empty "Sheet1" a new spreadsheet comes with.
  const blank = ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);

  getKey_();
  rebuildAll();
  SpreadsheetApp.getUi().alert(
    'Sheets are ready.\n\nNext: click Deploy > New deployment > Web app ' +
    '(Execute as: Me, Who has access: Anyone), then use Farm Records > 2. Show app setup link.');
}

function showSetupLink() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  let url = props.getProperty('WEB_APP_URL') || '';
  const res = ui.prompt('App setup link',
    'Paste the Web app URL from Deploy > Manage deployments (it ends in /exec).' +
    (url ? '\n\nLeave blank to keep the current one:\n' + url : ''),
    ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  const typed = res.getResponseText().trim();
  if (typed) url = typed;
  if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(url)) {
    ui.alert('That does not look like a web app URL. It should start with https://script.google.com/ and end with /exec');
    return;
  }
  props.setProperty('WEB_APP_URL', url);
  const key = getKey_();
  const code = Utilities.base64EncodeWebSafe(JSON.stringify({ u: url, k: key })).replace(/=+$/, '');
  const link = APP_ADDRESS + '#setup=' + code;
  const html = HtmlService.createHtmlOutput(
    '<div style="font-family:sans-serif;font-size:14px">' +
    '<p>Open this link <b>once</b> on each computer or phone that will enter records. ' +
    'It connects that device to this Sheet.</p>' +
    '<p><a href="' + link + '" target="_blank">Open the app and connect</a></p>' +
    '<p>Or copy it:</p><textarea style="width:100%;height:90px" onclick="this.select()">' + link + '</textarea>' +
    '<p>Manual setup (Settings screen in the app):<br>Server address: <code>' + url + '</code><br>Farm key: <code>' + key + '</code></p>' +
    '<p style="color:#a3271b">Treat this link like a password – anyone with it can add records.</p></div>')
    .setWidth(560).setHeight(420);
  ui.showModalDialog(html, 'App setup link');
}

function resetKey() {
  const ui = SpreadsheetApp.getUi();
  const ok = ui.alert('Change farm key?',
    'Every device will stop uploading until it is set up again with the new link. Continue?', ui.ButtonSet.YES_NO);
  if (ok !== ui.Button.YES) return;
  PropertiesService.getScriptProperties().setProperty('FARM_KEY', newKey_());
  ui.alert('Done. Use Farm Records > 2. Show app setup link to get the new link.');
}

// ---------------------------------------------------------------- web app

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (!p.action) return ContentService.createTextOutput('Farm Records server is running.');
  if (p.key !== getKey_()) return json_({ ok: false, error: 'bad_key' });
  if (p.action === 'bootstrap') {
    return json_({ ok: true, settings: readSettings_(), events: readEvents_(), serverTime: new Date().toISOString() });
  }
  return json_({ ok: false, error: 'unknown_action' });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'bad_request' });
  }
  if (!body || body.key !== getKey_()) return json_({ ok: false, error: 'bad_key' });

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = eventsSheet_();
    const header = headerMap_(sheet);
    const width = sheet.getLastColumn();
    const idCol = header.id;
    const existing = {};
    if (idCol !== undefined && sheet.getLastRow() > 1) {
      sheet.getRange(2, idCol + 1, sheet.getLastRow() - 1, 1).getValues()
        .forEach(function (r) { existing[String(r[0])] = true; });
    }

    const accepted = [];
    const rows = [];
    (body.events || []).forEach(function (ev) {
      if (!ev || !ev.id) return;
      if (existing[ev.id]) { accepted.push(ev.id); return; } // already saved (a retry)
      if (ev.photoData) {
        try { ev.photoUrl = savePhoto_(ev); } catch (err) { ev.photoUrl = 'Photo upload failed: ' + err.message; }
      }
      ev.receivedAt = new Date().toISOString();
      if (!ev.device) ev.device = body.device || '';
      rows.push(toRow_(ev, header, width));
      existing[ev.id] = true;
      accepted.push(ev.id);
    });

    if (rows.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, width).setValues(rows);
      PropertiesService.getScriptProperties().setProperty('LAST_UPLOAD',
        JSON.stringify({ at: new Date().toISOString(), device: body.device || '', count: rows.length }));
      rebuildAll();
    }
    return json_({ ok: true, accepted: accepted });
  } finally {
    lock.releaseLock();
  }
}

// When someone fixes a record directly in the Events tab, refresh the other tabs.
function onEdit(e) {
  if (e && e.range && e.range.getSheet().getName() === SHEET.events) rebuildAll();
}

// ---------------------------------------------------------------- reading & writing

function eventsSheet_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET.events);
  if (!sheet) throw new Error('No "Events" tab. Run Farm Records > 1. Set up sheets.');
  return sheet;
}

function headerMap_(sheet) {
  const byHeading = {};
  COLUMNS.forEach(function (c) { byHeading[c[1].toLowerCase()] = c[0]; });
  const map = {};
  const headings = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0];
  headings.forEach(function (h, i) {
    const key = byHeading[String(h).trim().toLowerCase()];
    if (key && map[key] === undefined) map[key] = i;
  });
  return map;
}

function toRow_(ev, header, width) {
  const row = [];
  for (let i = 0; i < width; i++) row.push('');
  Object.keys(header).forEach(function (key) {
    let v = ev[key];
    if (v === undefined || v === null) v = '';
    if (v === '') { row[header[key]] = ''; return; }
    if (NUMBER_FIELDS.indexOf(key) >= 0 && !isNaN(Number(v))) v = Number(v);
    else if (TIME_FIELDS.indexOf(key) >= 0) { const d = new Date(v); v = isNaN(d) ? String(v) : d; }
    else if (DATE_FIELDS.indexOf(key) >= 0) v = String(v);
    else {
      v = String(v);
      // Keep tag numbers like "007" as text, and never let input become a formula.
      if (TEXT_FIELDS.indexOf(key) >= 0 || /^[=+\-@]/.test(v)) v = "'" + v;
    }
    row[header[key]] = v;
  });
  return row;
}

function readEvents_() {
  const sheet = eventsSheet_();
  if (sheet.getLastRow() < 2) return [];
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const header = headerMap_(sheet);
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  const out = [];
  values.forEach(function (row, i) {
    const ev = {};
    Object.keys(header).forEach(function (key) {
      let v = row[header[key]];
      if (v === undefined || v === null) return;
      if (isDate_(v)) {
        v = DATE_FIELDS.indexOf(key) >= 0 ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : v.toISOString();
      }
      if (v !== '' && v !== null) ev[key] = (NUMBER_FIELDS.indexOf(key) >= 0 && v !== '') ? Number(v) : (typeof v === 'number' ? String(v) : v);
    });
    if (!ev.type || !ev.animalId) return; // blank or unfinished row
    if (!ev.id) ev.id = 'row-' + (i + 2);
    ev.animalId = String(ev.animalId);
    out.push(ev);
  });
  return out;
}

function readSettings_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET.settings);
  const out = { species: [], staff: [], treatment: [], cause: [] };
  if (!sheet || sheet.getLastRow() < 2) return out;
  sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues().forEach(function (r) {
    const list = String(r[0]).trim().toLowerCase();
    const en = String(r[1]).trim();
    if (!list || !en) return;
    if (!out[list]) out[list] = [];
    out[list].push({ en: en, ne: String(r[2]).trim(), option: String(r[3]).trim() });
  });
  return out;
}

function savePhoto_(ev) {
  const m = /^data:(image\/[a-z]+);base64,(.+)$/.exec(ev.photoData);
  if (!m) throw new Error('not an image');
  const props = PropertiesService.getScriptProperties();
  let folder;
  const folderId = props.getProperty('PHOTO_FOLDER_ID');
  if (folderId) { try { folder = DriveApp.getFolderById(folderId); } catch (err) { folder = null; } }
  if (!folder) {
    folder = DriveApp.createFolder('Farm Records Photos');
    props.setProperty('PHOTO_FOLDER_ID', folder.getId());
  }
  const name = [ev.eventDate, ev.species, ev.animalId, ev.type].join(' ').replace(/[\\/:*?"<>|]/g, '-') + '.jpg';
  const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], name);
  return folder.createFile(blob).getUrl();
}

// ---------------------------------------------------------------- Animals & Summary tabs

function rebuildAll() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const events = readEvents_();
  const settings = readSettings_();
  const register = buildRegister_(events);
  const tracking = {};
  settings.species.forEach(function (s) { tracking[s.en] = s.option || ''; });
  writeAnimals_(ss, register, tracking);
  writeSummary_(ss, events, register, settings);
}

function writeAnimals_(ss, register, tracking) {
  const sheet = ss.getSheetByName(SHEET.animals) || ss.insertSheet(SHEET.animals);
  const head = ['Animal type', 'Tracking', 'Tag / batch no.', 'Status', 'Count now', 'Started with', 'How it started',
    'Start date', 'Breed', 'Sex', 'Bought from / source', 'Price paid (NPR)', 'Mother tag', 'Deaths / losses', 'Sold',
    'Last weight (kg)', 'Last weight date', 'Last treatment', 'Last treatment date', 'Last activity'];
  const order = { Active: 0, Sold: 1, Dead: 2 };
  const rows = register.slice().sort(function (a, b) {
    return a.species.localeCompare(b.species) || (order[a.status] - order[b.status]) ||
      a.animalId.localeCompare(b.animalId, undefined, { numeric: true });
  }).map(function (r) {
    return [r.species, tracking[r.species] || '', "'" + r.animalId, r.status === 'Dead' ? 'Dead / lost' : r.status, r.count, r.startCount,
      r.origin, r.startDate, r.breed, r.sex, r.source, r.price, r.motherId ? "'" + r.motherId : '', r.deaths, r.sold,
      r.lastWeight, r.lastWeightDate, r.lastTreatment, r.lastTreatmentDate, r.lastEventDate];
  });
  sheet.clear();
  sheet.getRange(1, 1, 1, head.length).setValues([head]);
  if (rows.length) sheet.getRange(2, 1, rows.length, head.length).setValues(rows);
  styleHeader_(sheet, head.length);
}

function writeSummary_(ss, events, register, settings) {
  const sheet = ss.getSheetByName(SHEET.summary) || ss.insertSheet(SHEET.summary, 0);
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const since = Utilities.formatDate(new Date(now.getTime() - 30 * 86400000), tz, 'yyyy-MM-dd');
  const last = JSON.parse(PropertiesService.getScriptProperties().getProperty('LAST_UPLOAD') || 'null');

  const species = settings.species.map(function (s) { return s.en; });
  register.forEach(function (r) { if (species.indexOf(r.species) < 0) species.push(r.species); });

  const out = [];
  out.push(['Farm Records – Summary', '', '', '', '', '', '']);
  out.push(['Last upload from the farm', last ? Utilities.formatDate(new Date(last.at), tz, 'd MMM yyyy HH:mm') + ' (' + last.device + ')' : 'None yet', '', '', '', '', '']);
  out.push(['This page refreshed', Utilities.formatDate(now, tz, 'd MMM yyyy HH:mm'), '', '', '', '', '']);
  out.push(['', '', '', '', '', '', '']);
  out.push(['Animal type', 'Alive now', 'Live tags / batches', 'Arrived or born (30 days)', 'Died / lost (30 days)', 'Sold (30 days)', 'Treatments (30 days)']);
  const headRow = out.length;
  species.forEach(function (sp) {
    const live = register.filter(function (r) { return r.species === sp && r.status === 'Active'; });
    const recent = events.filter(function (e) { return e.species === sp && String(e.eventDate) >= since; });
    const sum = function (types) {
      return recent.filter(function (e) { return types.indexOf(e.type) >= 0; })
        .reduce(function (n, e) { return n + (Number(e.count) || 1); }, 0);
    };
    out.push([sp,
      live.reduce(function (n, r) { return n + Math.max(0, r.count); }, 0),
      live.length,
      sum(['Arrival', 'Birth']),
      sum(['Death/Loss']),
      sum(['Sale']),
      recent.filter(function (e) { return e.type === 'Treatment'; }).length]);
  });
  out.push(['', '', '', '', '', '', '']);
  out.push(['Latest entries', '', '', '', '', '', '']);
  const latestHead = out.length + 1;
  out.push(['Date', 'Event', 'Animal type', 'Tag / batch no.', 'Details', 'Recorded by', 'Photo']);
  events.slice().sort(function (a, b) {
    return String(b.recordedAt || '').localeCompare(String(a.recordedAt || '')) || String(b.eventDate).localeCompare(String(a.eventDate));
  }).slice(0, 25).forEach(function (e) {
    out.push([e.eventDate || '', e.type, e.species, "'" + e.animalId, details_(e), e.recordedBy || '', e.photoUrl || '']);
  });

  sheet.clear();
  sheet.getRange(1, 1, out.length, 7).setValues(out);
  sheet.getRange(1, 1).setFontSize(16).setFontWeight('bold');
  sheet.getRange(2, 1, 2, 1).setFontWeight('bold');
  sheet.getRange(headRow, 1, 1, 7).setFontWeight('bold').setBackground('#e3efe2');
  sheet.getRange(latestHead - 1, 1).setFontWeight('bold').setFontSize(13);
  sheet.getRange(latestHead, 1, 1, 7).setFontWeight('bold').setBackground('#e3efe2');
  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(5, 360);
}

function details_(e) {
  const p = [];
  const money = function (v) { return 'NPR ' + Number(v).toLocaleString('en-IN'); };
  if (e.type === 'Arrival' || e.type === 'Birth') {
    if (Number(e.count) > 1) p.push('× ' + e.count);
    if (e.breed) p.push(e.breed);
    if (e.sex) p.push(e.sex);
    if (e.motherId) p.push('mother ' + e.motherId);
    if (e.source) p.push('from ' + e.source);
    if (e.price !== undefined && e.price !== '') p.push(money(e.price));
  } else if (e.type === 'Treatment') {
    p.push(e.treatmentType || '');
    if (e.medicine) p.push(e.medicine);
  } else if (e.type === 'Weight') {
    p.push(e.weightKg + ' kg');
  } else if (e.type === 'Death/Loss') {
    if (Number(e.count) > 1) p.push('× ' + e.count);
    p.push(e.cause || '');
  } else if (e.type === 'Sale') {
    if (Number(e.count) > 1) p.push('× ' + e.count);
    if (e.buyer) p.push('to ' + e.buyer);
    if (e.salePrice !== undefined && e.salePrice !== '') p.push(money(e.salePrice));
  }
  if (e.notes) p.push('"' + e.notes + '"');
  return p.filter(function (x) { return x; }).join(' · ');
}

// Same logic as js/register.js in the app – keep the two in step.
function buildRegister_(events) {
  const num = function (v, fallback) {
    const n = Number(v);
    return (v === '' || v === null || v === undefined || isNaN(n)) ? fallback : n;
  };
  const regKey = function (species, id) {
    return String(species || '').trim().toLowerCase() + '|' + String(id || '').trim().toLowerCase();
  };
  const newRecord = function (e, key, origin) {
    return {
      key: key, species: e.species, animalId: String(e.animalId).trim(), origin: origin,
      breed: e.breed || '', sex: e.sex || '', startCount: 0, count: 0, startDate: e.eventDate || '',
      source: e.source || '', price: e.price === undefined ? '' : e.price, motherId: e.motherId || '',
      deaths: 0, sold: 0, lastWeight: '', lastWeightDate: '', lastTreatment: '', lastTreatmentDate: '',
      lastEventDate: '', lastReduction: '', status: 'Active',
    };
  };
  const sorted = events.slice().sort(function (a, b) {
    return String(a.eventDate || '').slice(0, 10).localeCompare(String(b.eventDate || '').slice(0, 10)) ||
      String(a.recordedAt || '').localeCompare(String(b.recordedAt || ''));
  });
  const reg = {};
  const keys = [];
  sorted.forEach(function (e) {
    if (!e.animalId || !e.species) return;
    const key = regKey(e.species, e.animalId);
    let r = reg[key];
    if (e.type === 'Arrival' || e.type === 'Birth') {
      if (r && r.origin === 'Unknown') {
        // Something was recorded for this number before its arrival – join them up.
        const fresh = newRecord(e, key, e.type);
        ['origin', 'breed', 'sex', 'startDate', 'source', 'price', 'motherId'].forEach(function (f) { r[f] = fresh[f]; });
      } else if (!r || r.count <= 0) {
        if (!r) keys.push(key);
        r = newRecord(e, key, e.type);
        reg[key] = r;
      }
      const n = num(e.count, 1);
      r.startCount += n;
      r.count += n;
    } else {
      if (!r) { r = newRecord(e, key, 'Unknown'); reg[key] = r; keys.push(key); }
      if (e.type === 'Death/Loss' || e.type === 'Sale') {
        const n = num(e.count, 1);
        r.count -= n;
        if (e.type === 'Sale') { r.sold += n; r.lastReduction = 'Sold'; } else { r.deaths += n; r.lastReduction = 'Dead'; }
      } else if (e.type === 'Weight') {
        r.lastWeight = num(e.weightKg, '');
        r.lastWeightDate = e.eventDate || '';
      } else if (e.type === 'Treatment') {
        r.lastTreatment = [e.treatmentType, e.medicine].filter(function (x) { return x; }).join(' – ');
        r.lastTreatmentDate = e.eventDate || '';
      }
    }
    if (String(e.eventDate || '') > r.lastEventDate) r.lastEventDate = String(e.eventDate);
  });
  return keys.map(function (k) {
    const r = reg[k];
    if (r.count > 0) r.status = 'Active';
    else if (r.origin === 'Unknown' && !r.lastReduction) r.status = 'Active';
    else { r.status = r.lastReduction || 'Dead'; r.count = 0; }
    return r;
  });
}

// ---------------------------------------------------------------- small helpers

function isDate_(v) {
  return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime());
}

function getKey_() {
  const props = PropertiesService.getScriptProperties();
  let key = props.getProperty('FARM_KEY');
  if (!key) { key = newKey_(); props.setProperty('FARM_KEY', key); }
  return key;
}

function newKey_() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 20);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function styleHeader_(sheet, width) {
  sheet.getRange(1, 1, 1, width).setFontWeight('bold').setBackground('#e3efe2');
  sheet.setFrozenRows(1);
}
