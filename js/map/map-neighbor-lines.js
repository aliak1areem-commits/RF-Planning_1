/* =========================================================
   🗺️ MAP NEIGHBOR LINES — Draw Lines Between Neighbors
   ========================================================= */
(function() {
  'use strict';

  let selectedCellForLines = null;

  function initNeighborLineLayer() {
    if (!State.neighborLineLayer) {
      State.neighborLineLayer = L.layerGroup().addTo(State.map);
    }
  }

  function toggleNeighborLines() {
    const chk = document.getElementById('showNeighborLines');
    const opts = document.getElementById('nbLineOptions');
    if (!chk) return;

    State.neighborLinesActive = chk.checked;

    if (opts) opts.style.display = State.neighborLinesActive ? 'block' : 'none';

    if (!State.neighborLinesActive) {
      if (State.neighborLineLayer) State.neighborLineLayer.clearLayers();
      selectedCellForLines = null;
      hideNeighborLinesLegend();
      toast('Neighbor Lines OFF', 'info');
      return;
    }

    initNeighborLineLayer();

    if (selectedCellForLines) {
      drawNeighborLines(selectedCellForLines);
    } else {
      toast('Select a cell on the map to view neighbors', 'info', 4000);
    }
  }

  function drawNeighborLines(cell) {
    if (!State.neighborLineLayer || !State.neighborLinesActive) return;

    State.neighborLineLayer.clearLayers();
    selectedCellForLines = cell;

    const maxNBEl = document.getElementById('nbLineMax');
    const radiusEl = document.getElementById('nbLineRadius');
    const maxNB = maxNBEl ? (parseInt(maxNBEl.value) || 10) : 10;
    const radius = radiusEl ? (parseInt(radiusEl.value) || 3000) : 3000;

    const neighbors = [];
    State.allCells.forEach(other => {
      if (other.id === cell.id) return;
      if (!other.lat || !other.long) return;
      if (other.tech !== cell.tech) return;

      const d = haversineDistance(cell.lat, cell.long, other.lat, other.long);
      if (d > radius) return;

      const bearing = calculateBearing(cell.lat, cell.long, other.lat, other.long);
      const angleDiff = boreDifference(cell.bore, bearing);

      let direction;
      if (angleDiff <= 45) direction = 'Front';
      else if (angleDiff <= 120) direction = 'Side';
      else direction = 'Back';

      neighbors.push({ cell: other, distance: d, bearing, angleDiff, direction });
    });

    neighbors.sort((a, b) => a.distance - b.distance);
    const top = neighbors.slice(0, maxNB);

    const layersByCategory = { front: [], side: [], back: [], source: [] };

    top.forEach(n => {
      let cat, color, dashArray, weight;
      if (n.direction === 'Front') { cat = 'front'; color = '#16A34A'; dashArray = null; weight = 2.5; }
      else if (n.direction === 'Side') { cat = 'side'; color = '#F59E0B'; dashArray = '6,4'; weight = 1.8; }
      else { cat = 'back'; color = '#94A3B8'; dashArray = '3,6'; weight = 1.2; }

      const line = L.polyline([
        [cell.lat, cell.long],
        [n.cell.lat, n.cell.long]
      ], {
        color: color, weight: weight, opacity: 0.85,
        dashArray: dashArray, lineCap: 'round', interactive: true
      });

      line.bindTooltip(
        '<div style="font-family:Inter,sans-serif;font-size:11.5px;">' +
          '<b style="font-family:monospace;">' + escapeHtml(n.cell.cell_name) + '</b><br>' +
          n.distance.toFixed(0) + ' m<br>' +
          n.bearing.toFixed(0) + '° (' + n.direction + ')<br>' +
          'Delta ' + n.angleDiff.toFixed(0) + '°' +
        '</div>',
        { sticky: true }
      );

      const dot = L.circleMarker([n.cell.lat, n.cell.long], {
        radius: 4, color: '#fff', weight: 1.5,
        fillColor: color, fillOpacity: 1, interactive: false
      });

      State.neighborLineLayer.addLayer(line);
      State.neighborLineLayer.addLayer(dot);
      layersByCategory[cat].push(line, dot);
    });

    const srcMarker = L.circleMarker([cell.lat, cell.long], {
      radius: 8, color: '#fff', weight: 3,
      fillColor: '#124191', fillOpacity: 1, interactive: false
    }).bindTooltip(
      '<b>' + escapeHtml(cell.cell_name) + '</b><br>' + top.length + ' neighbors',
      { permanent: true, direction: 'top', offset: [0, -10], className: 'nb-label-source' }
    );

    State.neighborLineLayer.addLayer(srcMarker);
    layersByCategory.source.push(srcMarker);

    window.__nbLineLayersByCat = layersByCategory;

    toast(top.length + ' neighbors shown', 'success');
    showNeighborLinesLegend(top.length);
  }

  function showNeighborLinesLegend(count) {
    const byCat = window.__nbLineLayersByCat || { front: [], side: [], back: [], source: [] };

    if (typeof ToolLegend === 'undefined') return;

    const onToggle = () => {
      if (!State.map) return;
      ['front', 'side', 'back', 'source'].forEach(cat => {
        const layers = byCat[cat] || [];
        const isActive = ToolLegend.isActive(cat);
        layers.forEach(l => {
          try {
            if (isActive) { if (!State.map.hasLayer(l)) State.map.addLayer(l); }
            else { if (State.map.hasLayer(l)) State.map.removeLayer(l); }
          } catch (e) {}
        });
      });
    };

    ToolLegend.show({
      icon: '🗺️',
      title: 'Neighbor Lines · ' + (count || 0),
      items: [
        { id: 'source', color: '#124191', label: 'Source Cell', count: 1 },
        { id: 'front', color: '#16A34A', label: 'Front', count: byCat.front.length / 2 },
        { id: 'side', color: '#F59E0B', label: 'Side', count: byCat.side.length / 2, dashed: true },
        { id: 'back', color: '#94A3B8', label: 'Back', count: byCat.back.length / 2, dashed: true }
      ],
      onToggle: onToggle
    });
  }

  function hideNeighborLinesLegend() {
    const legend = document.getElementById('nbLinesLegend');
    if (legend) legend.style.display = 'none';
    if (typeof ToolLegend !== 'undefined') ToolLegend.hide();
  }

  window.toggleNeighborLines = toggleNeighborLines;
  window.drawNeighborLines = drawNeighborLines;
  window.hideNeighborLinesLegend = hideNeighborLinesLegend;

  console.log('✅ Map neighbor lines loaded');
})();
