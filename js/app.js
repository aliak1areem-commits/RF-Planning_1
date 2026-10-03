/* =========================================================
   🚀 APP — Main Entry Point
   ========================================================= */
(function() {
  'use strict';

  // ═══ Wait for pages + DOM ═══
  async function boot() {
    // 1. انتظر تحميل الصفحات
    try {
      if (window.__pagesReady) {
        await window.__pagesReady;
        console.log('✅ Pages injected');
      }
    } catch (e) {
      console.error('❌ Pages injection failed:', e);
    }

    // 2. Init Map (بعد تحميل الصفحات)
    if (typeof initMap === 'function') {
      initMap();
      console.log('✅ Map initialized');
    } else {
      console.warn('⚠️ initMap not available — will retry');
      setTimeout(() => {
        if (typeof initMap === 'function') initMap();
      }, 500);
    }

    // 3. Load Projects
    if (typeof loadProjects === 'function') {
      await loadProjects();
    }

    // 4. Setup modal backdrop
    const modal = document.getElementById('createProjectModal');
    if (modal) {
      modal.addEventListener('click', function(e) {
        if (e.target.id === 'createProjectModal') {
          if (typeof closeCreateProjectModal === 'function') closeCreateProjectModal();
        }
      });
    }

    // 5. Lucide Icons
    if (window.lucide) lucide.createIcons();

    // 6. Sidebar collapsed state
    if (localStorage.getItem('rf_nav_collapsed') === '1') {
      document.querySelector('.app').classList.add('nav-collapsed');
    }

    // 7. Auth check
    setTimeout(() => {
      if (typeof checkAuthOnLoad === 'function') {
        checkAuthOnLoad();
      }
    }, 300);

    // 8. Fire pagesLoaded event (يستفيد منه ui scripts)
    window.dispatchEvent(new CustomEvent('pagesLoaded'));

    console.log('%c✅ App initialized', 
      'color:#124191;font-weight:bold;font-size:13px;');
  }

  // ═══ Run ═══
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
