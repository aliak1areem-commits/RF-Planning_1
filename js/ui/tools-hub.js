/* =========================================================
   🎨 TOOLS HUB — Filter + Categorize tools
   ========================================================= */
(function() {
  'use strict';

  const TOOL_META = {
    'tool-pci-checker': { icon: 'hash',             cat: 'LTE' },
    'tool-psc-checker': { icon: 'signal',           cat: '3G' },
    'tool-3g-nb':       { icon: 'network',          cat: 'Neighbors' },
    'tool-gsm-planner': { icon: 'radio',            cat: '2G' },
    'tool-bsic':        { icon: 'palette',          cat: '2G' },
    'tool-hsn':         { icon: 'shuffle',          cat: '2G' },
    'tool-neighbor':    { icon: 'share-2',          cat: 'Neighbors' },
    'tool-symmetry':    { icon: 'arrow-left-right', cat: 'Neighbors' },
    'tool-azimuth-opt': { icon: 'compass',          cat: 'Planning' },
    'tool-new-site':    { icon: 'building-2',       cat: 'Planning' },
    'tool-distance':    { icon: 'ruler',            cat: 'Utilities' },
    'tool-azimuth':     { icon: 'navigation',       cat: 'Utilities' },
    'tool-unit':        { icon: 'calculator',       cat: 'Utilities' },
    'tool-kml':         { icon: 'globe',            cat: 'Utilities' }
  };

  let currentCat = 'All';

  function initToolsHub() {
    document.querySelectorAll('.tools-grid .tool-card').forEach(card => {
      const m = (card.getAttribute('onclick') || '').match(/'(tool-[^']+)'/);
      const meta = m && TOOL_META[m[1]];
      if (!meta) return;
      card.dataset.cat = meta.cat;
      const ic = card.querySelector('.tool-icon');
      if (ic) ic.innerHTML = '<i data-lucide="' + meta.icon + '"></i>';
      const tag = card.querySelector('.tool-tag');
      if (tag) tag.textContent = meta.cat;
    });
    if (window.lucide) lucide.createIcons();
  }

  function filterTools(cat) {
    if (typeof cat === 'string') {
      currentCat = cat;
      document.querySelectorAll('#toolsCats button').forEach(b => {
        b.classList.toggle('active', b.dataset.cat === cat);
      });
    }

    const q = (document.getElementById('toolsSearch')?.value || '').toLowerCase().trim();

    document.querySelectorAll('.tools-grid .tool-card').forEach(card => {
      const matchesSearch = card.textContent.toLowerCase().includes(q);
      const matchesCat = currentCat === 'All' || card.dataset.cat === currentCat;
      const ok = matchesSearch && matchesCat;
      card.classList.toggle('is-filtered', !ok);
    });
  }

  window.initToolsHub = initToolsHub;
  window.filterTools = filterTools;

  window.addEventListener('pagesLoaded', initToolsHub);
  setTimeout(initToolsHub, 1500);

  console.log('✅ Tools hub loaded');
})();
