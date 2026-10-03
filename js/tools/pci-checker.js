/* =========================================================
   🧮 PCI CONFLICT CHECKER (LTE)
   ========================================================= */
(function() {
  'use strict';

  let lastPCIResults = null;

  function isFaceToFace(cell1, cell2, thresholdDeg) {
    thresholdDeg = thresholdDeg || 45;
    const b_1to2 = calculateBearing(cell1.lat, cell1.long, cell2.lat, cell2.long);
    const b_2to1 = (b_1to2 + 180) % 360;
    return boreDifference(cell1.bore, b_1to2) <= thresholdDeg &&
           boreDifference(cell2.bore, b_2to1) <= thresholdDeg;
  }

  function findPairsWithin(cells, maxRadiusM) {
    if (cells.length < 2) return [];
    const bucketDeg = Math.max(maxRadiusM / 85000.0, 0.005);
    const buckets = new Map();
    function key(lat, lon) {
      return Math.floor(lat / bucketDeg) + ',' + Math.floor(lon / bucketDeg);
    }

    cells.forEach((c, idx) => {
      const k = key(c.lat, c.long);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(idx);
    });

    const pairs = new Set();
    buckets.forEach((idxs, k) => {
      const [bx, by] = k.split(',').map(Number);
      const neighborhood = [];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const nk = (bx + dx) + ',' + (by + dy);
          if (buckets.has(nk)) neighborhood.push(...buckets.get(nk));
        }
      }
      const sorted = Array.from(new Set(neighborhood)).sort((a, b) => a - b);
      idxs.forEach(i => {
        sorted.forEach(j => {
          if (j > i) pairs.add(i + ',' + j);
        });
      });
    });
    return Array.from(pairs).map(s => s.split(',').map(Number))
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  }

  function analyzeConflicts(cells, settings) {
    cells = cells.filter(c => c.pci != null);

    const maxRadius = Math.max(
      settings.same_pci_radius_m, settings.mod3_radius_m,
      settings.check_mod6 ? settings.mod6_radius_m : 0,
      settings.face_to_face_radius_m, settings.same_heading_radius_m
    );

    const pairs = findPairsWithin(cells, maxRadius);
    const conflicts = [], faceToFaceConflicts = [], samePciSameHeading = [];
    const neighborMap = new Map();

    const reachRadius = Math.max(
      settings.same_pci_radius_m, settings.mod3_radius_m,
      settings.check_mod6 ? settings.mod6_radius_m : 0
    );

    pairs.forEach(([i, j]) => {
      const c1 = cells[i], c2 = cells[j];
      const dist = haversineDistance(c1.lat, c1.long, c2.lat, c2.long);

      let ff = false;
      if (dist <= settings.face_to_face_radius_m) {
        ff = isFaceToFace(c1, c2);
        if (ff) faceToFaceConflicts.push({ cell1: c1, cell2: c2, distance: dist });
      }

      if (c1.pci === c2.pci && dist <= settings.same_pci_radius_m) {
        conflicts.push({ cell1: c1, cell2: c2, type: 'Same PCI', distance: dist, face_to_face: ff });
      } else if ((c1.pci % 3) === (c2.pci % 3) && dist <= settings.mod3_radius_m) {
        conflicts.push({ cell1: c1, cell2: c2, type: 'MOD3 Conflict', distance: dist, face_to_face: ff });
      } else if (settings.check_mod6 && (c1.pci % 6) === (c2.pci % 6) && dist <= settings.mod6_radius_m) {
        conflicts.push({ cell1: c1, cell2: c2, type: 'MOD6 Conflict', distance: dist, face_to_face: ff });
      }

      if (c1.pci === c2.pci && dist <= settings.same_heading_radius_m) {
        const azDiff = boreDifference(c1.bore, c2.bore);
        if (azDiff <= settings.same_heading_deg) {
          samePciSameHeading.push({ cell1: c1, cell2: c2, pci: c1.pci, distance: dist, azimuth_diff: azDiff });
        }
      }

      if (dist <= reachRadius) {
        if (!neighborMap.has(c1.id)) neighborMap.set(c1.id, []);
        if (!neighborMap.has(c2.id)) neighborMap.set(c2.id, []);
        neighborMap.get(c1.id).push({ cell: c2, dist: dist, is_ff: ff });
        neighborMap.get(c2.id).push({ cell: c1, dist: dist, is_ff: ff });
      }
    });

    return { conflicts, faceToFaceConflicts, samePciSameHeading, neighborMap };
  }

  function conflictProfile(neighbors, currentPciOf, settings) {
    const samePciPenalty = new Map(), mod3Penalty = new Map(), mod6Penalty = new Map();
    const samePciK = Math.max(settings.same_pci_radius_m, 1.0);
    const mod3K = Math.max(settings.mod3_radius_m, 1.0);
    const mod6K = Math.max(settings.mod6_radius_m || 1.0, 1.0);

    neighbors.forEach(nb => {
      const nbPci = currentPciOf(nb.cell.id);
      if (nbPci == null) return;

      if (nb.dist <= settings.same_pci_radius_m) {
        let p = 100000.0 * Math.exp(-nb.dist / samePciK);
        if (nb.is_ff) p += 60000.0;
        samePciPenalty.set(nbPci, (samePciPenalty.get(nbPci) || 0) + p);
      }
      if (nb.dist <= settings.mod3_radius_m) {
        let p = 600.0 * Math.exp(-nb.dist / mod3K);
        if (nb.is_ff) p += 300.0;
        const k = nbPci % 3;
        mod3Penalty.set(k, (mod3Penalty.get(k) || 0) + p);
      }
      if (settings.check_mod6 && nb.dist <= settings.mod6_radius_m) {
        const p = 150.0 * Math.exp(-nb.dist / mod6K);
        const k = nbPci % 6;
        mod6Penalty.set(k, (mod6Penalty.get(k) || 0) + p);
      }
    });

    return { samePciPenalty, mod3Penalty, mod6Penalty };
  }

  function scoreCandidate(candidate, profile, checkMod6) {
    let score = (profile.samePciPenalty.get(candidate) || 0) +
                (profile.mod3Penalty.get(candidate % 3) || 0);
    if (checkMod6) score += (profile.mod6Penalty.get(candidate % 6) || 0);
    return score;
  }

  function optimizePCI(cells, analysis, settings, pciPool, passes) {
    passes = passes || 3;
    const neighborMap = analysis.neighborMap;
    const currentPci = new Map();
    cells.forEach(c => currentPci.set(c.id, c.pci));

    function currentPciOf(id) { return currentPci.get(id); }

    const conflictCounts = new Map();
    analysis.conflicts.forEach(c => {
      conflictCounts.set(c.cell1.id, (conflictCounts.get(c.cell1.id) || 0) + 1);
      conflictCounts.set(c.cell2.id, (conflictCounts.get(c.cell2.id) || 0) + 1);
    });

    const candidates = Array.from(pciPool).sort((a, b) => a - b);

    for (let pass = 0; pass < passes; pass++) {
      const ordered = cells.slice().sort((a, b) =>
        (conflictCounts.get(b.id) || 0) - (conflictCounts.get(a.id) || 0));
      let changed = false;

      ordered.forEach(cell => {
        const neighbors = neighborMap.get(cell.id) || [];
        if (!neighbors.length) return;
        const profile = conflictProfile(neighbors, currentPciOf, settings);
        const original = currentPci.get(cell.id);
        const currentScore = scoreCandidate(original, profile, settings.check_mod6);
        if (currentScore === 0) return;

        let bestPci = original, bestScore = currentScore;
        for (const cand of candidates) {
          if (cand === original) continue;
          const s = scoreCandidate(cand, profile, settings.check_mod6);
          if (s < bestScore) {
            bestScore = s;
            bestPci = cand;
            if (bestScore === 0) break;
          }
        }
        if (bestPci !== original) {
          currentPci.set(cell.id, bestPci);
          changed = true;
        }
      });
      if (!changed) break;
    }

    cells.forEach(c => { c.suggested_pci = currentPci.get(c.id); });
    return cells;
  }

  function runPCIChecker() {
    if (!State.allCells.length) { toast('No cells loaded', 'error'); return; }

    const lteCells = State.allCells.filter(c => c.tech === 'LTE' && c.pci != null);
    if (!lteCells.length) {
      toast('No LTE cells (PCI > 0). PCI Checker works on LTE only.', 'error', 5000);
      return;
    }

    const settings = {
      same_pci_radius_m: parseFloat(document.getElementById('pci_r_same').value) || 5000,
      mod3_radius_m: parseFloat(document.getElementById('pci_r_mod3').value) || 1000,
      mod6_radius_m: parseFloat(document.getElementById('pci_r_mod6').value) || 500,
      face_to_face_radius_m: parseFloat(document.getElementById('pci_r_ff').value) || 2000,
      same_heading_radius_m: 3000,
      same_heading_deg: 15,
      check_mod6: document.getElementById('pci_check_mod6').value === 'yes'
    };

    const pciMin = parseInt(document.getElementById('pci_min').value) || 0;
    const pciMax = parseInt(document.getElementById('pci_max').value) || 503;
    const pciPool = new Set();
    for (let p = pciMin; p <= pciMax; p++) pciPool.add(p);

    toast('Analyzing ' + lteCells.length + ' LTE cells...', 'info');

    setTimeout(() => {
      try {
        const cellsCopy = lteCells.map(c => Object.assign({}, c));
        const analysis = analyzeConflicts(cellsCopy, settings);
        const optimized = optimizePCI(cellsCopy, analysis, settings, pciPool, 3);

        const newPciById = new Map();
        optimized.forEach(c => newPciById.set(c.id, c.suggested_pci));

        const stillConflicted = new Set();
        analysis.conflicts.forEach(c => {
          const p1 = newPciById.get(c.cell1.id);
          const p2 = newPciById.get(c.cell2.id);
          if (c.type === 'Same PCI' && p1 === p2) {
            stillConflicted.add(c.cell1.id); stillConflicted.add(c.cell2.id);
          } else if (c.type === 'MOD3 Conflict' && (p1 % 3) === (p2 % 3)) {
            stillConflicted.add(c.cell1.id); stillConflicted.add(c.cell2.id);
          } else if (c.type === 'MOD6 Conflict' && (p1 % 6) === (p2 % 6)) {
            stillConflicted.add(c.cell1.id); stillConflicted.add(c.cell2.id);
          }
        });

        lastPCIResults = {
          cells: optimized,
          conflicts: analysis.conflicts,
          faceToFace: analysis.faceToFaceConflicts,
          sameHeading: analysis.samePciSameHeading,
          stillConflicted: stillConflicted
        };

        renderPCIResults(lastPCIResults);
        document.getElementById('pciResults').style.display = 'block';
        toast(analysis.conflicts.length + ' conflicts found', 'success');
      } catch (e) {
        console.error(e);
        toast('Analysis failed: ' + e.message, 'error');
      }
    }, 100);
  }

  function renderPCIResults(result) {
    const sameN = result.conflicts.filter(c => c.type === 'Same PCI').length;
    const mod3N = result.conflicts.filter(c => c.type === 'MOD3 Conflict').length;
    const mod6N = result.conflicts.filter(c => c.type === 'MOD6 Conflict').length;
    const reassignedN = result.cells.filter(c => c.suggested_pci !== c.pci).length;
    const unresolvedN = result.stillConflicted.size;

    document.getElementById('kpi_total').textContent = result.cells.length;
    document.getElementById('kpi_conflicts').textContent = result.conflicts.length;
    document.getElementById('kpi_same').textContent = sameN;
    document.getElementById('kpi_mod3').textContent = mod3N;
    document.getElementById('kpi_mod6').textContent = mod6N;
    document.getElementById('kpi_ff').textContent = result.faceToFace.length;
    document.getElementById('kpi_reassigned').textContent = reassignedN;

    const unresolvedEl = document.getElementById('kpi_unresolved');
    unresolvedEl.textContent = unresolvedN;
    const unresolvedCard = document.getElementById('kpi_unresolved_card');
    unresolvedCard.className = 'kpi-card ' + (unresolvedN > 0 ? 'danger' : 'success');

    const conflictBody = document.querySelector('#pciConflictsTable tbody');
    conflictBody.innerHTML = result.conflicts.slice(0, 200).map(c =>
      '<tr>' +
        '<td>' + escapeHtml(c.cell1.cell_name) + '</td>' +
        '<td>' + c.cell1.pci + '</td>' +
        '<td><span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;background:' +
          (c.type === 'Same PCI' ? '#FCEAEA;color:#B91C1C' :
           c.type === 'MOD3 Conflict' ? '#FDF1DC;color:#8A5A00' :
           '#EAF2FB;color:#124191') + ';">' + c.type + '</span></td>' +
        '<td>' + escapeHtml(c.cell2.cell_name) + '</td>' +
        '<td>' + c.cell2.pci + '</td>' +
        '<td>' + c.distance.toFixed(0) + '</td>' +
      '</tr>'
    ).join('') || '<tr><td colspan="6" style="text-align:center;padding:20px;color:#5A6B87;">No conflicts</td></tr>';

    const optBody = document.querySelector('#pciOptTable tbody');
    const sorted = result.cells.slice().sort((a, b) => {
      const aChanged = a.suggested_pci !== a.pci ? 1 : 0;
      const bChanged = b.suggested_pci !== b.pci ? 1 : 0;
      return bChanged - aChanged;
    });

    optBody.innerHTML = sorted.slice(0, 200).map(c => {
      const newPci = c.suggested_pci;
      const changed = newPci !== c.pci;
      const unresolved = result.stillConflicted.has(c.id);
      let statusText, statusColor, statusBg;
      if (unresolved) { statusText = 'Unresolved'; statusColor = '#B91C1C'; statusBg = '#FCEAEA'; }
      else if (changed) { statusText = 'Reassigned'; statusColor = '#1F9D55'; statusBg = '#E7F7EE'; }
      else { statusText = 'Clean'; statusColor = '#5A6B87'; statusBg = '#F4F7FB'; }

      return '<tr>' +
        '<td>' + escapeHtml(c.cell_name) + '</td>' +
        '<td>' + c.pci + '</td>' +
        '<td style="font-weight:700;color:' + (changed ? '#124191' : '#0C1B3D') + ';">' + newPci + '</td>' +
        '<td>' + (newPci % 3) + '</td>' +
        '<td><span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;background:' + statusBg + ';color:' + statusColor + ';">' + statusText + '</span></td>' +
      '</tr>';
    }).join('');
  }

  function clearPCIResults() {
    lastPCIResults = null;
    document.getElementById('pciResults').style.display = 'none';
    toast('Results cleared', 'info');
  }

  function exportPCIResults() {
    if (!lastPCIResults) { toast('Run analysis first', 'error'); return; }
    const rows = [['Cell Name', 'Original PCI', 'New PCI', 'MOD3 Group', 'Lat', 'Long', 'Azimuth', 'Status']];
    lastPCIResults.cells.forEach(c => {
      const newPci = c.suggested_pci;
      const changed = newPci !== c.pci;
      const unresolved = lastPCIResults.stillConflicted.has(c.id);
      const status = unresolved ? 'Unresolved' : (changed ? 'Reassigned' : 'Clean');
      rows.push([c.cell_name, c.pci, newPci, newPci % 3, c.lat, c.long, c.bore, status]);
    });
    downloadCSV('PCI_Optimization_' + new Date().toISOString().slice(0, 10) + '.csv', rows);
    toast('CSV exported', 'success');
  }

  async function pciApplyAll(btn) {
    if (!lastPCIResults) { toast('Run analysis first', 'error'); return; }
    if (typeof requirePermission === 'function' &&
        !requirePermission('action:apply-changes', 'apply PCI changes')) return;

    const changes = lastPCIResults.cells.filter(c => c.suggested_pci !== c.pci);
    if (!changes.length) { toast('No changes to apply', 'info'); return; }
    if (!confirm('Apply ' + changes.length + ' PCI changes to Supabase?')) return;

    btn.disabled = true;
    let applied = 0, failed = 0;

    try {
      for (let i = 0; i < changes.length; i += 20) {
        const chunk = changes.slice(i, i + 20);
        const res = await Promise.all(chunk.map(c =>
          db.from('rf_cells').update({ pci: c.suggested_pci }).eq('id', c.id)));

        res.forEach((r, k) => {
          if (r.error) { failed++; console.error(r.error); return; }
          applied++;
          const local = State.allCells.find(x => x.id === chunk[k].id);
          if (local) local.pci = chunk[k].suggested_pci;
        });
        btn.textContent = 'Applying ' + applied + '/' + changes.length + '...';
      }
      if (typeof persistCellsCache === 'function') persistCellsCache();
      toast('Applied ' + applied + ' PCI changes' + (failed ? ' (' + failed + ' failed)' : ''), 'success', 5000);
      setTimeout(runPCIChecker, 500);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Apply All Suggestions';
    }
  }

  function showPCIOnMap() {
    if (!lastPCIResults) { toast('Run analysis first', 'error'); return; }

    window.__gsmMode = true;
    switchView('map');

    setTimeout(() => {
      if (State.sectorLayer) State.sectorLayer.clearLayers();
      if (State.labelLayer) State.labelLayer.clearLayers();

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

      lastPCIResults.cells.forEach(cell => {
        if (!cell.lat || !cell.long) return;
        let cat, color;
        if (lastPCIResults.stillConflicted.has(cell.id)) { cat = 'unresolved'; color = '#D64545'; }
        else if (cell.suggested_pci !== cell.pci) { cat = 'reassigned'; color = '#1F9D55'; }
        else { cat = 'clean'; color = '#94A3B8'; }

        const coords = makeSectorCoords(cell.lat, cell.long, cell.bore);
        const poly = L.polygon(coords, {
          color: color, weight: 1.5, fillColor: color, fillOpacity: 0.75, interactive: true
        });
        poly.bindPopup(
          '<div style="font-family:Inter,sans-serif;font-size:12.5px;min-width:220px;">' +
            '<div style="font-weight:700;font-size:14px;font-family:monospace;margin-bottom:6px;">' + escapeHtml(cell.cell_name) + '</div>' +
            '<div style="display:flex;justify-content:space-between;padding:3px 0;"><span>Original PCI:</span><b>' + cell.pci + '</b></div>' +
            '<div style="display:flex;justify-content:space-between;padding:3px 0;"><span>New PCI:</span><b style="color:#1F9D55;">' + cell.suggested_pci + '</b></div>' +
          '</div>'
        );
        addToCategory(cat, poly);
      });

      if (lastPCIResults.cells.length) {
        const bounds = L.latLngBounds(lastPCIResults.cells.map(c => [c.lat, c.long]));
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

      const unresolvedN = lastPCIResults.stillConflicted.size;
      const reassignedN = lastPCIResults.cells.filter(c =>
        c.suggested_pci !== c.pci && !lastPCIResults.stillConflicted.has(c.id)).length;
      const cleanN = lastPCIResults.cells.length - unresolvedN - reassignedN;

      ToolLegend.show({
        icon: '🧮',
        title: 'PCI Checker · ' + lastPCIResults.cells.length + ' cells',
        items: [
          { id: 'unresolved', color: '#D64545', label: 'Unresolved', count: unresolvedN },
          { id: 'reassigned', color: '#1F9D55', label: 'Reassigned', count: reassignedN },
          { id: 'clean', color: '#94A3B8', label: 'Clean', count: cleanN }
        ],
        onToggle: onToggle
      });

      toast('PCI results on map', 'success');
    }, 300);
  }

  window.runPCIChecker = runPCIChecker;
  window.renderPCIResults = renderPCIResults;
  window.clearPCIResults = clearPCIResults;
  window.exportPCIResults = exportPCIResults;
  window.pciApplyAll = pciApplyAll;
  window.showPCIOnMap = showPCIOnMap;
  window.isFaceToFace = isFaceToFace;

  console.log('✅ PCI checker loaded');
})();
