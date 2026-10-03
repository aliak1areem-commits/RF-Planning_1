/* =========================================================
   📄 PAGES LOADER — يحمّل HTML pages قبل تشغيل التطبيق
   ========================================================= */
(function() {
  'use strict';

  const PAGES = [
    { id: 'page-map',                   file: './pages/map.html' },
    { id: 'page-dashboard',             file: './pages/dashboard.html' },
    { id: 'page-projects',              file: './pages/data.html' },
    { id: 'page-import',                file: './pages/data.html' },
    { id: 'page-cells',                 file: './pages/data.html' },
    { id: 'page-tools',                 file: './pages/tools.html' },
    { id: 'page-tool-pci-checker',      file: './pages/tools.html' },
    { id: 'page-tool-gsm-planner',      file: './pages/tools.html' },
    { id: 'page-tool-psc-checker',      file: './pages/tools.html' },
    { id: 'page-tool-bsic',             file: './pages/tools.html' },
    { id: 'page-tool-hsn',              file: './pages/tools.html' },
    { id: 'page-tool-neighbor',         file: './pages/tools.html' },
    { id: 'page-tool-symmetry',         file: './pages/tools.html' },
    { id: 'page-tool-3g-nb',            file: './pages/tools.html' },
    { id: 'page-tool-azimuth-opt',      file: './pages/tools.html' },
    { id: 'page-tool-new-site',         file: './pages/tools.html' },
    { id: 'page-tool-distance',         file: './pages/tools.html' },
    { id: 'page-tool-azimuth',          file: './pages/tools.html' },
    { id: 'page-tool-unit',             file: './pages/tools.html' },
    { id: 'page-tool-kml',              file: './pages/tools.html' },
    // Modal
    { id: 'createProjectModal',         file: './pages/tools.html' }
  ];

  async function loadPage(file) {
    const res = await fetch(file);
    if (!res.ok) throw new Error('Failed to load ' + file);
    return await res.text();
  }

  async function injectPages() {
    const mount = document.getElementById('page-mount');
    if (!mount) {
      console.warn('⚠️ #page-mount not found');
      return;
    }

    // Group by file (لتحميل كل ملف مرة وحدة)
    const fileGroups = {};
    PAGES.forEach(p => {
      if (!fileGroups[p.file]) fileGroups[p.file] = [];
      fileGroups[p.file].push(p.id);
    });

    // Load each file
    const cache = {};
    for (const file of Object.keys(fileGroups)) {
      try {
        const html = await loadPage(file);
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // استخرج كل section[id^="page-"] + كل modal-backdrop
        doc.querySelectorAll('section[id^="page-"], .modal-backdrop').forEach(el => {
          const id = el.id;
          if (id) cache[id] = el.outerHTML;
        });
      } catch (e) {
        console.error('❌ Failed to load', file, e);
      }
    }

    // Inject all requested pages
    const allIds = Object.values(fileGroups).flat();
    let html = '';
    allIds.forEach(id => {
      if (cache[id]) html += cache[id];
    });

    mount.innerHTML = html;

    // Move to <main>
    const main = document.querySelector('.main');
    while (mount.firstChild) {
      main.appendChild(mount.firstChild);
    }
    mount.remove();

    console.log('✅ Pages loaded:', allIds.length);

    // Fire event for other modules
    window.dispatchEvent(new CustomEvent('pagesLoaded'));
    return true;
  }

  // Fire immediately
  window.__pagesReady = injectPages();
  window.loadPages = injectPages;

  console.log('✅ Pages loader started');
})();
