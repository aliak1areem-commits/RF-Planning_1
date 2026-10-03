/* =========================================================
   💾 CELLS LOADER — Load + Normalize + Lookups
   ========================================================= */
(function() {
  'use strict';

  function normalizeCell(row) {
    const name = row.cell_name || '';
    const baseName = name.toUpperCase().replace(/^[LU]/, '');
    const prefixMatch = baseName.match(/^[A-Z]+/);
    const region = prefixMatch ? prefixMatch[0] : 'UNKNOWN';
    const sector = name.slice(-1);

    const site = row.site
      ? String(row.site).toUpperCase().replace(/^[LU]/, '')
      : baseName.replace(/[A-Z]$/, '');

    const nameUpper = name.toUpperCase();
    const isLTE = nameUpper.startsWith('L');
    const is3G = nameUpper.startsWith('U');
    const isGSM = !isLTE && !is3G;

    const uarfcn_dl_val = row.downlink_uarfcn != null ? parseInt(row.downlink_uarfcn)
                        : (row.dl_uarfcn != null ? parseInt(row.dl_uarfcn)
                        : (row.uarfcn_dl != null ? parseInt(row.uarfcn_dl) : null));
    const uarfcn_ul_val = row.uplink_uarfcn != null ? parseInt(row.uplink_uarfcn)
                        : (row.ul_uarfcn != null ? parseInt(row.ul_uarfcn)
                        : (row.uarfcn_ul != null ? parseInt(row.uarfcn_ul) : null));

    const gsmBand = (function() {
      if (isGSM) return GSM_BAND_SUFFIX[sector.toUpperCase()] || 'unknown';
      if (is3G) {
        const dl = uarfcn_dl_val || 0;
        if (dl >= 2937 && dl <= 3088) return '900';
        if (dl >= 10562 && dl <= 10838) return '2100';
        return 'unknown';
      }
      return null;
    })();

    const result = {
      id: row.id,
      cell_name: name,
      cell_id: row.cell_id || 0,
      site: site,
      region: region,
      sector: sector,
      gsmBand: gsmBand,
      lat: parseFloat(row.lat) || 0,
      long: parseFloat(row.long) || 0,
      bore: row.bore || 0,
      radius: row.cell_radius || 5000,
      pci: row.pci != null ? parseInt(row.pci) : null,
      rsi: row.rsi || 0,
      bcch: row.bcch || 0,
      bsic: row.bsic || '',
      tch: row.tch || 0,
      lac: row.lac || 0,
      hsn: row.hsn != null ? parseInt(row.hsn) : null,
      psc: row.psc != null ? parseInt(row.psc) : null,
      uarfcn_dl: uarfcn_dl_val,
      uarfcn_ul: uarfcn_ul_val,
      rnc_id: row.rnc_id != null ? parseInt(row.rnc_id) : null,
      bsc: row.bsc || '',
      bw: row.bw || 0,
      height: row.height || 0,
      comment: row.comment || null,
      project_id: row.project_id || null,
      tech: isGSM ? 'GSM' : (isLTE ? 'LTE' : (is3G ? '3G' : 'Unknown')),
      color: CELL_COLOR
    };

    for (let i = 1; i <= 35; i++) {
      const val = row['nb' + i];
      if (val !== null && val !== undefined && String(val).trim() !== '') {
        result['nb' + i] = String(val).trim();
      }
    }

    return result;
  }

  function rebuildLookups() {
    State.cellByName.clear();
    State.cellById.clear();
    State.allCells.forEach(c => {
      State.cellByName.set(c.cell_name.toUpperCase(), c);
      State.cellById.set(c.id, c);
    });
  }

  function updateStats() {
    const el = id => document.getElementById(id);
    const cells = State.allCells;

    if (el('statTotal')) el('statTotal').textContent = cells.length;

    const sites = new Set(cells
      .filter(c => /[A-Z]$/.test(c.cell_name))
      .map(c => {
        let site = c.cell_name.replace(/[A-Z]$/, '');
        site = site.replace(/^[LU]/, '');
        return site.toUpperCase();
      })
    );
    if (el('statSites')) el('statSites').textContent = sites.size;

    const regions = new Set(cells.map(c => c.region));
    if (el('statBands')) el('statBands').textContent = regions.size;

    if (el('navCellsCount')) el('navCellsCount').textContent = cells.length;
  }

  function cellsForCache() {
    return State.allCells.map(c => {
      const o = {
        id: c.id, cell_name: c.cell_name, cell_id: c.cell_id, site: c.site,
        lat: c.lat, long: c.long, bore: c.bore, pci: c.pci, rsi: c.rsi,
        bcch: c.bcch, bsic: c.bsic, tch: c.tch, lac: c.lac, hsn: c.hsn,
        psc: c.psc, uarfcn_dl: c.uarfcn_dl, uarfcn_ul: c.uarfcn_ul,
        rnc_id: c.rnc_id, bsc: c.bsc, bw: c.bw, height: c.height,
        cell_radius: c.radius, comment: c.comment || null, project_id: c.project_id
      };
      for (let i = 1; i <= 35; i++) if (c['nb' + i]) o['nb' + i] = c['nb' + i];
      return o;
    });
  }

  async function persistCellsCache() {
    try {
      await CacheDB.set('cells_' + (State.currentProjectId || 'all'), cellsForCache());
    } catch (e) {
      console.warn(e);
    }
  }

  async function loadCells(useCache) {
    useCache = useCache !== false;
    const loadingEl = document.getElementById('loadingOverlay');
    const t0 = performance.now();
    const cacheKey = 'cells_' + (State.currentProjectId || 'all');

    // 1. Cache attempt
    if (useCache) {
      const cached = await CacheDB.get(cacheKey, 10 * 60 * 1000);
      if (cached && cached.length > 0) {
        console.log('⚡ Cache HIT: ' + cached.length + ' cells');
        State.allCells = cached.map(normalizeCell);
        rebuildLookups();
        updateStats();
        applyFilters();
        setTimeout(() => {
          if (State.map) State.map.invalidateSize();
          setTimeout(() => fitAllCells(), 150);
        }, 50);
        if (loadingEl) loadingEl.style.display = 'none';
        toast('⚡ ' + State.allCells.length.toLocaleString() + ' cells (Cache)', 'success', 1500);
        return;
      }
    }

    if (loadingEl) loadingEl.style.display = 'flex';

    try {
      let countQuery = db.from('rf_cells').select('id', { count: 'exact', head: true });
      if (State.currentProjectId) countQuery = countQuery.eq('project_id', State.currentProjectId);
      const { count } = await countQuery;
      const total = count || 0;

      console.log('📊 Total cells: ' + total);

      if (total === 0) {
        State.allCells = [];
        rebuildLookups();
        updateStats();
        applyFilters();
        if (loadingEl) loadingEl.style.display = 'none';
        return;
      }

      const PAGE_SIZE = 1000;
      const pages = Math.ceil(total / PAGE_SIZE);
      const promises = [];

      for (let i = 0; i < pages; i++) {
        let q = db.from('rf_cells').select('*').order('cell_name')
          .range(i * PAGE_SIZE, (i + 1) * PAGE_SIZE - 1);
        if (State.currentProjectId) q = q.eq('project_id', State.currentProjectId);
        promises.push(q);
      }

      const results = await Promise.all(promises);
      let allData = [];
      results.forEach(r => {
        if (r.error) throw r.error;
        if (r.data) allData = allData.concat(r.data);
      });

      State.allCells = allData.map(normalizeCell);
      rebuildLookups();
      updateStats();
      applyFilters();

      await CacheDB.set(cacheKey, cellsForCache());

      setTimeout(() => {
        if (State.map) State.map.invalidateSize();
        setTimeout(() => fitAllCells(), 150);
      }, 100);

      const dur = ((performance.now() - t0) / 1000).toFixed(1);
      console.log('✅ Loaded ' + State.allCells.length + ' in ' + dur + 's');
      toast('✅ ' + State.allCells.length.toLocaleString() + ' cells (' + dur + 's)', 'success', 1500);
    } catch (e) {
      console.error(e);
      toast('Error: ' + e.message, 'error');
    } finally {
      if (loadingEl) loadingEl.style.display = 'none';
    }
  }

  async function refreshCellsInBackground() {
    try {
      let countQuery = db.from('rf_cells').select('id', { count: 'exact', head: true });
      if (State.currentProjectId) countQuery = countQuery.eq('project_id', State.currentProjectId);
      const { count } = await countQuery;
      const total = count || 0;

      const PAGE_SIZE = 1000;
      const pages = Math.ceil(total / PAGE_SIZE);
      const promises = [];
      for (let i = 0; i < pages; i++) {
        let q = db.from('rf_cells').select('*').order('cell_name')
          .range(i * PAGE_SIZE, (i + 1) * PAGE_SIZE - 1);
        if (State.currentProjectId) q = q.eq('project_id', State.currentProjectId);
        promises.push(q);
      }
      const results = await Promise.all(promises);
      let allData = [];
      results.forEach(r => {
        if (r.data) allData = allData.concat(r.data);
      });

      if (allData.length !== State.allCells.length) {
        State.allCells = allData.map(normalizeCell);
        rebuildLookups();
        updateStats();
        applyFilters();
        await CacheDB.set('cells_' + (State.currentProjectId || 'all'), cellsForCache());
        toast('🔄 Network updated (' + State.allCells.length + ' cells)', 'info', 3000);
      }
    } catch (e) {
      console.warn('Background refresh failed:', e);
    }
  }

  async function loadNeighborsForCell(cellName) {
    if (State.cellNeighborsCache.has(cellName)) {
      return State.cellNeighborsCache.get(cellName);
    }

    const columns = 'source_cell,neighbor_cell,relation_type,source_rnc,source_cell_id,neighbor_rnc,neighbor_cell_id,bsc_name,bidirectional,project_id,id';

    const [asSource, asTarget] = await Promise.all([
      db.from('rf_neighbors').select(columns).eq('source_cell', cellName).limit(5000),
      db.from('rf_neighbors').select(columns).eq('neighbor_cell', cellName).limit(5000)
    ]);

    const all = [...(asSource.data || []), ...(asTarget.data || [])];
    const unique = Array.from(new Map(all.map(n => [n.id, n])).values());

    State.cellNeighborsCache.set(cellName, unique);
    return unique;
  }

  async function ensureReferencedCells(cellNames) {
    const inMemory = new Set(State.allCells.map(c => c.cell_name));
    const missing = [...cellNames].filter(n => n && !inMemory.has(n));
    if (missing.length === 0) return;

    const BATCH = 150;
    let added = 0;
    for (let i = 0; i < missing.length; i += BATCH) {
      const batch = missing.slice(i, i + BATCH);
      const { data } = await db.from('rf_cells').select('*').in('cell_name', batch);
      if (data && data.length) {
        State.allCells = State.allCells.concat(data.map(normalizeCell));
        added += data.length;
      }
    }
    rebuildLookups();
  }

  async function ensureCellInMemory(cellName) {
    let cell = State.cellByName.get(cellName);
    if (cell) return cell;

    const { data } = await db.from('rf_cells').select('*')
      .eq('cell_name', cellName).maybeSingle();
    if (!data) return null;

    const normalized = normalizeCell(data);
    State.allCells.push(normalized);
    rebuildLookups();
    return normalized;
  }

  window.normalizeCell = normalizeCell;
  window.rebuildLookups = rebuildLookups;
  window.updateStats = updateStats;
  window.persistCellsCache = persistCellsCache;
  window.loadCells = loadCells;
  window.refreshCellsInBackground = refreshCellsInBackground;
  window.loadNeighborsForCell = loadNeighborsForCell;
  window.ensureReferencedCells = ensureReferencedCells;
  window.ensureCellInMemory = ensureCellInMemory;

  console.log('✅ Cells loader loaded');
})();
