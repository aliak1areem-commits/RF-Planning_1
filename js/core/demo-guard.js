/* =========================================================
   🛡️ DEMO GUARD — يحمي التطبيق في وضع Demo
   يُحمَّل أول شيء قبل أي شي ثاني
   ========================================================= */
(function(){
  const IS_DEMO = new URLSearchParams(location.search).get('demo') === '1'
               || location.pathname.includes('demo')
               || localStorage.getItem('rf_demo_mode') === '1'
               || window.__demoMode === true;

  if (!IS_DEMO) {
    console.log('%c✅ Normal mode — All features enabled', 
      'background:#006C35;color:#fff;padding:6px 12px;border-radius:6px;font-weight:700;font-size:12px');
    window.__demoGuardActive = false;
    return;
  }

  window.__demoGuardActive = true;
  console.warn('%c🛡️ DEMO MODE ACTIVE', 
    'background:#006C35;color:#fff;padding:10px 20px;border-radius:8px;font-weight:700;font-size:13px');

  // ═══ 1. Block Supabase (data) but allow Auth ═══
  const BLOCKED = ['supabase.co', 'supabase.in', 'supabase.io'];
  const AUTH_PATHS = [
    '/auth/v1/token', '/auth/v1/signup', '/auth/v1/user',
    '/auth/v1/logout', '/auth/v1/recover', '/auth/v1/otp', '/auth/v1/verify'
  ];

  function isAuthCall(url) {
    return AUTH_PATHS.some(p => url.indexOf(p) !== -1);
  }

  // Patch fetch
  const origFetch = window.fetch;
  window.fetch = function(input, init) {
    const url = (typeof input === 'string') ? input :
                (input && input.url) ? input.url : String(input);
    const isSupabase = BLOCKED.some(d => url.indexOf(d) !== -1);

    if (isSupabase && !isAuthCall(url)) {
      console.warn('🛡️ Blocked (data):', url.substring(0, 70));
      return Promise.resolve(new Response('[]', {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }));
    }
    return origFetch.apply(this, arguments);
  };

  // Patch XHR
  const OrigXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function() {
    const xhr = new OrigXHR();
    const origOpen = xhr.open;
    const origSend = xhr.send;
    let blocked = false;

    xhr.open = function(method, url) {
      const isSupabase = BLOCKED.some(d => url.indexOf(d) !== -1);
      if (isSupabase && !isAuthCall(url)) {
        blocked = true;
        return origOpen.call(this, method, 'about:blank', true);
      }
      return origOpen.apply(this, arguments);
    };

    xhr.send = function() {
      if (blocked) {
        Object.defineProperty(xhr, 'status', { value: 200, configurable: true });
        Object.defineProperty(xhr, 'readyState', { value: 4, configurable: true });
        Object.defineProperty(xhr, 'responseText', { value: '[]', configurable: true });
        Object.defineProperty(xhr, 'response', { value: '[]', configurable: true });
        if (xhr.onreadystatechange) xhr.onreadystatechange();
        if (xhr.onload) xhr.onload();
        return;
      }
      return origSend.apply(this, arguments);
    };
    return xhr;
  };

  // ═══ 2. Block right-click + shortcuts ═══
  document.addEventListener('contextmenu', e => { e.preventDefault(); return false; });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'F12' || e.keyCode === 123) {
      e.preventDefault(); e.stopPropagation();
      showWarning(); return false;
    }
    if (e.ctrlKey && e.shiftKey && ['I','i','J','j','C','c'].includes(e.key)) {
      e.preventDefault(); e.stopPropagation();
      showWarning(); return false;
    }
    if (e.ctrlKey && (e.key === 'U' || e.key === 'u')) {
      e.preventDefault(); e.stopPropagation();
      showWarning(); return false;
    }
    if (e.ctrlKey && (e.key === 'S' || e.key === 's')) {
      e.preventDefault(); e.stopPropagation(); return false;
    }
  }, true);

  // ═══ 3. Warning Popup ═══
  let warnCooldown = 0;
  function showWarning() {
    const now = Date.now();
    if (now - warnCooldown < 2000) return;
    warnCooldown = now;

    const warn = document.createElement('div');
    warn.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999999;background:linear-gradient(135deg,#006C35,#00A550);color:#fff;padding:24px 40px;border-radius:14px;font-size:15px;font-weight:700;text-align:center;box-shadow:0 20px 60px rgba(0,108,53,.6);font-family:Inter,system-ui,sans-serif;';
    warn.innerHTML = '🛡️ Demo Mode — Inspection Disabled<br><span style="font-size:11.5px;opacity:.85;text-transform:uppercase;margin-top:6px;display:block;">This is a public demo.</span>';
    document.body.appendChild(warn);
    setTimeout(() => { warn.style.transition = 'opacity .3s'; warn.style.opacity = '0'; }, 1800);
    setTimeout(() => warn.remove(), 2200);
  }

  // ═══ 4. DevTools detection ═══
  let devtoolsOpen = false;
  const threshold = 160;

  function detectDevTools() {
    if (!window.__demoGuardActive) return;

    const widthDiff = window.outerWidth - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;
    const isOpen = widthDiff > threshold || heightDiff > threshold;

    if (isOpen && !devtoolsOpen) {
      devtoolsOpen = true;
      document.body.style.transition = 'filter .3s ease';
      document.body.style.filter = 'blur(20px)';
      document.body.style.pointerEvents = 'none';

      if (!document.getElementById('__devWarn')) {
        const w = document.createElement('div');
        w.id = '__devWarn';
        w.style.cssText = 'position:fixed;inset:0;z-index:99999999;background:radial-gradient(circle at 50% 50%,rgba(0,108,53,.15),rgba(0,0,0,.95));color:#fff;display:flex;align-items:center;justify-content:center;font-family:Inter,system-ui,sans-serif;text-align:center;padding:40px;';
        w.innerHTML = '<div style="max-width:520px;"><div style="font-size:88px;margin-bottom:24px;">🛡️</div><h1 style="font-size:32px;color:#00A550;font-weight:800;">Demo Mode Protected</h1><p style="color:#94A3B8;">Close Developer Tools to continue.</p></div>';
        document.body.appendChild(w);
      }
    } else if (!isOpen && devtoolsOpen) {
      devtoolsOpen = false;
      document.body.style.filter = '';
      document.body.style.pointerEvents = '';
      const w = document.getElementById('__devWarn');
      if (w) w.remove();
    }
  }

  setInterval(detectDevTools, 500);

  // ═══ 5. Block drag ═══
  document.addEventListener('dragstart', e => {
    if (e.target.tagName === 'IMG' || e.target.tagName === 'A') e.preventDefault();
  });

  console.log('%c🛡️ Demo Guard — Active', 'background:#006C35;color:#fff;padding:8px 16px;border-radius:6px;font-weight:700;font-size:12px');
})();
