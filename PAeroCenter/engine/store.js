/* IndexedDB stores local checkpoints and diagnostic records; nothing is synced. */
(() => {
  'use strict';
  let pending;
  function open() {
    if (!pending) pending = new Promise((resolve, reject) => {
      const r = indexedDB.open('PAeroCenter-v2', 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore('jobs', {keyPath: 'id'});
        const records = r.result.createObjectStore('network', {keyPath: 'id', autoIncrement: true});
        records.createIndex('jobId', 'jobId');
      };
      r.onsuccess = () => resolve(r.result); r.onerror = () => { pending = null; reject(r.error); };
    });
    return pending;
  }
  async function op(store, mode, action) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode); const request = action(tx.objectStore(store));
      let result; request.onsuccess = () => { result = request.result; };
      tx.oncomplete = () => resolve(result); tx.onerror = () => reject(tx.error || request.error);
      tx.onabort = () => reject(tx.error || new Error('Хранилище прервало запись'));
    });
  }
  globalThis.PAeroStore = {
    get: id => op('jobs', 'readonly', s => s.get(id)),
    put: job => op('jobs', 'readwrite', s => s.put(job)),
    list: () => op('jobs', 'readonly', s => s.getAll()),
    addRecord: row => op('network', 'readwrite', s => s.add(row)),
    records: jobId => op('network', 'readonly', s => s.index('jobId').getAll(jobId)),
    async clear() { await op('network', 'readwrite', s => s.clear()); await op('jobs', 'readwrite', s => s.clear()); }
  };
})();
