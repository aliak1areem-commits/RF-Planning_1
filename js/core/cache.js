/* =========================================================
   💾 CACHE — IndexedDB Wrapper
   ========================================================= */
(function() {
  'use strict';

  const DB_NAME = 'rf_planner_cache_v2';
  const DB_VERSION = 1;
  const STORE = 'cache';

  const CacheDB = {
    _db: null,

    async init() {
      if (this._db) return this._db;
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = e => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE)) {
            db.createObjectStore(STORE, { keyPath: 'key' });
          }
        };
        req.onsuccess = e => {
          this._db = e.target.result;
          resolve(this._db);
        };
        req.onerror = e => reject(e.target.error);
      });
    },

    async set(key, value) {
      const db = await this.init();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put({ key, value, savedAt: Date.now() });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    },

    async get(key, maxAgeMs) {
      const db = await this.init();
      return new Promise(resolve => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = () => {
          const rec = req.result;
          if (!rec) return resolve(null);
          if (maxAgeMs && Date.now() - rec.savedAt > maxAgeMs) return resolve(null);
          resolve(rec.value);
        };
        req.onerror = () => resolve(null);
      });
    },

    async clear() {
      const db = await this.init();
      return new Promise(resolve => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).clear();
        tx.oncomplete = () => resolve(true);
      });
    },

    async info() {
      const db = await this.init();
      return new Promise(resolve => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => {
          const items = req.result || [];
          const size = new Blob([JSON.stringify(items)]).size;
          resolve({
            count: items.length,
            sizeMB: (size / 1048576).toFixed(2),
            items: items.map(i => ({
              key: i.key,
              sizeMB: (new Blob([JSON.stringify(i.value)]).size / 1048576).toFixed(2),
              savedAt: new Date(i.savedAt).toLocaleString()
            }))
          });
        };
      });
    }
  };

  window.CacheDB = CacheDB;

  // Legacy localStorage cache
  function saveCacheToDisk(cells) {
    const MAX = 3000;
    if (cells.length > MAX) {
      try { localStorage.removeItem('rf_cells_cache_v2'); } catch (e) {}
      return;
    }
    try {
      const payload = {
        timestamp: Date.now(),
        cells: cells.map(c => ({
          id: c.id, cell_name: c.cell_name, site: c.site,
          lat: c.lat, long: c.long, bore: c.bore,
          pci: c.pci, rsi: c.rsi, bcch: c.bcch, bsic: c.bsic,
          hsn: c.hsn, tch: c.tch, lac: c.lac, bsc: c.bsc,
          bw: c.bw, height: c.height, cell_radius: c.radius,
          comment: c.comment || null, project_id: c.project_id,
          psc: c.psc, uarfcn_dl: c.uarfcn_dl,
          uarfcn_ul: c.uarfcn_ul, rnc_id: c.rnc_id
        }))
      };
      localStorage.setItem('rf_cells_cache_v2', JSON.stringify(payload));
    } catch (e) {
      try { localStorage.removeItem('rf_cells_cache_v2'); } catch (err) {}
    }
  }

  function loadCacheFromDisk() {
    try {
      const raw = localStorage.getItem('rf_cells_cache_v2');
      if (!raw) return null;
      const payload = JSON.parse(raw);
      if (Date.now() - payload.timestamp > 5 * 60 * 1000) return null;
      return payload.cells;
    } catch (e) {
      return null;
    }
  }

  async function clearCache() {
    await CacheDB.clear();
    localStorage.removeItem('rf_cells_cache_v2');
    toast('Cache cleared', 'success');
  }

  async function clearAllCache() {
    if (!confirm('مسح كل Cache؟')) return;
    await CacheDB.clear();
    toast('🗑️ تم مسح Cache', 'success');
  }

  window.saveCacheToDisk = saveCacheToDisk;
  window.loadCacheFromDisk = loadCacheFromDisk;
  window.clearCache = clearCache;
  window.clearAllCache = clearAllCache;

  console.log('✅ Cache loaded');
})();
