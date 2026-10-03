/* =========================================================
   🧭 ROUTER — View Switching + Navigation
   ========================================================= */
(function() {
  'use strict';

  const PAGE_TITLES = {
    'map':              { icon: '🗺️', title: 'Cell Map',                sub: 'Visualize cells on the map' },
    'dashboard':        { icon: '📊', title: 'Dashboard',               sub: 'Overview and statistics' },
    'projects':         { icon: '📁', title: 'Projects',                sub: 'Manage RF projects' },
    'import':           { icon: '📥', title: 'Import',                  sub: 'Import cells from Excel' },
    'cells':            { icon: '📋', title: 'Cells Database',          sub: 'Manage all cells' },
    'tools':            { icon: '🔧', title: 'Tools',                   sub: 'RF optimization & planning tools' },
    'tool-pci-checker': { icon: '🧮', title: 'PCI Conflict Checker',    sub: 'Detect & fix PCI conflicts' },
    'tool-gsm-planner': { icon: '📡', title: 'GSM BCCH/BSIC Planner',   sub: 'Suggest conflict-free BCCH and BSIC' },
    'tool-neighbor':    { icon: '🔗', title: 'Neighbor Analysis',       sub: 'Audit missing neighbor relations' },
    'tool-3g-nb':       { icon: '📶', title: '3G / IRAT Analyzer',      sub: '3G Neighbor + 3G→2G IRAT' },
    'tool-hsn':         { icon: '🎵', title: 'HSN Conflict Analyzer',   sub: 'Detect & fix HSN conflicts in GSM' },
    'tool-psc-checker': { icon: '📶', title: 'PSC Conflict Checker (3G)', sub: 'Detect & fix PSC conflicts in 3G UMTS' },
    'tool-bsic':        { icon: '🎨', title: 'BSIC Analyzer',           sub: 'Detect & fix BSIC conflicts' },
    'tool-symmetry':    { icon: '🔗', title: 'Neighbor Symmetry Checker', sub: 'Detect asymmetric neighbor relations' },
    'tool-azimuth-opt': { icon: '🎯', title: 'Azimuth Optimization',    sub: 'Suggest optimal azimuth based on neighbors' },
    'tool-distance':    { icon: '📐', title: 'Distance & Bearing',      sub: 'Calculate distance between sites' },
    'tool-azimuth':     { icon: '🎯', title: 'Azimuth & Tilt',          sub: 'Calculate antenna angles' },
    'tool-unit':        { icon: '🔢', title: 'Unit Converter',          sub: 'Convert RF units' },
    'tool-kml':         { icon: '🗺️', title: 'Export KML',              sub: 'Export to Google Earth' },
    'tool-new-site':    { icon: '🏗️', title: 'New Site Planner PRO',    sub: 'Auto-plan BCCH/BSIC/PSC/PCI/RSI' }
  };

  function switchView(page) {
    State.currentView = page;

    // Reset tool modes
    if (page !== 'map') {
      window.__gsmMode = false;
      window.__nbMode = false;
      if (typeof nbHideLegend === 'function') nbHideLegend();
      if (typeof hideNeighborLinesLegend === 'function') hideNeighborLinesLegend();
      if (typeof ToolLegend !== 'undefined') ToolLegend.hide();
    }

    // Update nav
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    const navBtn = document.querySelector('[data-page="' + page + '"]');
    if (navBtn) navBtn.classList.add('active');

    const pageEl = document.getElementById('page-' + page);
    if (pageEl) pageEl.classList.add('active');

    // Update titles
    const info = PAGE_TITLES[page] || PAGE_TITLES['map'];
    document.getElementById('pageIcon').textContent = info.icon;
    document.getElementById('pageTitle').textContent = info.title;
    document.getElementById('pageSubtitle').textContent = info.sub;

    // Page-specific init
    if (page === 'map' && State.map) {
      setTimeout(() => State.map.invalidateSize(), 150);
    }
    if (page === 'dashboard') {
      setTimeout(() => {
        if (typeof renderDashboard === 'function') renderDashboard();
      }, 100);
    }
    if (page === 'cells') {
      setTimeout(() => {
        if (typeof renderCellsPage === 'function') renderCellsPage(1);
      }, 100);
    }
  }

  // Nav click handlers
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        switchView(btn.dataset.page);
      });
    });
  });

  window.PAGE_TITLES = PAGE_TITLES;
  window.switchView = switchView;

  console.log('✅ Router loaded');
})();
