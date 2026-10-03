/* =========================================================
   🗺️ MAP SEARCH — Fly to Cell by Name/Site/PCI
   ========================================================= */
(function() {
  'use strict';

  function mapSearchFly() {
    const input = document.getElementById('mapSearchInput');
    if (!input) return;

    const query = input.value.trim().toLowerCase();
    if (!query) return;

    const match = State.allCells.find(c =>
      c.cell_name.toLowerCase() === query ||
      c.cell_name.toLowerCase().includes(query) ||
      c.site.toLowerCase() === query ||
      String(c.pci) === query
    );

    if (!match) {
      toast('Not found "' + query + '"', 'error', 3000);
      return;
    }

    window.__gsmMode = false;
    window.__nbMode = false;
    State.map.flyTo([match.lat, match.long], 16, { duration: 1.2 });

    setTimeout(() => {
      renderMap();
      if (typeof showSiteInfo === 'function') showSiteInfo(match);
    }, 1300);

    toast(match.cell_name, 'success', 3000);
  }

  function searchAndFly() {
    const query = (document.getElementById('searchFilter')?.value || '').trim().toLowerCase();
    if (!query) { toast('Enter search text', 'error'); return; }

    const match = State.allCells.find(c =>
      c.cell_name.toLowerCase() === query ||
      c.cell_name.toLowerCase().includes(query) ||
      String(c.pci) === query
    );

    if (!match) { toast('No match for "' + query + '"', 'error'); return; }

    window.__gsmMode = false;
    window.__nbMode = false;
    State.map.flyTo([match.lat, match.long], 16, { duration: 1.5 });

    setTimeout(() => {
      renderMap();
      if (typeof showSiteInfo === 'function') showSiteInfo(match);
    }, 1600);

    toast('Flying to ' + match.cell_name, 'success');
  }

  window.mapSearchFly = mapSearchFly;
  window.searchAndFly = searchAndFly;

  console.log('✅ Map search loaded');
})();
