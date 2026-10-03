/* =========================================================
   🎵 HSN CONFLICT ANALYZER (GSM)
   ========================================================= */
(function() {
  'use strict';

  let hsnLastResults = null;

  function hsnBoreDifference(b1, b2) {
    const d = Math.abs(b1 - b2) % 360;
    return d <= 180 ? d : 360 - d;
  }

  function hsnExtractSiteId(cellName) {
    return cellName.substring(0, Math.min(6, cellName.length));
  }

  function hsnIsInCoverage(bore, bearingToNeighbor, sectorWidth) {
    sectorWidth = sectorWidth || 120;
    if (bore == null) return true;
    const diff = hsnBoreDifference(bore, bearingToNeighbor);
    return diff <= (sectorWidth / 2);
  }

  function hsnCalculateConflictLevel(distance, maxDistance, bearingDiff, considerBearing) {
    let baseLevel = 1.0 - (distance / maxDistance);

    if (considerBearing) {
      if (bearingDiff < 30) baseLevel *= 1.5;
      else if (bearingDiff < 60) baseLevel *= 1.2;
      else if (bearingDiff > 150) baseLevel *= 0.5;
    }

    return Math.min(1.0, Math.max(0.1, baseLevel));
  }

  function runHSNChecker() {
    const gsmCells = State.allCells.filter(c =>
      c.tech === 'GSM' && /[A-Z]$/.test(c.cell_name) && c.hsn != null && c.hsn >= 0);

    if (!gsmCells.length) {
      toast('No GSM cells with HSN found. Import GSM data first.', 'error', 6000);
      return;
    }

    const distanceThreshold = parseInt(document.getElementById('hsn_distance').value) || 2000;
    const hsnMin = parseInt(document.getElementById('hsn_min').value) || 0;
    const hsnMax = parseInt(document.getElementById('hsn_max').value) || 63;
    const sectorWidth = parseInt(document.getElementById('hsn_sector_width').value) || 120;
    const considerBearing = document.getElementById('hsn_consider_bearing').checked;
    const forceUnique = document.getElementById('hsn_force_unique_site').checked;

    const features = gsmCells.filter(c => c.hsn >= hsnMin && c.hsn <= hsnMax);
    if (!features.length) {
      toast('No cells with HSN in range ' + hsnMin + '-' + hsnMax, 'error', 5000);
      return;
    }

    const siteGroups = {};
    features.forEach(f => {
      const siteId = f.site || hsnExtractSiteId(f.cell_name);
      if (!siteGroups[siteId]) siteGroups[siteId] = [];
      siteGroups[siteId].push(f);
    });

    const conflicts = [];
    const conflictMap = new Map();
    const featureDict = new Map();
    features.forEach(f => featureDict.set(f.id, f));

    // Same-site conflicts
    Object.entries(siteGroups).forEach(([siteId, cells]) => {
      if (cells.length <= 1) return;
      for (let i = 0; i < cells.length; i++) {
        for (let j = 0; j < cells.length; j++) {
          if (i === j) continue;
          const src = cells[i], tgt = cells[j];
          if (src.hsn === tgt.hsn) {
            conflicts.push({
              sourceId: src.id, sourceCell: src.cell_name,
              targetId: tgt.id, targetCell: tgt.cell_name,
              hsn: src.hsn, distance: 1, bearingDiff: 0,
              conflictLevel: 1.0, sameSite: true
            });
            if (!conflictMap.has(src.id)) conflictMap.set(src.id, []);
            conflictMap.get(src.id).push({
              cell: tgt.cell_name, distance: 1, hsn: tgt.hsn,
              bearingDiff: 0, conflictLevel: 1.0, sameSite: true
            });
          }
        }
      }
    });

    // Neighbor conflicts
    for (let i = 0; i < features.length; i++) {
      const src = features[i];
      for (let j = 0; j < features.length; j++) {
        if (i === j) continue;
        const tgt = features[j];

        const srcSite = src.site || hsnExtractSiteId(src.cell_name);
        const tgtSite = tgt.site || hsnExtractSiteId(tgt.cell_name);
        if (srcSite === tgtSite) continue;

        const dist = haversineDistance(src.lat, src.long, tgt.lat, tgt.long);
        if (dist > distanceThreshold) continue;
        if (src.hsn !== tgt.hsn) continue;

        const bearingToTarget = calculateBearing(src.lat, src.long, tgt.lat, tgt.long);

        let inCov = true;
        let bDiff = 0;
        if (considerBearing) {
          inCov = hsnIsInCoverage(src.bore, bearingToTarget, sectorWidth);
          bDiff = hsnBoreDifference(src.bore, bearingToTarget);
        }

        if (inCov) {
          const cLevel = hsnCalculateConflictLevel(dist, distanceThreshold, bDiff, considerBearing);
          conflicts.push({
            sourceId: src.id, sourceCell: src.cell_name,
            targetId: tgt.id, targetCell: tgt.cell_name,
            hsn: src.hsn, distance: dist, bearingDiff: bDiff,
            conflictLevel: cLevel, sameSite: false
          });
          if (!conflictMap.has(src.id)) conflictMap.set(src.id, []);
          conflictMap.get(src.id).push({
            cell: tgt.cell_name, distance: dist, hsn: tgt.hsn,
            bearingDiff: bDiff, conflictLevel: cLevel, sameSite: false
          });
        }
      }
    }

    // Force unique HSN per site
    if (forceUnique) {
      Object.entries(siteGroups).forEach(([siteId, cells]) => {
        if (cells.length <= 1) return;
        const hsnGroups = {};
        cells.forEach(c => {
          if (!hsnGroups[c.hsn]) hsnGroups[c.hsn] = [];
          hsnGroups[c.hsn].push(c);
        });
        Object.entries(hsnGroups).forEach(([hsn, group]) => {
          if (group.length <= 1) return;
          for (let i = 0; i < group.length; i++) {
            for (let j = 0; j < group.length; j++) {
              if (i === j) continue;
              const src = group[i], tgt = group[j];
              if (!conflictMap.has(src.id)) conflictMap.set(src.id, []);
              const exists = conflictMap.get(src.id).some(c => c.cell === tgt.cell_name);
              if (!exists) {
                conflictMap.get(src.id).push({
                  cell: tgt.cell_name, distance: 1, hsn: tgt.hsn,
                  bearingDiff: 0, conflictLevel: 1.0, sameSite: true
                });
              }
            }
          }
        });
      });
    }

    if (!conflictMap.size) {
      toast('No HSN conflicts found!', 'success');
      document.getElementById('hsnResults').style.display = 'none';
      return;
    }

    // Suggest new HSNs
    const allPossibleHSNs = [];
    for (let h = 0; h <= 63; h++) allPossibleHSNs.push(h);

    const hsnDistribution = {};
    features.forEach(f => { hsnDistribution[f.hsn] = (hsnDistribution[f.hsn] || 0) + 1; });

    const suggestedHSNs = new Map();
    const hsnByName = new Map(features.map(f => [f.cell_name, f]));

    const conflictedCells = Array.from(conflictMap.entries())
      .sort((a, b) => b[1].length - a[1].length);

    conflictedCells.forEach(([featureId, cellConflicts]) => {
      const feat = featureDict.get(featureId);
      if (!feat) return;

      const neighborHSNs = new Set(cellConflicts.map(c => c.hsn));

      const siteHSNs = new Set();
      const siteId = feat.site || hsnExtractSiteId(feat.cell_name);
      (siteGroups[siteId] || []).forEach(cell => {
        if (cell.id === featureId) return;
        if (suggestedHSNs.has(cell.id)) siteHSNs.add(suggestedHSNs.get(cell.id));
        else siteHSNs.add(cell.hsn);
      });

      const forbidden = new Set([...neighborHSNs, ...siteHSNs]);
      cellConflicts.forEach(c => {
        const nf = hsnByName.get(c.cell);
        if (nf && suggestedHSNs.has(nf.id)) forbidden.add(suggestedHSNs.get(nf.id));
      });

      const available = allPossibleHSNs.filter(h => !forbidden.has(h));

      let suggestedHSN;
      if (available.length) {
        suggestedHSN = available.reduce((a, b) =>
          (hsnDistribution[a] || 0) <= (hsnDistribution[b] || 0) ? a : b);
      } else {
        suggestedHSN = allPossibleHSNs.reduce((a, b) =>
          (hsnDistribution[a] || 0) <= (hsnDistribution[b] || 0) ? a : b);
      }

      suggestedHSNs.set(featureId, suggestedHSN);
      hsnDistribution[suggestedHSN] = (hsnDistribution[suggestedHSN] || 0) + 1;
    });

    hsnLastResults = {
      cells: features,
      conflicts: conflicts,
      conflictMap: conflictMap,
      featureDict: featureDict,
      suggestedHSNs: suggestedHSNs,
      distanceThreshold: distanceThreshold,
      considerBearing: considerBearing,
      forceUnique: forceUnique
    };

    renderHSNResults(hsnLastResults);
    document.getElementById('hsnResults').style.display = 'block';
    toast(conflicts.length + ' conflicts in ' + conflictMap.size + ' cells', 'success', 5000);
  }

  function renderHSNResults(r) {
    const totalCells = r.cells.length;
    const totalConflicts = r.conflicts.length;
    const sameSiteCount = r.conflicts.filter(c => c.sameSite).length;
    const neighborCount = r.conflicts.filter(c => !c.sameSite).length;

    document.getElementById('hsn_kpi_total').textContent = totalCells;
    document.getElementById('hsn_kpi_conflicts').textContent = totalConflicts;
    document.getElementById('hsn_kpi_samesite').textContent = sameSiteCount;
    document.getElementById('hsn_kpi_neighbor').textContent = neighborCount;

    let highCount = 0;
    r.conflictMap.forEach((conflicts, id) => {
      const cnt = conflicts.length;
      const avgLevel = conflicts.reduce((a, c) => a + (c.conflictLevel || 0.5), 0) / cnt;
      if (cnt >= 3 && avgLevel > 0.7) highCount++;
    });
    document.getElementById('hsn_kpi_high').textContent = highCount;
    document.getElementById('hsn_kpi_reassigned').textContent = r.suggestedHSNs.size;

    const warnEl = document.getElementById('hsnWarnings');
    let warnHtml = '';
    if (sameSiteCount > 0) {
      warnHtml += '<div style="background:#FCEAEA;color:#B91C1C;padding:10px 14px;border-radius:8px;font-size:12.5px;margin-bottom:8px;">' +
        '<b>Same-Site Conflicts:</b> ' + sameSiteCount + ' — same HSN on same site</div>';
    }
    if (neighborCount > 0) {
      warnHtml += '<div style="background:#FDF1DC;color:#8A5A00;padding:10px 14px;border-radius:8px;font-size:12.5px;">' +
        '<b>Neighbor Conflicts:</b> ' + neighborCount + ' — same HSN between neighbors</div>';
    }
    warnEl.innerHTML = warnHtml;

    const tbody = document.querySelector('#hsnConflictsTable tbody');
    const rows = [];

    r.conflictMap.forEach((conflicts, id) => {
      const feat = r.featureDict.get(id);
      if (!feat) return;

      const cnt = conflicts.length;
      const sameSite = conflicts.filter(c => c.sameSite).length;
      const neighbor = conflicts.filter(c => !c.sameSite).length;
      const avgLevel = conflicts.reduce((a, c) => a + (c.conflictLevel || 0.5), 0) / cnt;

      let priority, priorityColor, priorityBg;
      if (cnt >= 3 && avgLevel > 0.7) { priority = 'HIGH'; priorityColor = '#B91C1C'; priorityBg = '#FCEAEA'; }
      else if (cnt >= 2 || sameSite > 0) { priority = 'MEDIUM'; priorityColor = '#8A5A00'; priorityBg = '#FDF1DC'; }
      else { priority = 'LOW'; priorityColor = '#1F9D55'; priorityBg = '#E7F7EE'; }

      const typeText = sameSite > 0 && neighbor > 0 ? 'Same + Neighbor' :
                       sameSite > 0 ? 'Same-Site' : 'Neighbor';

      const neighborList = conflicts.slice(0, 3).map(c => {
        if (c.sameSite) return c.cell + ' (SAME, HSN:' + c.hsn + ')';
        return c.cell + ' (HSN:' + c.hsn + ', ' + c.distance.toFixed(0) + 'm, ' + c.bearingDiff.toFixed(0) + '°)';
      }).join('<br>') + (conflicts.length > 3 ? '<br>... +' + (conflicts.length - 3) + ' more' : '');

      const suggestedHSN = r.suggestedHSNs.get(id);

      rows.push('<tr>' +
        '<td><b>' + escapeHtml(feat.cell_name) + '</b></td>' +
        '<td style="font-family:monospace;">' + feat.hsn + '</td>' +
        '<td style="text-align:center;"><b>' + cnt + '</b></td>' +
        '<td>' + typeText + '</td>' +
        '<td style="font-size:11px;font-family:monospace;">' + neighborList + '</td>' +
        '<td style="font-family:monospace;font-weight:800;color:#124191;font-size:14px;">' + suggestedHSN + '</td>' +
        '<td><span style="padding:3px 9px;border-radius:10px;font-size:11px;font-weight:700;background:' + priorityBg + ';color:' + priorityColor + ';">' + priority + '</span></td>' +
      '</tr>');
    });

    tbody.innerHTML = rows.join('') || '<tr><td colspan="7" style="text-align:center;padding:20px;color:#5A6B87;">No conflicts</td></tr>';
  }

  function clearHSNResults() {
    hsnLastResults = null;
    document.getElementById('hsnResults').style.display = 'none';
    toast('Cleared', 'info');
  }

  async function hsnApplyAll(btn) {
    if (!hsnLastResults) { toast('Run analysis first', 'error'); return; }
    const count = hsnLastResults.suggestedHSNs.size;
    if (!count) { toast('No suggestions to apply', 'info'); return; }
    if (!confirm('Apply ' + count + ' suggested HSN values?')) return;

    btn.disabled = true;
    btn.textContent = 'Applying...';

    let applied = 0, failed = 0;

    try {
      for (const [id, newHSN] of hsnLastResults.suggestedHSNs) {
        const feat = hsnLastResults.featureDict.get(id);
        if (!feat) continue;

        const { error } = await db.from('rf_cells').update({ hsn: newHSN }).eq('id', feat.id);
        if (error) { failed++; console.error(error); }
        else {
          applied++;
          const local = State.allCells.find(c => c.id === feat.id);
          if (local) local.hsn = newHSN;
        }

        if (applied % 20 === 0) btn.textContent = 'Applying ' + applied + '/' + count + '...';
      }

      toast('Applied ' + applied + ' HSN updates' + (failed ? ' (' + failed + ' failed)' : ''), 'success', 5000);
      if (typeof persistCellsCache === 'function') persistCellsCache();
      setTimeout(runHSNChecker, 500);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Apply All Suggestions';
    }
  }

  function hsnExportCSV() {
    if (!hsnLastResults) { toast('Run analysis first', 'error'); return; }

    const rows = [['Cell', 'Site', 'Current HSN', 'Conflicts', 'Same-Site', 'Neighbor', 'Neighbors List', 'Suggested HSN', 'Priority']];

    hsnLastResults.conflictMap.forEach((conflicts, id) => {
      const feat = hsnLastResults.featureDict.get(id);
      if (!feat) return;

      const sameSite = conflicts.filter(c => c.sameSite).length;
      const neighbor = conflicts.filter(c => !c.sameSite).length;
      const cnt = conflicts.length;
      const avgLevel = conflicts.reduce((a, c) => a + (c.conflictLevel || 0.5), 0) / cnt;

      let priority;
      if (cnt >= 3 && avgLevel > 0.7) priority = 'HIGH';
      else if (cnt >= 2 || sameSite > 0) priority = 'MEDIUM';
      else priority = 'LOW';

      const neighborText = conflicts.map(c =>
        c.sameSite ? c.cell + '(SAME)' : c.cell + '(' + c.distance.toFixed(0) + 'm)'
      ).join('; ');

      rows.push([
        feat.cell_name, feat.site || '', feat.hsn, cnt, sameSite, neighbor,
        neighborText, hsnLastResults.suggestedHSNs.get(id), priority
      ]);
    });

    downloadCSV('HSN_Analysis_' + new Date().toISOString().slice(0, 10) + '.csv', rows);
    toast('CSV exported', 'success');
  }

  function hsnShowOnMap() {
    if (!hsnLastResults) { toast('Run analysis first', 'error'); return; }

    window.__gsmMode = true;
    switchView('map');

    setTimeout(() => {
      if (State.sectorLayer) State.sectorLayer.clearLayers();
      if (State.labelLayer) State.labelLayer.clearLayers();

      window.nbMapLayers = window.nbMapLayers || [];
      nbMapLayers.forEach(l => { try { State.map.removeLayer(l); } catch (e) {} });
      window.nbMapLayers = [];

      const conflictCells = hsnLastResults.cells.filter(c => hsnLastResults.conflictMap.has(c.id));
      if (!conflictCells.length) {
        toast('No conflicts — all cells clean!', 'success', 5000);
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
        if (!cell.lat || !cell.long) return;

        const conflicts = hsnLastResults.conflictMap.get(cell.id);
        const conflictCount = conflicts.length;
        const avgLevel = conflicts.reduce((a, c) => a + (c.conflictLevel || 0.5), 0) / conflictCount;

        let cat, color, fillOpacity, weight;
        if (conflictCount >= 3 && avgLevel > 0.7) {
          cat = 'high'; color = '#B91C1C'; fillOpacity = 0.95; weight = 2.5; highN++;
        } else if (conflictCount >= 2 || conflicts.some(c => c.sameSite)) {
          cat = 'medium'; color = '#F97316'; fillOpacity = 0.85; weight = 2; medN++;
        } else {
          cat = 'low'; color = '#FBBF24'; fillOpacity = 0.75; weight = 1.5; lowN++;
        }

        const coords = makeSectorCoordsScaled(cell.lat, cell.long, cell.bore, 1.0);
        const poly = L.polygon(coords, {
          color: color, weight: weight, fillColor: color, fillOpacity: fillOpacity
        });

        const suggested = hsnLastResults.suggestedHSNs.get(cell.id);
        poly.bindPopup(
          '<div style="font-family:Inter,sans-serif;font-size:13px;min-width:240px;">' +
            '<div style="font-weight:800;font-family:monospace;margin-bottom:8px;">' + escapeHtml(cell.cell_name) + '</div>' +
            '<div style="display:flex;justify-content:space-between;padding:4px 0;"><span>Current HSN:</span><b style="color:#B91C1C;">' + cell.hsn + '</b></div>' +
            '<div style="display:flex;justify-content:space-between;padding:4px 0;"><span>Suggested:</span><b style="color:#1F9D55;">' + (suggested != null ? suggested : '-') + '</b></div>' +
            '<div style="display:flex;justify-content:space-between;padding:4px 0;"><span>Conflicts:</span><b style="color:#B91C1C;">' + conflictCount + '</b></div>' +
          '</div>'
        );
        addToCategory(cat, poly);
      });

      const bounds = L.latLngBounds(conflictCells.map(c => [c.lat, c.long]));
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
        icon: '🎵',
        title: 'HSN Conflicts · ' + conflictCells.length,
        items: [
          { id: 'high', color: '#B91C1C', label: 'HIGH', count: highN },
          { id: 'medium', color: '#F97316', label: 'MEDIUM', count: medN },
          { id: 'low', color: '#FBBF24', label: 'LOW', count: lowN }
        ],
        onToggle: onToggle
      });

      toast(conflictCells.length + ' conflicts on map', 'success', 4000);
    }, 400);
  }

  function hsnShowAllOnMap() {
    if (!hsnLastResults) { toast('Run analysis first', 'error'); return; }
    hsnShowOnMap();
  }

  window.runHSNChecker = runHSNChecker;
  window.clearHSNResults = clearHSNResults;
  window.hsnApplyAll = hsnApplyAll;
  window.hsnExportCSV = hsnExportCSV;
  window.hsnShowOnMap = hsnShowOnMap;
  window.hsnShowAllOnMap = hsnShowAllOnMap;

  console.log('✅ HSN checker loaded');
})();
