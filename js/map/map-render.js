/* =========================================================
   🗺️ MAP RENDER — Sectors + Labels + Site Circles
   ========================================================= */
(function() {
  'use strict';

  function getLayerPriority(cell) {
    const isGSM = cell.tech === 'GSM';
    const isLTE = cell.tech === 'LTE';
    const is3G = cell.tech === '3G';

    if (isGSM && cell.gsmBand === '900') return 1;
    if (isGSM && cell.gsmBand === '1800') return 2;
    if (is3G && cell.gsmBand === '900') return 3;
    if (is3G && cell.gsmBand === '2100') return 4;
    if (isLTE) return 5;
    return 6;
  }

  function makeSectorCoords(lat, lng, azimuth) {
    return makeSectorCoordsScaled(lat, lng, azimuth, 1.0, null, 15);
  }

  function makeSectorCoordsScaled(lat, lng, azimuth, scale, _band, zoomOverride) {
    const zoom = zoomOverride || (State.map ? State.map.getZoom() : 15);

    let radius_m, half_width_m;
    if (zoom >= 16) { radius_m = 150; half_width_m = 45; }
    else if (zoom >= 14) { radius_m = 350; half_width_m = 100; }
    else if (zoom >= 12) { radius_m = 800; half_width_m = 230; }
    else if (zoom >= 11) { radius_m = 1200; half_width_m = 350; }
    else { radius_m = 2000; half_width_m = 570; }

    radius_m *= scale;
    half_width_m *= scale;

    const near_d = radius_m * 0.04;
    const far_d = radius_m;
    const near_w = half_width_m * 0.30;
    const far_w = half_width_m;

    function pt(fwd_m, right_m) {
      const distance = Math.sqrt(fwd_m * fwd_m + right_m * right_m);
      const offsetAngle = Math.atan2(right_m, fwd_m) * 180 / Math.PI;
      return destinationPoint(lat, lng, azimuth + offsetAngle, distance);
    }

    return [pt(0, 0), pt(near_d, -near_w), pt(far_d, -far_w), pt(far_d, far_w), pt(near_d, near_w)];
  }

  function renderMap() {
    if (!State.map) return;
    if (window.__gsmMode) return;
    if (window.__nbMode) return;

    if (!State.sectorLayer || !State.labelLayer || !State.coverageLayer) return;

    State.sectorLayer.clearLayers();
    State.labelLayer.clearLayers();
    State.coverageLayer.clearLayers();

    const showSectors = document.getElementById('showSectors')?.checked;
    const showLabels = document.getElementById('showLabels')?.checked;
    const showSiteCircle = document.getElementById('showSiteCircle')?.checked;
    const labelMode = document.getElementById('labelMode')?.value || 'name';

    const zoom = State.map.getZoom();
    const viewportBounds = State.map.getBounds().pad(0.1);

    // Site circles at low zoom
    if (showSiteCircle && zoom < 11) {
      const sites = {};
      State.visibleCells.forEach(cell => {
        if (!cell.lat || !cell.long) return;
        if (!sites[cell.site]) {
          sites[cell.site] = { lat: cell.lat, long: cell.long, cells: [], region: cell.region };
        }
        sites[cell.site].cells.push(cell);
      });

      Object.entries(sites).forEach(([siteName, info]) => {
        const count = info.cells.length;
        const circle = L.circleMarker([info.lat, info.long], {
          radius: 7 + Math.min(count, 5),
          color: '#fff', weight: 2.5,
          fillColor: CELL_COLOR, fillOpacity: 0.9,
          interactive: true
        });
        circle.bindPopup(
          '<div style="font-family:Inter,sans-serif;font-size:12.5px;min-width:200px;">' +
            '<div style="font-weight:800;font-size:14px;font-family:monospace;margin-bottom:8px;color:#0C1B3D;">' +
              escapeHtml(siteName) +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;padding:4px 0;">' +
              '<span style="color:#5A6B87;">Cells:</span><b>' + count + '</b>' +
            '</div>' +
          '</div>'
        );
        State.sectorLayer.addLayer(circle);
      });
      return;
    }

    // Site circles at medium zoom
    const SHOW_SECTORS_MIN_ZOOM = 14;
    if (zoom < SHOW_SECTORS_MIN_ZOOM) {
      const sites = {};
      State.visibleCells.forEach(cell => {
        if (!cell.lat || !cell.long) return;
        const key = cell.site;
        if (!sites[key]) sites[key] = { lat: cell.lat, long: cell.long, gsm: 0, g3: 0, lte: 0 };
        if (cell.tech === 'GSM') sites[key].gsm++;
        else if (cell.tech === '3G') sites[key].g3++;
        else if (cell.tech === 'LTE') sites[key].lte++;
      });

      Object.entries(sites).forEach(([siteName, info]) => {
        const kinds = (info.gsm ? 1 : 0) + (info.g3 ? 1 : 0) + (info.lte ? 1 : 0);
        const color = kinds > 1 ? '#7C3AED' :
                      info.gsm ? '#D97706' :
                      info.g3 ? '#14B8A6' :
                      info.lte ? '#124191' : '#94A3B8';
        const total = info.gsm + info.g3 + info.lte;

        const circle = L.circleMarker([info.lat, info.long], {
          radius: 6 + Math.min(total / 3, 6),
          color: '#fff', weight: 2,
          fillColor: color, fillOpacity: 0.85,
          interactive: true
        });
        circle.bindPopup(
          '<div style="font-family:Inter,sans-serif;font-size:12.5px;min-width:180px;">' +
            '<div style="font-weight:800;font-size:14px;font-family:monospace;margin-bottom:8px;color:#0C1B3D;">' +
              escapeHtml(siteName) +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;padding:4px 0;">' +
              '<span style="color:#D97706;">GSM:</span><b>' + info.gsm + '</b>' +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;padding:4px 0;">' +
              '<span style="color:#14B8A6;">3G:</span><b>' + info.g3 + '</b>' +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;padding:4px 0;">' +
              '<span style="color:#124191;">LTE:</span><b>' + info.lte + '</b>' +
            '</div>' +
          '</div>'
        );
        State.sectorLayer.addLayer(circle);
      });
      return;
    }

    // Sectors (zoom >= 14)
    const sortedCells = State.visibleCells.slice().sort((a, b) =>
      getLayerPriority(a) - getLayerPriority(b));

    sortedCells.forEach(cell => {
      if (!cell.lat || !cell.long) return;
      if (!viewportBounds.contains([cell.lat, cell.long])) return;
      const center = [cell.lat, cell.long];

      if (showSectors) {
        const isGSM = cell.tech === 'GSM';
        const isLTE = cell.tech === 'LTE';
        const is3G = cell.tech === '3G';

        if (isLTE && zoom < 16) return;
        if (is3G && zoom < 13) return;

        let cellColor, fillOpacity, weight, scale;

        if (isGSM) {
          if (cell.gsmBand === '900') {
            cellColor = '#D97706'; fillOpacity = 0.55; weight = 1.8; scale = 1.00;
          } else if (cell.gsmBand === '1800') {
            cellColor = '#7C3AED'; fillOpacity = 0.75; weight = 1.5; scale = 0.78;
          } else {
            cellColor = '#9CA3AF'; fillOpacity = 0.55; weight = 1.2; scale = 0.70;
          }
        } else if (is3G) {
          if (cell.gsmBand === '900') {
            cellColor = '#14B8A6'; fillOpacity = 0.80; weight = 2.0; scale = 0.58;
          } else if (cell.gsmBand === '2100') {
            cellColor = '#0D9488'; fillOpacity = 0.88; weight = 2.0; scale = 0.42;
          } else {
            cellColor = '#5EEAD4'; fillOpacity = 0.6; weight = 1.2; scale = 0.55;
          }
        } else if (isLTE) {
          cellColor = '#124191'; fillOpacity = 0.92; weight = 2.0; scale = 0.30;
        } else {
          cellColor = cell.color; fillOpacity = 0.65; weight = 0.8; scale = 1.0;
        }

        const coords = makeSectorCoordsScaled(cell.lat, cell.long, cell.bore, scale);
        const polygon = L.polygon(coords, {
          color: cellColor, weight: weight, opacity: 1,
          fillColor: cellColor, fillOpacity: fillOpacity,
          interactive: true, lineJoin: 'round'
        });

        polygon.cellData = cell;

        polygon.on('contextmenu', function(e) {
          L.DomEvent.stopPropagation(e);
          e.originalEvent.preventDefault();
          if (typeof showCellContextMenu === 'function') {
            showCellContextMenu(cell, e);
          }
        });

        polygon.on('click', function(e) {
          if (State.multiSelectMode) {
            if (typeof toggleCellSelection === 'function') {
              toggleCellSelection(cell, this);
            }
          } else {
            if (typeof showSiteInfo === 'function') showSiteInfo(cell);
            if (State.neighborLinesActive && typeof drawNeighborLines === 'function') {
              drawNeighborLines(cell);
            }
          }
        });

        polygon.on('mouseover', function() {
          this.setStyle({ fillOpacity: 0.85, weight: 2 });
          if (!State.multiSelectMode) {
            this.bindTooltip(escapeHtml(cell.cell_name), { sticky: true }).openTooltip();
          }
        });

        polygon.on('mouseout', function() {
          this.setStyle({ fillOpacity: fillOpacity, weight: weight });
          this.closeTooltip();
        });

        State.sectorLayer.addLayer(polygon);

        // Comment icon
        if (cell.comment && zoom >= 13) {
          const commentIcon = L.marker(center, {
            icon: L.divIcon({
              className: 'comment-icon',
              html: '<div style="background:#F2A900;color:#fff;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;box-shadow:0 2px 6px rgba(0,0,0,.3);border:2px solid #fff;">!</div>',
              iconSize: [18, 18],
              iconAnchor: [9, 9]
            }),
            interactive: true
          });
          commentIcon.on('click', function(e) {
            e.originalEvent.stopPropagation();
            if (typeof showSiteInfo === 'function') showSiteInfo(cell);
          });
          State.labelLayer.addLayer(commentIcon);
        }
      }

      // Labels
      if (showLabels && zoom >= 13) {
        let labelText = '';
        let labelColor = cell.color;

        if (labelMode === 'name') labelText = cell.cell_name;
        else if (labelMode === 'pci') { labelText = 'PCI ' + (cell.pci != null ? cell.pci : '—'); labelColor = '#0C1B3D'; }
        else if (labelMode === 'both') labelText = cell.cell_name + ' · ' + cell.pci;
        else if (labelMode === 'site') { labelText = cell.site; labelColor = '#124191'; }
        else return;

        const label = L.marker(center, {
          icon: L.divIcon({
            className: 'cell-label',
            html: '<div style="background:' + labelColor + ';color:#fff;padding:2px 7px;border-radius:10px;font-family:\'JetBrains Mono\',monospace;font-size:9.5px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.3);border:1.5px solid #fff;">' +
              escapeHtml(labelText) + '</div>',
            iconSize: null,
            iconAnchor: [-6, 12]
          }),
          interactive: false
        });
        State.labelLayer.addLayer(label);
      }
    });

    if (typeof updateMiniStats === 'function') updateMiniStats();
  }

  function fitAllCells() {
    window.__gsmMode = false;
    if (!State.visibleCells.length) { toast('No cells to fit', 'error'); return; }
    const bounds = L.latLngBounds(State.visibleCells.map(c => [c.lat, c.long]));
    State.map.fitBounds(bounds, { padding: [50, 50] });
  }

  function toggleLayer(type) {
    renderMap();
  }

  function updateMiniStats() {
    const el = document.getElementById('miniStats');
    if (!el) return;
    const visible = State.visibleCells.length;
    const total = State.allCells.length;
    const sites = new Set(State.visibleCells.map(c => c.cell_name.replace(/[A-Z]$/, ''))).size;

    el.innerHTML =
      '<span>Visible: <b>' + visible + '</b></span>' +
      '<span>Sites: <b>' + sites + '</b></span>' +
      '<span>Total: <b>' + total + '</b></span>';
  }

  function resetMapView() {
    document.querySelector('.main').classList.remove('split');
    window.__gsmMode = false;
    window.__nbMode = false;
    State.currentView = 'map';

    if (State.sectorLayer) State.sectorLayer.clearLayers();
    if (State.labelLayer) State.labelLayer.clearLayers();
    if (State.neighborLineLayer) State.neighborLineLayer.clearLayers();
    if (State.coverageLayer) State.coverageLayer.clearLayers();

    if (typeof nbMapLayers !== 'undefined' && nbMapLayers.length) {
      nbMapLayers.forEach(l => { try { State.map.removeLayer(l); } catch (e) {} });
      window.nbMapLayers = [];
    }
    if (typeof threeGMapLayers !== 'undefined' && threeGMapLayers.length) {
      threeGMapLayers.forEach(l => { try { State.map.removeLayer(l); } catch (e) {} });
      window.threeGMapLayers = [];
    }
    if (typeof symMapLayers !== 'undefined' && symMapLayers.length) {
      symMapLayers.forEach(l => { try { State.map.removeLayer(l); } catch (e) {} });
      window.symMapLayers = [];
    }
    if (typeof azoptMapLayers !== 'undefined' && azoptMapLayers.length) {
      azoptMapLayers.forEach(l => { try { State.map.removeLayer(l); } catch (e) {} });
      window.azoptMapLayers = [];
    }

    ['nbLegend', 'nbLinesLegend', 'pscLegend', 'hsnLegend', 'bsicLegend', 'azoptLegend'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    if (typeof ToolLegend !== 'undefined') ToolLegend.hide();

    if (typeof nbCurrentSource !== 'undefined') window.nbCurrentSource = null;
    if (typeof nbCurrentNeighbors !== 'undefined') window.nbCurrentNeighbors = [];
    if (typeof threeGNbCurrent !== 'undefined') window.threeGNbCurrent = null;

    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    const mapBtn = document.querySelector('[data-page="map"]');
    if (mapBtn) mapBtn.classList.add('active');

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const mapPage = document.getElementById('page-map');
    if (mapPage) mapPage.classList.add('active');

    const iconEl = document.getElementById('pageIcon');
    const titleEl = document.getElementById('pageTitle');
    const subEl = document.getElementById('pageSubtitle');
    if (iconEl) iconEl.textContent = '🗺️';
    if (titleEl) titleEl.textContent = 'Cell Map';
    if (subEl) subEl.textContent = 'Visualize cells on the map';

    if (State.map) setTimeout(() => State.map.invalidateSize(), 100);

    applyFilters();
    toast('Cells re-displayed', 'success');
  }

  window.renderMap = renderMap;
  window.fitAllCells = fitAllCells;
  window.toggleLayer = toggleLayer;
  window.updateMiniStats = updateMiniStats;
  window.resetMapView = resetMapView;
  window.makeSectorCoords = makeSectorCoords;
  window.makeSectorCoordsScaled = makeSectorCoordsScaled;
  window.getLayerPriority = getLayerPriority;

  console.log('✅ Map render loaded');
})();
