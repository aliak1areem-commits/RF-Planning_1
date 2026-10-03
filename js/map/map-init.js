/* =========================================================
   🗺️ MAP INIT — Initialize Leaflet + Draw Tools + Layers
   ========================================================= */
(function() {
  'use strict';

  function initMap() {
    if (typeof L === 'undefined') {
      console.error('❌ Leaflet not loaded');
      return;
    }

    State.map = L.map('map', {
      center: [33.3, 44.4],
      zoom: 8,
      minZoom: 5,
      maxZoom: 18,
      zoomControl: true,
      zoomSnap: 0.5,
      zoomDelta: 1,
      wheelPxPerZoomLevel: 120,
      renderer: L.canvas({ padding: 0.5 }),
      updateWhenZooming: false,
      updateWhenIdle: true,
      keepBuffer: 2
    });

    State.canvasRenderer = State.map.options.renderer;

    // Basemaps
    State.basemaps.street = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { maxZoom: 19, attribution: '© OpenStreetMap' }
    );

    State.basemaps.satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: '© Esri' }
    );

    State.basemaps.terrain = L.tileLayer(
      'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      { maxZoom: 17, attribution: '© OpenTopoMap' }
    );

    State.basemaps.street.addTo(State.map);

    // Layers
    State.sectorLayer = L.layerGroup().addTo(State.map);
    State.labelLayer = L.layerGroup().addTo(State.map);
    State.coverageLayer = L.layerGroup();
    State.neighborLineLayer = L.layerGroup().addTo(State.map);

    // Scale
    L.control.scale({ imperial: false, position: 'bottomright' }).addTo(State.map);

    // Draw tools
    setupDrawTools();

    // Zoom optimizations
    setupZoomOptimizations();

    // Reverse geocoding
    setupReverseGeocoding();

    // Basemap switcher
    setupBasemapSwitcher();

    console.log('✅ Map initialized');
  }

  function setupDrawTools() {
    const drawnItems = new L.FeatureGroup();
    State.map.addLayer(drawnItems);
    State.drawnItems = drawnItems;

    const drawControl = new L.Control.Draw({
      position: 'topleft',
      draw: {
        polyline: {
          shapeOptions: { color: '#F2A900', weight: 3 },
          metric: true, feet: false, showLength: true
        },
        polygon: {
          allowIntersection: false,
          showArea: false,
          shapeOptions: { color: '#124191', fillOpacity: 0.15, weight: 2 }
        },
        rectangle: false, circle: false, circlemarker: false, marker: false
      },
      edit: { featureGroup: drawnItems, remove: true }
    });
    State.map.addControl(drawControl);

    window.__lastPolygonCells = [];

    State.map.on(L.Draw.Event.CREATED, function(e) {
      drawnItems.addLayer(e.layer);

      if (e.layerType === 'polyline') {
        const latlngs = e.layer.getLatLngs();
        if (latlngs.length < 2) return;
        const p1 = latlngs[0];
        const p2 = latlngs[latlngs.length - 1];
        const dist = haversineDistance(p1.lat, p1.lng, p2.lat, p2.lng);
        const bearing = calculateBearing(p1.lat, p1.lng, p2.lat, p2.lng);
        const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
        const dir = dirs[Math.round(bearing / 22.5) % 16];

        e.layer.bindTooltip(
          dist.toFixed(0) + ' m · ' + (dist / 1000).toFixed(2) + ' km<br>' +
          bearing.toFixed(1) + '° (' + dir + ')',
          { permanent: true, direction: 'center', className: 'nb-label' }
        ).openTooltip();

        toast(dist.toFixed(0) + ' m · ' + bearing.toFixed(1) + '°', 'success', 4000);
      }

      if (e.layerType === 'polygon') {
        const ring = e.layer.getLatLngs()[0];
        const inside = (lat, lng) => {
          let r = false;
          for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const yi = ring[i].lat, xi = ring[i].lng, yj = ring[j].lat, xj = ring[j].lng;
            if ((yi > lat) !== (yj > lat) &&
                lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) r = !r;
          }
          return r;
        };
        const cellsInside = State.allCells.filter(c => c.lat && c.long && inside(c.lat, c.long));
        window.__lastPolygonCells = cellsInside;
        toast(cellsInside.length + ' cells inside polygon — click "Copy Polygon Cells"', 'success', 5000);
      }
    });
  }

  function setupZoomOptimizations() {
    let zoomTimer = null;
    let moveTimer = null;
    let isRendering = false;

    State.map.on('zoomstart movestart', function() {
      if (window.__gsmMode || window.__nbMode) return;
      if (State.sectorLayer) State.sectorLayer.clearLayers();
      if (State.labelLayer) State.labelLayer.clearLayers();
    });

    State.map.on('zoomend', function() {
      if (zoomTimer) clearTimeout(zoomTimer);
      zoomTimer = setTimeout(function() {
        if (window.__gsmMode || window.__nbMode) return;
        if (State.visibleCells.length && !isRendering) {
          isRendering = true;
          try { renderMap(); } finally { isRendering = false; }
        }
      }, 400);
    });

    State.map.on('moveend', function() {
      if (moveTimer) clearTimeout(moveTimer);
      moveTimer = setTimeout(function() {
        if (window.__gsmMode || window.__nbMode) return;
        if (State.visibleCells.length && !isRendering) {
          isRendering = true;
          try { renderMap(); } finally { isRendering = false; }
        }
      }, 400);
    });
  }

  function setupReverseGeocoding() {
    State.map.on('contextmenu', function(e) {
      const lat = e.latlng.lat.toFixed(6);
      const lon = e.latlng.lng.toFixed(6);

      const url = 'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lon + '&zoom=14&accept-language=ar,en';

      toast('Searching...', 'info', 2000);

      fetch(url)
        .then(r => r.json())
        .then(data => {
          const addr = escapeHtml(data.display_name || 'Unknown location');
          const short = escapeHtml(data.address ?
            (data.address.city || data.address.town || data.address.village || data.address.state || '') +
            (data.address.country ? ', ' + data.address.country : '') : '');

          L.popup()
            .setLatLng(e.latlng)
            .setContent(
              '<div style="font-family:Inter,sans-serif;font-size:12.5px;min-width:220px;">' +
                '<div style="font-weight:800;color:#0C1B3D;margin-bottom:6px;">' + (short || 'Location') + '</div>' +
                '<div style="color:#5A6B87;font-size:11.5px;margin-bottom:6px;line-height:1.4;">' + addr + '</div>' +
                '<div style="font-family:monospace;font-size:11px;color:#124191;">' + lat + ', ' + lon + '</div>' +
              '</div>'
            )
            .openOn(State.map);
        })
        .catch(() => toast('Connection failed', 'error'));
    });
  }

  function setupBasemapSwitcher() {
    document.querySelectorAll('.basemap-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.basemap-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const name = btn.dataset.basemap;
        Object.keys(State.basemaps).forEach(k => State.map.removeLayer(State.basemaps[k]));
        State.basemaps[name].addTo(State.map);
      });
    });
  }

  function copyPolygonCells() {
    if (!window.__lastPolygonCells || !window.__lastPolygonCells.length) {
      toast('Draw a polygon first', 'error');
      return;
    }

    const rows = [['Cell', 'Site', 'Tech', 'PCI', 'BCCH', 'BSIC', 'HSN', 'Bore', 'Lat', 'Long', 'Comment']];
    window.__lastPolygonCells.forEach(c => {
      rows.push([
        c.cell_name, c.site, c.tech, c.pci || '', c.bcch || '',
        c.bsic || '', c.hsn != null ? c.hsn : '', c.bore, c.lat, c.long, c.comment || ''
      ]);
    });

    const tsv = rows.map(r => r.join('\t')).join('\n');
    navigator.clipboard.writeText(tsv).then(() => {
      toast('Copied ' + window.__lastPolygonCells.length + ' cells — paste in Excel', 'success', 5000);
    }).catch(() => {
      downloadCSV('Polygon_Cells_' + new Date().toISOString().slice(0, 10) + '.csv', rows);
      toast('CSV downloaded', 'success');
    });
  }

  function clearDrawings() {
    if (State.drawnItems) State.drawnItems.clearLayers();
    window.__lastPolygonCells = [];
    toast('Drawings cleared', 'info');
  }

  window.initMap = initMap;
  window.copyPolygonCells = copyPolygonCells;
  window.clearDrawings = clearDrawings;

  console.log('✅ Map init loaded');
})();
