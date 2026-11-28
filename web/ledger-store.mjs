const name = 'expensepilot-statements';
const store = 'ledger';
const key = 'current';

export function openLedger() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function emptyState() {
  return { revision: 0, transactions: [], imports: [], rules: [] };
}

export function loadLedger(database) {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(store, 'readonly');
    const request = tx.objectStore(store).get(key);
    tx.oncomplete = () => resolve(request.result ?? emptyState());
    tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('Could not read the ledger.'));
  });
}

export function saveLedger(database, expectedRevision, changes) {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(store, 'readwrite');
    const ledger = tx.objectStore(store);
    const request = ledger.get(key);
    let updated;
    let stale = false;
    request.onsuccess = () => {
      const state = request.result ?? emptyState();
      if (state.revision !== expectedRevision) {
        stale = true;
        tx.abort();
        return;
      }
      updated = { ...state, ...changes, revision: state.revision + 1 };
      ledger.put(updated, key);
    };
    tx.oncomplete = () => resolve(updated);
    tx.onerror = tx.onabort = () => reject(stale ? new Error('The ledger changed in another tab. Review the refreshed data and try again.') :
      tx.error ?? new Error('Could not save the ledger.'));
  });
}
