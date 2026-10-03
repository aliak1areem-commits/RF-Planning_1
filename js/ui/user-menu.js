/* =========================================================
   🎨 USER MENU — Dropdown + Nav collapse
   ========================================================= */
(function() {
  'use strict';

  function toggleUserMenu(e) {
    if (e) e.stopPropagation();
    const m = document.getElementById('userMenu');
    if (m) m.classList.toggle('show');
  }

  function closeUserMenu() {
    const m = document.getElementById('userMenu');
    if (m) m.classList.remove('show');
  }

  document.addEventListener('click', closeUserMenu);

  function toggleNav() {
    const a = document.querySelector('.app');
    a.classList.toggle('nav-collapsed');
    localStorage.setItem('rf_nav_collapsed',
      a.classList.contains('nav-collapsed') ? '1' : '0');
    setTimeout(() => {
      if (typeof State !== 'undefined' && State.map) {
        State.map.invalidateSize();
      }
    }, 250);
  }

  function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark');
    localStorage.setItem('rf_dark_mode', isDark ? '1' : '0');

    const btn = document.getElementById('darkModeBtn');
    if (btn) {
      btn.innerHTML = '<i data-lucide="' + (isDark ? 'sun' : 'moon') + '"></i>' +
                      '<span>' + (isDark ? 'Light mode' : 'Dark mode') + '</span>';
      if (window.lucide) lucide.createIcons();
    }

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = isDark ? '#0B1220' : '#F5F7FA';

    closeUserMenu();
  }

  // Restore dark mode
  if (localStorage.getItem('rf_dark_mode') === '1') {
    document.body.classList.add('dark');
    setTimeout(() => {
      const btn = document.getElementById('darkModeBtn');
      if (btn) {
        btn.innerHTML = '<i data-lucide="sun"></i><span>Light mode</span>';
        if (window.lucide) lucide.createIcons();
      }
    }, 500);
  }

  window.toggleUserMenu = toggleUserMenu;
  window.closeUserMenu = closeUserMenu;
  window.toggleNav = toggleNav;
  window.toggleDarkMode = toggleDarkMode;

  console.log('✅ User menu loaded');
})();
