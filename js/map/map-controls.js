/* =========================================================
   🗺️ MAP CONTROLS — Screenshot + Goto + Bookmarks + Reset
   ========================================================= */
(function() {
  'use strict';

  // ═══ Goto Coordinates ═══
  function toggleGotoCoords() {
    const panel = document.getElementById('gotoPanel');
    if (panel) panel.classList.toggle('show');
  }

  function gotoCoordinates() {
    const lat = parseFloat(document.getElementById('gotoLat')?.value);
    const lon = parseFloat(document.getElementById('gotoLon')?.value);

    if (isNaN(lat) || isNaN(lon)) {
      toast('Invalid coordinates', 'error');
      return;
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      toast('Out of allowed range', 'error');
      return;
    }

    State.map.flyTo([lat, lon], 15, { duration: 1.2 });
    const panel = document.getElementById('gotoPanel');
    if (panel) panel.classList.remove('show');
    toast(lat.toFixed(4) + ', ' + lon.toFixed(4), 'success');
  }

  // ═══ Screenshot ═══
  function takeMapScreenshot() {
    toast('Preparing image...', 'info', 2000);

    if (typeof html2canvas === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      script.onload = () => captureMap();
      document.head.appendChild(script);
    } else {
      captureMap();
    }
  }

  function captureMap() {
    const mapContainer = document.querySelector('.map-container');
    if (!mapContainer) return;

    html2canvas(mapContainer, {
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#F4F7FB',
      scale: 1.5,
      width: mapContainer.offsetWidth,
      height: mapContainer.offsetHeight,
      ignoreElements: (el) => {
        return el.classList && (
          el.classList.contains('map-sidebar') ||
          el.classList.contains('map-toolbar') ||
          el.classList.contains('map-controls') ||
          el.classList.contains('screenshot-btn') ||
          el.classList.contains('map-mini-stats') ||
          el.classList.contains('tool-legend')
        );
      }
    }).then(canvas => {
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'RF_Map_' + new Date().toISOString().slice(0, 19).replace(/:/g, '-') + '.png';
        a.click();
        URL.revokeObjectURL(url);
        toast('Image saved', 'success', 3000);
      }, 'image/png');
    }).catch(err => {
      console.error(err);
      toast('Screenshot failed — try again', 'error');
    });
  }

  // ═══ Map Sidebar Toggle ═══
  function toggleMapSidebar() {
    const sb = document.getElementById('mapSidebar');
    if (!sb) return;
    sb.classList.toggle('collapsed');

    const collapsed = sb.classList.contains('collapsed');
    const legend = document.getElementById('legend');
    if (legend) legend.style.left = collapsed ? '20px' : '340px';

    setTimeout(() => {
      if (State.map) State.map.invalidateSize();
    }, 300);
  }

  window.toggleGotoCoords = toggleGotoCoords;
  window.gotoCoordinates = gotoCoordinates;
  window.takeMapScreenshot = takeMapScreenshot;
  window.toggleMapSidebar = toggleMapSidebar;

  console.log('✅ Map controls loaded');
})();
