/**
 * Tiny promise wrapper around IndexedDB. Two stores:
 *   write_queue — one row per (match_id, hole), keyed `${match_id}:${hole}`.
 *                 Latest write wins; this mirrors the server's upsert design.
 *   snapshot    — the last good server fetch, keyed 'tables', so the app
 *                 can open with data when there is no signal on the course.
 */
const DB_NAME = 'freeman-cup';
const DB_VERSION = 1;
const STORES = ['write_queue', 'snapshot'] as const;
export type StoreName = (typeof STORES)[number];

let _db: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (_db) return _db;
  _db = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _db;
}

function tx<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest,
): Promise<T> {
  return open().then(
    db =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const idbGet = <T>(store: StoreName, key: string) =>
  tx<T | undefined>(store, 'readonly', s => s.get(key));
export const idbGetAll = <T>(store: StoreName) =>
  tx<T[]>(store, 'readonly', s => s.getAll());
export const idbPut = (store: StoreName, key: string, value: unknown) =>
  tx<IDBValidKey>(store, 'readwrite', s => s.put(value, key));
export const idbDelete = (store: StoreName, key: string) =>
  tx<undefined>(store, 'readwrite', s => s.delete(key));

/** Tests swap the global indexedDB between cases; drop the cached handle. */
export const _resetDbForTests = () => {
  _db = null;
};
