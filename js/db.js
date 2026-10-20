window.App = window.App || {};
window.App.db = (function (App) {
  'use strict';

  /**
   * Warstwa trwałego zapisu - IndexedDB.
   * Store'y:
   *   progress  - postęp per słowo (klucz: wordId)
   *   meta      - ustawienia i statystyki sesji (klucz: nazwa)
   */

  const DB_NAME = 'words3000';
  const DB_VERSION = 1;
  const STORE_PROGRESS = 'progress';
  const STORE_META = 'meta';

  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_PROGRESS)) {
          const s = db.createObjectStore(STORE_PROGRESS, { keyPath: 'wordId' });
          s.createIndex('box', 'box');
          s.createIndex('due', 'due');
          s.createIndex('cat', 'cat');
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' });
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    return dbPromise;
  }

  function tx(store, mode = 'readonly') {
    return openDb().then((db) => db.transaction(store, mode).objectStore(store));
  }

  function wrap(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /* ------------------------- Postęp ------------------------- */

  async function getAllProgress() {
    const store = await tx(STORE_PROGRESS);
    return wrap(store.getAll());
  }

  async function getProgress(wordId) {
    const store = await tx(STORE_PROGRESS);
    return wrap(store.get(wordId));
  }

  async function putProgress(record) {
    const store = await tx(STORE_PROGRESS, 'readwrite');
    return wrap(store.put(record));
  }

  async function putProgressBatch(records) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE_PROGRESS, 'readwrite');
      const store = t.objectStore(STORE_PROGRESS);
      records.forEach((r) => store.put(r));
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  }

  async function clearProgress() {
    const store = await tx(STORE_PROGRESS, 'readwrite');
    return wrap(store.clear());
  }

  /* ------------------------- Meta ------------------------- */

  async function getMeta(key, fallback = null) {
    const store = await tx(STORE_META);
    const row = await wrap(store.get(key));
    return row === undefined ? fallback : row.value;
  }

  async function setMeta(key, value) {
    const store = await tx(STORE_META, 'readwrite');
    return wrap(store.put({ key, value }));
  }

  async function clearMeta() {
    const store = await tx(STORE_META, 'readwrite');
    return wrap(store.clear());
  }

  return { getAllProgress, getProgress, putProgress, putProgressBatch, clearProgress, getMeta, setMeta, clearMeta };
})(window.App);
