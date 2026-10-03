/* =========================================================
   🎯 AZIMUTH OPTIMIZATION
   ========================================================= */
(function() {
  'use strict';

  let azoptLastResults = null;

  function azoptGetBoreForNeighbors(cell, neighbors, radius, weightMethod) {
    const WINDOW = 60;
    const MAX_SHIFT = 30;
    let sumSin = 0, sumCos = 0, total = 0;

    neighbors.forEach(nb => {
      if (nb.distance < 50) return;
      const b = calculateBearing(cell.lat, cell.long, nb.cell.lat, nb.cell.long);
      if (boreDifference(cell.bore, b) > WINDOW) return;
      const w = weightMethod === 'distance' ? 1 / Math.max(nb.distance, 100) : 1;
      sumSin += Math.sin(b * Math.PI / 180) * w;
      sumCos += Math.cos(b * Math.PI / 180) * w;
      total += w;
    });

    if (!total) return cell.bore;

    const target = (Math.atan2(sumSin, sumCos) * 180 / Math.PI + 360) % 360;
    let d = ((target - cell.bore + 540) % 360) - 180;
    if (Math.abs(d) < 15) return cell.bore;
    d = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, d));
    return Math.round((cell.bore + d + 360) % 360);
  }

  function runAzimuthOpt() {
    const targetName = (document.getElementById('azopt_cell').value || '').trim().toUpperCase();
    const radius = parseInt(document.getElementById('azopt_radius').value) || 3000;
    const weightMethod = document.getElementById('azopt_weight').value;

    let cells;
    if (targetName) {
      const c = State.allCells.find(x => x.cell_name.toUpperCase() === targetName);
      if (!c) { toast('Cell "' + targetName + '" not found', 'error', 5000); return; }
      cells = [c];
    } else {
      cells = State.allCells.filter(c => c.tech === 'GSM' && /[A-Z]$/.test(c.cell_name));
    }

    if (!cells.length) { toast('No cells to analyze', 'error'); return; }

    const results = [];

    cells.forEach(cell => {
      const neighbors = [];
      State.allCells.forEach(other => {
        if (other.id === cell.id) return;
        if (other.tech !== cell.tech) return;
        if (!other.lat || !other.long) return;
        const d = haversineDistance(cell.lat, cell.long, other.lat, other.long);
        if (d <= radius) {
          neighbors.push({ cell: other, distance: d });
        }
      });

      const suggested = azoptGetBoreForNeighbors(cell, neighbors, radius, weightMethod);
      const change = ((suggested - cell.bore + 540) % 360) - 180;
      const absChange = Math.abs(change);

      let beforeFront = 0, afterFront = 0;
      neighbors.forEach(nb => {
        const bearing = calculateBearing(cell.lat, cell.long, nb.cell.lat, nb.cell.long);
        if (boreDifference(cell.bore, bearing) <= 45) beforeFront++;
        if (boreDifference(suggested, bearing) <= 45) afterFront++;
      });

      results.push({
        cell: cell,
        currentBore: cell.bore,
        suggestedBore: suggested,
        change: change,
        absChange: absChange,
        neighborsCount: neighbors.length,
        beforeFront: beforeFront,
        afterFront: afterFront,
        gain: afterFront - beforeFront
      });
    });

    results.sort((a, b) => b.absChange - a.absChange);

    azoptLastResults = {
      results: results,
      single: targetName ? results[0] : null,
      radius: radius
    };

    renderAzimuthOpt(azoptLastResults);
    document.getElementById('azoptResults').style.display = 'block';
    toast(results.length + ' cells analyzed', 'success', 4000);
  }

  function renderAzimuthOpt(r) {
    const singleBox = document.getElementById('azoptSingleBox');

    if (r.single) {
      const s = r.single;
      singleBox.innerHTML =
        '<div style="background:#EAF2FB;border-radius:12px;padding:20px;border-left:4px solid #124191;">' +
          '<div style="font-size:15px;font-weight:800;color:#0C1B3D;margin-bottom:12px;">' + escapeHtml(s.cell.cell_name) + '</div>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;">' +
            '<div style="background:#fff;border-radius:10px;padding:14px;">' +
              '<div style="font-size:11px;color:#5A6B87;font-weight:700;text-transform:uppercase;">Current Bore</div>' +
              '<div style="font-family:monospace;font-size:22px;font-weight:800;color:#0C1B3D;">' + s.currentBore + '°</div>' +
            '</div>' +
            '<div style="background:#fff;border-radius:10px;padding:14px;">' +
              '<div style="font-size:11px;color:#5A6B87;font-weight:700;text-transform:uppercase;">Suggested</div>' +
              '<div style="font-family:monospace;font-size:22px;font-weight:800;color:#1F9D55;">' + s.suggestedBore + '°</div>' +
            '</div>' +
            '<div style="background:#fff;border-radius:10px;padding:14px;">' +
              '<div style="font-size:11px;color:#5A6B87;font-weight:700;text-transform:uppercase;">Change</div>' +
              '<div style="font-family:monospace;font-size:22px;font-weight:800;color:' + (s.absChange > 15 ? '#D64545' : '#5A6B87') + ';">' +
                (s.change >= 0 ? '+' : '') + Math.round(s.change) + '°' +
              '</div>' +
            '</div>' +
            '<div style="background:#fff;border-radius:10px;padding:14px;">' +
              '<div style="font-size:11px;color:#5A6B87;font-weight:700;text-transform:uppercase;">Neighbors</div>' +
              '<div style="font-family:monospace;font-size:22px;font-weight:800;color:#124191;">' + s.neighborsCount + '</div>' +
            '</div>' +
            '<div style="background:#fff;border-radius:10px;padding:14px;">' +
              '<div style="font-size:11px;color:#5A6B87;font-weight:700;text-transform:uppercase;">Front Coverage</div>' +
              '<div style="font-family:monospace;font-size:22px;font-weight:800;color:#7C3AED;">' + s.beforeFront + ' -> ' + s.afterFront + '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
    } else {
      singleBox.innerHTML = '';
    }

    const tbody = document.querySelector('#azoptTable tbody');
    const rows = r.single ? r.results : r.results.filter(x => x.absChange >= 15);

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#1F9D55;font-weight:600;">All cells optimized — no changes needed</td></tr>';
      return;
    }

    tbody.innerHTML = rows.slice(0, 500).map(x => {
      const changeStr = (x.change >= 0 ? '+' : '') + Math.round(x.change) + '°';
      const changeColor = x.absChange > 60 ? '#B91C1C' : x.absChange > 30 ? '#8A5A00' : '#1F9D55';
      const gainStr = (x.gain > 0 ? '+' : '') + x.gain;

      return '<tr>' +
        '<td><b>' + escapeHtml(x.cell.cell_name) + '</b></td>' +
        '<td style="font-family:monospace;">' + x.currentBore + '°</td>' +
        '<td style="font-family:monospace;font-weight:800;color:#1F9D55;">' + x.suggestedBore + '°</td>' +
        '<td style="color:' + changeColor + ';font-weight:800;">' + changeStr + '</td>' +
        '<td>' + x.neighborsCount + '</td>' +
        '<td style="color:' + (x.gain > 0 ? '#1F9D55' : '#5A6B87') + ';font-weight:700;">' + gainStr + '</td>' +
      '</tr>';
    }).join('');
  }

  function clearAzimuthOpt() {
    azoptLastResults = null;
    document.getElementById('azoptResults').style.display = 'none';
    toast('Cleared', 'info');
  }

  function azoptExportCSV() {
    if (!azoptLastResults) { toast('Run analysis first', 'error'); return; }

    const rows = [['Cell', 'Current_Bore', 'Suggested_Bore', 'Change', 'Neighbors', 'Front_Before', 'Front_After', 'Gain']];
    azoptLastResults.results.forEach(r => {
      rows.push([
        r.cell.cell_name, r.currentBore, r.suggestedBore,
        Math.round(r.change), r.neighborsCount,
        r.beforeFront, r.afterFront, r.gain
      ]);
    });

    downloadCSV('Azimuth_Optimization_' + new Date().toISOString().slice(0, 10) + '.csv', rows);
    toast('CSV exported', 'success');
  }

  function azoptShowOnMap() {
    if (!azoptLastResults) { toast('Run analysis first', 'error'); return; }

    window.__gsmMode = true;
    switchView('map');

    setTimeout(() => {
      window.azoptMapLayers = window.azoptMapLayers || [];
      azoptMapLayers.forEach(l => { try { State.map.removeLayer(l); } catch (e) {} });
      window.azoptMapLayers = [];

      if (State.sectorLayer) State.sectorLayer.clearLayers();
      if (State.labelLayer) State.labelLayer.clearLayers();

      window.nbMapLayers = window.nbMapLayers || [];
      nbMapLayers.forEach(l => { try { State.map.removeLayer(l); } catch (e) {} });
      window.nbMapLayers = [];

      const toShow = azoptLastResults.results.filter(r => r.absChange >= 15).slice(0, 100);
      const layersByCategory = {};
      const addToCategory = (cat, layer) => {
        if (!layersByCategory[cat]) layersByCategory[cat] = [];
        layersByCategory[cat].push(layer);
        nbMapLayers.push(layer);
        if (State.map && !State.map.hasLayer(layer)) State.map.addLayer(layer);
        return layer;
      };

      toShow.forEach(item => {
        const cell = item.cell;

        const currentCoords = makeSectorCoordsScaled(cell.lat, cell.long, cell.bore, 1.0);
        const currentPoly = L.polygon(currentCoords, {
          color: '#DC2626', weight: 1.5, fillColor: '#DC2626', fillOpacity: 0.25,
          dashArray: '5,4'
        });
        currentPoly.bindPopup(
          '<div style="font-family:Inter,sans-serif;font-size:12.5px;min-width:220px;">' +
            '<div style="font-weight:800;font-family:monospace;margin-bottom:8px;">' + escapeHtml(cell.cell_name) + '</div>' +
            '<div style="display:flex;justify-content:space-between;padding:3px 0;"><span>Current:</span><b style="color:#DC2626;">' + item.currentBore + '°</b></div>' +
            '<div style="display:flex;justify-content:space-between;padding:3px 0;"><span>Suggested:</span><b style="color:#16A34A;">' + item.suggestedBore + '°</b></div>' +
          '</div>'
        );
        addToCategory('current', currentPoly);

        const suggestedCoords = makeSectorCoordsScaled(cell.lat, cell.long, item.suggestedBore, 1.0);
        const suggestedPoly = L.polygon(suggestedCoords, {
          color: '#16A34A', weight: 2, fillColor: '#16A34A', fillOpacity: 0.55
        });
        addToCategory('suggested', suggestedPoly);
      });

      if (toShow.length) {
        const points = toShow.map(r => [r.cell.lat, r.cell.long]);
        State.map.fitBounds(L.latLngBounds(points), { padding: [60, 60] });
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
        icon: '🎯',
        title: 'Azimuth Optimization · ' + toShow.length,
        items: [
          { id: 'current', color: '#DC2626', label: 'Current Azimuth', count: toShow.length, dashed: true },
          { id: 'suggested', color: '#16A34A', label: 'Suggested Azimuth', count: toShow.length }
        ],
        onToggle: onToggle
      });

      toast(toShow.length + ' cells on map', 'success', 4000);
    }, 400);
  }

  window.runAzimuthOpt = runAzimuthOpt;
  window.clearAzimuthOpt = clearAzimuthOpt;
  window.azoptExportCSV = azoptExportCSV;
  window.azoptShowOnMap = azoptShowOnMap;

  console.log('✅ Azimuth optimization loaded');
})();
