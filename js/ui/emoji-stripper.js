/* =========================================================
   🎨 EMOJI STRIPPER — إزالة الإيموجي من UI (اختياري)
   ========================================================= */
(function() {
  'use strict';

  const EMOJI_T = /[\p{Extended_Pictographic}]/u;
  const EMOJI_G = /[\p{Extended_Pictographic}\uFE0F\u200D]/gu;

  function stripAllEmoji(root) {
    if (!root) root = document.body;

    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => {
        if (!n.parentElement) return NodeFilter.FILTER_REJECT;
        // Protected elements
        if (n.parentElement.closest('#map,#cellCommentDisplay,#toolLegend,textarea,script,style')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    let n;
    while ((n = w.nextNode())) {
      if (EMOJI_T.test(n.nodeValue)) {
        n.nodeValue = n.nodeValue.replace(EMOJI_G, '').replace(/^\s+/, '');
      }
    }

    root.querySelectorAll('[placeholder]').forEach(el => {
      el.placeholder = el.placeholder.replace(EMOJI_G, '').trim();
    });
  }

  window.stripAllEmoji = stripAllEmoji;
  window.EMOJI_G = EMOJI_G;

  // Auto-run once (اختياري — احذفه إذا ما تريد)
  // window.addEventListener('pagesLoaded', () => stripAllEmoji());

  console.log('✅ Emoji stripper loaded (disabled by default)');
})();
