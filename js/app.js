/* =========================================================
   🚀 APP — Main Entry Point
   ========================================================= */
(function() {
  'use strict';

  // ═══ Wait for DOM ready ═══
  window.addEventListener('DOMContentLoaded', function() {
    console.log('%c🚀 RF Planning Pro v3.0 — Modular', 
      'color:#124191;font-weight:bold;font-size:14px;');

    // ═══ 1. Initialize Map ═══
    if (typeof initMap === 'function') {
      initMap();
    }

    // ═══ 2. Load Projects ═══
    if (typeof loadProjects === 'function') {
      loadProjects();
    }

    // ═══ 3. Setup Modal backdrops ═══
    const modal = document.getElementById('createProjectModal');
    if (modal) {
      modal.addEventListener('click', function(e) {
        if (e.target.id === 'createProjectModal') {
          if (typeof closeCreateProjectModal === 'function') closeCreateProjectModal();
        }
      });
    }

    // ═══ 4. Lucide Icons ═══
    if (window.lucide) {
      lucide.createIcons();
    }

    // ═══ 5. Auth Check ═══
    setTimeout(() => {
      if (typeof checkAuthOnLoad === 'function') {
        checkAuthOnLoad();
      }
    }, 500);

    // ═══ 6. Sidebar state ═══
    if (localStorage.getItem('rf_nav_collapsed') === '1') {
      document.querySelector('.app').classList.add('nav-collapsed');
    }

    console.log('✅ App initialized');
  });
})();
