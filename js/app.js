import { T, bi, txt, itemText, esc } from './i18n.js';
import { db } from './db.js';
import { buildRegister, regKey } from './register.js';

export const APP_VERSION = '0.1.0';

const EVENT_TYPES = [
  { type: 'Arrival', icon: '🚚' },
  { type: 'Birth', icon: '🐣' },
  { type: 'Treatment', icon: '💉' },
  { type: 'Weight', icon: '⚖️' },
  { type: 'Death/Loss', icon: '🕊️' },
  { type: 'Sale', icon: '💰' },
];
const ICON = Object.fromEntries(EVENT_TYPES.map((e) => [e.type, e.icon]));

// Used until the first download from the Google Sheet (which has the editable lists).
const DEFAULT_SETTINGS = {
  species: [
    { en: 'Pig', ne: 'सुँगुर', option: 'Individual' },
    { en: 'Goat', ne: 'बाख्रा', option: 'Individual' },
    { en: 'Pheasant', ne: 'कालिज (फिजेन्ट)', option: 'Batch' },
    { en: 'Chicken', ne: 'कुखुरा', option: 'Batch' },
  ],
  treatment: [
    { en: 'Vaccination', ne: 'खोप' },
    { en: 'Deworming', ne: 'जुकाको औषधि' },
    { en: 'Medicine', ne: 'औषधि' },
    { en: 'Vitamins / supplements', ne: 'भिटामिन / पूरक आहार' },
    { en: 'Vet visit', ne: 'पशु चिकित्सक जाँच' },
    { en: 'Other', ne: 'अन्य' },
  ],
  cause: [
    { en: 'Illness', ne: 'रोग' },
    { en: 'Predator / wild animal', ne: 'जङ्गली जनावर' },
    { en: 'Injury', ne: 'चोटपटक' },
    { en: 'Weather (cold / heat)', ne: 'मौसम (चिसो / गर्मी)' },
    { en: 'Lost / stolen', ne: 'हराएको / चोरी' },
    { en: 'Unknown', ne: 'थाहा छैन' },
    { en: 'Other', ne: 'अन्य' },
  ],
  staff: [],
};

const state = {
  config: null, // { url, key, device }
  settings: DEFAULT_SETTINGS,
  serverEvents: [],
  pending: [],
  lastSync: null,
  sync: { status: 'idle', detail: '' },
  syncing: false,
  lastStaff: '',
};

window.farmRecords = state; // handy when helping remotely: type farmRecords in the browser console

const $ = (sel, root = document) => root.querySelector(sel);
const main = () => $('#main');

// ---------- helpers ----------

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function speciesList() { return state.settings.species || []; }
function speciesInfo(name) { return speciesList().find((s) => s.en === name); }
function isBatch(name) { return (speciesInfo(name)?.option || '').toLowerCase().startsWith('batch'); }
function speciesLabel(name) { const s = speciesInfo(name); return s ? itemText(s) : name; }
function listLabel(list, value) {
  const item = (state.settings[list] || []).find((i) => i.en === value);
  if (item) return itemText(item);
  return T[value] ? txt(value) : value;
}

function allEvents() {
  const pendingIds = new Set(state.pending.map((p) => p.id));
  return [...state.serverEvents.filter((e) => !pendingIds.has(e.id)), ...state.pending.map((p) => ({ ...p, _pending: true }))];
}
function register() { return buildRegister(allEvents()); }

function fmtDate(d) {
  if (!d) return '';
  const [y, m, day] = String(d).slice(0, 10).split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(day)} ${months[Number(m) - 1] || ''} ${y}`;
}
function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${fmtDate(iso.slice(0, 10))} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function fmtNum(n) { return n === '' || n === null || n === undefined ? '' : Number(n).toLocaleString('en-IN'); }

function eventDetails(e) {
  const parts = [];
  if (e.type === 'Arrival' || e.type === 'Birth') {
    if (isBatch(e.species) || Number(e.count) > 1) parts.push(`× ${fmtNum(e.count)}`);
    if (e.breed) parts.push(e.breed);
    if (e.sex) parts.push(listLabel('', e.sex));
    if (e.motherId) parts.push(`${txt('motherId')}: ${e.motherId}`);
    if (e.source) parts.push(e.source);
    if (e.price !== '' && e.price !== undefined) parts.push(`रु. ${fmtNum(e.price)}`);
  } else if (e.type === 'Treatment') {
    parts.push(listLabel('treatment', e.treatmentType));
    if (e.medicine) parts.push(e.medicine);
  } else if (e.type === 'Weight') {
    parts.push(`${e.weightKg} kg`);
  } else if (e.type === 'Death/Loss') {
    if (isBatch(e.species) || Number(e.count) > 1) parts.push(`× ${fmtNum(e.count)}`);
    parts.push(listLabel('cause', e.cause));
  } else if (e.type === 'Sale') {
    if (isBatch(e.species) || Number(e.count) > 1) parts.push(`× ${fmtNum(e.count)}`);
    if (e.buyer) parts.push(e.buyer);
    if (e.salePrice !== '' && e.salePrice !== undefined) parts.push(`रु. ${fmtNum(e.salePrice)}`);
  }
  if (e.notes) parts.push(`“${e.notes}”`);
  return parts.filter(Boolean).join(' · ');
}

function toast(message) {
  const el = $('#toast');
  el.innerHTML = message;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 2500);
}

// ---------- sync with the Google Sheet ----------

async function api(method, payload) {
  const { url, key } = state.config;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    let res;
    if (method === 'GET') {
      res = await fetch(`${url}?action=bootstrap&key=${encodeURIComponent(key)}`, { signal: controller.signal });
    } else {
      // Sent as plain text so the browser does not need an extra permission check with Google.
      res = await fetch(url, { method: 'POST', body: JSON.stringify({ ...payload, key }), signal: controller.signal });
    }
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('Unexpected reply from server. Check the server address in Settings.'); }
    if (!data.ok) {
      const err = new Error(data.error || 'Server error');
      err.code = data.error;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export async function sync() {
  if (!state.config?.url) { state.sync = { status: 'nosetup' }; renderStatus(); return; }
  if (state.syncing) return;
  state.syncing = true;
  state.sync = { status: 'syncing' };
  renderStatus();
  try {
    // 1. Upload anything waiting, a few at a time (photos make requests large).
    let pending = [...state.pending].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
    while (pending.length) {
      const batch = [];
      let size = 0;
      while (pending.length && batch.length < 10 && size < 2_000_000) {
        const next = pending.shift();
        batch.push(next);
        size += (next.photoData || '').length + 1000;
      }
      const res = await api('POST', { device: state.config.device, events: batch });
      await db.removePending(res.accepted || []);
      const done = new Set(res.accepted || []);
      state.pending = state.pending.filter((p) => !done.has(p.id));
    }
    // 2. Download the latest records and lists from the Sheet (includes any fixes made in the UK).
    const data = await api('GET');
    state.serverEvents = data.events || [];
    if (data.settings && (data.settings.species || []).length) state.settings = { ...DEFAULT_SETTINGS, ...data.settings };
    state.lastSync = new Date().toISOString();
    await db.set('serverEvents', state.serverEvents);
    await db.set('settings', state.settings);
    await db.set('lastSync', state.lastSync);
    state.sync = { status: 'ok' };
  } catch (err) {
    if (err.code === 'bad_key') state.sync = { status: 'badkey' };
    else if (!navigator.onLine || err.name === 'AbortError' || err instanceof TypeError) state.sync = { status: 'offline' };
    else state.sync = { status: 'error', detail: err.message };
    console.warn('Sync failed', err);
  } finally {
    state.syncing = false;
    renderStatus();
    // Refresh lists on screen with the latest data, but never wipe a half-filled form.
    if (!/^#\/(new|settings)/.test(location.hash)) route(false);
  }
}

function renderStatus() {
  const el = $('#status');
  const n = state.pending.length;
  const waiting = n ? `⏳ ${n} ${txt('waiting')}` : '';
  let cls = 'ok';
  let html;
  switch (state.sync.status) {
    case 'nosetup': cls = 'warn'; html = `⚙️ ${txt('notSetUp')}`; break;
    case 'syncing': cls = 'busy'; html = `🔄 ${txt('uploading')}`; break;
    case 'offline': cls = 'warn'; html = `${waiting ? waiting + ' · ' : ''}📴 ${txt('offline')}`; break;
    case 'badkey': cls = 'bad'; html = `⚠️ ${txt('badKey')}`; break;
    case 'error': cls = 'bad'; html = `⚠️ ${txt('syncError')}${waiting ? ' · ' + waiting : ''}`; break;
    default:
      if (n) { cls = 'warn'; html = waiting; } else { html = `✅ ${txt('allUploaded')}`; }
  }
  const last = state.lastSync ? `<small>${esc(txt('lastSync'))}: ${esc(fmtTime(state.lastSync))}</small>` : '';
  el.className = `status ${cls}`;
  el.innerHTML = `<span>${esc(html)}</span>${last}`;
  el.title = state.sync.detail || txt('syncNow');
}

// ---------- screens ----------

function renderHome() {
  const tiles = EVENT_TYPES.map((e) => `
    <a class="tile" href="#/new/${encodeURIComponent(e.type)}">
      <span class="icon" aria-hidden="true">${e.icon}</span>${bi(e.type)}
    </a>`).join('');
  main().innerHTML = `
    <h2 class="prompt">${bi('whatHappened')}</h2>
    <div class="tiles">${tiles}</div>
    <div class="tiles secondary">
      <a class="tile small" href="#/animals"><span class="icon" aria-hidden="true">📋</span>${bi('animals')}</a>
      <a class="tile small" href="#/recent"><span class="icon" aria-hidden="true">🕘</span>${bi('recent')}</a>
      <a class="tile small" href="#/settings"><span class="icon" aria-hidden="true">⚙️</span>${bi('settings')}</a>
    </div>`;
}

// Which fields appear on each form, in order.
const FORMS = {
  Arrival: ['eventDate', 'species', 'newId', 'breed', 'sex', 'count', 'source', 'price', 'notes', 'photo', 'recordedBy'],
  Birth: ['eventDate', 'species', 'newId', 'motherId', 'breed', 'count', 'sex', 'notes', 'photo', 'recordedBy'],
  Treatment: ['eventDate', 'species', 'existingId', 'treatmentType', 'medicine', 'notes', 'recordedBy'],
  Weight: ['eventDate', 'species', 'existingId', 'weightKg', 'notes', 'recordedBy'],
  'Death/Loss': ['eventDate', 'species', 'existingId', 'countReduce', 'cause', 'notes', 'photo', 'recordedBy'],
  Sale: ['eventDate', 'species', 'existingId', 'countReduce', 'buyer', 'salePrice', 'notes', 'recordedBy'],
};
const OPTIONAL = new Set(['breed', 'sex', 'source', 'price', 'motherId', 'medicine', 'notes', 'photo', 'buyer', 'salePrice']);

function label(forKey, labelKey, name) {
  const opt = OPTIONAL.has(forKey) ? ` <em class="opt">(${esc(txt('optional'))})</em>` : '';
  return `<label for="f-${name}">${bi(labelKey)}${opt}</label>`;
}

function selectHtml(name, items, { placeholder = true, value = '' } = {}) {
  const opts = items.map((i) => `<option value="${esc(i.value)}"${i.value === value ? ' selected' : ''}>${esc(i.text)}</option>`).join('');
  return `<select id="f-${name}" name="${name}">${placeholder ? `<option value="">${esc(txt('choose'))}</option>` : ''}${opts}</select>`;
}

function suggestions(field) {
  const seen = new Set();
  for (const e of allEvents()) if (e[field]) seen.add(String(e[field]));
  return [...seen].sort().map((v) => `<option value="${esc(v)}">`).join('');
}

function fieldHtml(f, type) {
  const wrap = (inner, extra = '') => `<div class="field" data-field="${f}"${extra}>${inner}<div class="error" data-error="${f}"></div></div>`;
  switch (f) {
    case 'eventDate':
      return wrap(`${label(f, 'eventDate', 'eventDate')}<input type="date" id="f-eventDate" name="eventDate" value="${today()}" max="${today()}">`);
    case 'species':
      return wrap(`${label(f, 'species', 'species')}${selectHtml('species', speciesList().map((s) => ({ value: s.en, text: itemText(s) })))}`);
    case 'newId':
      return wrap(`<label for="f-animalId" id="newIdLabel">${bi('tagNo')}</label><input id="f-animalId" name="animalId" autocomplete="off"><div class="hint" id="newIdHint"></div>`);
    case 'existingId':
      return wrap(`${label(f, 'animalOrBatch', 'animalId')}<select id="f-animalId" name="animalId"><option value="">${esc(txt('choose'))}</option></select><div class="hint" id="existingHint"></div>`);
    case 'motherId':
      return wrap(`${label(f, 'motherId', 'motherId')}<input id="f-motherId" name="motherId" autocomplete="off" list="dl-mother"><datalist id="dl-mother"></datalist>`, ' data-only="individual"');
    case 'breed':
      return wrap(`${label(f, 'breed', 'breed')}<input id="f-breed" name="breed" list="dl-breed" autocomplete="off"><datalist id="dl-breed">${suggestions('breed')}</datalist>`);
    case 'sex':
      return wrap(`${label(f, 'sex', 'sex')}<div class="choice" role="radiogroup">${['Female', 'Male', 'Unknown'].map((s) => `<label class="pill"><input type="radio" name="sex" value="${s}">${bi(s)}</label>`).join('')}</div>`, ' data-only="individual-single"');
    case 'count':
      return wrap(`${label(f, type === 'Birth' ? 'countBorn' : 'count', 'count')}<input type="number" inputmode="numeric" min="1" step="1" id="f-count" name="count">`, type === 'Birth' ? '' : ' data-only="batch"');
    case 'countReduce':
      return wrap(`${label(f, type === 'Sale' ? 'countSold' : 'countDied', 'count')}<input type="number" inputmode="numeric" min="1" step="1" id="f-count" name="count">`, ' data-only="multi"');
    case 'source':
      return wrap(`${label(f, 'source', 'source')}<input id="f-source" name="source" list="dl-source" autocomplete="off"><datalist id="dl-source">${suggestions('source')}</datalist>`);
    case 'price':
      return wrap(`${label(f, 'price', 'price')}<input type="number" inputmode="decimal" min="0" step="any" id="f-price" name="price">`);
    case 'treatmentType':
      return wrap(`${label(f, 'treatmentType', 'treatmentType')}${selectHtml('treatmentType', (state.settings.treatment || []).map((i) => ({ value: i.en, text: itemText(i) })))}`);
    case 'medicine':
      return wrap(`${label(f, 'medicine', 'medicine')}<input id="f-medicine" name="medicine" list="dl-medicine" autocomplete="off"><datalist id="dl-medicine">${suggestions('medicine')}</datalist>`);
    case 'weightKg':
      return wrap(`${label(f, 'weightKg', 'weightKg')}<input type="number" inputmode="decimal" min="0" step="any" id="f-weightKg" name="weightKg"><div class="hint" data-only="batch">${bi('hintBatchWeight')}</div>`);
    case 'cause':
      return wrap(`${label(f, 'cause', 'cause')}${selectHtml('cause', (state.settings.cause || []).map((i) => ({ value: i.en, text: itemText(i) })))}`);
    case 'buyer':
      return wrap(`${label(f, 'buyer', 'buyer')}<input id="f-buyer" name="buyer" list="dl-buyer" autocomplete="off"><datalist id="dl-buyer">${suggestions('buyer')}</datalist>`);
    case 'salePrice':
      return wrap(`${label(f, 'salePrice', 'salePrice')}<input type="number" inputmode="decimal" min="0" step="any" id="f-salePrice" name="salePrice">`);
    case 'notes':
      return wrap(`${label(f, 'notes', 'notes')}<textarea id="f-notes" name="notes" rows="2"></textarea>`);
    case 'photo':
      return wrap(`${label(f, 'photo', 'photo')}
        <div class="photo">
          <label class="btn secondary"><input type="file" accept="image/*" capture="environment" id="f-photo" hidden>📷 ${esc(txt('addPhoto'))}</label>
          <img id="photoPreview" alt="" hidden>
          <button type="button" class="btn link" id="photoRemove" hidden>${esc(txt('removePhoto'))}</button>
        </div>`);
    case 'recordedBy': {
      const staff = state.settings.staff || [];
      const input = staff.length
        ? selectHtml('recordedBy', staff.map((i) => ({ value: i.en, text: itemText(i) })), { value: state.lastStaff })
        : `<input id="f-recordedBy" name="recordedBy" value="${esc(state.lastStaff)}" autocomplete="name">`;
      return wrap(`${label(f, 'recordedBy', 'recordedBy')}${input}`);
    }
    default: return '';
  }
}

function renderForm(type) {
  if (!FORMS[type]) { location.hash = '#/'; return; }
  const ev = EVENT_TYPES.find((e) => e.type === type);
  main().innerHTML = `
    <form class="card form" id="entryForm" novalidate>
      <h2><span class="icon" aria-hidden="true">${ev.icon}</span>${bi(type)}</h2>
      ${FORMS[type].map((f) => fieldHtml(f, type)).join('')}
      <div class="actions">
        <a class="btn secondary" href="#/">${bi('cancel')}</a>
        <button class="btn primary" type="submit">${bi('save')}</button>
      </div>
    </form>`;

  const form = $('#entryForm');
  let photoData = '';

  // If there is only one animal type, pick it automatically.
  if (speciesList().length === 1) form.species.value = speciesList()[0].en;

  const refresh = () => {
    const sp = form.species.value;
    const batch = sp ? isBatch(sp) : false;
    const count = Number(form.count?.value || 0);
    const selId = form.querySelector('select[name="animalId"]')?.value;
    const selRec = sp && selId ? register().find((r) => r.key === regKey(sp, selId)) : null;
    form.querySelectorAll('[data-only]').forEach((el) => {
      const only = el.dataset.only;
      let show = true;
      if (!sp) show = only !== 'batch' && only !== 'individual' && only !== 'individual-single';
      else if (only === 'batch') show = batch;
      else if (only === 'multi') show = batch || (selRec ? selRec.count > 1 : false);
      else if (only === 'individual') show = !batch;
      else if (only === 'individual-single') show = !batch && (type !== 'Birth' || count <= 1);
      el.hidden = !show;
    });

    const newLabel = $('#newIdLabel');
    if (newLabel) {
      newLabel.innerHTML = bi(batch ? 'batchNo' : (type === 'Birth' ? 'tagOrLitter' : 'tagNo'));
      const hint = $('#newIdHint');
      const id = form.animalId.value.trim();
      const existing = sp && id ? register().find((r) => r.key === regKey(sp, id) && r.status === 'Active') : null;
      hint.innerHTML = existing && batch ? bi('hintBatchExists') : (type === 'Birth' && !batch ? bi('hintLitter') : '');
    }

    const existingSel = form.querySelector('select[name="animalId"]');
    if (existingSel && existingSel.dataset.species !== sp) {
      existingSel.dataset.species = sp;
      const active = register().filter((r) => r.species === sp && r.status === 'Active')
        .sort((a, b) => a.animalId.localeCompare(b.animalId, undefined, { numeric: true }));
      existingSel.innerHTML = `<option value="">${esc(txt('choose'))}</option>` + active.map((r) => {
        const bits = [r.animalId];
        if (batch || r.startCount > 1) bits.push(`${fmtNum(r.count)} ${txt('hintLeft')}`);
        else { if (r.breed) bits.push(r.breed); if (r.sex) bits.push(txt(r.sex)); }
        return `<option value="${esc(r.animalId)}">${esc(bits.join(' · '))}</option>`;
      }).join('');
      $('#existingHint').innerHTML = sp && !active.length ? bi('noActive') : '';
    }

    const motherList = $('#dl-mother');
    if (motherList && sp) {
      motherList.innerHTML = register().filter((r) => r.species === sp && r.status === 'Active' && (r.sex === 'Female' || !r.sex))
        .map((r) => `<option value="${esc(r.animalId)}">`).join('');
    }
  };
  form.addEventListener('input', refresh);
  form.addEventListener('change', refresh);
  refresh();

  const photoInput = $('#f-photo');
  if (photoInput) {
    photoInput.addEventListener('change', async () => {
      const file = photoInput.files[0];
      if (!file) return;
      photoData = await shrinkImage(file);
      $('#photoPreview').src = photoData;
      $('#photoPreview').hidden = false;
      $('#photoRemove').hidden = false;
    });
    $('#photoRemove').addEventListener('click', () => {
      photoData = '';
      photoInput.value = '';
      $('#photoPreview').hidden = true;
      $('#photoRemove').hidden = true;
    });
  }

  form.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    const entry = readForm(form, type);
    if (!validate(form, entry, type)) return;
    if (photoData) entry.photoData = photoData;
    state.pending.push(entry);
    await db.putPending(entry);
    if (entry.recordedBy) { state.lastStaff = entry.recordedBy; db.set('lastStaff', entry.recordedBy); }
    toast(`✅ ${esc(txt('saved'))}`);
    location.hash = '#/';
    sync();
  });
}

function readForm(form, type) {
  const fd = new FormData(form);
  const v = (k) => String(fd.get(k) ?? '').trim();
  const sp = v('species');
  const batch = isBatch(sp);
  const entry = {
    id: newId(),
    recordedAt: new Date().toISOString(),
    device: state.config?.device || '',
    type,
    eventDate: v('eventDate'),
    species: sp,
    animalId: v('animalId'),
    recordedBy: v('recordedBy'),
  };
  const fields = FORMS[type];
  const put = (k, val) => { if (val !== '' && val !== null && val !== undefined) entry[k] = val; };
  if (fields.includes('breed')) put('breed', v('breed'));
  if (fields.includes('sex')) put('sex', v('sex'));
  if (fields.includes('motherId') && !batch) put('motherId', v('motherId'));
  const countField = form.querySelector('[data-field="count"], [data-field="countReduce"]');
  if (countField) entry.count = countField.hidden ? 1 : (v('count') === '' ? '' : Number(v('count')));
  for (const k of ['source', 'treatmentType', 'medicine', 'cause', 'buyer', 'notes']) if (fields.includes(k)) put(k, v(k));
  for (const k of ['price', 'weightKg', 'salePrice']) if (fields.includes(k) && v(k) !== '') entry[k] = Number(v(k));
  if (batch || (type === 'Birth' && Number(entry.count) > 1)) delete entry.sex;
  return entry;
}

function validate(form, e, type) {
  form.querySelectorAll('[data-error]').forEach((el) => { el.textContent = ''; });
  const errors = {};
  const need = (k, cond = true) => { if (cond && (e[k] === '' || e[k] === undefined)) errors[k] = txt('required'); };
  need('eventDate');
  if (e.eventDate && e.eventDate > today()) errors.eventDate = txt('futureDate');
  need('species');
  need('animalId');
  need('recordedBy');
  const batch = isBatch(e.species);
  const fields = FORMS[type];
  const countField = form.querySelector('[data-field="count"], [data-field="countReduce"]');
  if (countField && !countField.hidden && !(Number(e.count) > 0)) errors.count = e.count === '' ? txt('required') : txt('mustBePositive');
  if (type === 'Treatment') need('treatmentType');
  if (type === 'Weight') { need('weightKg'); if (e.weightKg !== undefined && !(e.weightKg > 0)) errors.weightKg = txt('mustBePositive'); }
  if (type === 'Death/Loss') need('cause');

  const rec = e.species && e.animalId ? register().find((r) => r.key === regKey(e.species, e.animalId)) : null;
  if ((type === 'Arrival' || type === 'Birth') && rec && rec.status === 'Active' && !batch) errors.animalId = txt('tagInUse');
  if ((type === 'Death/Loss' || type === 'Sale') && rec && Number(e.count) > rec.count) errors.count = `${txt('tooMany')} (${rec.count})`;

  const map = { animalId: fields.includes('newId') ? 'newId' : 'existingId', count: fields.includes('count') ? 'count' : 'countReduce' };
  for (const [k, msg] of Object.entries(errors)) {
    const el = form.querySelector(`[data-error="${map[k] || k}"]`);
    if (el) el.textContent = msg;
  }
  const first = form.querySelector('[data-error]:not(:empty)');
  if (first) first.closest('.field').scrollIntoView({ behavior: 'smooth', block: 'center' });
  return !Object.keys(errors).length;
}

/** Shrinks a photo to at most 1280px so it uploads quickly over a slow connection. */
function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 1280;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read photo')); };
    img.src = url;
  });
}

function renderAnimals() {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const sp = params.get('species') || '';
  const status = params.get('status') || 'Active';
  const q = (params.get('q') || '').toLowerCase();
  const reg = register();

  const totals = speciesList().map((s) => {
    const live = reg.filter((r) => r.species === s.en && r.status === 'Active');
    const n = live.reduce((sum, r) => sum + Math.max(0, r.count), 0);
    return `<a class="stat" href="#/animals?species=${encodeURIComponent(s.en)}"><b>${fmtNum(n)}</b><span>${esc(itemText(s))}</span></a>`;
  }).join('');

  const rows = reg
    .filter((r) => (!sp || r.species === sp) && (status === 'all' || r.status === status))
    .filter((r) => !q || [r.animalId, r.breed, r.source].join(' ').toLowerCase().includes(q))
    .sort((a, b) => a.species.localeCompare(b.species) || a.animalId.localeCompare(b.animalId, undefined, { numeric: true }))
    .map((r) => `
      <tr data-key="${esc(r.key)}" tabindex="0">
        <td><b>${esc(r.animalId)}</b></td>
        <td>${esc(speciesLabel(r.species))}</td>
        <td class="num">${isBatch(r.species) || r.startCount > 1 ? fmtNum(r.count) : (r.sex ? esc(txt(r.sex)) : '')}</td>
        <td>${esc(r.breed)}</td>
        <td>${esc(fmtDate(r.startDate))}</td>
        <td><span class="badge ${r.status}">${esc(txt(r.status))}</span></td>
      </tr>`).join('');

  main().innerHTML = `
    <div class="card">
      <h2>${bi('animals')}</h2>
      <div class="stats"><div class="stat-title">${bi('liveNow')}</div>${totals}</div>
      <form class="filters" id="filters">
        ${selectHtml('fspecies', [{ value: '', text: txt('all') }, ...speciesList().map((s) => ({ value: s.en, text: itemText(s) }))], { placeholder: false, value: sp })}
        ${selectHtml('fstatus', ['Active', 'Dead', 'Sold', 'all'].map((s) => ({ value: s, text: txt(s) })), { placeholder: false, value: status })}
        <input type="search" id="f-q" placeholder="${esc(txt('search'))}" value="${esc(params.get('q') || '')}">
      </form>
      ${rows ? `<div class="table-wrap"><table class="list">
        <thead><tr><th>${bi('tagNo')}</th><th>${bi('species')}</th><th>${bi('countSex')}</th><th>${bi('breed')}</th><th>${bi('started')}</th><th>${bi('status')}</th></tr></thead>
        <tbody>${rows}</tbody></table></div>` : `<p class="empty">${bi('nothingHere')}</p>`}
      <div class="actions"><a class="btn secondary" href="#/">${bi('back')}</a></div>
    </div>`;

  const apply = () => {
    const p = new URLSearchParams();
    const f = $('#filters');
    if (f.fspecies.value) p.set('species', f.fspecies.value);
    p.set('status', f.fstatus.value);
    if ($('#f-q').value) p.set('q', $('#f-q').value);
    history.replaceState(null, '', `#/animals?${p}`);
    const pos = $('#f-q').selectionStart;
    renderAnimals();
    const input = $('#f-q');
    input.focus();
    input.setSelectionRange(pos, pos);
  };
  $('#filters').addEventListener('change', apply);
  $('#f-q').addEventListener('input', apply);
  main().querySelectorAll('tr[data-key]').forEach((tr) => {
    const open = () => { location.hash = `#/animal/${encodeURIComponent(tr.dataset.key)}`; };
    tr.addEventListener('click', open);
    tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
  });
}

function renderAnimal(key) {
  const r = register().find((x) => x.key === key);
  if (!r) { location.hash = '#/animals'; return; }
  const events = allEvents().filter((e) => regKey(e.species, e.animalId) === key)
    .sort((a, b) => String(b.eventDate).localeCompare(String(a.eventDate)) || String(b.recordedAt).localeCompare(String(a.recordedAt)));
  const batch = isBatch(r.species);
  const facts = [
    ['species', speciesLabel(r.species)],
    ['status', txt(r.status)],
    batch || r.startCount > 1 ? ['count', `${fmtNum(r.count)} (${txt('startedWith')} ${fmtNum(r.startCount)})`] : ['sex', r.sex ? txt(r.sex) : ''],
    ['breed', r.breed],
    ['started', `${fmtDate(r.startDate)} · ${txt(r.origin) || r.origin}`],
    ['source', r.source],
    ['motherId', r.motherId],
    ['lastWeight', r.lastWeight !== '' ? `${r.lastWeight} kg (${fmtDate(r.lastWeightDate)})` : ''],
    ['lastTreatment', r.lastTreatment ? `${r.lastTreatment} (${fmtDate(r.lastTreatmentDate)})` : ''],
  ].filter(([, v]) => v);

  main().innerHTML = `
    <div class="card">
      <h2>${esc(r.animalId)} <small>${esc(speciesLabel(r.species))}</small></h2>
      <dl class="facts">${facts.map(([k, v]) => `<dt>${bi(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      <h3>${bi('history')}</h3>
      ${eventList(events)}
      <div class="actions"><a class="btn secondary" href="#/animals">${bi('back')}</a></div>
    </div>`;
}

function eventList(events, { showAnimal = false, allowDelete = false } = {}) {
  if (!events.length) return `<p class="empty">${bi('nothingHere')}</p>`;
  return `<ul class="events">${events.map((e) => `
    <li class="${e._pending ? 'pending' : ''}">
      <span class="icon" aria-hidden="true">${ICON[e.type] || '•'}</span>
      <div class="body">
        <div class="line1"><b>${esc(txt(e.type))}</b>${showAnimal ? ` · ${esc(speciesLabel(e.species))} <b>${esc(e.animalId)}</b>` : ''}</div>
        <div class="line2">${esc(eventDetails(e))}</div>
        <div class="line3">${esc(fmtDate(e.eventDate))}${e.recordedBy ? ` · ${esc(e.recordedBy)}` : ''}
          ${e.photoUrl ? ` · <a href="${esc(e.photoUrl)}" target="_blank" rel="noopener">📷 ${esc(txt('photo'))}</a>` : ''}
          ${e.photoData ? ' · 📷' : ''}
          ${e._pending ? ` · <span class="badge pending">⏳ ${esc(txt('pendingBadge'))}</span>` : ''}</div>
      </div>
      ${allowDelete && e._pending ? `<button class="btn link danger" data-delete="${esc(e.id)}">${esc(txt('delete'))}</button>` : ''}
    </li>`).join('')}</ul>`;
}

function renderRecent() {
  const events = allEvents()
    .sort((a, b) => String(b.recordedAt).localeCompare(String(a.recordedAt)))
    .slice(0, 100);
  main().innerHTML = `
    <div class="card">
      <h2>${bi('recent')}</h2>
      ${eventList(events, { showAnimal: true, allowDelete: true })}
      <div class="actions"><a class="btn secondary" href="#/">${bi('back')}</a></div>
    </div>`;
  main().querySelectorAll('[data-delete]').forEach((btn) => btn.addEventListener('click', async () => {
    if (!confirm(txt('confirmDelete'))) return;
    const id = btn.dataset.delete;
    await db.removePending([id]);
    state.pending = state.pending.filter((p) => p.id !== id);
    renderStatus();
    renderRecent();
  }));
}

function renderSettings(message = '') {
  const c = state.config || {};
  main().innerHTML = `
    <form class="card form" id="settingsForm">
      <h2>${bi('settings')}</h2>
      ${message ? `<p class="notice">${message}</p>` : ''}
      <div class="field"><label for="s-url">${bi('serverUrl')}</label><input id="s-url" name="url" value="${esc(c.url || '')}" placeholder="https://script.google.com/macros/s/…/exec"></div>
      <div class="field"><label for="s-key">${bi('farmKey')}</label><input id="s-key" name="key" value="${esc(c.key || '')}" autocomplete="off"></div>
      <div class="field"><label for="s-device">${bi('deviceName')}</label><input id="s-device" name="device" value="${esc(c.device || 'Farm laptop')}"></div>
      <div class="actions">
        <a class="btn secondary" href="#/">${bi('back')}</a>
        <button class="btn primary" type="submit">${bi('saveSettings')}</button>
      </div>
      <p class="meta">${esc(txt('version'))}: ${APP_VERSION} · ${esc(txt('lastSync'))}: ${esc(state.lastSync ? fmtTime(state.lastSync) : '—')} · ⏳ ${state.pending.length}</p>
    </form>`;
  $('#settingsForm').addEventListener('submit', async (evt) => {
    evt.preventDefault();
    const f = evt.target;
    state.config = { url: f.url.value.trim(), key: f.key.value.trim(), device: f.device.value.trim() || 'Farm laptop' };
    await db.set('config', state.config);
    await sync();
    renderSettings(state.sync.status === 'ok' ? `✅ ${esc(txt('connected'))}` : `⚠️ ${esc($('#status').textContent)}`);
  });
}

// ---------- routing & start-up ----------

function route(scrollTop = true) {
  const h = location.hash || '#/';
  if (scrollTop) window.scrollTo(0, 0);
  if (h.startsWith('#/new/')) return renderForm(decodeURIComponent(h.slice(6)));
  if (h.startsWith('#/animals')) return renderAnimals();
  if (h.startsWith('#/animal/')) return renderAnimal(decodeURIComponent(h.slice(9)));
  if (h.startsWith('#/recent')) return renderRecent();
  if (h.startsWith('#/settings')) return renderSettings();
  return renderHome();
}

/** A setup link (…#setup=XXXX) from the Google Sheet connects this device in one click. */
async function handleSetupLink() {
  if (!location.hash.startsWith('#setup=')) return false;
  try {
    let b64 = location.hash.slice(7).replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const { u, k } = JSON.parse(atob(b64));
    state.config = { url: u, key: k, device: state.config?.device || 'Farm laptop' };
    await db.set('config', state.config);
    history.replaceState(null, '', location.pathname + '#/settings');
    renderSettings(`✅ ${bi('setupDone')}`);
    sync();
    return true;
  } catch (err) {
    console.warn('Bad setup link', err);
    return false;
  }
}

async function start() {
  try { await navigator.storage?.persist?.(); } catch { /* not supported */ }
  const [config, settings, serverEvents, pending, lastSync, lastStaff] = await Promise.all([
    db.get('config'), db.get('settings'), db.get('serverEvents'), db.getPending(), db.get('lastSync'), db.get('lastStaff'),
  ]);
  state.config = config || null;
  if (settings) state.settings = settings;
  state.serverEvents = serverEvents || [];
  state.pending = pending || [];
  state.lastSync = lastSync || null;
  state.lastStaff = lastStaff || '';
  document.title = txt('appName');

  $('#status').addEventListener('click', () => sync());
  window.addEventListener('hashchange', route);
  window.addEventListener('online', () => sync());

  if (!(await handleSetupLink())) {
    route();
    if (!state.config?.url) { state.sync = { status: 'nosetup' }; renderStatus(); } else sync();
  }
  renderStatus();
  // Keep trying in the background every 2 minutes.
  setInterval(() => { if (state.pending.length || Date.now() - new Date(state.lastSync || 0) > 10 * 60_000) sync(); }, 120_000);

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW failed', e));
}

start();
