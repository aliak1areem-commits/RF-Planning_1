/* =========================================================
   🎨 SIDEBAR ACCORDION — تحويل H3 إلى details/summary
   ========================================================= */
(function() {
  'use strict';

  function makeSidebarAccordion() {
    const sb = document.getElementById('mapSidebar');
    if (!sb || sb.dataset.acc) return;

    const kids = Array.from(sb.children);
    sb.innerHTML = '';
    let det = null;
    let idx = 0;

    kids.forEach(el => {
      if (el.tagName === 'H3') {
        det = document.createElement('details');
        det.open = idx++ < 2; // أول 2 مفتوحة افتراضياً
        const s = document.createElement('summary');
        s.textContent = el.textContent;
        det.appendChild(s);
        sb.appendChild(det);
      } else if (det) {
        det.appendChild(el);
      } else {
        sb.appendChild(el);
      }
    });

    sb.dataset.acc = '1';
  }

  window.makeSidebarAccordion = makeSidebarAccordion;

  // Auto-run after pages loaded
  window.addEventListener('pagesLoaded', makeSidebarAccordion);
  setTimeout(makeSidebarAccordion, 1500);

  console.log('✅ Sidebar accordion loaded');
})();
