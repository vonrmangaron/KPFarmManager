/* ProdWise.VM — Version history (IndexedDB-backed snapshots)
   Guards against accidental data loss during high-risk operations:
     • New Batch   (wipes farmData / siloData / farmLoads / predictions)
     • Excel import (replaces farmData)
     • Restore     (replaces everything again)
   Also offers a manual "Save current version" button with optional label.
*/

const HISTORY_DB_NAME = 'prodwise_history_db';
const HISTORY_DB_VERSION = 1;
const HISTORY_STORE = 'snapshots';
const HISTORY_MAX_AUTO = 20;

let _historyDbPromise = null;
let _historyDbUnavailable = false;

function openHistoryDb() {
  if (_historyDbUnavailable) return Promise.reject(new Error('IndexedDB unavailable'));
  if (_historyDbPromise) return _historyDbPromise;
  _historyDbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('IndexedDB not supported')); return; }
    let req;
    try { req = indexedDB.open(HISTORY_DB_NAME, HISTORY_DB_VERSION); }
    catch (e) { reject(e); return; }
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(HISTORY_STORE)) {
        const store = db.createObjectStore(HISTORY_STORE, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  }).catch(err => {
    _historyDbUnavailable = true;
    throw err;
  });
  return _historyDbPromise;
}

function historyIsAvailable() {
  return !_historyDbUnavailable && ('indexedDB' in window);
}

async function historyListAll() {
  if (!historyIsAvailable()) return [];
  try {
    const db = await openHistoryDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(HISTORY_STORE, 'readonly');
      const store = tx.objectStore(HISTORY_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const arr = req.result || [];
        arr.sort((a, b) => b.timestamp - a.timestamp);
        resolve(arr);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('History list failed', e);
    return [];
  }
}

async function historySave(snapshot) {
  if (!historyIsAvailable()) return null;
  try {
    const db = await openHistoryDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(HISTORY_STORE, 'readwrite');
      const store = tx.objectStore(HISTORY_STORE);
      store.put(snapshot);
      tx.oncomplete = () => resolve(snapshot);
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('History save failed', e);
    return null;
  }
}

async function historyDelete(id) {
  if (!historyIsAvailable()) return false;
  try {
    const db = await openHistoryDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(HISTORY_STORE, 'readwrite');
      tx.objectStore(HISTORY_STORE).delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) { return false; }
}

async function historyGet(id) {
  if (!historyIsAvailable()) return null;
  try {
    const db = await openHistoryDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(HISTORY_STORE, 'readonly');
      const req = tx.objectStore(HISTORY_STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) { return null; }
}

async function historyPruneAuto() {
  if (!historyIsAvailable()) return;
  try {
    const all = await historyListAll();
    const autoUnpinned = all.filter(s => s.source !== 'manual' && !s.pinned);
    if (autoUnpinned.length <= HISTORY_MAX_AUTO) return;
    const toDelete = autoUnpinned.slice(HISTORY_MAX_AUTO);
    for (const s of toDelete) await historyDelete(s.id);
  } catch (e) {
    console.warn('History prune failed', e);
  }
}

function historySummarize(payload) {
  if (!payload) return { sheds: 0, totalSheds: 0, pickups: 0, siloReadings: 0, loads: 0, batch: '' };
  const sheds = (payload.farmData && payload.farmData.sheds) ? payload.farmData.sheds : [];
  let pickups = 0, placedSheds = 0;
  sheds.forEach(s => {
    pickups += (s.pickups || []).length;
    if (s.placementDate) placedSheds++;
  });
  let siloReadings = 0;
  if (payload.siloData) {
    [1,2,3,4].forEach(g => {
      siloReadings += ((payload.siloData[g] && payload.siloData[g].readings) || []).length;
    });
  }
  const loads = Array.isArray(payload.farmLoads) ? payload.farmLoads.length : 0;
  return {
    sheds: placedSheds,
    totalSheds: sheds.length,
    pickups,
    siloReadings,
    loads,
    batch: payload.batchNumber || ''
  };
}

/* Snapshot builder — mirrors buildCloudPayload() so the shape is
   interchangeable with cloud backups and exportable JSON files. */
function buildHistorySnapshot(source, label) {
  const payload = buildCloudPayload();
  return {
    id: uid('snap'),
    timestamp: Date.now(),
    source: source || 'manual',
    label: String(label || '').slice(0, 80),
    pinned: source === 'manual',
    summary: historySummarize(payload),
    data: payload
  };
}

async function historyCreateSnapshot(source, label) {
  if (!historyIsAvailable()) return null;
  const snap = buildHistorySnapshot(source, label);
  const saved = await historySave(snap);
  if (saved) await historyPruneAuto();
  return saved;
}

/* Auto-snapshot — silent, called before risky operations. */
async function historyAutoSnapshot(source, label) {
  if (!farmData) return null;
  return historyCreateSnapshot(source, label);
}

/* Restore: applies the snapshot via applyCloudPayload. Always snapshots
   the current state first, so the restore itself can be undone. */
async function historyRestoreSnapshot(id) {
  if (!historyIsAvailable()) { showToast('Version history is not available in this browser.', true); return false; }
  const snap = await historyGet(id);
  if (!snap || !snap.data) { showToast('Snapshot not found.', true); return false; }
  await historyCreateSnapshot('auto-restore', 'Auto-saved before restore');
  const ok = applyCloudPayload(snap.data, { isFirstPull: true });
  if (!ok) { showToast('Could not restore this snapshot.', true); return false; }
  saveState(); saveSiloData(); saveFarmLoads(); savePredState(); saveShedViews();
  schedulePush();
  return true;
}

/* Download a snapshot as a JSON file — same format as the New Batch
   backup, so it's compatible with the app's JSON import. */
function historyDownloadSnapshot(snap) {
  if (!snap || !snap.data) return;
  const payload = snap.data;
  const batch = sanitizeBatchNumber(payload.batchNumber || 'current') || 'current';
  const farm = sanitizeUserFarmName(payload.farmName || 'farm');
  const dateStr = new Date(snap.timestamp).toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${farm}-feed-${batch}-snapshot-${dateStr}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  showToast('📥 Snapshot downloaded.');
}

/* Manual save from UI — shows a toast and refreshes the History page. */
async function historySaveManual() {
  if (!farmData) { showToast('Import Excel first — nothing to save yet.', true); return; }
  if (!historyIsAvailable()) { showToast('Version history is not available in this browser.', true); return; }
  const label = prompt('Name this version (optional):', '');
  if (label === null) return;
  const snap = await historyCreateSnapshot('manual', label.trim());
  if (snap) {
    showToast(`✅ Version saved${snap.label ? ' — "' + snap.label + '"' : ''}.`);
    if (activeTab === 'history') render();
  } else {
    showToast('Could not save version.', true);
  }
}

async function historyTogglePin(id) {
  const snap = await historyGet(id);
  if (!snap) return;
  snap.pinned = !snap.pinned;
  await historySave(snap);
  if (activeTab === 'history') render();
  showToast(snap.pinned ? '📌 Version pinned.' : 'Unpinned.');
}

async function historyDeleteFromUi(id) {
  const snap = await historyGet(id);
  if (!snap) return;
  const label = snap.label ? `"${snap.label}"` : new Date(snap.timestamp).toLocaleString();
  if (!confirm(`Delete this version?\n\n${label}\n\nThis cannot be undone.`)) return;
  await historyDelete(id);
  if (activeTab === 'history') render();
  showToast('🗑️ Version deleted.');
}

async function historyRestoreFromUi(id) {
  const snap = await historyGet(id);
  if (!snap) return;
  const sum = snap.summary || historySummarize(snap.data);
  const when = new Date(snap.timestamp).toLocaleString();
  const label = snap.label ? `"${snap.label}"` : 'Auto-save';
  const msg =
    `Restore this version?\n\n` +
    `${label}\n${when}\n\n` +
    `Batch: ${sum.batch || '—'}\n` +
    `${sum.sheds} placed sheds · ${sum.pickups} pickups\n` +
    `${sum.siloReadings} silo readings · ${sum.loads} feed loads\n\n` +
    `Your current data will be auto-saved first.`;
  if (!confirm(msg)) return;
  const ok = await historyRestoreSnapshot(id);
  if (ok) {
    showToast('✅ Version restored.');
    render();
  }
}

/* JSON import — closes the loop on the New Batch JSON backup file.
   Detects ProdWise backup shape and routes through applyCloudPayload. */
async function tryImportProdwiseJson(file) {
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    if (!payload || typeof payload !== 'object') return false;
    if (payload.app && payload.app !== SYNC_APP_TAG) return false;
    if (!payload.farmData || !Array.isArray(payload.farmData.sheds)) return false;
    await historyAutoSnapshot('auto-import', 'Before JSON import: ' + file.name);
    const ok = applyCloudPayload(payload, { isFirstPull: true });
    if (!ok) { showToast('Could not import this JSON file.', true); return true; }
    saveState(); saveSiloData(); saveFarmLoads(); savePredState(); saveShedViews();
    schedulePush();
    const sum = historySummarize(payload);
    showToast(`✅ Imported backup · ${sum.sheds} sheds · ${sum.pickups} pickups · ${sum.loads} loads`);
    render();
    return true;
  } catch (e) {
    console.warn('JSON import failed', e);
    return false;
  }
}