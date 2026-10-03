/* =========================================================
   🗺️ MAP FILTERS — Apply Filters + Search + Chips
   ========================================================= */
(function() {
  'use strict';

  const debouncedApplyFilters = debounce(applyFilters, 200);

  function applyFilters() {
    const searchEl = document.getElementById('searchFilter');
    if (!searchEl) return;

    const search = (searchEl.value || '').toLowerCase().trim();
    const pciEl = document.getElementById('pciFilter');
    const pciQuery = pciEl ? (pciEl.value || '').trim() : '';

    const gsmEl = document.getElementById('filterGSM');
    const lteEl = document.getElementById('filterLTE');
    const g3El = document.getElementById('filter3G');

    const showGSM = !gsmEl || gsmEl.checked;
    const showLTE = !lteEl || lteEl.checked;
    const show3G = !g3El || g3El.checked;

    State.visibleCells = State.allCells.filter(function(c) {
      if (!/[A-Z]$/.test(c.cell_name)) return false;
      if (c.tech === 'GSM' && !showGSM) return false;
      if (c.tech === 'LTE' && !showLTE) return false;
      if (c.tech === '3G' && !show3G) return false;

      if (search) {
        const hay = (c.cell_name + ' ' + c.site + ' ' + (c.pci != null ? c.pci : '') + ' ' + c.cell_id).toLowerCase();
        if (hay.indexOf(search) === -1) return false;
      }
      if (pciQuery && String(c.pci) !== pciQuery) return false;
      return true;
    });

    renderMap();
    const statVisible = document.getElementById('statVisible');
    if (statVisible) statVisible.textContent = State.visibleCells.length;
  }

  function clearFilters() {
    const s = document.getElementById('searchFilter');
    if (s) s.value = '';
    const p = document.getElementById('pciFilter');
    if (p) p.value = '';
    const f = document.getElementById('findByField');
    if (f) f.value = '';
    const v = document.getElementById('findByValue');
    if (v) v.value = '';
    const b = document.getElementById('clearFieldSearchBtn');
    if (b) b.remove();

    window.__gsmMode = false;
    window.__nbMode = false;
    applyFilters();
    toast('Filters cleared', 'info');
  }

  function applyQuickChip(filter) {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    const chip = document.querySelector('.chip[data-filter="' + filter + '"]');
    if (chip) chip.classList.add('active');

    window.__gsmMode = false;
    window.__nbMode = false;

    const chkGSM = document.getElementById('filterGSM');
    const chk3G = document.getElementById('filter3G');
    const chkLTE = document.getElementById('filterLTE');

    if (filter === 'all') {
      if (chkGSM) chkGSM.checked = true;
      if (chk3G) chk3G.checked = true;
      if (chkLTE) chkLTE.checked = true;
      applyFilters();
    } else if (filter === 'gsm') {
      if (chkGSM) chkGSM.checked = true;
      if (chk3G) chk3G.checked = false;
      if (chkLTE) chkLTE.checked = false;
      applyFilters();
    } else if (filter === 'threeg') {
      if (chkGSM) chkGSM.checked = false;
      if (chk3G) chk3G.checked = true;
      if (chkLTE) chkLTE.checked = false;
      applyFilters();
    } else if (filter === 'lte') {
      if (chkGSM) chkGSM.checked = false;
      if (chk3G) chk3G.checked = false;
      if (chkLTE) chkLTE.checked = true;
      applyFilters();
    } else if (filter === 'b900' || filter === 'b1800' || filter === 'b2100') {
      const targetBand = filter.replace('b', '');

      State.visibleCells = State.allCells.filter(c => {
        if (!/[A-Z]$/.test(c.cell_name)) return false;
        if (c.gsmBand !== targetBand) return false;
        if (targetBand === '1800' && c.tech !== 'GSM') return false;
        if (targetBand === '2100' && c.tech !== '3G') return false;
        return true;
      });

      renderMap();
      const statVisible = document.getElementById('statVisible');
      if (statVisible) statVisible.textContent = State.visibleCells.length;

      if (State.visibleCells.length) {
        const bounds = L.latLngBounds(State.visibleCells.map(c => [c.lat, c.long]));
        State.map.fitBounds(bounds, { padding: [50, 50] });
      } else {
        toast('No cells in band ' + targetBand + ' MHz', 'error', 3000);
      }
    }

    toast('Filter: ' + filter, 'info', 2000);
  }

  function findCellByField() {
    const field = document.getElementById('findByField')?.value;
    const value = (document.getElementById('findByValue')?.value || '').trim();

    if (!field) { toast('Select field first', 'error'); return; }
    if (!value) { clearFieldSearch(); return; }

    const FIELD_TECH = {
      bcch: 'GSM', tch: 'GSM', bsic: 'GSM', lac: 'GSM', hsn: 'GSM',
      psc: '3G', uarfcn_dl: '3G', uarfcn_ul: '3G', rnc_id: '3G',
      pci: 'LTE', rsi: 'LTE'
    };

    const expectedTech = FIELD_TECH[field] || null;
    const valLower = value.toLowerCase();

    const matches = State.allCells.filter(c => {
      if (expectedTech && c.tech !== expectedTech) return false;
      const v = c[field];
      if (v == null || v === '') return false;
      const vStr = String(v).trim();
      return vStr === value || vStr.toLowerCase() === valLower;
    });

    if (!matches.length) {
      const techName = expectedTech ? ' (' + expectedTech + ')' : '';
      toast('No cell with ' + field.toUpperCase() + ' = ' + value + techName, 'error', 5000);
      State.visibleCells = [];
      window.__gsmMode = false;
      window.__nbMode = false;
      switchView('map');
      renderMap();
      const statVisible = document.getElementById('statVisible');
      if (statVisible) statVisible.textContent = '0';
      return;
    }

    window.__gsmMode = false;
    window.__nbMode = false;
    State.visibleCells = matches;
    switchView('map');

    setTimeout(() => {
      renderMap();

      if (matches.length === 1) {
        State.map.flyTo([matches[0].lat, matches[0].long], 16, { duration: 1 });
        setTimeout(() => {
          if (typeof showSiteInfo === 'function') showSiteInfo(matches[0]);
        }, 1200);
      } else {
        const bounds = L.latLngBounds(matches.map(c => [c.lat, c.long]));
        State.map.fitBounds(bounds, { padding: [60, 60] });
      }

      const statVisible = document.getElementById('statVisible');
      if (statVisible) statVisible.textContent = matches.length;

      toast(matches.length + ' cells with ' + field.toUpperCase() + ' = ' + value, 'success', 6000);
    }, 200);

    showSearchClearButton();
  }

  function showSearchClearButton() {
    let btn = document.getElementById('clearFieldSearchBtn');
    if (btn) return;

    btn = document.createElement('button');
    btn.id = 'clearFieldSearchBtn';
    btn.className = 'btn btn-ghost';
    btn.style.cssText = 'width:100%;justify-content:center;margin-top:8px;background:#FCEAEA;color:#D64545;border-color:#F5D5D5;';
    btn.textContent = 'Clear Field Search';
    btn.onclick = clearFieldSearch;

    const findGroup = document.getElementById('findByValue')?.parentElement?.parentElement;
    if (findGroup) findGroup.appendChild(btn);
  }

  function clearFieldSearch() {
    const f = document.getElementById('findByField');
    const v = document.getElementById('findByValue');
    if (f) f.value = '';
    if (v) v.value = '';

    const btn = document.getElementById('clearFieldSearchBtn');
    if (btn) btn.remove();

    applyFilters();
    toast('Search cleared', 'info');
  }

  window.applyFilters = applyFilters;
  window.debouncedApplyFilters = debouncedApplyFilters;
  window.clearFilters = clearFilters;
  window.applyQuickChip = applyQuickChip;
  window.findCellByField = findCellByField;
  window.clearFieldSearch = clearFieldSearch;

  console.log('✅ Map filters loaded');
})();
