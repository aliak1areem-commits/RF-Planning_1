/* =========================================================
   📡 GSM BCCH/BSIC PLANNER
   ========================================================= */
(function() {
  'use strict';

  let gsmLastResults = null;

  function gsmGetBand(cellName) {
    if (!cellName || cellName.length < 1) return null;
    return GSM_BAND_SUFFIX[cellName.slice(-1).toUpperCase()] || null;
  }

  function gsmIsFrontSector(targetBore, bearingToNeighbor, threshold) {
    threshold = threshold || GSM_FRONT_THRESHOLD;
    return boreDifference(targetBore, bearingToNeighbor) <= threshold;
  }

  function gsmGetAvailableFreqs(band) {
    const range = GSM_BAND_ARFCN[band];
    if (!range) return [];
    const freqs = [];
    for (let f = range.from; f <= range.to; f++) freqs.push(f);
    for (let i = freqs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [freqs[i], freqs[j]] = [freqs[j], freqs[i]];
    }
    return freqs;
  }

  function gsmRandomBSIC() {
    return String(Math.floor(Math.random() * 8)) + String(Math.floor(Math.random() * 8));
  }

  function gsmGetNearbyCells(targetCell, targetBand, radius) {
    const results = [];
    const tLat = targetCell.lat, tLon = targetCell.long;
    const tName = targetCell.cell_name, tBore = targetCell.bore;
    const tSite = tName.replace(/[A-Z]$/, '');

    State.allCells.forEach(feat => {
      if (feat.cell_name === tName) return;
      if (feat.tech !== 'GSM') return;

      const cellBand = gsmGetBand(feat.cell_name);
      if (cellBand !== targetBand) return;

      const dist = haversineDistance(tLat, tLon, feat.lat, feat.long);
      if (dist > radius) return;

      const featSite = feat.cell_name.replace(/[A-Z]$/, '');
      const isCoSite = (featSite === tSite);
      const bearingFromTarget = calculateBearing(tLat, tLon, feat.lat, feat.long);

      results.push({
        cell: feat.cell_name, distance: dist, bore: feat.bore, band: cellBand,
        bcch: feat.bcch || null, bsic: feat.bsic || null,
        bearingFromTarget: bearingFromTarget,
        isFront: gsmIsFrontSector(tBore, bearingFromTarget),
        isCoSite: isCoSite
      });
    });

    results.sort((a, b) => a.distance - b.distance);
    return results;
  }

  function gsmSelectOptimalBCCH(availableFreqs, usedFreqs, nearbyCells, targetBore) {
    const analysisCells = nearbyCells.filter(c => !c.isCoSite);
    const frontCells = analysisCells.filter(c => c.isFront);

    const frontFreqs = new Set(frontCells.map(c => c.bcch).filter(f => f != null));
    const allNearFreqs = new Set(analysisCells.map(c => c.bcch).filter(f => f != null));

    const frontAdj = new Set();
    frontFreqs.forEach(f => { frontAdj.add(f - 1); frontAdj.add(f + 1); });

    const freqScores = {};
    availableFreqs.forEach(freq => {
      let score = 1000.0;
      if (frontFreqs.has(freq)) score -= 15000;
      if (frontAdj.has(freq)) score -= 8000;
      if (allNearFreqs.has(freq)) score -= 2000;

      analysisCells.forEach(c => {
        if (c.bcch === freq) {
          const distPen = 600 * Math.exp(-c.distance / 400);
          const anglePen = 300 * (1 - boreDifference(targetBore, c.bearingFromTarget) / 180);
          score -= (distPen + anglePen);
        }
      });
      freqScores[freq] = score;
    });

    let best = -Infinity, bestFreq = null;

    Object.keys(freqScores).forEach(f => {
      const n = parseInt(f);
      if (!usedFreqs.has(n) && !frontFreqs.has(n) && !frontAdj.has(n) && freqScores[f] > 0) {
        if (freqScores[f] > best) { best = freqScores[f]; bestFreq = n; }
      }
    });
    if (bestFreq !== null) return bestFreq;

    best = -Infinity;
    Object.keys(freqScores).forEach(f => {
      const n = parseInt(f);
      if (!frontFreqs.has(n) && !frontAdj.has(n) && freqScores[f] > 0) {
        if (freqScores[f] > best) { best = freqScores[f]; bestFreq = n; }
      }
    });
    if (bestFreq !== null) return bestFreq;

    const tier3 = availableFreqs.filter(f => !frontFreqs.has(f));
    if (tier3.length) {
      const freqCounts = {};
      analysisCells.forEach(c => {
        if (tier3.includes(c.bcch)) freqCounts[c.bcch] = (freqCounts[c.bcch] || 0) + 1;
      });
      tier3.sort((a, b) => (freqCounts[a] || 0) - (freqCounts[b] || 0));
      return tier3[0];
    }
    return null;
  }

  function gsmSelectOptimalBSIC(usedBsics, nearbyCells, targetBore) {
    const analysisCells = nearbyCells.filter(c => !c.isCoSite);
    const allBsics = [];
    for (let ncc = 0; ncc < 8; ncc++) {
      for (let bcc = 0; bcc < 8; bcc++) {
        allBsics.push(String(ncc) + String(bcc));
      }
    }

    const frontBsics = new Set(analysisCells.filter(c => c.isFront && c.bsic).map(c => c.bsic));
    const nearBsics = new Set(analysisCells.filter(c => c.bsic).map(c => c.bsic));

    const tier1 = allBsics.filter(b => !usedBsics.has(b) && !frontBsics.has(b) && !nearBsics.has(b));
    if (tier1.length) return tier1[Math.floor(Math.random() * tier1.length)];

    const tier2 = allBsics.filter(b => !frontBsics.has(b) && !usedBsics.has(b));
    if (tier2.length) return tier2[Math.floor(Math.random() * tier2.length)];

    const tier3 = allBsics.filter(b => !frontBsics.has(b));
    if (tier3.length) return tier3[Math.floor(Math.random() * tier3.length)];

    return gsmRandomBSIC();
  }

  function runGSMPlanner() {
    const cellInput = document.getElementById('gsm_cell');
    if (!cellInput) return;

    const cellName = (cellInput.value || '').trim().toUpperCase();
    const radius = parseInt(document.getElementById('gsm_radius').value) || GSM_RADIUS_M;

    if (!cellName) { toast('Please enter a cell name', 'error'); return; }

    const band = gsmGetBand(cellName);
    if (!band) { toast('Invalid cell name — must end with A/B/C or D/E/F', 'error', 5000); return; }
    if (!State.allCells.length) { toast('No cells loaded', 'error', 5000); return; }

    const targetCell = State.allCells.find(c => c.cell_name.toUpperCase() === cellName);
    if (!targetCell) { toast('Cell "' + cellName + '" not found', 'error', 5000); return; }

    const availableFreqs = gsmGetAvailableFreqs(band);
    if (!availableFreqs.length) { toast('No frequencies for band ' + band, 'error'); return; }

    const nearbyCells = gsmGetNearbyCells(targetCell, band, radius);
    const siteName = cellName.slice(0, -1);
    const usedFreqs = new Set(), cositeFreqs = new Set();
    const usedBsics = new Set(), cositeBsics = new Set();

    State.allCells.forEach(feat => {
      const featCell = feat.cell_name.toUpperCase();
      if (featCell === cellName) return;
      const isCoSite = featCell.slice(0, -1) === siteName;

      if (isCoSite) {
        if (feat.bcch) cositeFreqs.add(feat.bcch);
        if (feat.bsic && /^\d{2}$/.test(feat.bsic)) cositeBsics.add(feat.bsic);
        return;
      }

      const dist = haversineDistance(targetCell.lat, targetCell.long, feat.lat, feat.long);
      if (dist <= radius) {
        if (feat.bcch) usedFreqs.add(feat.bcch);
        if (feat.bsic && /^\d{2}$/.test(feat.bsic)) usedBsics.add(feat.bsic);
      }
    });

    const finalUsedFreqs = new Set([...usedFreqs, ...cositeFreqs]);
    const finalUsedBsics = new Set([...usedBsics, ...cositeBsics]);

    const suggestedBCCH = gsmSelectOptimalBCCH(availableFreqs, finalUsedFreqs, nearbyCells, targetCell.bore);
    if (suggestedBCCH === null) { toast('No BCCH available', 'error', 6000); return; }

    const suggestedBSIC = gsmSelectOptimalBSIC(finalUsedBsics, nearbyCells, targetCell.bore);

    const conflicts = [];
    nearbyCells.forEach(c => {
      if (c.isCoSite) return;
      if (c.isFront && c.bcch === suggestedBCCH) conflicts.push(c.cell);
    });

    gsmLastResults = {
      cell: targetCell, band: band, bcch: suggestedBCCH, bsic: suggestedBSIC,
      nearby: nearbyCells, conflicts: conflicts,
      cositeFreqs: Array.from(cositeFreqs),
      cositeBsics: Array.from(cositeBsics),
      radius: radius
    };

    renderGSMResults(gsmLastResults);
    document.getElementById('gsmResults').style.display = 'block';
    toast('BCCH=' + suggestedBCCH + ' · BSIC=' + suggestedBSIC, 'success', 4000);
  }

  function renderGSMResults(r) {
    document.getElementById('gsm_kpi_cell').textContent = r.cell.cell_name;
    document.getElementById('gsm_kpi_bcch').textContent = r.bcch;
    document.getElementById('gsm_kpi_bsic').textContent = r.bsic;
    document.getElementById('gsm_kpi_band').textContent = r.band + ' MHz';
    document.getElementById('gsm_kpi_conflicts').textContent = r.conflicts.length;
    document.getElementById('gsm_kpi_neighbors').textContent = r.nearby.length;

    let warnHtml = '';
    if (r.conflicts.length) {
      warnHtml += '<div style="background:#FCEAEA;color:#B91C1C;padding:10px 14px;border-radius:8px;font-size:12.5px;margin-bottom:8px;">' +
        '<b>' + r.conflicts.length + ' conflict(s):</b> ' + r.conflicts.slice(0, 5).join(', ') + '</div>';
    }
    if (r.cositeFreqs.length) {
      warnHtml += '<div style="background:#FDF1DC;color:#8A5A00;padding:10px 14px;border-radius:8px;font-size:12.5px;margin-bottom:8px;">' +
        '<b>Co-site blocked BCCH:</b> ' + r.cositeFreqs.sort((a, b) => a - b).join(', ') + '</div>';
    }
    if (r.cositeBsics.length) {
      warnHtml += '<div style="background:#FDF1DC;color:#8A5A00;padding:10px 14px;border-radius:8px;font-size:12.5px;">' +
        '<b>Co-site blocked BSIC:</b> ' + r.cositeBsics.sort().join(', ') + '</div>';
    }
    document.getElementById('gsmWarnings').innerHTML = warnHtml;

    const tbody = document.querySelector('#gsmNearbyTable tbody');
    if (!r.nearby.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#5A6B87;">No nearby cells</td></tr>';
      return;
    }

    tbody.innerHTML = r.nearby.slice(0, 200).map(c => {
      const isConflict = !c.isCoSite && c.isFront && c.bcch === r.bcch;

      let rowBg;
      if (c.isCoSite) rowBg = '#E5E7EB';
      else if (c.isFront) rowBg = '#FFF9C4';
      else rowBg = '#F5F5F5';

      const confBg = isConflict ? '#FFCDD2' : '#C8E6C9';
      const confText = isConflict ? 'Yes' : (c.isCoSite ? '—' : 'No');
      const frontText = c.isCoSite ? 'Co-site' : (c.isFront ? 'Yes' : 'No');
      const cellDisplay = c.isCoSite
        ? '<b style="color:#6B7280;">' + escapeHtml(c.cell) + '</b>'
        : escapeHtml(c.cell);

      return '<tr style="background:' + rowBg + ';">' +
        '<td>' + cellDisplay + '</td>' +
        '<td>' + c.distance.toFixed(0) + '</td>' +
        '<td>' + c.bore + '°</td>' +
        '<td>' + c.band + '</td>' +
        '<td>' + (c.bcch != null ? c.bcch : '—') + '</td>' +
        '<td style="text-align:center;font-weight:600;">' + frontText + '</td>' +
        '<td style="background:' + confBg + ';text-align:center;font-weight:700;">' + confText + '</td>' +
      '</tr>';
    }).join('');
  }

  function gsmShowOnMap() {
    if (!gsmLastResults) { toast('Run analysis first', 'error'); return; }
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

      const target = gsmLastResults.cell;
      State.map.setView([target.lat, target.long], 14);

      const targetCoords = makeSectorCoords(target.lat, target.long, target.bore);
      const targetPoly = L.polygon(targetCoords, {
        color: '#FF3232', weight: 2.5, fillColor: '#FF3232', fillOpacity: 0.85, interactive: true
      });
      targetPoly.bindPopup(
        '<div style="font-family:Inter,sans-serif;font-size:12.5px;">' +
          '<b>' + escapeHtml(target.cell_name) + '</b><br>' +
          'BCCH: <b style="color:#1F9D55;">' + gsmLastResults.bcch + '</b><br>' +
          'BSIC: <b style="color:#1F9D55;">' + gsmLastResults.bsic + '</b>' +
        '</div>'
      );
      addToCategory('target', targetPoly);

      let conflictN = 0, cositeN = 0, frontN = 0, nonfrontN = 0;

      gsmLastResults.nearby.forEach(c => {
        const full = State.allCells.find(x => x.cell_name === c.cell);
        if (!full) return;
        const coords = makeSectorCoords(full.lat, full.long, full.bore);
        const isConflict = !c.isCoSite && c.isFront && c.bcch === gsmLastResults.bcch;
        let cat, color;
        if (isConflict) { cat = 'conflict'; color = '#D64545'; conflictN++; }
        else if (c.isCoSite) { cat = 'cosite'; color = '#6B7280'; cositeN++; }
        else if (c.isFront) { cat = 'front'; color = '#FF5050'; frontN++; }
        else { cat = 'nonfront'; color = '#FFDC00'; nonfrontN++; }

        const poly = L.polygon(coords, {
          color: '#FFFFFF', weight: 0.8, fillColor: color, fillOpacity: 0.75, interactive: true
        });
        poly.bindPopup('<b>' + escapeHtml(c.cell) + '</b><br>BCCH: ' + (c.bcch != null ? c.bcch : '—'));
        addToCategory(cat, poly);
      });

      const points = [[target.lat, target.long]];
      gsmLastResults.nearby.forEach(c => {
        const full = State.allCells.find(x => x.cell_name === c.cell);
        if (full) points.push([full.lat, full.long]);
      });
      if (points.length > 1) State.map.fitBounds(L.latLngBounds(points), { padding: [60, 60] });

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
        icon: '📡',
        title: 'GSM Planner · ' + gsmLastResults.nearby.length,
        items: [
          { id: 'target', color: '#FF3232', label: 'Target Cell', count: 1 },
          { id: 'conflict', color: '#D64545', label: 'Conflict (Front)', count: conflictN },
          { id: 'cosite', color: '#6B7280', label: 'Co-site', count: cositeN },
          { id: 'front', color: '#FF5050', label: 'Front (Safe)', count: frontN },
          { id: 'nonfront', color: '#FFDC00', label: 'Non-Front', count: nonfrontN }
        ],
        onToggle: onToggle
      });

      toast(gsmLastResults.nearby.length + ' cells on map', 'success');
    }, 400);
  }

  async function gsmSaveToDatabase() {
    if (!gsmLastResults) { toast('Run analysis first', 'error'); return; }
    const cell = gsmLastResults.cell;
    if (!cell.id) { toast('Cell has no ID', 'error'); return; }

    const msg = 'Save BCCH=' + gsmLastResults.bcch + ', BSIC=' + gsmLastResults.bsic + ' to ' + cell.cell_name + '?';
    if (!confirm(msg)) return;

    try {
      const { error } = await db.from('rf_cells')
        .update({ bcch: gsmLastResults.bcch, bsic: gsmLastResults.bsic })
        .eq('id', cell.id);
      if (error) throw error;
      toast('Saved', 'success');
      if (typeof persistCellsCache === 'function') persistCellsCache();
      const local = State.allCells.find(c => c.id === cell.id);
      if (local) {
        local.bcch = gsmLastResults.bcch;
        local.bsic = gsmLastResults.bsic;
      }
    } catch (e) {
      console.error(e);
      toast('Save failed: ' + e.message, 'error');
    }
  }

  function gsmExportCSV() {
    if (!gsmLastResults) { toast('Run analysis first', 'error'); return; }
    const rows = [['Cell', 'Distance (m)', 'Bore', 'Band', 'BCCH', 'BSIC', 'Front', 'Conflict']];
    gsmLastResults.nearby.forEach(c => {
      const isConflict = !c.isCoSite && c.isFront && c.bcch === gsmLastResults.bcch;
      rows.push([
        c.cell, c.distance.toFixed(0), c.bore, c.band,
        c.bcch != null ? c.bcch : '', c.bsic || '',
        c.isFront ? 'Yes' : 'No', isConflict ? 'Yes' : 'No'
      ]);
    });
    downloadCSV('GSM_Plan_' + gsmLastResults.cell.cell_name + '_' + new Date().toISOString().slice(0, 10) + '.csv', rows);
    toast('CSV exported', 'success');
  }

  window.runGSMPlanner = runGSMPlanner;
  window.gsmShowOnMap = gsmShowOnMap;
  window.gsmSaveToDatabase = gsmSaveToDatabase;
  window.gsmExportCSV = gsmExportCSV;
  window.gsmGetBand = gsmGetBand;

  console.log('✅ GSM planner loaded');
})();
