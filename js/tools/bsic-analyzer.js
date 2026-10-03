/* =========================================================
   🎨 BSIC ANALYZER — Clash detection + Strict-separation
   ========================================================= */
(function() {
  'use strict';

  let bsicMode = 'clash';
  let bsicLastResults = null;

  function bsicSetMode(mode) {
    bsicMode = mode;
    const b1 = document.getElementById('bsicModeBtn1');
    const b2 = document.getElementById('bsicModeBtn2');
    if (b1) b1.className = mode === 'clash' ? 'btn btn-primary' : 'btn btn-ghost';
    if (b2) b2.className = mode === 'optimize' ? 'btn btn-primary' : 'btn btn-ghost';
    const desc = document.getElementById('bsicModeDesc');
    if (desc) {
      desc.innerHTML = mode === 'clash'
        ? '<b>Clash Finder:</b> Find cells with same BCCH + BSIC within a specified distance.'
        : '<b>Full Optimizer:</b> Analyze all GSM cells and reassign all BSIC conflicts.';
    }
  }

  function bsicFormat(bsic) {
    if (bsic == null || bsic === '') return '00';
    if (typeof bsic === 'number') return String(bsic).padStart(2, '0').slice(-2);
    const s = String(bsic).trim();
    if (/^\d+$/.test(s)) {
      return s.length === 1 ? '0' + s : s.slice(0, 2).padStart(2, '0');
    }
    return s.padStart(2, '0').slice(-2);
  }

  function bsicAllPossible() {
    const list = [];
    for (let ncc = 0; ncc < 8; ncc++) {
      for (let bcc = 0; bcc < 8; bcc++) {
        list.push(String(ncc) + String(bcc));
      }
    }
    return list;
  }

  function bsicDistanceKm(lat1, lon1, lat2, lon2) {
    return haversineDistance(lat1, lon1, lat2, lon2) / 1000;
  }

  function runBSICAnalyzer() {
    const gsmCells = State.allCells.filter(c =>
      c.tech === 'GSM' && /[A-Z]$/.test(c.cell_name) && c.bsic !== '' && c.bsic != null);

    if (!gsmCells.length) {
      toast('No GSM cells with BSIC found', 'error', 6000);
      return;
    }

    const bcchText = (document.getElementById('bsic_bcch').value || '').trim();
    const targetBCCH = bcchText ? parseInt(bcchText) : null;
    const clashRadiusKm = parseFloat(document.getElementById('bsic_clash_radius').value) || 10;
    const analysisRadiusKm = parseFloat(document.getElementById('bsic_analysis_radius').value) || 200;

    let features = gsmCells;
    if (targetBCCH !== null && !isNaN(targetBCCH)) {
      features = gsmCells.filter(c => parseInt(c.bcch) === targetBCCH);
    }

    if (!features.length) {
      toast(targetBCCH !== null ? 'No cells with BCCH = ' + targetBCCH : 'No cells', 'error');
      return;
    }

    console.log('BSIC Analyzer [' + bsicMode + ']: ' + features.length + ' cells');

    const analysisRadiusM = analysisRadiusKm * 1000;
    const clashRadiusM = clashRadiusKm * 1000;

    const results = features.map(cell => ({
      id: cell.id,
      cell_name: cell.cell_name,
      bcch: parseInt(cell.bcch) || 0,
      bsic: bsicFormat(cell.bsic),
      lat: cell.lat,
      lon: cell.long,
      bore: cell.bore,
      neighbors_count: 0,
      same_bsic_nearby: 0,
      conflict_peers: []
    }));

    const searchRadiusM = Math.max(analysisRadiusM, clashRadiusM);
    const bucketDeg = Math.max(searchRadiusM / 85000, 0.001);
    const buckets = new Map();
    const key = (lat, lon) => Math.floor(lat / bucketDeg) + ',' + Math.floor(lon / bucketDeg);

    results.forEach((r, idx) => {
      const k = key(r.lat, r.lon);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(idx);
    });

    results.forEach((r, i) => {
      const [bx, by] = key(r.lat, r.lon).split(',').map(Number);
      const nearby = [];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const nk = (bx + dx) + ',' + (by + dy);
          if (buckets.has(nk)) nearby.push(...buckets.get(nk));
        }
      }
      const uniqueNearby = [...new Set(nearby)].filter(j => j !== i);

      uniqueNearby.forEach(j => {
        const o = results[j];
        const dM = haversineDistance(r.lat, r.lon, o.lat, o.lon);
        if (dM <= analysisRadiusM) r.neighbors_count++;
        if (r.bcch === o.bcch && r.bsic === o.bsic && dM <= clashRadiusM) {
          r.same_bsic_nearby++;
          r.conflict_peers.push({ cell: o.cell_name, distance_m: dM, bsic: o.bsic });
        }
      });
    });

    let analysisResults = results;
    if (bsicMode === 'clash') {
      analysisResults = results.filter(r => r.same_bsic_nearby > 0);
    }

    analysisResults.sort((a, b) =>
      b.same_bsic_nearby - a.same_bsic_nearby || a.cell_name.localeCompare(b.cell_name));

    const suggestions = bsicSuggestStrict(analysisResults, clashRadiusKm, results);

    let changeCount = 0;
    let highCount = 0;
    let mediumCount = 0;

    analysisResults.forEach(r => {
      const s = suggestions.get(r.id);
      if (bsicMode === 'clash' && r.same_bsic_nearby === 0) {
        r.suggested = r.bsic;
      } else if (s && s !== r.bsic) {
        r.suggested = s;
        changeCount++;
      } else {
        r.suggested = r.bsic;
      }
      if (r.same_bsic_nearby >= 3) highCount++;
      else if (r.same_bsic_nearby >= 1) mediumCount++;
    });

    bsicLastResults = {
      cells: analysisResults,
      suggestions: suggestions,
      mode: bsicMode,
      targetBCCH: targetBCCH,
      clashRadiusKm: clashRadiusKm,
      analysisRadiusKm: analysisRadiusKm,
      changes: changeCount,
      highCount: highCount,
      mediumCount: mediumCount
    };

    renderBSICResults(bsicLastResults);
    document.getElementById('bsicResults').style.display = 'block';
    toast(analysisResults.length + ' cells · ' + changeCount + ' suggestions', 'success', 5000);
  }

  function bsicSuggestStrict(cells, minDistanceKm, universe) {
    universe = universe || cells;
    const suggestions = new Map();
    const allBsics = bsicAllPossible();
    const assignments = {};

    const sorted = cells.slice().sort((a, b) => {
      if ((b.same_bsic_nearby || 0) !== (a.same_bsic_nearby || 0)) {
        return (b.same_bsic_nearby || 0) - (a.same_bsic_nearby || 0);
      }
      return b.lat - a.lat;
    });

    sorted.forEach(cell => {
      const cellId = cell.id;
      const currentBsic = cell.bsic;
      const lat = cell.lat, lon = cell.lon;
      const hasConflict = (cell.same_bsic_nearby || 0) > 0;

      if (!hasConflict) {
        suggestions.set(cellId, currentBsic);
        if (!assignments[currentBsic]) assignments[currentBsic] = [];
        assignments[currentBsic].push({ lat, lon, cell_id: cellId, bcch: cell.bcch });
        return;
      }

      const forbidden = new Set();

      Object.keys(assignments).forEach(bs => {
        assignments[bs].forEach(entry => {
          if (entry.cell_id === cellId) return;
          const d = bsicDistanceKm(lat, lon, entry.lat, entry.lon);
          if (d < minDistanceKm && entry.bcch === cell.bcch) {
            forbidden.add(bs);
          }
        });
      });

      universe.forEach(other => {
        if (other.id === cellId) return;
        const d = bsicDistanceKm(lat, lon, other.lat, other.lon);
        if (d < minDistanceKm && other.bcch === cell.bcch) {
          forbidden.add(other.bsic);
        }
      });

      forbidden.add(currentBsic);

      const available = allBsics.filter(bs => !forbidden.has(bs));

      let chosen;
      if (available.length) {
        const usage = {};
        available.forEach(bs => { usage[bs] = (assignments[bs] || []).length; });
        available.sort((a, b) => usage[a] - usage[b] || a.localeCompare(b));
        chosen = available[0];
      } else {
        let best = null, bestMin = -1;
        allBsics.forEach(bs => {
          if (bs === currentBsic) return;
          let minDist = Infinity;
          if (assignments[bs]) {
            assignments[bs].forEach(e => {
              if (e.cell_id === cellId || e.bcch !== cell.bcch) return;
              minDist = Math.min(minDist, bsicDistanceKm(lat, lon, e.lat, e.lon));
            });
          }
          universe.forEach(o => {
            if (o.id === cellId || o.bsic !== bs || o.bcch !== cell.bcch) return;
            minDist = Math.min(minDist, bsicDistanceKm(lat, lon, o.lat, o.lon));
          });
          if (minDist > bestMin) { bestMin = minDist; best = bs; }
        });
        chosen = (best !== null) ? best : currentBsic;
      }

      suggestions.set(cellId, chosen);
      if (!assignments[chosen]) assignments[chosen] = [];
      assignments[chosen].push({ lat, lon, cell_id: cellId, bcch: cell.bcch });
    });

    return suggestions;
  }

  function renderBSICResults(r) {
    document.getElementById('bsic_kpi_total').textContent = r.cells.length;
    document.getElementById('bsic_kpi_clashes').textContent = r.cells.filter(c => c.same_bsic_nearby > 0).length;
    document.getElementById('bsic_kpi_neighbors').textContent = r.cells.filter(c => c.neighbors_count > 0).length;
    document.getElementById('bsic_kpi_high').textContent = r.highCount;
    document.getElementById('bsic_kpi_medium').textContent = r.mediumCount;
    document.getElementById('bsic_kpi_changes').textContent = r.changes;

    const warnEl = document.getElementById('bsicWarnings');
    let warnHtml = '';

    if (r.targetBCCH !== null) {
      warnHtml += '<div style="background:#EAF2FB;color:#124191;padding:10px 14px;border-radius:8px;font-size:12.5px;margin-bottom:8px;">' +
        '<b>BCCH Filter:</b> ' + r.targetBCCH + ' — ' + r.cells.length + ' cells</div>';
    }

    if (r.changes > 0) {
      warnHtml += '<div style="background:#FFF9C4;color:#8A5A00;padding:10px 14px;border-radius:8px;font-size:12.5px;">' +
        '<b>' + r.changes + '</b> cells need BSIC change</div>';
    } else {
      warnHtml += '<div style="background:#E7F7EE;color:#1F9D55;padding:10px 14px;border-radius:8px;font-size:12.5px;">' +
        '<b>No conflicts — all BSICs clean</b></div>';
    }

    warnEl.innerHTML = warnHtml;

    renderBSICTable();
  }

  function renderBSICTable() {
    if (!bsicLastResults) return;
    const tbody = document.querySelector('#bsicTable tbody');
    const filter = document.getElementById('bsic_filter')?.value || 'all';
    const search = (document.getElementById('bsic_search')?.value || '').toLowerCase().trim();

    let rows = bsicLastResults.cells;

    if (filter === 'conflict') rows = rows.filter(c => c.same_bsic_nearby > 0);
    else if (filter === 'changed') rows = rows.filter(c => c.suggested && c.suggested !== c.bsic);
    else if (filter === 'clean') rows = rows.filter(c => c.same_bsic_nearby === 0);

    if (search) rows = rows.filter(c => c.cell_name.toLowerCase().includes(search));

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:20px;color:#5A6B87;">No cells match</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(c => {
      let level, levelColor, levelBg;
      if (c.same_bsic_nearby >= 3) { level = 'HIGH'; levelColor = '#B91C1C'; levelBg = '#FCEAEA'; }
      else if (c.same_bsic_nearby >= 1) { level = 'MEDIUM'; levelColor = '#8A5A00'; levelBg = '#FDF1DC'; }
      else { level = 'Low'; levelColor = '#1F9D55'; levelBg = '#E7F7EE'; }

      const changed = c.suggested && c.suggested !== c.bsic;

      return '<tr>' +
        '<td><b>' + escapeHtml(c.cell_name) + '</b></td>' +
        '<td>' + c.bcch + '</td>' +
        '<td style="font-family:monospace;font-weight:700;">' + c.bsic + '</td>' +
        '<td style="font-size:11px;">' + c.lat.toFixed(5) + '</td>' +
        '<td style="font-size:11px;">' + c.lon.toFixed(5) + '</td>' +
        '<td style="text-align:center;">' + c.neighbors_count + '</td>' +
        '<td style="text-align:center;color:' + (c.same_bsic_nearby > 0 ? '#B91C1C' : '#1F9D55') + ';font-weight:700;">' + c.same_bsic_nearby + '</td>' +
        '<td><span style="padding:2px 8px;border-radius:10px;font-size:10.5px;font-weight:700;background:' + levelBg + ';color:' + levelColor + ';">' + level + '</span></td>' +
        '<td style="font-family:monospace;font-weight:800;color:' + (changed ? '#1F9D55' : '#0C1B3D') + ';">' + c.suggested + (changed ? ' *' : '') + '</td>' +
      '</tr>';
    }).join('');
  }

  function clearBSICResults() {
    bsicLastResults = null;
    document.getElementById('bsicResults').style.display = 'none';
    toast('Cleared', 'info');
  }

  async function bsicApplyAll(btn) {
    if (!bsicLastResults) { toast('Run analysis first', 'error'); return; }

    const changes = bsicLastResults.cells.filter(c => c.suggested && c.suggested !== c.bsic);
    if (!changes.length) { toast('No changes to apply', 'info'); return; }
    if (!confirm('Apply BSIC changes to ' + changes.length + ' cells?')) return;

    btn.disabled = true;
    btn.textContent = 'Applying...';

    let applied = 0, failed = 0;

    try {
      for (let i = 0; i < changes.length; i++) {
        const c = changes[i];
        const { error } = await db.from('rf_cells').update({ bsic: c.suggested }).eq('id', c.id);
        if (error) { failed++; console.error(error); }
        else {
          applied++;
          const local = State.allCells.find(x => x.id === c.id);
          if (local) local.bsic = c.suggested;
        }
        if (applied % 20 === 0) btn.textContent = 'Applying ' + applied + '/' + changes.length + '...';
      }

      toast('Applied ' + applied + ' BSIC changes' + (failed ? ' (' + failed + ' failed)' : ''), 'success', 5000);
      if (typeof persistCellsCache === 'function') persistCellsCache();
      setTimeout(runBSICAnalyzer, 800);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Apply All Suggestions';
    }
  }

  function bsicExportCSV() {
    if (!bsicLastResults) { toast('Run analysis first', 'error'); return; }
    const rows = [['Cell', 'BCCH', 'BSIC', 'Lat', 'Lon', 'Neighbors', 'Same_BSIC_Nearby', 'Level', 'Suggested_BSIC', 'Changed']];

    bsicLastResults.cells.forEach(c => {
      const level = c.same_bsic_nearby >= 3 ? 'HIGH' : (c.same_bsic_nearby >= 1 ? 'MEDIUM' : 'Low');
      const changed = c.suggested && c.suggested !== c.bsic ? 'YES' : 'NO';
      rows.push([c.cell_name, c.bcch, c.bsic, c.lat, c.lon, c.neighbors_count,
                 c.same_bsic_nearby, level, c.suggested, changed]);
    });

    downloadCSV('BSIC_Analysis_' + new Date().toISOString().slice(0, 10) + '.csv', rows);
    toast('CSV exported', 'success');
  }

  function bsicShowOnMap() {
    if (!bsicLastResults) { toast('Run analysis first', 'error'); return; }

    window.__gsmMode = true;
    switchView('map');

    setTimeout(() => {
      if (State.sectorLayer) State.sectorLayer.clearLayers();
      if (State.labelLayer) State.labelLayer.clearLayers();

      window.nbMapLayers = window.nbMapLayers || [];
      nbMapLayers.forEach(l => { try { State.map.removeLayer(l); } catch (e) {} });
      window.nbMapLayers = [];

      const conflictCells = bsicLastResults.cells.filter(c => c.same_bsic_nearby > 0);
      if (!conflictCells.length) {
        toast('No clashes to show', 'success', 5000);
        return;
      }

      const layersByCategory = {};
      const addToCategory = (cat, layer) => {
        if (!layersByCategory[cat]) layersByCategory[cat] = [];
        layersByCategory[cat].push(layer);
        nbMapLayers.push(layer);
        if (State.map && !State.map.hasLayer(layer)) State.map.addLayer(layer);
        return layer;
      };

      let highN = 0, medN = 0, lowN = 0;

      conflictCells.forEach(cell => {
        let cat, color, weight;
        if (cell.same_bsic_nearby >= 3) { cat = 'high'; color = '#B91C1C'; weight = 2.5; highN++; }
        else if (cell.same_bsic_nearby >= 2) { cat = 'medium'; color = '#F97316'; weight = 2; medN++; }
        else { cat = 'low'; color = '#FBBF24'; weight = 1.5; lowN++; }

        const coords = makeSectorCoordsScaled(cell.lat, cell.lon, cell.bore, 1.0);
        const poly = L.polygon(coords, {
          color: color, weight: weight, fillColor: color, fillOpacity: 0.85, lineJoin: 'round'
        });
        poly.bindPopup(
          '<div style="font-family:Inter,sans-serif;font-size:13px;min-width:220px;">' +
            '<div style="font-weight:800;font-family:monospace;margin-bottom:8px;">' + escapeHtml(cell.cell_name) + '</div>' +
            '<div style="display:flex;justify-content:space-between;padding:3px 0;"><span>BCCH:</span><b>' + cell.bcch + '</b></div>' +
            '<div style="display:flex;justify-content:space-between;padding:3px 0;"><span>Current BSIC:</span><b style="color:#B91C1C;">' + cell.bsic + '</b></div>' +
            '<div style="display:flex;justify-content:space-between;padding:3px 0;"><span>Suggested:</span><b style="color:#1F9D55;">' + cell.suggested + '</b></div>' +
            '<div style="display:flex;justify-content:space-between;padding:3px 0;"><span>Clashes:</span><b style="color:#B91C1C;">' + cell.same_bsic_nearby + '</b></div>' +
          '</div>'
        );
        addToCategory(cat, poly);
      });

      const bounds = L.latLngBounds(conflictCells.map(c => [c.lat, c.lon]));
      if (bounds.isValid()) State.map.fitBounds(bounds, { padding: [80, 80] });

      const onToggle = () => {
        Object.entries(layersByCategory).forEach(([cat, layers]) => {
          const visible = ToolLegend.isActive(cat);
          layers.forEach(l => {
            if (visible) { if (!State.map.hasLayer(l)) State.map.addLayer(l); }
            else { if (State.map.hasLayer(l)) State.map.removeLayer(l); }
          });
        });
      };

      ToolLegend.show({
        icon: '🎨',
        title: 'BSIC Clashes · ' + conflictCells.length,
        items: [
          { id: 'high', color: '#B91C1C', label: 'HIGH (3+)', count: highN },
          { id: 'medium', color: '#F97316', label: 'MEDIUM (2)', count: medN },
          { id: 'low', color: '#FBBF24', label: 'LOW (1)', count: lowN }
        ],
        onToggle: onToggle
      });

      toast(conflictCells.length + ' clash cells on map', 'success', 4000);
    }, 400);
  }

  window.bsicSetMode = bsicSetMode;
  window.runBSICAnalyzer = runBSICAnalyzer;
  window.renderBSICTable = renderBSICTable;
  window.clearBSICResults = clearBSICResults;
  window.bsicApplyAll = bsicApplyAll;
  window.bsicExportCSV = bsicExportCSV;
  window.bsicShowOnMap = bsicShowOnMap;

  console.log('✅ BSIC analyzer loaded');
})();
