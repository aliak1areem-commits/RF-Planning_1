/* =========================================================
   📶 PSC CONFLICT CHECKER (3G UMTS)
   ========================================================= */
(function() {
  'use strict';

  let pscLastResults = null;

  function pscGetBandFromUarfcn(uarfcn) {
    if (uarfcn == null) return 'Unknown';
    const n = parseInt(uarfcn);
    if (isNaN(n)) return 'Unknown';
    if (n >= 2937 && n <= 3088) return '900';
    if (n >= 10562 && n <= 10838) return '2100';
    if (n >= 1207 && n <= 1949) return '1800';
    if (n >= 6150 && n <= 6449) return '800';
    return 'Other';
  }

  function pscDirectionDiff(d1, d2) {
    const diff = Math.abs(d1 - d2) % 360;
    return diff <= 180 ? diff : 360 - diff;
  }

  function runPSCChecker() {
    const cells3G = State.allCells.filter(c =>
      c.tech === '3G' && /[A-Z]$/.test(c.cell_name) && c.psc != null && c.psc >= 0);

    if (!cells3G.length) {
      toast('No 3G cells with PSC. Upload 3G data first.', 'error', 6000);
      return;
    }

    const pscMin = parseInt(document.getElementById('psc_min').value) || 0;
    const pscMax = parseInt(document.getElementById('psc_max').value) || 511;
    const maxDistance = parseFloat(document.getElementById('psc_distance').value) || 2000;

    if (pscMin < 0 || pscMax > 511 || pscMin > pscMax) {
      toast('Invalid PSC range (0-511)', 'error');
      return;
    }

    const features = cells3G.filter(c => c.psc >= pscMin && c.psc <= pscMax);
    if (!features.length) {
      toast('No cells with PSC in range ' + pscMin + '-' + pscMax, 'error');
      return;
    }

    console.log('PSC Checker: ' + features.length + ' 3G cells');

    const cells = features.map(c => ({
      id: c.id,
      name: c.cell_name,
      psc: parseInt(c.psc),
      band: pscGetBandFromUarfcn(c.uarfcn_dl || 0),
      lat: c.lat,
      lon: c.long,
      dir: c.bore || 0,
      originalPsc: parseInt(c.psc),
      suggestedPsc: parseInt(c.psc),
      cell: c
    }));

    const conflicts = [];
    for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) {
        const c1 = cells[i], c2 = cells[j];
        if (c1.psc !== c2.psc) continue;
        if (c1.band !== c2.band) continue;
        if (c1.band === 'Unknown' || c1.band === 'Other') continue;

        const dist = haversineDistance(c1.lat, c1.lon, c2.lat, c2.lon);
        if (dist > maxDistance) continue;

        const dirDiff = pscDirectionDiff(c1.dir, c2.dir);
        const conflictType = (dirDiff >= 120 && dirDiff <= 240)
          ? 'Opposite Sector Conflict'
          : 'Same Sector Conflict';

        conflicts.push({
          cell1: c1, cell2: c2,
          distance: dist, dirDiff: dirDiff, type: conflictType
        });
      }
    }

    const suggestions = pscSuggestNewCodes(cells, conflicts, pscMin, pscMax, maxDistance);

    let changed = 0;
    cells.forEach(c => {
      const s = suggestions.get(c.id);
      if (s != null && s !== c.originalPsc) {
        c.suggestedPsc = s;
        changed++;
      } else {
        c.suggestedPsc = c.originalPsc;
      }
    });

    const stillConflicted = new Set();
    conflicts.forEach(cf => {
      const p1 = suggestions.get(cf.cell1.id) ?? cf.cell1.originalPsc;
      const p2 = suggestions.get(cf.cell2.id) ?? cf.cell2.originalPsc;
      if (p1 === p2) {
        stillConflicted.add(cf.cell1.id);
        stillConflicted.add(cf.cell2.id);
      }
    });

    pscLastResults = {
      cells, conflicts, suggestions, stillConflicted,
      changed, maxDistance, pscRange: [pscMin, pscMax]
    };

    renderPSCResults(pscLastResults);
    document.getElementById('pscResults').style.display = 'block';
    toast(conflicts.length + ' conflicts · ' + changed + ' suggestions', 'success', 5000);
  }

  function pscSuggestNewCodes(cells, conflicts, pscMin, pscMax, maxDistance) {
    const suggestions = new Map();
    const conflictCount = new Map();
    conflicts.forEach(cf => {
      conflictCount.set(cf.cell1.id, (conflictCount.get(cf.cell1.id) || 0) + 1);
      conflictCount.set(cf.cell2.id, (conflictCount.get(cf.cell2.id) || 0) + 1);
    });

    const usedByBand = {};
    const listOf = band => (usedByBand[band] = usedByBand[band] || []);

    cells.forEach(c => {
      if (!conflictCount.get(c.id)) {
        suggestions.set(c.id, c.originalPsc);
        listOf(c.band).push({ psc: c.originalPsc, lat: c.lat, lon: c.lon });
      }
    });

    const globalUsage = {};
    cells.forEach(c => { globalUsage[c.originalPsc] = (globalUsage[c.originalPsc] || 0) + 1; });
    const allCodes = [];
    for (let i = pscMin; i <= pscMax; i++) allCodes.push(i);

    const conflicted = cells.filter(c => conflictCount.get(c.id))
      .sort((a, b) => conflictCount.get(b.id) - conflictCount.get(a.id));

    conflicted.forEach(cell => {
      const list = listOf(cell.band);
      const forbidden = new Set(
        list.filter(e => haversineDistance(cell.lat, cell.lon, e.lat, e.lon) <= maxDistance)
            .map(e => e.psc)
      );

      let chosen;
      if (!forbidden.has(cell.originalPsc)) {
        chosen = cell.originalPsc;
      } else {
        const candidates = allCodes.filter(c => !forbidden.has(c));
        if (candidates.length) {
          candidates.sort((a, b) => (globalUsage[a] || 0) - (globalUsage[b] || 0));
          chosen = candidates[0];
        } else {
          let best = cell.originalPsc, bestMin = -1;
          allCodes.forEach(psc => {
            let minDist = Infinity;
            list.forEach(e => {
              if (e.psc === psc) minDist = Math.min(minDist, haversineDistance(cell.lat, cell.lon, e.lat, e.lon));
            });
            if (minDist > bestMin) { bestMin = minDist; best = psc; }
          });
          chosen = best;
        }
      }

      suggestions.set(cell.id, chosen);
      globalUsage[chosen] = (globalUsage[chosen] || 0) + 1;
      list.push({ psc: chosen, lat: cell.lat, lon: cell.lon });
    });

    return suggestions;
  }

  function renderPSCResults(r) {
    const total = r.cells.length;
    const conflictCount = r.conflicts.length;
    const sameSector = r.conflicts.filter(c => c.type === 'Same Sector Conflict').length;
    const oppositeSector = r.conflicts.filter(c => c.type === 'Opposite Sector Conflict').length;
    const reassigned = r.cells.filter(c => c.suggestedPsc !== c.originalPsc).length;
    const unresolved = r.stillConflicted.size;

    document.getElementById('psc_kpi_total').textContent = total;
    document.getElementById('psc_kpi_conflicts').textContent = conflictCount;
    document.getElementById('psc_kpi_same').textContent = sameSector;
    document.getElementById('psc_kpi_opp').textContent = oppositeSector;
    document.getElementById('psc_kpi_reassigned').textContent = reassigned;
    document.getElementById('psc_kpi_unresolved').textContent = unresolved;

    const card = document.getElementById('psc_kpi_unresolved_card');
    card.className = 'kpi-card ' + (unresolved > 0 ? 'danger' : 'success');

    const warnEl = document.getElementById('pscWarnings');
    let warnHtml = '';
    if (conflictCount === 0) {
      warnHtml += '<div style="background:#E7F7EE;color:#1F9D55;padding:10px 14px;border-radius:8px;font-size:12.5px;">' +
        '<b>No conflicts — all PSCs clean</b></div>';
    } else {
      if (oppositeSector > 0) {
        warnHtml += '<div style="background:#FCEAEA;color:#B91C1C;padding:10px 14px;border-radius:8px;font-size:12.5px;margin-bottom:8px;">' +
          '<b>Opposite Sector Conflicts:</b> ' + oppositeSector + ' (critical)</div>';
      }
      if (sameSector > 0) {
        warnHtml += '<div style="background:#FDF1DC;color:#8A5A00;padding:10px 14px;border-radius:8px;font-size:12.5px;">' +
          '<b>Same Sector Conflicts:</b> ' + sameSector + '</div>';
      }
    }
    warnEl.innerHTML = warnHtml;

    const tbody = document.querySelector('#pscConflictsTable tbody');
    if (!r.conflicts.length) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:20px;color:#5A6B87;">No conflicts</td></tr>';
    } else {
      tbody.innerHTML = r.conflicts.slice(0, 300).map(cf => {
        const isOpposite = cf.type === 'Opposite Sector Conflict';
        const bg = isOpposite ? '#FCEAEA' : '#FDF1DC';
        const color = isOpposite ? '#B91C1C' : '#8A5A00';

        return '<tr>' +
          '<td><b>' + escapeHtml(cf.cell1.name) + '</b></td>' +
          '<td>' + cf.cell1.psc + '</td>' +
          '<td>' + cf.cell1.band + '</td>' +
          '<td>' + cf.cell1.dir.toFixed(0) + '°</td>' +
          '<td><b>' + escapeHtml(cf.cell2.name) + '</b></td>' +
          '<td>' + cf.cell2.psc + '</td>' +
          '<td>' + cf.cell2.band + '</td>' +
          '<td>' + cf.cell2.dir.toFixed(0) + '°</td>' +
          '<td>' + cf.distance.toFixed(0) + '</td>' +
          '<td><span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;background:' + bg + ';color:' + color + ';">' + cf.type + '</span></td>' +
        '</tr>';
      }).join('');
    }

    const optBody = document.querySelector('#pscOptTable tbody');
    const sorted = r.cells.slice().sort((a, b) => {
      const aChanged = a.suggestedPsc !== a.originalPsc ? 1 : 0;
      const bChanged = b.suggestedPsc !== b.originalPsc ? 1 : 0;
      return bChanged - aChanged;
    });

    optBody.innerHTML = sorted.slice(0, 500).map(c => {
      const changed = c.suggestedPsc !== c.originalPsc;
      const unresolved = r.stillConflicted.has(c.id);

      let statusText, statusColor, statusBg;
      if (unresolved) { statusText = 'Unresolved'; statusColor = '#B91C1C'; statusBg = '#FCEAEA'; }
      else if (changed) { statusText = 'Reassigned'; statusColor = '#1F9D55'; statusBg = '#E7F7EE'; }
      else { statusText = 'Clean'; statusColor = '#5A6B87'; statusBg = '#F4F7FB'; }

      return '<tr>' +
        '<td>' + escapeHtml(c.name) + '</td>' +
        '<td>' + c.originalPsc + '</td>' +
        '<td style="font-weight:700;color:' + (changed ? '#124191' : '#0C1B3D') + ';">' + c.suggestedPsc + '</td>' +
        '<td>' + c.band + '</td>' +
        '<td><span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;background:' + statusBg + ';color:' + statusColor + ';">' + statusText + '</span></td>' +
      '</tr>';
    }).join('');
  }

  function clearPSCResults() {
    pscLastResults = null;
    document.getElementById('pscResults').style.display = 'none';
    toast('Results cleared', 'info');
  }

  function exportPSCResults() {
    if (!pscLastResults) { toast('Run analysis first', 'error'); return; }
    const rows = [['Cell', 'Original_PSC', 'New_PSC', 'Band', 'Direction', 'Lat', 'Long', 'Status']];

    pscLastResults.cells.forEach(c => {
      const changed = c.suggestedPsc !== c.originalPsc;
      const unresolved = pscLastResults.stillConflicted.has(c.id);
      const status = unresolved ? 'Unresolved' : (changed ? 'Reassigned' : 'Clean');
      rows.push([
        c.name, c.originalPsc, c.suggestedPsc, c.band,
        c.dir.toFixed(0), c.lat.toFixed(6), c.lon.toFixed(6), status
      ]);
    });

    downloadCSV('PSC_Optimization_' + new Date().toISOString().slice(0, 10) + '.csv', rows);
    toast('CSV exported', 'success');
  }

  async function pscApplyAll(btn) {
    if (!pscLastResults) { toast('Run analysis first', 'error'); return; }
    const changes = pscLastResults.cells.filter(c => c.suggestedPsc !== c.originalPsc);
    if (!changes.length) { toast('No changes', 'info'); return; }
    if (!confirm('Apply ' + changes.length + ' PSC changes?')) return;

    btn.disabled = true;
    let applied = 0, failed = 0;

    try {
      for (let i = 0; i < changes.length; i++) {
        const c = changes[i];
        const { error } = await db.from('rf_cells').update({ psc: c.suggestedPsc }).eq('id', c.id);
        if (error) { failed++; console.error(error); }
        else {
          applied++;
          const local = State.allCells.find(x => x.id === c.id);
          if (local) local.psc = c.suggestedPsc;
        }
        if (applied % 20 === 0) btn.textContent = 'Applying ' + applied + '/' + changes.length + '...';
      }

      toast('Applied ' + applied + ' changes' + (failed ? ' (' + failed + ' failed)' : ''), 'success', 5000);
      if (typeof persistCellsCache === 'function') persistCellsCache();
      setTimeout(runPSCChecker, 500);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Apply All Suggestions';
    }
  }

  function showPSCOnMap() {
    if (!pscLastResults) { toast('Run analysis first', 'error'); return; }

    window.__gsmMode = true;
    switchView('map');

    setTimeout(() => {
      if (State.sectorLayer) State.sectorLayer.clearLayers();
      if (State.labelLayer) State.labelLayer.clearLayers();

      window.nbMapLayers = window.nbMapLayers || [];
      nbMapLayers.forEach(l => { try { State.map.removeLayer(l); } catch (e) {} });
      window.nbMapLayers = [];

      const conflictIds = new Set();
      pscLastResults.conflicts.forEach(cf => {
        conflictIds.add(cf.cell1.id);
        conflictIds.add(cf.cell2.id);
      });

      if (!conflictIds.size) {
        toast('No conflicts', 'success', 5000);
        return;
      }

      const conflictCells = pscLastResults.cells.filter(c => conflictIds.has(c.id));
      const layersByCategory = {};
      const addToCategory = (cat, layer) => {
        if (!layersByCategory[cat]) layersByCategory[cat] = [];
        layersByCategory[cat].push(layer);
        nbMapLayers.push(layer);
        if (State.map && !State.map.hasLayer(layer)) State.map.addLayer(layer);
        return layer;
      };

      let unresolvedN = 0, willChangeN = 0, conflictN = 0;

      conflictCells.forEach(c => {
        if (!c.lat || !c.lon) return;

        let cat, color;
        if (pscLastResults.stillConflicted.has(c.id)) { cat = 'unresolved'; color = '#D64545'; unresolvedN++; }
        else if (c.suggestedPsc !== c.originalPsc) { cat = 'will-change'; color = '#1F9D55'; willChangeN++; }
        else { cat = 'conflict'; color = '#F59E0B'; conflictN++; }

        const coords = makeSectorCoords(c.lat, c.lon, c.dir);
        const poly = L.polygon(coords, {
          color: color, weight: 2, fillColor: color, fillOpacity: 0.8, interactive: true
        });
        poly.bindPopup(
          '<div style="font-family:Inter,sans-serif;font-size:12.5px;min-width:230px;">' +
            '<div style="font-weight:800;font-family:monospace;margin-bottom:8px;">' + escapeHtml(c.name) + '</div>' +
            '<div style="display:flex;justify-content:space-between;padding:3px 0;"><span>Original PSC:</span><b>' + c.originalPsc + '</b></div>' +
            '<div style="display:flex;justify-content:space-between;padding:3px 0;"><span>New PSC:</span><b style="color:#1F9D55;">' + c.suggestedPsc + '</b></div>' +
          '</div>'
        );
        addToCategory(cat, poly);
      });

      if (conflictCells.length) {
        const bounds = L.latLngBounds(conflictCells.map(c => [c.lat, c.lon]));
        State.map.fitBounds(bounds, { padding: [50, 50] });
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

      ToolLegend.show({
        icon: '📶',
        title: 'PSC Conflicts · ' + conflictCells.length,
        items: [
          { id: 'unresolved', color: '#D64545', label: 'Unresolved', count: unresolvedN },
          { id: 'will-change', color: '#1F9D55', label: 'Will Change', count: willChangeN },
          { id: 'conflict', color: '#F59E0B', label: 'Conflict', count: conflictN }
        ],
        onToggle: onToggle
      });

      toast(conflictCells.length + ' conflict cells on map', 'success', 4000);
    }, 300);
  }

  window.runPSCChecker = runPSCChecker;
  window.clearPSCResults = clearPSCResults;
  window.exportPSCResults = exportPSCResults;
  window.pscApplyAll = pscApplyAll;
  window.showPSCOnMap = showPSCOnMap;

  console.log('✅ PSC checker loaded');
})();
