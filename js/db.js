// Local storage on the computer/phone (IndexedDB), so entries survive with no internet.
// "pending" holds entries not yet uploaded; "kv" holds settings and the last copy downloaded from the Sheet.

const DB_NAME = 'farm-records';
const DB_VERSION = 1;
let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('pending')) d.createObjectStore('pending', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function run(storeName, mode, fn) {
  const d = await open();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(storeName, mode);
    const req = fn(tx.objectStore(storeName));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const db = {
  getPending: () => run('pending', 'readonly', (s) => s.getAll()),
  putPending: (entry) => run('pending', 'readwrite', (s) => s.put(entry)),
  removePending: (ids) => run('pending', 'readwrite', (s) => { ids.forEach((id) => s.delete(id)); }),
  get: (key) => run('kv', 'readonly', (s) => s.get(key)),
  set: (key, value) => run('kv', 'readwrite', (s) => s.put(value, key)),
};
