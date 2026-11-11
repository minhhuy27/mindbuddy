import { getAuth } from 'firebase/auth';

const DB_NAME = 'mindbuddy-offline';
const STORE_NAME = 'ai-queue';
const DB_VERSION = 1;

export async function getFreshAuthHeaders(baseHeaders = {}) {
  const headers = { 'Content-Type': 'application/json', ...baseHeaders };
  try {
    const user = getAuth().currentUser;
    if (user) {
      const token = await user.getIdToken();
      headers.Authorization = `Bearer ${token}`;
    }
  } catch (err) {
    console.warn('Failed to get auth token:', err.message);
  }
  return headers;
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueRequest(url, options = {}) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    // Omit non-cloneable fields like AbortSignal and stale auth headers before persisting to IndexedDB
    const { signal: _signal, headers: _headers, ...serializableOptions } = options || {};
    tx.objectStore(STORE_NAME).add({
      url,
      options: { ...serializableOptions, headers: { 'Content-Type': 'application/json' } },
      timestamp: Date.now(),
    });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
    db.close();
  } catch (err) {
    console.error('Failed to enqueue offline request:', err);
  }
}

export async function getQueuedRequests() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => { db.close(); resolve(request.result || []); };
      request.onerror = () => { db.close(); reject(request.error); };
    });
  } catch (err) {
    console.error('Failed to get queued requests:', err);
    return [];
  }
}

export async function clearQueue() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
    db.close();
  } catch (err) {
    console.error('Failed to clear offline queue:', err);
  }
}

export async function replayQueue(fetchFn = fetch) {
  const queued = await getQueuedRequests();
  if (queued.length === 0) return [];

  const authHeaders = await getFreshAuthHeaders();
  const results = [];
  for (const item of queued) {
    try {
      const mergedOptions = {
        ...item.options,
        headers: {
          ...(item.options?.headers || {}),
          ...authHeaders,
        },
      };
      const res = await fetchFn(item.url, mergedOptions);
      if (res && typeof res.ok === 'boolean' && !res.ok) {
        results.push({ success: false, error: `HTTP ${res.status}`, status: res.status });
      } else {
        results.push({ success: true, data: res });
      }
    } catch (err) {
      results.push({ success: false, error: err.message });
    }
  }
  await clearQueue();
  return results;
}

// Auto-replay when coming back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    replayQueue(fetch).then((results) => {
      const succeeded = results.filter(r => r.success).length;
      if (succeeded > 0) {
        console.log(`Replayed ${succeeded}/${results.length} queued AI requests`);
      }
    });
  });
}
