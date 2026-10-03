/* =========================================================
   🎨 SPLIT VIEW — عرض الخريطة + الأداة جنباً إلى جنب
   ========================================================= */
(function() {
  'use strict';

  // Patch switchView لدعم Split
  function patchSwitchView() {
    if (typeof switchView !== 'function') {
      setTimeout(patchSwitchView, 200);
      return;
    }
    if (window.__switchViewPatched) return;

    const base = window.switchView;

    window.switchView = function(page, force) {
      const main = document.querySelector('.main');
      const inTool = typeof State !== 'undefined' &&
                     typeof State.currentView === 'string' &&
                     State.currentView.indexOf('tool-') === 0;

      // إذا كنا في أداة ونريد نروح للخريطة → Split
      if (page === 'map' && inTool && !force) {
        const tp = document.getElementById('page-' + State.currentView);
        if (!tp) { base(page); return; }

        main.classList.add('split');
        document.querySelectorAll('.page.split-tool').forEach(p => {
          p.classList.remove('split-tool');
        });
        tp.classList.add('split-tool', 'active');
        document.getElementById('page-map').classList.add('active');
        setTimeout(() => {
          if (State.map) State.map.invalidateSize();
        }, 250);
        return;
      }

      // إزالة split
      main.classList.remove('split');
      document.querySelectorAll('.page.split-tool').forEach(p => {
        p.classList.remove('split-tool');
      });

      base(page);

      // Mark tool nav as active
      if (page.indexOf('tool-') === 0) {
        const t = document.querySelector('.nav-item[data-page="tools"]');
        if (t) t.classList.add('active');
      }
    };

    window.__switchViewPatched = true;
  }

  patchSwitchView();

  // Close split
  function closeSplit() {
    if (typeof State === 'undefined') return;
    const prev = State.currentView;
    if (typeof resetMapView === 'function') resetMapView();
    if (typeof switchView === 'function') switchView(prev, true);
  }

  window.closeSplit = closeSplit;

  console.log('✅ Split view loaded');
})();
