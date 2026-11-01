// A small stand-in for Google Apps Script services, so apps-script/Code.gs can be
// tested on this computer. It copies how Sheets turns typed text into values:
// "2026-01-05" becomes a date, "12" becomes a number, and a leading ' keeps text as text.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

function convert(v) {
  if (typeof v !== 'string') return v;
  if (v.startsWith("'")) return v.slice(1);
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v + 'T00:00:00Z');
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

class Range {
  constructor(sheet, r, c, nr, nc) { Object.assign(this, { sheet, r, c, nr, nc }); }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const row = [];
      for (let j = 0; j < this.nc; j++) {
        const v = (this.sheet.data[this.r - 1 + i] || [])[this.c - 1 + j];
        row.push(v === undefined ? '' : v);
      }
      out.push(row);
    }
    return out;
  }
  setValues(values) {
    if (values.length !== this.nr || values.some((r) => r.length !== this.nc)) throw new Error(`setValues size mismatch: range ${this.nr}x${this.nc}, data ${values.length}x${values[0]?.length}`);
    values.forEach((row, i) => row.forEach((v, j) => {
      const rr = this.r - 1 + i;
      while (this.sheet.data.length <= rr) this.sheet.data.push([]);
      this.sheet.data[rr][this.c - 1 + j] = convert(v);
    }));
    return this;
  }
  setValue(v) { return this.setValues([[v]]); }
  setFontWeight() { return this; }
  setFontSize() { return this; }
  setBackground() { return this; }
  getSheet() { return this.sheet; }
}

class Sheet {
  constructor(name) { this.name = name; this.data = []; }
  getName() { return this.name; }
  getLastRow() {
    for (let i = this.data.length - 1; i >= 0; i--) if ((this.data[i] || []).some((v) => v !== '' && v !== undefined)) return i + 1;
    return 0;
  }
  getLastColumn() { return this.data.reduce((m, r) => Math.max(m, r.reduce((mm, v, j) => (v !== '' && v !== undefined ? j + 1 : mm), 0)), 0); }
  getRange(a, c, nr = 1, nc = 1) {
    if (typeof a === 'string') {
      const m = /^([A-Z])(\d+)(?::([A-Z])(\d+))?$/.exec(a);
      const col = (s) => s.charCodeAt(0) - 64;
      const r1 = +m[2]; const c1 = col(m[1]);
      return m[3] ? new Range(this, r1, c1, +m[4] - r1 + 1, col(m[3]) - c1 + 1) : new Range(this, r1, c1, 1, 1);
    }
    return new Range(this, a, c, nr, nc);
  }
  clear() { this.data = []; }
  setFrozenRows() {}
  setColumnWidth() {}
}

function createGas() {
  const sheets = [];
  const ss = {
    getSheetByName: (n) => sheets.find((s) => s.name === n) || null,
    insertSheet: (n, idx) => { const s = new Sheet(n); sheets.splice(idx ?? sheets.length, 0, s); return s; },
    deleteSheet: (s) => sheets.splice(sheets.indexOf(s), 1),
    getSheets: () => sheets,
    getSpreadsheetTimeZone: () => 'UTC',
  };
  ss.insertSheet('Sheet1');
  const props = {};
  const files = [];
  const pad = (n) => String(n).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const alerts = [];
  const gas = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ss,
      getUi: () => ({ alert: (...a) => { alerts.push(a); return 'YES'; }, Button: { YES: 'YES', OK: 'OK' }, ButtonSet: {} }),
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null, setProperty: (k, v) => { props[k] = String(v); } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (text) => ({ text, mime: 'text', setMimeType(m) { this.mime = m; return this; }, getContent() { return this.text; } }),
    },
    Utilities: {
      getUuid: () => require('crypto').randomUUID(),
      formatDate: (d, tz, fmt) => {
        const map = { yyyy: d.getUTCFullYear(), MMM: months[d.getUTCMonth()], MM: pad(d.getUTCMonth() + 1), dd: pad(d.getUTCDate()), d: d.getUTCDate(), HH: pad(d.getUTCHours()), mm: pad(d.getUTCMinutes()) };
        return fmt.replace(/yyyy|MMM|MM|dd|d|HH|mm/g, (t) => map[t]);
      },
      base64EncodeWebSafe: (s) => Buffer.from(s).toString('base64url'),
      base64Decode: (s) => Buffer.from(s, 'base64'),
      newBlob: (bytes, type, name) => ({ bytes, type, name }),
    },
    Drive: {
      Files: {
        get: (id) => ({ id, trashed: false }),
        create: (meta, blob) => {
          if (blob) files.push({ meta, blob });
          return { id: blob ? `file${files.length}` : 'folder1' };
        },
      },
    },
    HtmlService: { createHtmlOutput: () => ({ setWidth() { return this; }, setHeight() { return this; } }) },
    Logger: { log: console.log },
    console,
  };
  const context = vm.createContext({ ...gas });
  const code = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
  vm.runInContext(code + '\n;globalThis.__exports = { setupSheets, rebuildAll, doGet, doPost, getKey_, readEvents_ };', context);
  return { ...context.__exports, ss, props, files, alerts };
}

module.exports = { createGas };
