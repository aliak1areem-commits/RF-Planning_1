/* =========================================================
   📋 CELLS PAGE — Database with filters, sort, export
   ========================================================= */
(function() {
  'use strict';

  const CELLS_ALL_COLUMNS = [
    { id: 'cell_name', label: 'Cell Name', sortable: true },
    { id: 'site', label: 'Site', sortable: true },
    { id: 'tech', label: 'Tech' },
    { id: 'band', label: 'Band' },
    { id: 'pci', label: 'PCI', sortable: true },
    { id: 'psc', label: 'PSC', sortable: true },
    { id: 'bcch', label: 'BCCH', sortable: true },
    { id: 'bsic', label: 'BSIC' },
    { id: 'hsn', label: 'HSN' },
    { id: 'lac', label: 'LAC' },
    { id: 'rsi', label: 'RSI' },
    { id: 'rnc_id', label: 'RNC' },
    { id: 'uarfcn_dl', label: 'UARFCN' },
    { id: 'bore', label: 'Bore', sortable: true },
    { id: 'lat', label: 'Lat' },
    { id: 'long', label: 'Long' },
    { id: 'comment', label: 'Comment' },
    { id: 'actions', label: 'Actions' }
  ];

  function debounce(fn, delay) {
    let t;
    return function(...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  const debouncedRenderCells = debounce(() => renderCellsPage(1), 250);

  function cellsToggleColumns() {
    const t = document.getElementById('cellsColumnToggler');
    if (!t) return;
    t.style.display = t.style.display === 'none' ? 'block' : 'none';
    if (t.style.display === 'block') renderCellsColumnList();
  }

  function renderCellsColumnList() {
    const list = document.getElementById('cellsColumnList');
    if (!list) return;
    list.innerHTML = CELLS_ALL_COLUMNS.map(col =>
      '<label class="filter-checkbox" style="padding:6px 10px;">' +
        '<input type="checkbox"' + (State.cellsPageState.visibleColumns.includes(col.id) ? ' checked' : '') +
          ' onchange="cellsToggleColumn(\'' + col.id + '\')">' +
        '<span style="font-size:12px;">' + col.label + '</span>' +
      '</label>'
    ).join('');
  }

  function cellsToggleColumn(colId) {
    const arr = State.cellsPageState.visibleColumns;
    const idx = arr.indexOf(colId);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(colId);
    localStorage.setItem('rf_cells_columns', JSON.stringify(arr));
    renderCellsPage(State.cellsPageState.page);
  }

  function cellsRenderTableHead() {
    const head = document.getElementById('cellsTableHead');
    if (!head) return;

    let html = '<th style="width:40px;"><input type="checkbox" onchange="cellsToggleAll(this.checked)" title="Select all"></th>';

    CELLS_ALL_COLUMNS.forEach(col => {
      if (!State.cellsPageState.visibleColumns.includes(col.id)) return;
      if (col.id === 'actions') {
        html += '<th>' + col.label + '</th>';
      } else if (col.sortable) {
        const arrow = State.cellsPageState.sortBy === col.id
          ? (State.cellsPageState.sortAsc ? ' ▲' : ' ▼') : '';
        html += '<th style="cursor:pointer;" onclick="cellsSortBy(\'' + col.id + '\')">' + col.label + arrow + '</th>';
      } else {
        html += '<th>' + col.label + '</th>';
      }
    });

    head.innerHTML = html;
  }

  function cellsToggleAll(checked) {
    const tbody = document.getElementById('cellsTableBody');
    if (!tbody) return;
    tbody.querySelectorAll('input[type="checkbox"][data-cell-id]').forEach(cb => {
      cb.checked = checked;
      const id = parseInt(cb.dataset.cellId);
      if (checked) State.cellsPageState.selectedIds.add(id);
      else State.cellsPageState.selectedIds.delete(id);
    });
    cellsUpdateBulkBar();
  }

  function cellsUpdateBulkBar() {
    const bar = document.getElementById('cellsBulkBar');
    const count = document.getElementById('cellsBulkCount');
    const info = document.getElementById('cellsSelectedInfo');
    const size = State.cellsPageState.selectedIds.size;

    if (bar) bar.style.display = size > 0 ? 'flex' : 'none';
    if (bar) bar.classList.toggle('show', size > 0);
    if (count) count.textContent = size + ' selected';
    if (info) info.textContent = size > 0 ? size + ' selected' : '';
  }

  function cellsClearSelection() {
    State.cellsPageState.selectedIds.clear();
    const tbody = document.getElementById('cellsTableBody');
    if (tbody) {
      tbody.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    }
    cellsUpdateBulkBar();
  }

  function cellsGetFilteredData() {
    const get = id => (document.getElementById(id)?.value || '').trim();
    const search = get('cellsSearch').toLowerCase();
    const tech = document.getElementById('cellsFilterTech')?.value || 'all';
    const region = document.getElementById('cellsFilterRegion')?.value || 'all';
    const siteF = get('cellsFilterSite').toLowerCase();
    const pciF = get('cellsFilterPCI');
    const pscF = get('cellsFilterPSC');
    const bcchF = get('cellsFilterBCCH');
    const bsicF = get('cellsFilterBSIC');
    const hsnF = get('cellsFilterHSN');
    const lacF = get('cellsFilterLAC');
    const rncF = get('cellsFilterRNC');
    const rsiF = get('cellsFilterRSI');

    let filtered = State.allCells.filter(c => /[A-Z]$/.test(c.cell_name));
    if (tech !== 'all') filtered = filtered.filter(c => c.tech === tech);
    if (region !== 'all') filtered = filtered.filter(c => c.region === region);
    if (search) filtered = filtered.filter(c =>
      c.cell_name.toLowerCase().includes(search) ||
      c.site.toLowerCase().includes(search));
    if (siteF) filtered = filtered.filter(c => c.site.toLowerCase().includes(siteF));
    if (pciF) filtered = filtered.filter(c => String(c.pci) === pciF);
    if (pscF) filtered = filtered.filter(c => String(c.psc) === pscF);
    if (bcchF) filtered = filtered.filter(c => String(c.bcch) === bcchF);
    if (bsicF) filtered = filtered.filter(c => String(c.bsic) === bsicF);
    if (hsnF) filtered = filtered.filter(c => String(c.hsn) === hsnF);
    if (lacF) filtered = filtered.filter(c => String(c.lac) === lacF);
    if (rncF) filtered = filtered.filter(c => String(c.rnc_id) === rncF);
    if (rsiF) filtered = filtered.filter(c => String(c.rsi) === rsiF);

    return filtered;
  }

  function renderCellsPage(page) {
    State.cellsPageState.page = page || State.cellsPageState.page;
    populateCellsFilters();

    const filtered = cellsGetFilteredData();

    filtered.sort((a, b) => {
      const k = State.cellsPageState.sortBy;
      let va = a[k], vb = b[k];
      if (typeof va === 'string') { va = va.toLowerCase(); vb = String(vb || '').toLowerCase(); }
      if (va == null) va = '';
      if (vb == null) vb = '';
      if (va < vb) return State.cellsPageState.sortAsc ? -1 : 1;
      if (va > vb) return State.cellsPageState.sortAsc ? 1 : -1;
      return 0;
    });

    const perPage = parseInt(document.getElementById('cellsPerPage')?.value) || 50;
    const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
    if (State.cellsPageState.page > totalPages) State.cellsPageState.page = totalPages;

    const start = (State.cellsPageState.page - 1) * perPage;
    const pageItems = filtered.slice(start, start + perPage);

    const statsEl = document.getElementById('cellsFilterStats');
    if (statsEl) {
      statsEl.innerHTML =
        'Showing <b style="color:#124191;">' + (start + 1) + '–' + Math.min(start + perPage, filtered.length) + '</b> ' +
        'of <b>' + filtered.length + '</b> filtered · Total: <b>' + State.allCells.length + '</b>';
    }

    cellsRenderTableHead();
    const tbody = document.getElementById('cellsTableBody');
    if (!tbody) return;

    if (!pageItems.length) {
      tbody.innerHTML = '<tr><td colspan="20" style="text-align:center;padding:40px;color:#5A6B87;">No cells match your filters</td></tr>';
      renderCellsPagination(totalPages);
      return;
    }

    const techBadge = (t) => {
      const colors = {
        'GSM': '#FDF1DC;color:#8A5A00',
        '3G': '#CCFBF1;color:#0F766E',
        'LTE': '#EAF2FB;color:#124191'
      };
      return '<span style="padding:2px 8px;border-radius:10px;font-size:10.5px;font-weight:700;background:' + (colors[t] || '#F4F7FB;color:#5A6B87') + ';">' + t + '</span>';
    };

    tbody.innerHTML = pageItems.map(c => {
      const checked = State.cellsPageState.selectedIds.has(c.id) ? ' checked' : '';
      let row = '<tr>' +
        '<td><input type="checkbox" data-cell-id="' + c.id + '"' + checked + ' onchange="cellsToggleRow(this)"></td>';

      const v = State.cellsPageState.visibleColumns;

      if (v.includes('cell_name')) row += '<td><b>' + escapeHtml(c.cell_name) + '</b></td>';
      if (v.includes('site')) row += '<td>' + escapeHtml(c.site || '—') + '</td>';
      if (v.includes('tech')) row += '<td>' + techBadge(c.tech) + '</td>';
      if (v.includes('band')) row += '<td>' + (c.gsmBand || '—') + '</td>';
      if (v.includes('pci')) row += '<td style="font-family:monospace;color:' + (c.pci != null ? '#124191' : '#CBD5E1') + ';">' + (c.pci != null ? c.pci : '—') + '</td>';
      if (v.includes('psc')) row += '<td style="font-family:monospace;color:' + (c.psc != null ? '#0F766E' : '#CBD5E1') + ';">' + (c.psc != null ? c.psc : '—') + '</td>';
      if (v.includes('bcch')) row += '<td style="font-family:monospace;color:' + (c.bcch ? '#D97706' : '#CBD5E1') + ';">' + (c.bcch || '—') + '</td>';
      if (v.includes('bsic')) row += '<td style="font-family:monospace;color:' + (c.bsic ? '#7C3AED' : '#CBD5E1') + ';">' + (c.bsic || '—') + '</td>';
      if (v.includes('hsn')) row += '<td style="font-family:monospace;">' + (c.hsn != null ? c.hsn : '—') + '</td>';
      if (v.includes('lac')) row += '<td style="font-family:monospace;">' + (c.lac || '—') + '</td>';
      if (v.includes('rsi')) row += '<td style="font-family:monospace;">' + (c.rsi || '—') + '</td>';
      if (v.includes('rnc_id')) row += '<td style="font-family:monospace;">' + (c.rnc_id || '—') + '</td>';
      if (v.includes('uarfcn_dl')) row += '<td style="font-family:monospace;font-size:11px;">' + (c.uarfcn_dl || '—') + '</td>';
      if (v.includes('bore')) row += '<td>' + (c.bore || 0) + '°</td>';
      if (v.includes('lat')) row += '<td style="font-size:11px;">' + c.lat.toFixed(4) + '</td>';
      if (v.includes('long')) row += '<td style="font-size:11px;">' + c.long.toFixed(4) + '</td>';
      if (v.includes('comment')) {
        row += '<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
          (c.comment ? '<span style="color:#F2A900;font-weight:600;">' + escapeHtml(c.comment.substring(0, 30)) + (c.comment.length > 30 ? '...' : '') + '</span>' : '<span style="color:#CBD5E1;">—</span>') +
        '</td>';
      }
      if (v.includes('actions')) {
        row += '<td><button onclick="event.stopPropagation();flyToCell(' + c.id + ')" style="padding:4px 10px;background:#EAF2FB;color:#124191;border:1px solid #D7DEEA;border-radius:6px;font-size:10.5px;font-weight:600;cursor:pointer;font-family:inherit;">Map</button></td>';
      }
      row += '</tr>';
      return row;
    }).join('');

    renderCellsPagination(totalPages);
    cellsUpdateBulkBar();
  }

  function cellsToggleRow(checkbox) {
    const id = parseInt(checkbox.dataset.cellId);
    if (checkbox.checked) State.cellsPageState.selectedIds.add(id);
    else State.cellsPageState.selectedIds.delete(id);
    cellsUpdateBulkBar();
  }

  function cellsSortBy(key) {
    const s = State.cellsPageState;
    if (s.sortBy === key) s.sortAsc = !s.sortAsc;
    else { s.sortBy = key; s.sortAsc = true; }
    renderCellsPage(1);
  }

  function cellsResetFilters() {
    ['cellsSearch', 'cellsFilterSite', 'cellsFilterPCI', 'cellsFilterPSC', 'cellsFilterBCCH',
     'cellsFilterBSIC', 'cellsFilterHSN', 'cellsFilterLAC', 'cellsFilterRNC', 'cellsFilterRSI'
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const t = document.getElementById('cellsFilterTech');
    const r = document.getElementById('cellsFilterRegion');
    if (t) t.value = 'all';
    if (r) r.value = 'all';
    State.cellsPageState.selectedIds.clear();
    renderCellsPage(1);
    toast('Filters reset', 'info');
  }

  function populateCellsFilters() {
    const regionSel = document.getElementById('cellsFilterRegion');
    if (regionSel && regionSel.options.length <= 1) {
      const regions = [...new Set(State.allCells.map(c => c.region))].sort();
      regionSel.innerHTML = '<option value="all">All Regions</option>' +
        regions.map(r => '<option value="' + r + '">' + r + '</option>').join('');
    }
  }

  function renderCellsPagination(totalPages) {
    const el = document.getElementById('cellsPagination');
    if (!el) return;
    if (totalPages <= 1) { el.innerHTML = ''; return; }

    const cur = State.cellsPageState.page;
    const btnStyle = (active) =>
      'padding:6px 12px;border-radius:6px;border:1px solid #D7DEEA;background:' +
      (active ? '#124191;color:#fff;font-weight:700;' : '#fff;color:#5A6B87;font-weight:600;') +
      'font-size:12px;cursor:pointer;font-family:inherit;';

    let html = '';
    html += '<button style="' + btnStyle(false) + '" onclick="renderCellsPage(' + (cur - 1) + ')" ' + (cur <= 1 ? 'disabled' : '') + '>← Prev</button>';

    let startPage = Math.max(1, cur - 2);
    let endPage = Math.min(totalPages, cur + 2);

    if (startPage > 1) {
      html += '<button style="' + btnStyle(false) + '" onclick="renderCellsPage(1)">1</button>';
      if (startPage > 2) html += '<span style="color:#5A6B87;padding:0 6px;">…</span>';
    }
    for (let i = startPage; i <= endPage; i++) {
      html += '<button style="' + btnStyle(i === cur) + '" onclick="renderCellsPage(' + i + ')">' + i + '</button>';
    }
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) html += '<span style="color:#5A6B87;padding:0 6px;">…</span>';
      html += '<button style="' + btnStyle(false) + '" onclick="renderCellsPage(' + totalPages + ')">' + totalPages + '</button>';
    }

    html += '<button style="' + btnStyle(false) + '" onclick="renderCellsPage(' + (cur + 1) + ')" ' + (cur >= totalPages ? 'disabled' : '') + '>Next →</button>';
    el.innerHTML = html;
  }

  function cellsExportFiltered() {
    const filtered = cellsGetFilteredData();
    if (!filtered.length) { toast('No cells to export', 'error'); return; }

    const rows = [['Cell', 'Site', 'Tech', 'Band', 'PCI', 'PSC', 'BCCH', 'BSIC', 'HSN', 'LAC', 'RSI', 'RNC', 'UARFCN', 'Bore', 'Lat', 'Long', 'Comment']];
    filtered.forEach(c => {
      rows.push([
        c.cell_name, c.site, c.tech, c.gsmBand || '',
        c.pci || '', c.psc != null ? c.psc : '', c.bcch || '', c.bsic || '',
        c.hsn != null ? c.hsn : '', c.lac || '', c.rsi || '', c.rnc_id || '',
        c.uarfcn_dl || '', c.bore, c.lat, c.long, (c.comment || '').replace(/,/g, ';')
      ]);
    });

    downloadCSV('Cells_Export_' + new Date().toISOString().slice(0, 10) + '.csv', rows);
    toast('Exported ' + filtered.length + ' cells', 'success');
  }

  function cellsBulkCopy() {
    const ids = Array.from(State.cellsPageState.selectedIds);
    if (!ids.length) { toast('No cells selected', 'error'); return; }
    const selected = State.allCells.filter(c => ids.includes(c.id));
    const lines = selected.map(c =>
      c.cell_name + '\t' + c.tech + '\t' + (c.pci || c.psc || c.bcch || '') + '\t' + c.lat + ',' + c.long);
    navigator.clipboard.writeText(lines.join('\n')).then(() =>
      toast('Copied ' + selected.length + ' cells', 'success'));
  }

  function cellsBulkExport() {
    const ids = Array.from(State.cellsPageState.selectedIds);
    if (!ids.length) { toast('No cells selected', 'error'); return; }
    const selected = State.allCells.filter(c => ids.includes(c.id));

    const rows = [['Cell', 'Site', 'Tech', 'Band', 'PCI', 'PSC', 'BCCH', 'BSIC', 'Lat', 'Long']];
    selected.forEach(c => {
      rows.push([c.cell_name, c.site, c.tech, c.gsmBand || '', c.pci || '', c.psc || '', c.bcch || '', c.bsic || '', c.lat, c.long]);
    });
    downloadCSV('Selected_Cells_' + new Date().toISOString().slice(0, 10) + '.csv', rows);
    toast('Exported ' + selected.length + ' selected cells', 'success');
  }

  function flyToCell(id) {
    const cell = State.cellById.get(id);
    if (!cell) { toast('Cell not found', 'error'); return; }
    window.__gsmMode = false;
    window.__nbMode = false;
    switchView('map');
    setTimeout(() => {
      if (typeof renderMap === 'function') renderMap();
      if (State.map) State.map.flyTo([cell.lat, cell.long], 16, { duration: 1 });
      setTimeout(() => {
        if (typeof showSiteInfo === 'function') showSiteInfo(cell);
      }, 1200);
    }, 200);
  }

  // Load saved columns
  try {
    const saved = JSON.parse(localStorage.getItem('rf_cells_columns') || 'null');
    if (saved && Array.isArray(saved)) State.cellsPageState.visibleColumns = saved;
  } catch (e) {}

  window.renderCellsPage = renderCellsPage;
  window.debouncedRenderCells = debouncedRenderCells;
  window.cellsToggleColumns = cellsToggleColumns;
  window.cellsToggleColumn = cellsToggleColumn;
  window.cellsToggleAll = cellsToggleAll;
  window.cellsToggleRow = cellsToggleRow;
  window.cellsSortBy = cellsSortBy;
  window.cellsResetFilters = cellsResetFilters;
  window.cellsExportFiltered = cellsExportFiltered;
  window.cellsBulkCopy = cellsBulkCopy;
  window.cellsBulkExport = cellsBulkExport;
  window.cellsClearSelection = cellsClearSelection;
  window.flyToCell = flyToCell;

  console.log('✅ Cells page loaded');
})();
