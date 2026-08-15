/**
 * offlineSync.ts
 *
 * IndexedDB-backed offline action queue for Hisab Kitab.
 * When the user is offline (or a network request fails), write
 * mutations (POST/PUT/DELETE) are stored here and auto-replayed
 * when connectivity returns.
 */

const DB_NAME = "hk_offline_db";
const STORE_NAME = "action_queue";
const DB_VERSION = 1;

export interface OfflineAction {
  id?: number;
  endpoint: string;
  method: "POST" | "PUT" | "DELETE" | "PATCH";
  body?: string;
  headers?: Record<string, string>;
  created_at: number;
  /** Human-readable label for the toast shown when syncing */
  label?: string;
}

// ── Open DB ──────────────────────────────────────────────────────
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Enqueue an action ────────────────────────────────────────────
export async function enqueueAction(action: Omit<OfflineAction, "id" | "created_at">): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).add({ ...action, created_at: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Get all pending actions ──────────────────────────────────────
export async function getPendingActions(): Promise<OfflineAction[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as OfflineAction[]);
    req.onerror = () => reject(req.error);
  });
}

// ── Get count of pending actions ─────────────────────────────────
export async function getPendingCount(): Promise<number> {
  const actions = await getPendingActions();
  return actions.length;
}

// ── Delete a specific action by id ───────────────────────────────
export async function deleteAction(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Drain: replay all pending actions in order ────────────────────
export async function drainQueue(
  onProgress?: (done: number, total: number) => void
): Promise<{ synced: number; failed: number }> {
  const actions = await getPendingActions();
  if (actions.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    try {
      const res = await fetch(`/api${action.endpoint}`, {
        method: action.method,
        headers: {
          "Content-Type": "application/json",
          ...(action.headers ?? {}),
        },
        body: action.body,
      });
      if (res.ok || res.status === 409) {
        // 409 = conflict/duplicate — treat as synced to avoid infinite retry
        if (action.id != null) await deleteAction(action.id);
        synced++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
    onProgress?.(i + 1, actions.length);
  }

  return { synced, failed };
}

// ── Setup online listener to auto-drain ──────────────────────────
let _drainInProgress = false;

export function setupOnlineSyncListener(
  onSyncComplete?: (result: { synced: number; failed: number }) => void
) {
  const handler = async () => {
    if (_drainInProgress) return;
    const count = await getPendingCount();
    if (count === 0) return;

    _drainInProgress = true;
    try {
      const result = await drainQueue();
      onSyncComplete?.(result);
    } finally {
      _drainInProgress = false;
    }
  };

  window.addEventListener("online", handler);
  // Also listen for SW postMessage (background sync signal)
  navigator.serviceWorker?.addEventListener("message", (e) => {
    if (e.data?.type === "DRAIN_OFFLINE_QUEUE") handler();
  });

  // Return cleanup
  return () => window.removeEventListener("online", handler);
}
