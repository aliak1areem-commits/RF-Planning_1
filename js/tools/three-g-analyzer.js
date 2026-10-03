/* =========================================================
   📶 3G / IRAT ANALYZER
   ========================================================= */
(function() {
  'use strict';

  let threeGImportedData = { inter: [], intra: [], irat: [] };
  let threeGNbCurrent = null;

  function threeGSwitchTab(name) {
    document.querySelectorAll('#page-tool-3g-nb .nb-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#page-tool-3g-nb .nb-tab-content').forEach(c => c.classList.remove('active'));

    const btn = document.querySelector('#page-tool-3g-nb .nb-tab[data-tab="' + name + '"]');
    if (btn) btn.classList.add('active');
    const content = document.getElementById('tab_' + name);
    if (content) content.classList.add('active');

    if (name === '3gimport') threeGPopulateProjects();
  }

  function threeGPopulateProjects() {
    const sel = document.getElementById('3g_project');
    if (!sel) return;
    sel.innerHTML = '<option value="">Choose Project</option>' +
      State.allProjects.map(p =>
        '<option value="' + p.id + '">' + escapeHtml(p.name) + '</option>').join('');
  }

  function threeGFileSelected(input, type) {
    const file = input.files[0];
    if (!file) return;

    const statusEl = document.getElementById('3g_status_' + type);
    if (statusEl) {
      statusEl.textContent = 'Reading...';
      statusEl.style.color = '#F2A900';
    }

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const text = e.target.result;
        const rows = threeGParseCSV(text);
        if (!rows.length) throw new Error('File is empty');

        const headers = Object.keys(rows[0]).map(h => h.toLowerCase());
        const hasGsmCol = headers.some(h => h.includes('gsm') && h.includes('name'));
        const hasNeighCol = headers.some(h => h.includes('neighboring') && h.includes('cell') && h.includes('name'));

        let detectedType = type;
        if (hasGsmCol) detectedType = 'irat';
        else if (hasNeighCol) detectedType = type === 'intra' ? 'intra' : 'inter';

        const srcCol = threeGFindCol(rows[0], ['cell name'], ['gsm', 'neighbor', 'neighboring']);
        const dstCol = threeGFindCol(rows[0], ['neighboring cell name']) ||
                       threeGFindCol(rows[0], ['gsm cell name']);
        const rncCol = threeGFindCol(rows[0], ['rnc id'], ['neighbor']);
        const nbRncCol = threeGFindCol(rows[0], ['rnc id of']);
        const cellIdCol = threeGFindCol(rows[0], ['cell id'], ['neighbor', 'gsm']);
        const nbCellIdCol = threeGFindCol(rows[0], ['neighboring cell id']) ||
                            threeGFindCol(rows[0], ['gsm cell index']);
        const bscCol = threeGFindCol(rows[0], ['bsc']);

        if (!srcCol || !dstCol) throw new Error('Source/Neighbor columns not found in CSV');

        const parsed = [];
        rows.forEach(r => {
          const src = String(r[srcCol] || '').trim().toUpperCase();
          const dst = String(r[dstCol] || '').trim().toUpperCase();
          if (!src || !dst) return;
          parsed.push({
            source_cell: src,
            neighbor_cell: dst,
            relation_type: detectedType,
            source_rnc: r[rncCol] ? parseInt(r[rncCol]) : null,
            source_cell_id: r[cellIdCol] ? parseInt(r[cellIdCol]) : null,
            neighbor_rnc: r[nbRncCol] ? parseInt(r[nbRncCol]) : null,
            neighbor_cell_id: r[nbCellIdCol] ? parseInt(r[nbCellIdCol]) : null,
            bsc_name: r[bscCol] || null,
            bidirectional: false
          });
        });

        threeGImportedData[detectedType] = parsed;
        if (statusEl) {
          statusEl.textContent = parsed.length + ' relations (' + detectedType + ')';
          statusEl.style.color = '#1F9D55';
        }

        threeGRenderPreview();
        toast('Loaded ' + parsed.length + ' relations (' + detectedType + ')', 'success');
      } catch (err) {
        if (statusEl) {
          statusEl.textContent = err.message;
          statusEl.style.color = '#D64545';
        }
        toast('Error: ' + err.message, 'error');
      }
    };
    reader.readAsText(file, 'UTF-8');
  }

  function threeGParseCSV(text) {
    text = text.replace(/^\uFEFF/, '');
    const delim = (text.split(/\r?\n/)[0] || '').includes('\t') ? '\t' : ',';
    const rows = [];
    let row = [], field = '', inQ = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQ) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQ = false;
        } else field += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === delim) { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (ch !== '\r') field += ch;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    if (rows.length < 2) return [];

    const headers = rows[0].map(h => h.trim());
    return rows.slice(1)
      .filter(r => r.length >= headers.length && r.some(v => v.trim()))
      .map(r => {
        const o = {};
        headers.forEach((h, i) => { o[h] = (r[i] || '').trim(); });
        return o;
      });
  }

  function threeGFindCol(sampleRow, keywords, exclude) {
    exclude = exclude || [];
    const keys = Object.keys(sampleRow);
    for (const k of keys) {
      const kl = k.toLowerCase();
      if (keywords.every(w => kl.includes(w)) && !exclude.some(e => kl.includes(e))) return k;
    }
    return null;
  }

  function threeGRenderPreview() {
    const total = threeGImportedData.inter.length +
                  threeGImportedData.intra.length +
                  threeGImportedData.irat.length;

    const el = document.getElementById('3g_preview');
    if (!el) return;
    if (!total) { el.innerHTML = ''; return; }

    el.innerHTML =
      '<div style="background:#EAF2FB;border-radius:10px;padding:14px 18px;font-size:13px;">' +
        '<b style="color:#0C1B3D;">Total loaded: ' + total + ' relations</b>' +
        '<div style="margin-top:8px;font-family:JetBrains Mono,monospace;font-size:12px;line-height:1.8;">' +
          'Inter-Freq: <b>' + threeGImportedData.inter.length + '</b><br>' +
          'Intra-Freq: <b>' + threeGImportedData.intra.length + '</b><br>' +
          'IRAT (3G to 2G): <b>' + threeGImportedData.irat.length + '</b>' +
        '</div>' +
      '</div>';
  }

  function threeGClearImport() {
    threeGImportedData = { inter: [], intra: [], irat: [] };
    ['inter', 'intra', 'irat'].forEach(t => {
      const f = document.getElementById('3g_file_' + t);
      const s = document.getElementById('3g_status_' + t);
      if (f) f.value = '';
      if (s) {
        s.textContent = 'Not uploaded';
        s.style.color = '#94A3B8';
      }
    });
    const p = document.getElementById('3g_preview');
    if (p) p.innerHTML = '';
    toast('Cleared', 'info');
  }

  async function threeGSaveToSupabase(btn) {
    const projectId = document.getElementById('3g_project')?.value;
    if (!projectId) { toast('Select project first', 'error'); return; }

    const all = [].concat(
      threeGImportedData.inter.map(r => Object.assign({}, r, { project_id: parseInt(projectId) })),
      threeGImportedData.intra.map(r => Object.assign({}, r, { project_id: parseInt(projectId) })),
      threeGImportedData.irat.map(r => Object.assign({}, r, { project_id: parseInt(projectId) }))
    );

    if (!all.length) { toast('No data to save', 'error'); return; }

    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      const BATCH = 500;
      let saved = 0;

      for (let i = 0; i < all.length; i += BATCH) {
        const batch = all.slice(i, i + BATCH);
        const { error } = await db.from('rf_neighbors').insert(batch);
        if (error) throw error;
        saved += batch.length;
        btn.textContent = 'Saving ' + saved + '/' + all.length + '...';
        await new Promise(r => setTimeout(r, 500));
      }

      toast('Saved ' + saved + ' relations to Supabase', 'success', 5000);
    } catch (e) {
      console.error(e);
      toast('Error: ' + e.message, 'error', 6000);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save to Supabase';
    }
  }

  function threeGGetBand(cellName) {
    const n = (cellName || '').toUpperCase();
    if (n.startsWith('U')) {
      const c = State.cellByName.get(n);
      if (c && c.uarfcn_dl) {
        const dl = c.uarfcn_dl;
        if (dl >= 2937 && dl <= 3088) return '900';
        if (dl >= 10562 && dl <= 10838) return '2100';
      }
      return '2100';
    }
    const suffix = n.slice(-1);
    const map = { 'A': '900', 'B': '900', 'C': '900', 'D': '1800', 'E': '1800', 'F': '1800', 'G': '900', 'H': '1800' };
    return map[suffix] || '900';
  }

  async function run3GNBAnalysis() {
    const cellName = (document.getElementById('3gnb_cell').value || '').trim().toUpperCase();
    const radius = parseInt(document.getElementById('3gnb_radius').value) || 1200;
    const thr = parseInt(document.getElementById('3gnb_thr').value) || 45;

    if (!cellName) { toast('Enter cell name', 'error'); return; }

    const source = await ensureCellInMemory(cellName);
    if (!source) { toast('Cell "' + cellName + '" not found', 'error', 4000); return; }
    if (source.tech !== '3G') { toast('Tool works on 3G cells only (starts with U)', 'error'); return; }

    toast('Loading neighbors...', 'info', 1500);

    const cellNbs = await loadNeighborsForCell(cellName);
    const refs = new Set();
    cellNbs.forEach(n => { refs.add(n.source_cell); refs.add(n.neighbor_cell); });
    await ensureReferencedCells(refs);

    const listedInter = new Set(
      cellNbs.filter(n => n.source_cell === cellName && n.relation_type === 'inter').map(n => n.neighbor_cell));
    const listedIntra = new Set(
      cellNbs.filter(n => n.source_cell === cellName && n.relation_type === 'intra').map(n => n.neighbor_cell));
    const allListed = new Set([...listedInter, ...listedIntra]);

    const neighbors = [];
    const seen = new Set();

    allListed.forEach(nbName => {
      seen.add(nbName);
      const nbCell = State.cellByName.get(nbName);

      if (!nbCell || nbCell.tech !== '3G') {
        neighbors.push({
          source: cellName, name: nbName, cell: null,
          distance: null, isFront: false, direction: '-',
          status: 'Added (Not Found)', type: '?'
        });
        return;
      }

      const dist = haversineDistance(source.lat, source.long, nbCell.lat, nbCell.long);
      const bearing = calculateBearing(source.lat, source.long, nbCell.lat, nbCell.long);
      const angleDiff = boreDifference(source.bore, bearing);
      const isFront = angleDiff <= thr;
      const sourceBand = threeGGetBand(cellName);
      const nbBand = threeGGetBand(nbName);
      const nbType = sourceBand === nbBand ? 'Intra-Freq' : 'Inter-Freq';

      neighbors.push({
        source: cellName, name: nbName, cell: nbCell,
        distance: dist, bearing, isFront, angleDiff,
        direction: isFront ? 'Front' : (angleDiff <= 120 ? 'Side' : 'Back'),
        status: 'Added', type: nbType, nbBand
      });
    });

    State.allCells
      .filter(c => c.tech === '3G' && c.cell_name !== cellName && /[A-Z]$/.test(c.cell_name))
      .forEach(nbCell => {
        if (seen.has(nbCell.cell_name)) return;
        const dist = haversineDistance(source.lat, source.long, nbCell.lat, nbCell.long);
        if (dist > radius) return;

        const bearing = calculateBearing(source.lat, source.long, nbCell.lat, nbCell.long);
        const angleDiff = boreDifference(source.bore, bearing);
        const isFront = angleDiff <= thr;
        const sourceBand = threeGGetBand(cellName);
        const nbBand = threeGGetBand(nbCell.cell_name);
        const nbType = sourceBand === nbBand ? 'Intra-Freq' : 'Inter-Freq';

        neighbors.push({
          source: cellName, name: nbCell.cell_name, cell: nbCell,
          distance: dist, bearing, isFront, angleDiff,
          direction: isFront ? 'Front' : (angleDiff <= 120 ? 'Side' : 'Back'),
          status: 'Missing', type: nbType, nbBand
        });
      });

    neighbors.sort((a, b) => {
      if (a.isFront !== b.isFront) return a.isFront ? -1 : 1;
      if (a.status !== b.status) return a.status === 'Added' ? -1 : 1;
      return (a.distance || 99999) - (b.distance || 99999);
    });

    threeGNbCurrent = { mode: '3gnb', source, neighbors, radius };

    const total = neighbors.length;
    const added = neighbors.filter(n => n.status === 'Added').length;
    const missing = neighbors.filter(n => n.status === 'Missing').length;
    const missFront = neighbors.filter(n => n.status === 'Missing' && n.isFront).length;
    const intra = neighbors.filter(n => n.type === 'Intra-Freq').length;
    const inter = neighbors.filter(n => n.type === 'Inter-Freq').length;
    const dists = neighbors.filter(n => n.distance != null).map(n => n.distance);
    const avgDist = dists.length ? dists.reduce((a, b) => a + b, 0) / dists.length : 0;

    const statsEl = document.getElementById('3gnb_stats');
    statsEl.innerHTML =
      '<b>' + escapeHtml(cellName) + '</b> | Total: <b>' + total + '</b> | ' +
      '<span style="color:#1F9D55;">Added: <b>' + added + '</b></span> | ' +
      '<span style="color:#B91C1C;">Missing: <b>' + missing + '</b></span> | ' +
      '<span style="color:#D97706;">Miss-Front: <b>' + missFront + '</b></span> | ' +
      'Intra: <b>' + intra + '</b> | Inter: <b>' + inter + '</b> | ' +
      'Avg: <b>' + avgDist.toFixed(0) + 'm</b>';

    // ✅ FIX: استخدم getElementById بدل querySelector
    const tableEl = document.getElementById('3gnb_table');
    const tbody = tableEl ? tableEl.querySelector('tbody') : null;

    if (tbody) {
      tbody.innerHTML = neighbors.map(nb => {
        const distStr = nb.distance != null ? nb.distance.toFixed(0) : '-';
        let bg, sc;
        if (nb.status === 'Missing') { bg = nb.isFront ? '#FFCDD2' : '#FFEBEE'; sc = '#B91C1C'; }
        else if (nb.status === 'Added') { bg = '#E8F5E9'; sc = '#1F9D55'; }
        else { bg = '#FFF3E0'; sc = '#8A5A00'; }

        const tc = nb.type === 'Intra-Freq' ? '#EAF2FB' : '#F3E8FF';
        const tcol = nb.type === 'Intra-Freq' ? '#124191' : '#7C3AED';

        return '<tr style="background:' + bg + ';">' +
          '<td>' + escapeHtml(nb.source) + '</td>' +
          '<td><b>' + escapeHtml(nb.name) + '</b></td>' +
          '<td>' + distStr + '</td>' +
          '<td>' + (nb.bearing != null ? nb.bearing.toFixed(0) + '°' : '-') + '</td>' +
          '<td>' + nb.direction + '</td>' +
          '<td><span style="padding:2px 8px;border-radius:10px;font-size:10.5px;font-weight:700;background:' + tc + ';color:' + tcol + ';">' + nb.type + '</span></td>' +
          '<td style="color:' + sc + ';font-weight:700;">' + nb.status + '</td>' +
          '<td>' + (nb.cell && nb.cell.rnc_id ? nb.cell.rnc_id : '-') + '</td>' +
        '</tr>';
      }).join('') || '<tr><td colspan="8" style="text-align:center;padding:20px;">No neighbors</td></tr>';
    }

    document.getElementById('3gnb_stats').style.display = 'block';
    document.getElementById('3gnb_main').style.display = 'block';
    toast(neighbors.length + ' neighbors', 'success');
  }

  async function runIRATAnalysis() {
    const cellName = (document.getElementById('irat_cell').value || '').trim().toUpperCase();
    const radius = parseInt(document.getElementById('irat_radius').value) || 1500;
    const thr = parseInt(document.getElementById('irat_thr').value) || 70;

    if (!cellName) { toast('Enter 3G cell name', 'error'); return; }

    const source = await ensureCellInMemory(cellName);
    if (!source) { toast('Cell not found', 'error'); return; }
    if (source.tech !== '3G') { toast('Must start with U (3G)', 'error'); return; }

    toast('Loading neighbors...', 'info', 1500);

    const cellNbs = await loadNeighborsForCell(cellName);
    const refs = new Set();
    cellNbs.forEach(n => { refs.add(n.source_cell); refs.add(n.neighbor_cell); });
    await ensureReferencedCells(refs);

    const listedIrat = new Set(
      cellNbs.filter(n => n.source_cell === cellName && n.relation_type === 'irat').map(n => n.neighbor_cell));

    const neighbors = [];
    const seen = new Set();

    listedIrat.forEach(nbName => {
      seen.add(nbName);
      const nbCell = State.cellByName.get(nbName);

      if (!nbCell) {
        neighbors.push({
          source: cellName, name: nbName, cell: null,
          distance: null, isFront: false, status: 'Added (Not Found)', direction: '-'
        });
        return;
      }

      const dist = haversineDistance(source.lat, source.long, nbCell.lat, nbCell.long);
      const bearing = calculateBearing(source.lat, source.long, nbCell.lat, nbCell.long);
      const angleDiff = boreDifference(source.bore, bearing);
      const isFront = angleDiff <= thr;

      neighbors.push({
        source: cellName, name: nbName, cell: nbCell,
        distance: dist, bearing, isFront, angleDiff,
        direction: isFront ? 'Front' : (angleDiff <= 120 ? 'Side' : 'Back'),
        status: 'Added'
      });
    });

    State.allCells
      .filter(c => c.tech === 'GSM' && /[A-Z]$/.test(c.cell_name))
      .forEach(nbCell => {
        if (seen.has(nbCell.cell_name)) return;
        const dist = haversineDistance(source.lat, source.long, nbCell.lat, nbCell.long);
        if (dist > radius) return;

        const bearing = calculateBearing(source.lat, source.long, nbCell.lat, nbCell.long);
        const angleDiff = boreDifference(source.bore, bearing);
        const isFront = angleDiff <= thr;

        neighbors.push({
          source: cellName, name: nbCell.cell_name, cell: nbCell,
          distance: dist, bearing, isFront, angleDiff,
          direction: isFront ? 'Front' : (angleDiff <= 120 ? 'Side' : 'Back'),
          status: 'Missing'
        });
        seen.add(nbCell.cell_name);
      });

    neighbors.sort((a, b) => {
      if (a.isFront !== b.isFront) return a.isFront ? -1 : 1;
      if (a.status !== b.status) return a.status === 'Added' ? -1 : 1;
      return (a.distance || 99999) - (b.distance || 99999);
    });

    threeGNbCurrent = { mode: 'irat', source, neighbors, radius };

    const total = neighbors.length;
    const added = neighbors.filter(n => n.status === 'Added').length;
    const missing = neighbors.filter(n => n.status === 'Missing').length;
    const missFront = neighbors.filter(n => n.status === 'Missing' && n.isFront).length;

    document.getElementById('irat_stats').innerHTML =
      '<b>' + escapeHtml(cellName) + '</b> | Total: <b>' + total + '</b> | ' +
      '<span style="color:#1F9D55;">Added: <b>' + added + '</b></span> | ' +
      '<span style="color:#B91C1C;">Missing: <b>' + missing + '</b></span> | ' +
      '<span style="color:#D97706;">Miss-Front: <b>' + missFront + '</b></span>';

    // ✅ FIX: استخدم getElementById
    const tableEl = document.getElementById('irat_table');
    const tbody = tableEl ? tableEl.querySelector('tbody') : null;

    if (tbody) {
      tbody.innerHTML = neighbors.map(nb => {
        const distStr = nb.distance != null ? nb.distance.toFixed(0) : '-';
        let bg, sc;
        if (nb.status === 'Missing') { bg = nb.isFront ? '#FFCDD2' : '#FFEBEE'; sc = '#B91C1C'; }
        else if (nb.status === 'Added') { bg = '#E8F5E9'; sc = '#1F9D55'; }
        else { bg = '#FFF3E0'; sc = '#8A5A00'; }

        return '<tr style="background:' + bg + ';">' +
          '<td>' + escapeHtml(nb.source) + '</td>' +
          '<td><b>' + escapeHtml(nb.name) + '</b></td>' +
          '<td>' + distStr + '</td>' +
          '<td>' + nb.direction + '</td>' +
          '<td style="color:' + sc + ';font-weight:700;">' + nb.status + '</td>' +
          '<td>' + (nb.cell ? escapeHtml(nb.cell.site) : '-') + '</td>' +
          '<td>' + (nb.cell && nb.cell.bsc ? escapeHtml(nb.cell.bsc) : '-') + '</td>' +
          '<td>' + (nb.cell && nb.cell.bcch ? nb.cell.bcch : '-') + '</td>' +
          '<td>' + (nb.cell && nb.cell.bsic ? escapeHtml(String(nb.cell.bsic)) : '-') + '</td>' +
        '</tr>';
      }).join('') || '<tr><td colspan="9" style="text-align:center;padding:20px;">No IRAT neighbors</td></tr>';
    }

    document.getElementById('irat_stats').style.display = 'block';
    document.getElementById('irat_main').style.display = 'block';
    toast(neighbors.length + ' IRAT neighbors', 'success');
  }

  async function run3GBatch() {
    const input = document.getElementById('3gbatch_input').value.trim();
    const radius = parseInt(document.getElementById('3gbatch_radius').value) || 1200;
    const mode = document.getElementById('3gbatch_mode').value;

    if (!input) { toast('Enter cells', 'error'); return; }

    const cells = input.split('\n').map(s => s.trim().toUpperCase()).filter(Boolean);

    // ✅ FIX
    const tableEl = document.getElementById('3gbatch_table');
    const tbody = tableEl ? tableEl.querySelector('tbody') : null;
    if (!tbody) return;

    let html = '';

    toast('Loading data...', 'info', 1500);

    for (const cellName of cells) {
      const source = await ensureCellInMemory(cellName);
      if (!source || source.tech !== '3G') {
        html += '<tr style="background:#FFEBEE;"><td><b>' + escapeHtml(cellName) + '</b></td>' +
          '<td colspan="9" style="text-align:center;color:#B91C1C;">Not found / Not 3G</td></tr>';
        continue;
      }

      const cellNbs = await loadNeighborsForCell(cellName);
      const refs = new Set();
      cellNbs.forEach(n => { refs.add(n.source_cell); refs.add(n.neighbor_cell); });
      await ensureReferencedCells(refs);

      html += '<tr><td><b>' + escapeHtml(cellName) + '</b></td><td colspan="9" style="text-align:center;color:#1F9D55;">Processed</td></tr>';
    }

    tbody.innerHTML = html || '<tr><td colspan="10" style="text-align:center;padding:20px;">No results</td></tr>';
    toast('Batch done for ' + cells.length + ' cells', 'success');
  }

  async function run3GDuplicateCheck() {
    const input = document.getElementById('3gbatch_input');
    const txt = input && input.value.trim();

    const cellNames = txt
      ? txt.split('\n').map(s => s.trim().toUpperCase()).filter(Boolean)
      : State.allCells.filter(c => c.tech === '3G').map(c => c.cell_name);

    if (!cellNames.length) { toast('Enter cells in Batch or load data first', 'error', 3000); return; }
    toast('Checking ' + cellNames.length + ' cells...', 'info', 3000);

    const bySource = new Map();
    const CH = 150;

    try {
      for (let i = 0; i < cellNames.length; i += CH) {
        const chunk = cellNames.slice(i, i + CH);
        for (let from = 0; ; from += 1000) {
          let q = db.from('rf_neighbors')
            .select('id,source_cell,neighbor_cell,relation_type')
            .in('source_cell', chunk)
            .order('id')
            .range(from, from + 999);
          if (State.currentProjectId) q = q.eq('project_id', State.currentProjectId);
          const { data, error } = await q;
          if (error) throw error;

          data.forEach(r => {
            if (!bySource.has(r.source_cell)) bySource.set(r.source_cell, []);
            bySource.get(r.source_cell).push(r);
          });

          if (data.length < 1000) break;
        }
      }
    } catch (e) {
      toast('Error: ' + e.message, 'error');
      return;
    }

    const dups = [];
    bySource.forEach((rows, cell) => {
      const byNb = new Map();
      rows.forEach(r => {
        if (!byNb.has(r.neighbor_cell)) byNb.set(r.neighbor_cell, []);
        byNb.get(r.neighbor_cell).push(r.relation_type);
      });
      byNb.forEach((types, nb) => {
        if (types.length > 1) dups.push({
          cell, nb,
          in_intra: types.includes('intra'),
          in_inter: types.includes('inter'),
          in_irat: types.includes('irat')
        });
      });
    });

    // ✅ FIX
    const tableEl = document.getElementById('3gdup_table');
    const tbody = tableEl ? tableEl.querySelector('tbody') : null;

    if (tbody) {
      tbody.innerHTML = dups.length
        ? dups.map(d => '<tr style="background:#FFF3E0;">' +
            '<td><b>' + escapeHtml(d.cell) + '</b></td>' +
            '<td>' + escapeHtml(d.nb) + '</td>' +
            '<td>' + (d.in_intra ? 'Yes' : '-') + '</td>' +
            '<td>' + (d.in_inter ? 'Yes' : '-') + '</td>' +
            '<td>' + (d.in_irat ? 'Yes' : '-') + '</td>' +
          '</tr>').join('')
        : '<tr><td colspan="5" style="text-align:center;padding:20px;color:#1F9D55;">No duplicates</td></tr>';
    }

    toast('Found ' + dups.length + ' duplicates', 'success');
  }

  function getNeighborStyle(nb) {
    const isIntra = nb.type === 'Intra-Freq';
    const isMissing = nb.status === 'Missing';

    if (isIntra && !isMissing) {
      return { fill: '#16A34A', stroke: '#15803D', lineColor: '#16A34A', dashArray: null, textColor: '#15803D' };
    } else if (!isIntra && !isMissing) {
      return { fill: '#2563EB', stroke: '#1E40AF', lineColor: '#2563EB', dashArray: null, textColor: '#1E40AF' };
    } else if (isIntra && isMissing) {
      return { fill: '#DC2626', stroke: '#991B1B', lineColor: '#DC2626', dashArray: '8,6', textColor: '#991B1B' };
    } else {
      return { fill: '#F97316', stroke: '#C2410C', lineColor: '#F97316', dashArray: '8,6', textColor: '#C2410C' };
    }
  }

  function threeGShowOnMap(mode) {
    if (!threeGNbCurrent) { toast('Run analysis first', 'error'); return; }

    window.__nbMode = true;
    window.__gsmMode = false;
    switchView('map');

    setTimeout(() => {
      if (State.sectorLayer) State.sectorLayer.clearLayers();
      if (State.labelLayer) State.labelLayer.clearLayers();
      if (State.coverageLayer) State.coverageLayer.clearLayers();

      window.nbMapLayers = window.nbMapLayers || [];
      nbMapLayers.forEach(l => { try { State.map.removeLayer(l); } catch (e) {} });
      window.nbMapLayers = [];

      const layersByCategory = {};
      const addToCategory = (cat, layer) => {
        if (!layersByCategory[cat]) layersByCategory[cat] = [];
        layersByCategory[cat].push(layer);
        nbMapLayers.push(layer);
        if (State.map && !State.map.hasLayer(layer)) State.map.addLayer(layer);
        return layer;
      };

      const src = threeGNbCurrent.source;
      const sLat = src.lat, sLon = src.long, sBore = src.bore;
      State.map.setView([sLat, sLon], 14);

      const radiusCircle = L.circle([sLat, sLon], {
        radius: threeGNbCurrent.radius || 1200,
        color: '#2563EB', weight: 2, dashArray: '6,6',
        fillColor: '#2563EB', fillOpacity: 0.04, interactive: false
      }).addTo(State.map);
      addToCategory('source', radiusCircle);

      const srcCoords = makeSectorCoords(sLat, sLon, sBore);
      const srcPoly = L.polygon(srcCoords, {
        color: '#991B1B', weight: 2.5, fillColor: '#DC2626', fillOpacity: 0.85
      }).addTo(State.map);
      srcPoly.bindTooltip(escapeHtml(src.cell_name), {
        permanent: true, direction: 'top', offset: [0, -10], className: 'nb-label-source'
      });
      addToCategory('source', srcPoly);

      const points = [[sLat, sLon]];

      threeGNbCurrent.neighbors.forEach(nb => {
        if (!nb.cell) return;
        points.push([nb.cell.lat, nb.cell.long]);

        let cat;
        if (mode === 'irat') {
          cat = nb.status === 'Missing' ? 'irat-missing' : 'irat-added';
        } else {
          const isIntra = nb.type === 'Intra-Freq';
          const isMissing = nb.status === 'Missing';
          if (isIntra && !isMissing) cat = 'intra-added';
          else if (!isIntra && !isMissing) cat = 'inter-added';
          else if (isIntra && isMissing) cat = 'intra-missing';
          else cat = 'inter-missing';
        }

        const style = getNeighborStyle(nb);

        const line = L.polyline([[sLat, sLon], [nb.cell.lat, nb.cell.long]], {
          color: style.lineColor,
          weight: nb.isFront ? 3 : 1.5,
          opacity: 0.85,
          dashArray: style.dashArray
        }).addTo(State.map);
        addToCategory(cat, line);

        const nCoords = makeSectorCoords(nb.cell.lat, nb.cell.long, nb.cell.bore);
        const nPoly = L.polygon(nCoords, {
          color: style.stroke, weight: 1.5,
          fillColor: style.fill, fillOpacity: 0.75
        }).addTo(State.map);
        nPoly.bindTooltip(nb.name, { permanent: true, direction: 'center', className: 'nb-label' });
        addToCategory(cat, nPoly);
      });

      if (points.length > 1) {
        State.map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
      }

      const onToggle = () => {
        Object.entries(layersByCategory).forEach(([cat, layers]) => {
          const visible = ToolLegend.isActive(cat);
          layers.forEach(l => {
            if (visible) { if (!State.map.hasLayer(l)) State.map.addLayer(l); }
            else { if (State.map.hasLayer(l)) State.map.removeLayer(l); }
          });
        });
      };

      if (mode === 'irat') {
        const added = threeGNbCurrent.neighbors.filter(n => n.status !== 'Missing').length;
        const missing = threeGNbCurrent.neighbors.filter(n => n.status === 'Missing').length;

        ToolLegend.show({
          icon: '🔗',
          title: 'IRAT (3G to 2G) · ' + threeGNbCurrent.neighbors.length,
          items: [
            { id: 'source', color: '#DC2626', label: '3G Source Cell', count: 1 },
            { id: 'irat-added', color: '#16A34A', label: 'Added (IRAT)', count: added },
            { id: 'irat-missing', color: '#F97316', label: 'Missing (IRAT)', count: missing, dashed: true }
          ],
          onToggle: onToggle
        });
      } else {
        const intraAdded = threeGNbCurrent.neighbors.filter(n => n.type === 'Intra-Freq' && n.status !== 'Missing').length;
        const intraMissing = threeGNbCurrent.neighbors.filter(n => n.type === 'Intra-Freq' && n.status === 'Missing').length;
        const interAdded = threeGNbCurrent.neighbors.filter(n => n.type === 'Inter-Freq' && n.status !== 'Missing').length;
        const interMissing = threeGNbCurrent.neighbors.filter(n => n.type === 'Inter-Freq' && n.status === 'Missing').length;

        ToolLegend.show({
          icon: '📡',
          title: '3G Neighbor · ' + threeGNbCurrent.neighbors.length,
          items: [
            { id: 'source', color: '#DC2626', label: 'Source Cell', count: 1 },
            { id: 'intra-added', color: '#16A34A', label: 'Intra-Freq Added', count: intraAdded },
            { id: 'intra-missing', color: '#DC2626', label: 'Intra-Freq Missing', count: intraMissing, dashed: true },
            { id: 'inter-added', color: '#2563EB', label: 'Inter-Freq Added', count: interAdded },
            { id: 'inter-missing', color: '#F97316', label: 'Inter-Freq Missing', count: interMissing, dashed: true }
          ],
          onToggle: onToggle
        });
      }

      toast(threeGNbCurrent.neighbors.length + ' neighbors on map', 'success');
    }, 400);
  }

  function threeGExportCSV(mode) {
    if (!threeGNbCurrent) { toast('Run analysis first', 'error'); return; }

    const headers = mode === '3gnb'
      ? ['Source', 'Neighbor', 'Distance', 'Bearing', 'Direction', 'Type', 'Status', 'RNC']
      : ['3G Cell', '2G Neighbor', 'Distance', 'Direction', 'Status', '2G Site', 'BSC', 'BCCH', 'BSIC'];

    const rows = [headers];
    threeGNbCurrent.neighbors.forEach(nb => {
      if (mode === '3gnb') {
        rows.push([
          nb.source, nb.name, nb.distance ? nb.distance.toFixed(1) : '',
          nb.bearing != null ? nb.bearing.toFixed(0) : '',
          nb.direction, nb.type, nb.status,
          nb.cell && nb.cell.rnc_id ? nb.cell.rnc_id : ''
        ]);
      } else {
        rows.push([
          nb.source, nb.name, nb.distance ? nb.distance.toFixed(1) : '',
          nb.direction, nb.status,
          nb.cell ? nb.cell.site : '',
          nb.cell && nb.cell.bsc ? nb.cell.bsc : '',
          nb.cell && nb.cell.bcch ? nb.cell.bcch : '',
          nb.cell && nb.cell.bsic ? nb.cell.bsic : ''
        ]);
      }
    });

    downloadCSV((mode === '3gnb' ? '3G_NB_' : 'IRAT_') + new Date().toISOString().slice(0, 10) + '.csv', rows);
    toast('CSV exported', 'success');
  }

  function clear3GNB() {
    document.getElementById('3gnb_stats').style.display = 'none';
    document.getElementById('3gnb_main').style.display = 'none';

    // ✅ FIX
    const tableEl = document.getElementById('3gnb_table');
    const tbody = tableEl ? tableEl.querySelector('tbody') : null;
    if (tbody) tbody.innerHTML = '';

    threeGNbCurrent = null;
    toast('Cleared', 'info');
  }

  function clearIRAT() {
    document.getElementById('irat_stats').style.display = 'none';
    document.getElementById('irat_main').style.display = 'none';

    // ✅ FIX
    const tableEl = document.getElementById('irat_table');
    const tbody = tableEl ? tableEl.querySelector('tbody') : null;
    if (tbody) tbody.innerHTML = '';

    threeGNbCurrent = null;
    toast('Cleared', 'info');
  }

  window.threeGSwitchTab = threeGSwitchTab;
  window.threeGFileSelected = threeGFileSelected;
  window.threeGClearImport = threeGClearImport;
  window.threeGSaveToSupabase = threeGSaveToSupabase;
  window.run3GNBAnalysis = run3GNBAnalysis;
  window.runIRATAnalysis = runIRATAnalysis;
  window.run3GBatch = run3GBatch;
  window.run3GDuplicateCheck = run3GDuplicateCheck;
  window.threeGShowOnMap = threeGShowOnMap;
  window.threeGExportCSV = threeGExportCSV;
  window.clear3GNB = clear3GNB;
  window.clearIRAT = clearIRAT;

  console.log('✅ 3G/IRAT analyzer loaded');
})();
