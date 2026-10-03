/* =========================================================
   🌐 LANGUAGE — Switch AR/EN + Auto-translate
   ========================================================= */
(function() {
  'use strict';

  const LANG_KEY = 'rf_lang_preference';
  State.currentLang = localStorage.getItem(LANG_KEY) || 'en';

  function applyLanguage(lang, silent) {
    State.currentLang = lang;
    localStorage.setItem(LANG_KEY, lang);

    document.documentElement.lang = lang === 'ar' ? 'ar' : 'en';

    const label = document.getElementById('langLabel');
    const btn = document.getElementById('langToggleBtn');
    if (label) label.textContent = lang === 'ar' ? 'EN' : 'AR';
    if (btn) btn.title = lang === 'ar' ? 'Switch to English' : 'التبديل للعربية';

    if (lang === 'en') {
      // Translate all Arabic text nodes
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      const textNodes = [];
      let node;
      while ((node = walker.nextNode())) textNodes.push(node);

      textNodes.forEach(n => {
        if (n.parentElement &&
            n.parentElement.closest('#cellCommentDisplay, textarea, .no-translate')) return;
        if (n.nodeValue && /[\u0600-\u06FF]/.test(n.nodeValue)) {
          n.nodeValue = translateText(n.nodeValue, 'en');
        }
      });

      // Translate attributes
      ['placeholder', 'title', 'alt', 'aria-label'].forEach(attr => {
        document.querySelectorAll('[' + attr + ']').forEach(el => {
          const v = el.getAttribute(attr);
          if (v && /[\u0600-\u06FF]/.test(v)) {
            el.setAttribute(attr, translateText(v, 'en'));
          }
        });
      });
    }

    if (!silent) {
      toast(lang === 'ar' ? 'Switched to Arabic' : 'Switched to English', 'success', 2000);
    }
  }

  function toggleLanguage() {
    applyLanguage(State.currentLang === 'ar' ? 'en' : 'ar');
  }

  // Patch toast/confirm/alert
  (function patchDialogs() {
    if (window.__dialogsPatched) return;

    const originalToast = window.toast;
    window.toast = function(msg, type, duration) {
      const finalMsg = (State.currentLang === 'en') ? translateText(msg, 'en') : msg;
      return originalToast(finalMsg, type, duration);
    };

    const originalConfirm = window.confirm;
    window.confirm = function(msg) {
      const finalMsg = (State.currentLang === 'en') ? translateText(msg, 'en') : msg;
      return originalConfirm(finalMsg);
    };

    const originalAlert = window.alert;
    window.alert = function(msg) {
      const finalMsg = (State.currentLang === 'en') ? translateText(msg, 'en') : msg;
      return originalAlert(finalMsg);
    };

    window.__dialogsPatched = true;
  })();

  // Init
  setTimeout(() => {
    if (State.currentLang === 'en') {
      applyLanguage('en', true);
    } else {
      const label = document.getElementById('langLabel');
      if (label) label.textContent = 'EN';
    }
  }, 500);

  // Re-apply on nav clicks
  document.addEventListener('click', function(e) {
    if (State.currentLang !== 'en') return;
    if (e.target.closest('.nav-item') || e.target.closest('.nb-tab') || e.target.closest('.back-btn')) {
      setTimeout(() => applyLanguage('en', true), 200);
      setTimeout(() => applyLanguage('en', true), 600);
    }
  }, true);

  // MutationObserver
  (function setupLangObserver() {
    if (window.__langObserver) return;
    let timer = null;

    const observer = new MutationObserver(function(mutations) {
      if (State.currentLang !== 'en') return;

      let hasNew = false;
      for (const m of mutations) {
        for (const n of m.addedNodes) {
          if ((n.nodeType === 1 || n.nodeType === 3) &&
              /[\u0600-\u06FF]/.test(n.textContent || '')) {
            hasNew = true;
            break;
          }
        }
        if (hasNew) break;
      }

      if (hasNew) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => applyLanguage('en', true), 150);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    window.__langObserver = observer;
  })();

  window.applyLanguage = applyLanguage;
  window.toggleLanguage = toggleLanguage;

  console.log('✅ Language loaded');
})();
