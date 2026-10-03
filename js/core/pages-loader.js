/* =========================================================
   📄 PAGES LOADER — يحمّل HTML pages قبل تشغيل التطبيق
   ========================================================= */
(function() {
  'use strict';

  const PAGES = [
    { id: 'page-map',        file: './pages/map.html' },
    { id: 'page-dashboard',  file: './pages/dashboard.html' },
    { id: 'page-projects',   file: './pages/data.html' },
    { id: 'page-import',     file: './pages/data.html' },
    { id: 'page-cells',      file: './pages/data.html' },
    { id: 'page-tools',      file: './pages/tools.html' },
    { id: 'page-tool-pci-checker', file: './pages/tools.html' },
    { id: 'page-tool-distance',    file: './pages/tools.html' }
    // ⚠️ باقي الأدوات تُضاف هنا لاحقاً
  ];

  async function loadPage(file) {
    const res = await fetch(file);
    if (!res.ok) throw new Error('Failed to load ' + file);
    return await res.text();
  }

  async function injectPages() {
    const mount = document.getElementById('page-mount');
    if (!mount) return;

    // ═══ Group by file ═══
    const fileGroups = {};
    PAGES.forEach(p => {
      if (!fileGroups[p.file]) fileGroups[p.file] = [];
      fileGroups[p.file].push(p.id);
    });

    // ═══ Load each file once ═══
    const cache = {};
    for (const file of Object.keys(fileGroups)) {
      try {
        const html = await loadPage(file);
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Each <section id="page-xxx"> in file
        doc.querySelectorAll('section[id^="page-"]').forEach(section => {
          cache[section.id] = section.outerHTML;
        });
      } catch (e) {
        console.error('❌ Failed to load', file, e);
      }
    }

    // ═══ Inject required pages ═══
    const allPages = Object.values(fileGroups).flat();
    let html = '';
    allPages.forEach(id => {
      if (cache[id]) html += cache[id];
    });

    mount.innerHTML = html;

    // ═══ Remove mount, move pages into .main ═══
    const main = document.querySelector('.main');
    while (mount.firstChild) {
      main.appendChild(mount.firstChild);
    }
    mount.remove();

    console.log('✅ Pages loaded:', allPages.length);
    return true;
  }

  // ═══ Run before app init ═══
  window.__pagesReady = injectPages();
  window.loadPages = injectPages;
})();
