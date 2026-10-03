/* =========================================================
   🔧 UTILS — Math, String, CSV, Async
   ========================================================= */
(function() {
  'use strict';

  const EARTH_RADIUS_M = 6371000.0;
  const EMOJI_G = /[\p{Extended_Pictographic}\uFE0F\u200D]/gu;

  // ═══════════════════════════════════════════════════
  // 📐 Math
  // ═══════════════════════════════════════════════════
  function haversineDistance(lat1, lon1, lat2, lon2) {
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const dphi = (lat2 - lat1) * Math.PI / 180;
    const dlam = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dphi / 2) ** 2 +
              Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlam / 2) ** 2;
    return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function calculateBearing(lat1, lon1, lat2, lon2) {
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const dlambda = (lon2 - lon1) * Math.PI / 180;
    const x = Math.sin(dlambda) * Math.cos(phi2);
    const y = Math.cos(phi1) * Math.sin(phi2) -
              Math.sin(phi1) * Math.cos(phi2) * Math.cos(dlambda);
    return (Math.atan2(x, y) * 180 / Math.PI + 360) % 360;
  }

  function boreDifference(b1, b2) {
    const diff = Math.abs(b1 - b2) % 360;
    return diff <= 180 ? diff : 360 - diff;
  }

  function destinationPoint(lat, lng, bearing, distanceM) {
    const R = 6371000;
    const d = distanceM / R;
    const theta = bearing * Math.PI / 180;
    const phi1 = lat * Math.PI / 180;
    const lambda1 = lng * Math.PI / 180;
    const phi2 = Math.asin(
      Math.sin(phi1) * Math.cos(d) +
      Math.cos(phi1) * Math.sin(d) * Math.cos(theta)
    );
    const lambda2 = lambda1 + Math.atan2(
      Math.sin(theta) * Math.sin(d) * Math.cos(phi1),
      Math.cos(d) - Math.sin(phi1) * Math.sin(phi2)
    );
    return [phi2 * 180 / Math.PI, lambda2 * 180 / Math.PI];
  }

  // ═══════════════════════════════════════════════════
  // 🔤 String
  // ═══════════════════════════════════════════════════
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
  }

  // ═══════════════════════════════════════════════════
  // 📄 CSV
  // ═══════════════════════════════════════════════════
  function toCSV(rows) {
    return '\uFEFF' + rows.map(r => r.map(v => {
      const s = v == null ? '' : String(v);
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')).join('\r\n');
  }

  function downloadCSV(filename, rows) {
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ═══════════════════════════════════════════════════
  // ⏱️ Async
  // ═══════════════════════════════════════════════════
  function debounce(fn, delay) {
    let t;
    return function(...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // ═══════════════════════════════════════════════════
  // 🎨 UI
  // ═══════════════════════════════════════════════════
  function toast(msg, type = 'info', duration = 3000) {
    const el = document.getElementById('toast');
    if (!el) return;
    const cleanMsg = String(msg).replace(EMOJI_G, '').replace(/\s{2,}/g, ' ').trim();
    el.textContent = cleanMsg;
    el.className = 'toast show ' + type;
    clearTimeout(el._t);
    el._t = setTimeout(() => {
      el.className = 'toast ' + type;
    }, duration);
  }

  // ═══════════════════════════════════════════════════
  // 🌐 Export
  // ═══════════════════════════════════════════════════
  const Utils = {
    haversineDistance,
    calculateBearing,
    boreDifference,
    destinationPoint,
    escapeHtml,
    toCSV,
    downloadCSV,
    debounce,
    toast
  };

  window.Utils = Utils;

  // Shortcuts for backwards compatibility
  Object.keys(Utils).forEach(k => { window[k] = Utils[k]; });

  console.log('✅ Utils loaded');
})();
// ═══════════════════════════════════════════════════════════
// 🔥 PERMANENT FIX — يُشغّل تلقائياً
// ═══════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    // نفس الكود اللي شغّلته بس يشتغل تلقائياً
    const css = document.createElement('style');
    css.id = '__permanentFix';
    css.textContent = `
      .map-mini-stats {
        position: absolute !important;
        bottom: 20px !important;
        left: 320px !important;
        top: auto !important;
        right: auto !important;
        width: auto !important;
        display: flex !important;
        z-index: 500 !important;
        flex: 0 0 auto !important;
      }
      .legend {
        position: absolute !important;
        bottom: 20px !important;
        left: 340px !important;
        width: auto !important;
        display: block !important;
        z-index: 500 !important;
      }
      .map-toolbar {
        position: absolute !important;
        top: 12px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        width: min(560px, calc(100% - 400px)) !important;
      }
      .map-controls {
        position: absolute !important;
        top: 12px !important;
        right: 12px !important;
        width: auto !important;
        display: flex !important;
      }
      .goto-panel,
      .bookmarks-panel {
        display: none !important;
      }
      .goto-panel.show {
        display: flex !important;
      }
      .bookmarks-panel.show {
        display: block !important;
      }
    `;
    document.head.appendChild(css);
    console.log('✅ Permanent fix applied');
  }, 1000);
});
