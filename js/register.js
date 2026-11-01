// Works out the current list of animals and batches from the list of events.
// The same logic is copied into apps-script/Code.gs (buildRegister_) so the app and
// the Google Sheet always agree. If you change one, change the other.

export function regKey(species, animalId) {
  return `${String(species || '').trim().toLowerCase()}|${String(animalId || '').trim().toLowerCase()}`;
}

function num(v, fallback) {
  const n = Number(v);
  return v === '' || v === null || v === undefined || Number.isNaN(n) ? fallback : n;
}

function newRecord(e, key, origin) {
  return {
    key,
    species: e.species,
    animalId: String(e.animalId).trim(),
    origin,
    breed: e.breed || '',
    sex: e.sex || '',
    startCount: 0,
    count: 0,
    startDate: e.eventDate || '',
    source: e.source || '',
    price: e.price ?? '',
    motherId: e.motherId || '',
    deaths: 0,
    sold: 0,
    lastWeight: '',
    lastWeightDate: '',
    lastTreatment: '',
    lastTreatmentDate: '',
    lastEventDate: '',
    lastReduction: '',
    status: 'Active',
  };
}

export function buildRegister(events) {
  const sorted = [...events].sort((a, b) =>
    String(a.eventDate || '').slice(0, 10).localeCompare(String(b.eventDate || '').slice(0, 10)) ||
    String(a.recordedAt || '').localeCompare(String(b.recordedAt || '')));
  const reg = new Map();

  for (const e of sorted) {
    if (!e.animalId || !e.species) continue;
    const key = regKey(e.species, e.animalId);
    let r = reg.get(key);

    if (e.type === 'Arrival' || e.type === 'Birth') {
      if (r && r.origin === 'Unknown') {
        // Something was recorded for this number before its arrival – join them up.
        const fresh = newRecord(e, key, e.type);
        for (const f of ['origin', 'breed', 'sex', 'startDate', 'source', 'price', 'motherId']) r[f] = fresh[f];
      } else if (!r || r.count <= 0) {
        // A number that was used before but whose animals are all gone starts afresh.
        r = newRecord(e, key, e.type);
        reg.set(key, r);
      }
      const n = num(e.count, 1);
      r.startCount += n;
      r.count += n;
    } else {
      if (!r) {
        r = newRecord(e, key, 'Unknown');
        reg.set(key, r);
      }
      if (e.type === 'Death/Loss' || e.type === 'Sale') {
        const n = num(e.count, 1);
        r.count -= n;
        if (e.type === 'Sale') { r.sold += n; r.lastReduction = 'Sold'; } else { r.deaths += n; r.lastReduction = 'Dead'; }
      } else if (e.type === 'Weight') {
        r.lastWeight = num(e.weightKg, '');
        r.lastWeightDate = e.eventDate || '';
      } else if (e.type === 'Treatment') {
        r.lastTreatment = [e.treatmentType, e.medicine].filter(Boolean).join(' – ');
        r.lastTreatmentDate = e.eventDate || '';
      }
    }
    if (String(e.eventDate || '') > r.lastEventDate) r.lastEventDate = String(e.eventDate);
  }

  for (const r of reg.values()) {
    if (r.count > 0) r.status = 'Active';
    else if (r.origin === 'Unknown' && !r.lastReduction) r.status = 'Active';
    else { r.status = r.lastReduction || 'Dead'; r.count = 0; }
  }
  return [...reg.values()];
}
