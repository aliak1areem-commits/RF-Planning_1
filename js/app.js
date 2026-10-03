/* =========================================================
   🚀 APP — Main Entry Point
   ========================================================= */
(async function() {
  'use strict';

  // ═══ 1. انتظر تحميل الصفحات ═══
  try {
    if (window.__pagesReady) {
      await window.__pagesReady;
      console.log('✅ Pages injected successfully');
    }
  } catch (e) {
    console.error('❌ Failed to inject pages:', e);
  }

  // ═══ 2. الآن شغّل التطبيق ═══
  window.addEventListener('DOMContentLoaded', async function() {
    console.log('%c🚀 RF Planning Pro v3.0 — Modular', 
      'color:#124191;font-weight:bold;font-size:14px;');

    // Initialize Map
    if (typeof initMap === 'function') initMap();

    // Load Projects
    if (typeof loadProjects === 'function') await loadProjects();

    // Setup Modals
    const modal = document.getElementById('createProjectModal');
    if (modal) {
      modal.addEventListener('click', function(e) {
        if (e.target.id === 'createProjectModal') {
          if (typeof closeCreateProjectModal === 'function') closeCreateProjectModal();
        }
      });
    }

    // Lucide Icons
    if (window.lucide) lucide.createIcons();

    // Auth Check
    setTimeout(() => {
      if (typeof checkAuthOnLoad === 'function') checkAuthOnLoad();
    }, 500);

    // Sidebar state
    if (localStorage.getItem('rf_nav_collapsed') === '1') {
      document.querySelector('.app').classList.add('nav-collapsed');
    }

    console.log('✅ App initialized');
  });
})();
    // ═══ 6. Sidebar state ═══
    if (localStorage.getItem('rf_nav_collapsed') === '1') {
      document.querySelector('.app').classList.add('nav-collapsed');
    }

    console.log('✅ App initialized');
  });
})();
