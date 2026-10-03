/* =========================================================
   🔗 NEIGHBOR ANALYSIS (GSM)
   ========================================================= */
(function() {
  'use strict';

  let nbCurrentNeighbors = [];
  let nbCurrentSource = null;
  let nbBeforeSnapshot = {};
  let nbCurrentRadius = 1200;
  let nbBatchResults = {};

  function nbGetNbFields(cell) {
    const result = [];
    for (let i = 1; i <= 35; i++) {
      const slot = 'nb' + i;
      const val = cell[slot];
      if (val && String(val).trim()) {
        result.push({ slot, slotNum: i, value: String(val).trim().toUpperCase() });
      }
    }
    return result;
  }

  function nbGetEmptySlots(cell) {
    const empty = [];
    for (let i = 1; i <= 35; i++) {
      const slot = 'nb' + i;
      const val = cell[slot];
      if (!val || !String(val).trim()) {
        empty.push({ slot, slotNum: i });
      }
    }
    return empty;
  }

  function nbFindCell(cellName) {
    const target = cellName.toUpperCase();
    return State.allCells.find(c => c.cell_name.toUpperCase() === target);
  }

  function nbIsFront(sourceBore, neighborBore, threshold) {
    const diff = Math.abs(sourceBore - neighborBore) % 360;
    const d = diff <= 180 ? diff : 360 - diff;
    return d <= threshold;
  }

  function nbAnalyzeCell(sourceCell, radius, threshold) {
    const sourceName = sourceCell.cell_name;
    const sLat = sourceCell.lat, sLon = sourceCell.long, sBore = sourceCell.bore;

    const listedNBs = nbGetNbFields(sourceCell);
    const neighbors = [];
    const seen = new Set();

    listedNBs.forEach(item => {
      const nbName = item.value;
      const feat = nbFindCell(nbName);

      if (feat && !/[A-Z]$/.test(feat.cell_name)) {
        neighbors.push({ name: nbName, cell: null, distance: null, isFront: false, status: 'Added (Not Found)', nbField: item.slot, nbSlotNum: item.slotNum });
        seen.add(nbName.toUpperCase());
        return;
      }
      if (!feat) {
        neighbors.push({ name: nbName, cell: null, distance: null, isFront: false, status: 'Added (Not Found)', nbField: item.slot, nbSlotNum: item.slotNum });
        seen.add(nbName.toUpperCase());
        return;
      }

      const dist = haversineDistance(sLat, sLon, feat.lat, feat.long);
      const front = nbIsFront(sBore, feat.bore, threshold);
      neighbors.push({ name: nbName, cell: feat, distance: dist, isFront: front, status: 'Added', nbField: item.slot, nbSlotNum: item.slotNum });
      seen.add(nbName.toUpperCase());
    });

    State.allCells.forEach(feat => {
      const fname = feat.cell_name.toUpperCase();
      if (fname === sourceName.toUpperCase()) return;
      if (seen.has(fname)) return;
      if (feat.tech !== 'GSM') return;
      if (!/[A-Z]$/.test(feat.cell_name)) return;

      const sourceSite = sourceName.replace(/[A-Z]$/, '');
      const featSite = feat.cell_name.replace(/[A-Z]$/, '');
      if (sourceSite === featSite) return;

      const dist = haversineDistance(sLat, sLon, feat.lat, feat.long);
      if (dist > radius) return;

      const front = nbIsFront(sBore, feat.bore, threshold);
      neighbors.push({ name: feat.cell_name, cell: feat, distance: dist, isFront: front, status: 'Missing', nbField: null, nbSlotNum: null });
      seen.add(fname);
    });

    neighbors.sort((a, b) => {
      if (a.isFront !== b.isFront) return a.isFront ? -1 : 1;
      if (a.status !== b.status) {
        if (a.status === 'Added') return -1;
        if (b.status === 'Added') return 1;
      }
      const da = a.distance != null ? a.distance : 999999;
      const db = b.distance != null ? b.distance : 999999;
      return da - db;
    });

    return neighbors;
  }

  function nbComputeStats(neighbors) {
    const total = neighbors.length;
    const added = neighbors.filter(n => n.status === 'Added').length;
    const missing = neighbors.filter(n => n.status === 'Missing').length;
    const front = neighbors.filter(n => n.isFront).length;
    const missFront = neighbors.filter(n => n.status === 'Missing' && n.isFront).length;
    const dists = neighbors.filter(n => n.distance != null).map(n => n.distance);
    const avgDist = dists.length ? dists.reduce((a, b) => a + b, 0) / dists.length : 0;
    const minDist = dists.length ? Math.min(...dists) : 0;
    return { total, added, missing, front, missFront, avgDist, minDist };
  }

  function runNeighborAnalysis() {
    const cellInput = document.getElementById('nb_cell');
    if (!cellInput) return;

    const cellName = (cellInput.value || '').trim().toUpperCase();
    const radius = parseInt(document.getElementById('nb_radius').value) || NB_DEFAULT_RADIUS;
    const threshold = parseInt(document.getElementById('nb_threshold').value) || NB_FRONT_THRESHOLD;

    if (!cellName) { toast('Please enter a source cell name', 'error'); return; }
    if (!State.allCells.length) { toast('No cells loaded', 'error', 5000); return; }

    const sourceCell = nbFindCell(cellName);
    if (!sourceCell) { toast('Cell "' + cellName + '" not found', 'error', 5000); return; }
    if (sourceCell.tech !== 'GSM') { toast('This tool works on GSM (2G) cells only', 'error', 5000); return; }

    const neighbors = nbAnalyzeCell(sourceCell, radius, threshold);
    nbCurrentNeighbors = neighbors;
    nbCurrentSource = sourceCell;
    nbCurrentRadius = radius;

    nbRenderStats(cellName, neighbors);
    nbRenderResultsTable(cellName, neighbors);

    document.getElementById('nb_stats').style.display = 'block';
    document.getElementById('nb_main').style.display = 'block';
    switchNbTab('results');
    toast(neighbors.length + ' neighbors found', 'success');
  }

  function nbRenderStats(cellName, neighbors) {
    const s = nbComputeStats(neighbors);
    const el = document.getElementById('nb_stats');
    el.innerHTML =
      '<b style="color:#124191;">' + escapeHtml(cellName) + '</b>  |  ' +
      'Total: <b>' + s.total + '</b>  |  ' +
      '<span style="color:#1F9D55;">Added: <b>' + s.added + '</b></span>  |  ' +
      '<span style="color:#D64545;">Missing: <b>' + s.missing + '</b></span>  |  ' +
      '<span style="color:#D97706;">Missing Front: <b>' + s.missFront + '</b></span>  |  ' +
      'Avg: <b>' + s.avgDist.toFixed(0) + 'm</b>';
  }

  function nbRenderResultsTable(sourceName, neighbors) {
    const tbody = document.querySelector('#nbResultsTable tbody');
    if (!neighbors.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#5A6B87;">No neighbors found</td></tr>';
      return;
    }

    tbody.innerHTML = neighbors.map(nb => {
      const distStr = nb.distance != null ? nb.distance.toFixed(1) : '-';
      const dir = nb.isFront ? 'Front' : 'Non-Front';

      let rowBg;
      if (nb.status === 'Missing') rowBg = nb.isFront ? '#FFCDD2' : '#FFEBEE';
      else if (nb.status === 'Added (Not Found)') rowBg = '#FFE0B2';
      else rowBg = '#E8F5E9';

      let statusColor;
      if (nb.status === 'Missing') statusColor = '#B91C1C';
      else if (nb.status === 'Added (Not Found)') statusColor = '#8A5A00';
      else statusColor = '#1F9D55';

      const siteVal = nb.cell ? escapeHtml(nb.cell.site || '-') : '-';
      const slotVal = nb.nbField ? nb.nbField.toUpperCase() : '-';

      return '<tr data-status="' + (nb.status === 'Added' ? 'added' : (nb.status === 'Missing' ? 'missing' : 'other')) + '" ' +
                  'data-dir="' + (nb.isFront ? 'front' : 'nonfront') + '" ' +
                  'data-dist="' + (nb.distance != null ? nb.distance : '') + '" ' +
                  'style="background:' + rowBg + ';">' +
        '<td>' + escapeHtml(sourceName) + '</td>' +
        '<td><b>' + escapeHtml(nb.name) + '</b></td>' +
        '<td>' + distStr + '</td>' +
        '<td>' + dir + '</td>' +
        '<td style="color:' + statusColor + ';font-weight:700;">' + nb.status + '</td>' +
        '<td>' + siteVal + '</td>' +
        '<td>' + slotVal + '</td>' +
      '</tr>';
    }).join('');
  }

  function switchNbTab(tabName) {
    const root = document.getElementById('page-tool-neighbor');
    if (!root) return;
    root.querySelectorAll('.nb-tab').forEach(t => t.classList.remove('active'));
    root.querySelectorAll('.nb-tab-content').forEach(c => c.classList.remove('active'));
    const btn = root.querySelector('.nb-tab[data-tab="' + tabName + '"]');
    if (btn) btn.classList.add('active');
    const content = document.getElementById('nb_tab_' + tabName);
    if (content) content.classList.add('active');
  }

  function clearNeighborAnalysis() {
    document.getElementById('nb_stats').style.display = 'none';
    document.getElementById('nb_main').style.display = 'none';
    document.querySelector('#nbResultsTable tbody').innerHTML = '';
    nbCurrentNeighbors = [];
    nbCurrentSource = null;
    nbBeforeSnapshot = {};
    toast('Cleared', 'info');
  }

  async function nbTakeSnapshot() {
    if (!State.allCells.length) { toast('No cells loaded', 'error'); return; }
    const gsmCells = State.allCells.filter(c => c.tech === 'GSM');
    if (!gsmCells.length) { toast('No GSM cells found', 'error'); return; }

    nbBeforeSnapshot = {};
    gsmCells.forEach(cell => {
      const nbs = [];
      for (let i = 1; i <= 35; i++) nbs.push(cell['nb' + i] || '');
      nbBeforeSnapshot[cell.cell_name] = nbs;
    });

    nbLog('Snapshot taken: ' + Object.keys(nbBeforeSnapshot).length + ' cells');
    toast('Snapshot taken for ' + Object.keys(nbBeforeSnapshot).length + ' cells', 'success');
  }

  async function nbDoAdd() {
    if (!nbCurrentSource || !nbCurrentNeighbors.length) { toast('Run analysis first', 'error'); return; }

    const frontOnly = document.getElementById('nb_add_front_only').checked;
    const missing = nbCurrentNeighbors.filter(n => n.status === 'Missing' && n.cell !== null && (!frontOnly || n.isFront));

    if (!missing.length) { toast('No missing neighbors to add', 'info'); return; }

    const emptySlots = nbGetEmptySlots(nbCurrentSource);
    if (!emptySlots.length) { toast('No empty NB slots (NB1-NB35 full)', 'error'); return; }

    const toAdd = missing.slice(0, emptySlots.length);
    const msg = 'Add ' + toAdd.length + ' missing neighbors to ' + nbCurrentSource.cell_name + '?';
    if (!confirm(msg)) return;

    const update = {};
    toAdd.forEach((nb, i) => { update[emptySlots[i].slot] = nb.name; });

    try {
      const { error } = await db.from('rf_cells').update(update).eq('id', nbCurrentSource.id);
      if (error) throw error;

      Object.keys(update).forEach(slot => { nbCurrentSource[slot] = update[slot]; });
      nbLog('Added ' + toAdd.length + ' NBs');
      toast('Added ' + toAdd.length + ' neighbors', 'success');
      if (typeof persistCellsCache === 'function') persistCellsCache();
      runNeighborAnalysis();
    } catch (e) {
      console.error(e);
      toast('Error: ' + e.message, 'error');
    }
  }

  async function nbDoRemove() {
    if (!nbCurrentSource || !nbCurrentNeighbors.length) { toast('Run analysis first', 'error'); return; }

    const keepRadius = parseInt(document.getElementById('nb_remove_radius').value) || 1500;
    const far = nbCurrentNeighbors.filter(n =>
      n.status === 'Added' && n.distance != null && n.distance > keepRadius && n.nbField);

    if (!far.length) { toast('No far neighbors to remove', 'info'); return; }
    if (!confirm('Remove ' + far.length + ' neighbors beyond ' + keepRadius + 'm?')) return;

    const update = {};
    far.forEach(n => { update[n.nbField] = null; });

    try {
      const { error } = await db.from('rf_cells').update(update).eq('id', nbCurrentSource.id);
      if (error) throw error;

      Object.keys(update).forEach(slot => { nbCurrentSource[slot] = null; });
      nbLog('Removed ' + far.length + ' far NBs');
      toast('Removed ' + far.length + ' neighbors', 'success');
      if (typeof persistCellsCache === 'function') persistCellsCache();
      runNeighborAnalysis();
    } catch (e) {
      console.error(e);
      toast('Error: ' + e.message, 'error');
    }
  }

  function nbLog(msg) {
    const el = document.getElementById('nbActionLog');
    if (!el) return;
    const time = new Date().toLocaleTimeString('en-GB');
    const line = '[' + time + '] ' + escapeHtml(msg);
    if (el.innerHTML.indexOf('No actions yet') !== -1) el.innerHTML = line;
    else el.innerHTML += '<br>' + line;
    el.scrollTop = el.scrollHeight;
  }

  function nbRunBatch() {
    const input = document.getElementById('nbBatchInput');
    const radius = parseInt(document.getElementById('nb_radius').value) || NB_DEFAULT_RADIUS;
    const threshold = parseInt(document.getElementById('nb_threshold').value) || NB_FRONT_THRESHOLD;

    if (!input || !input.value.trim()) { toast('Enter cell names', 'error'); return; }

    const lines = input.value.trim().split('\n').map(l => l.trim().toUpperCase()).filter(Boolean);
    if (!lines.length) { toast('No valid cell names', 'error'); return; }

    nbBatchResults = {};
    const tbody = document.querySelector('#nbBatchTable tbody');
    let html = '', processed = 0, notFound = 0;

    lines.forEach(cellName => {
      const source = nbFindCell(cellName);
      if (!source || source.tech !== 'GSM') { notFound++; return; }

      const neighbors = nbAnalyzeCell(source, radius, threshold);
      const stats = nbComputeStats(neighbors);
      nbBatchResults[cellName] = neighbors;
      processed++;

      html += '<tr>' +
        '<td><b>' + escapeHtml(cellName) + '</b></td>' +
        '<td>' + stats.total + '</td>' +
        '<td style="color:#1F9D55;font-weight:700;">' + stats.added + '</td>' +
        '<td style="color:#B91C1C;font-weight:700;">' + stats.missing + '</td>' +
        '<td style="background:' + (stats.missFront > 0 ? '#FFCDD2' : 'transparent') + ';font-weight:700;">' + stats.missFront + '</td>' +
        '<td>' + stats.avgDist.toFixed(0) + '</td>' +
      '</tr>';
    });

    if (!html) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#5A6B87;">No cells found</td></tr>';
    else tbody.innerHTML = html;

    toast('Analyzed ' + processed + ' cells' + (notFound ? ' · ' + notFound + ' not found' : ''), 'success', 4000);
  }

  function nbRefreshCompare() {
    if (!nbBeforeSnapshot || !Object.keys(nbBeforeSnapshot).length) {
      toast('Take a Before Snapshot first', 'error');
      return;
    }

    const tbody = document.querySelector('#nbCompareTable tbody');
    let html = '', changes = 0;

    State.allCells.filter(c => c.tech === 'GSM').forEach(cell => {
      const before = nbBeforeSnapshot[cell.cell_name];
      if (!before) return;

      for (let i = 0; i < 35; i++) {
        const slot = 'nb' + (i + 1);
        const b = (before[i] || '').trim();
        const a = (cell[slot] || '').trim();
        if (b === a) continue;

        const changeType = (!b && a) ? 'Added' : (b && !a) ? 'Removed' : 'Changed';
        const bg = changeType === 'Added' ? '#C8E6C9' : changeType === 'Removed' ? '#FFCDD2' : '#FFF9C4';

        html += '<tr style="background:' + bg + ';">' +
          '<td><b>' + escapeHtml(cell.cell_name) + '</b></td>' +
          '<td>' + slot.toUpperCase() + '</td>' +
          '<td>' + (b || '-') + '</td>' +
          '<td>' + (a || '-') + '</td>' +
          '<td style="font-weight:700;">' + changeType + '</td>' +
        '</tr>';
        changes++;
      }
    });

    if (!html) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:#5A6B87;">No changes detected</td></tr>';
      toast('No changes since snapshot', 'info');
    } else {
      tbody.innerHTML = html;
      toast(changes + ' changes detected', 'success');
    }
  }

  function nbShowOnMap() {
    if (!nbCurrentSource || !nbCurrentNeighbors.length) { toast('Run analysis first', 'error'); return; }

    window.__nbMode = true;
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

      const sLat = nbCurrentSource.lat, sLon = nbCurrentSource.long, sBore = nbCurrentSource.bore;
      State.map.setView([sLat, sLon], 14);

      const radiusCircle = L.circle([sLat, sLon], {
        radius: nbCurrentRadius, color: '#2563EB', weight: 2, dashArray: '6,6',
        fillColor: '#2563EB', fillOpacity: 0.04, interactive: false
      }).addTo(State.map);
      addToCategory('source', radiusCircle);

      const srcCoords = makeSectorCoords(sLat, sLon, sBore);
      const srcPoly = L.polygon(srcCoords, {
        color: '#991B1B', weight: 2.5, fillColor: '#DC2626', fillOpacity: 0.85
      }).addTo(State.map);
      srcPoly.bindTooltip(escapeHtml(nbCurrentSource.cell_name), {
        permanent: true, direction: 'top', offset: [0, -10], className: 'nb-label-source'
      });
      addToCategory('source', srcPoly);

      nbCurrentNeighbors.forEach(nb => {
        if (!nb.cell) return;
        const nLat = nb.cell.lat, nLon = nb.cell.long;

        let cat, fill, stroke;
        if (nb.status === 'Missing') { cat = 'missing'; fill = '#F97316'; stroke = '#C2410C'; }
        else if (nb.status === 'Added (Not Found)') { cat = 'not-found'; fill = '#EAB308'; stroke = '#A16207'; }
        else { cat = 'added'; fill = '#16A34A'; stroke = '#15803D'; }

        const line = L.polyline([[sLat, sLon], [nLat, nLon]], {
          color: nb.status === 'Missing' ? '#DC2626' : (nb.status === 'Added (Not Found)' ? '#EAB308' : '#16A34A'),
          weight: nb.isFront ? 3 : 1.5, opacity: 0.85,
          dashArray: nb.status === 'Missing' ? '8,6' : null
        }).addTo(State.map);
        addToCategory(cat, line);

        const nCoords = makeSectorCoords(nLat, nLon, nb.cell.bore);
        const nPoly = L.polygon(nCoords, {
          color: stroke, weight: 1.5, fillColor: fill, fillOpacity: 0.7
        }).addTo(State.map);
        nPoly.bindTooltip(nb.name, { permanent: true, direction: 'center', className: 'nb-label' });
        addToCategory(cat, nPoly);
      });

      const points = [[sLat, sLon]];
      nbCurrentNeighbors.forEach(nb => { if (nb.cell) points.push([nb.cell.lat, nb.cell.long]); });
      if (points.length > 1) {
        const bounds = L.latLngBounds(points);
        State.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
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

      const added = nbCurrentNeighbors.filter(n => n.status === 'Added').length;
      const missing = nbCurrentNeighbors.filter(n => n.status === 'Missing').length;
      const notFound = nbCurrentNeighbors.filter(n => n.status === 'Added (Not Found)').length;

      ToolLegend.show({
        icon: '🔗',
        title: '2G Neighbor · ' + nbCurrentNeighbors.length,
        items: [
          { id: 'source', color: '#DC2626', label: 'Source Cell', count: 1 },
          { id: 'added', color: '#16A34A', label: 'Added', count: added },
          { id: 'missing', color: '#F97316', label: 'Missing', count: missing, dashed: true },
          { id: 'not-found', color: '#EAB308', label: 'Not Found in DB', count: notFound }
        ],
        onToggle: onToggle
      });

      toast(nbCurrentNeighbors.length + ' neighbors on map', 'success');
    }, 500);
  }

  function nbHideMapLayers() {
    window.__nbMode = false;
    window.nbMapLayers = window.nbMapLayers || [];
    nbMapLayers.forEach(l => State.map.removeLayer(l));
    window.nbMapLayers = [];
    if (typeof ToolLegend !== 'undefined') ToolLegend.hide();
    toast('Map layers hidden', 'info');
  }

  function nbExportCSV() {
    if (!nbCurrentNeighbors.length) { toast('Run analysis first', 'error'); return; }
    const rows = [['Source', 'Neighbor', 'Distance (m)', 'Direction', 'Status', 'Site', 'NB Slot']];
    nbCurrentNeighbors.forEach(nb => {
      rows.push([
        nbCurrentSource ? nbCurrentSource.cell_name : '',
        nb.name,
        nb.distance != null ? nb.distance.toFixed(1) : '',
        nb.isFront ? 'Front' : 'Non-Front',
        nb.status,
        nb.cell && nb.cell.site ? nb.cell.site : '',
        nb.nbField ? nb.nbField.toUpperCase() : ''
      ]);
    });
    downloadCSV('NB_Analysis_' + (nbCurrentSource ? nbCurrentSource.cell_name : 'export') + '_' + new Date().toISOString().slice(0, 10) + '.csv', rows);
    toast('CSV exported', 'success');
  }

  function nbCopyResults() {
    if (!nbCurrentNeighbors.length) { toast('Run analysis first', 'error'); return; }
    const rows = [['Source', 'Neighbor', 'Distance (m)', 'Direction', 'Status', 'Site', 'NB Slot']];
    nbCurrentNeighbors.forEach(nb => {
      rows.push([
        nbCurrentSource ? nbCurrentSource.cell_name : '',
        nb.name,
        nb.distance != null ? nb.distance.toFixed(1) : '',
        nb.isFront ? 'Front' : 'Non-Front',
        nb.status,
        nb.cell && nb.cell.site ? nb.cell.site : '',
        nb.nbField ? nb.nbField.toUpperCase() : ''
      ]);
    });
    const text = rows.map(r => r.join('\t')).join('\n');
    navigator.clipboard.writeText(text).then(() => toast('Copied', 'success')).catch(() => toast('Copy failed', 'error'));
  }

  function applyNbFilters() {
    const distF = document.getElementById('nb_filter_dist').value;
    const dirF = document.getElementById('nb_filter_dir').value;
    const statF = document.getElementById('nb_filter_status').value;

    document.querySelectorAll('#nbResultsTable tbody tr').forEach(row => {
      const status = row.getAttribute('data-status');
      const dir = row.getAttribute('data-dir');
      const distStr = row.getAttribute('data-dist');
      const dist = distStr ? parseFloat(distStr) : null;
      let show = true;

      if (distF !== 'all' && dist != null) {
        if (distF === 'lt500' && dist >= 500) show = false;
        else if (distF === '500_1000' && !(dist >= 500 && dist <= 1000)) show = false;
        else if (distF === 'gt1000' && dist <= 1000) show = false;
      }
      if (show && dirF !== 'all') {
        if (dirF === 'front' && dir !== 'front') show = false;
        if (dirF === 'nonfront' && dir !== 'nonfront') show = false;
      }
      if (show && statF !== 'all') {
        if (statF === 'added' && status !== 'added') show = false;
        if (statF === 'missing' && status !== 'missing') show = false;
      }
      row.style.display = show ? '' : 'none';
    });
  }

  window.runNeighborAnalysis = runNeighborAnalysis;
  window.switchNbTab = switchNbTab;
  window.clearNeighborAnalysis = clearNeighborAnalysis;
  window.nbTakeSnapshot = nbTakeSnapshot;
  window.nbDoAdd = nbDoAdd;
  window.nbDoRemove = nbDoRemove;
  window.nbRunBatch = nbRunBatch;
  window.nbRefreshCompare = nbRefreshCompare;
  window.nbShowOnMap = nbShowOnMap;
  window.nbHideMapLayers = nbHideMapLayers;
  window.nbExportCSV = nbExportCSV;
  window.nbCopyResults = nbCopyResults;
  window.applyNbFilters = applyNbFilters;

  console.log('✅ Neighbor analysis loaded');
})();
