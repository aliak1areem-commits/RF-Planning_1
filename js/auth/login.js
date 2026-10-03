/* =========================================================
   🔐 LOGIN — Authentication + Role-Based UI
   ========================================================= */
(function() {
  'use strict';

  async function doLogin() {
    const usernameEl = document.getElementById('loginUsername');
    const passwordEl = document.getElementById('loginPassword');
    const btn = document.getElementById('loginBtn');
    const errEl = document.getElementById('loginError');

    if (!usernameEl || !passwordEl) return;

    const username = (usernameEl.value || '').trim().toLowerCase();
    const password = passwordEl.value || '';

    if (!username || !password) {
      errEl.textContent = 'Please enter both username and password.';
      errEl.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Signing in...';
    errEl.style.display = 'none';

    try {
      const email = username.includes('@') ? username : (username + '@rfplanning.local');
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const { data: profile, error: pErr } = await db
        .from('profiles').select('*').eq('id', data.user.id).single();
      if (pErr) throw pErr;

      if (!profile.is_active) {
        await db.auth.signOut();
        throw new Error('Your account is disabled. Contact admin.');
      }

      await db.from('profiles')
        .update({ last_login: new Date().toISOString() })
        .eq('id', data.user.id);

      State.currentUser = data.user;
      State.currentProfile = profile;

      document.getElementById('loginScreen').style.display = 'none';
      passwordEl.value = '';

      applyRoleBasedUI();
      showApp();

      if (State.map) setTimeout(() => State.map.invalidateSize(), 100);

      await loadProjects();
      await loadCells();

      toast('Welcome, ' + (profile.full_name || profile.username) + '!', 'success', 3000);
    } catch (e) {
      console.error(e);
      errEl.textContent = e.message || 'Login failed';
      errEl.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign in';
    }
  }

  async function doLogout() {
    if (!confirm('Sign out?')) return;
    try { await CacheDB.clear(); } catch (e) {}
    try { await db.auth.signOut(); } catch (e) { console.error(e); }
    State.currentUser = null;
    State.currentProfile = null;
    location.reload();
  }

  function applyRoleBasedUI() {
    const profile = State.currentProfile;
    if (!profile) return;

    const role = profile.role;

    // 1. Update User Badge
    const badge = document.getElementById('userBadge');
    if (badge) {
      badge.innerHTML =
        '<span>' + escapeHtml(profile.username) + '</span>' +
        '<span class="role-pill role-' + role + '">' + role + '</span>';
      const av = document.getElementById('userAvatar');
      if (av) av.textContent = (profile.username || '?').charAt(0).toUpperCase();
    }

    // 2. Hide Nav Items
    const navPermMap = {
      'map': 'page:map',
      'dashboard': 'page:dashboard',
      'projects': 'page:projects',
      'import': 'page:import',
      'cells': 'page:cells',
      'tools': 'page:tools'
    };

    Object.entries(navPermMap).forEach(([page, perm]) => {
      const btn = document.querySelector('[data-page="' + page + '"]');
      if (btn) btn.style.display = hasPermission(perm) ? '' : 'none';
    });

    // 3. Hide Tool Cards
    const toolCardPerms = [
      { selector: '.tool-card[onclick*="tool-pci-checker"]', perm: 'tool:pci' },
      { selector: '.tool-card[onclick*="tool-gsm-planner"]', perm: 'tool:gsm' },
      { selector: '.tool-card[onclick*="tool-neighbor"]', perm: 'tool:neighbor' },
      { selector: '.tool-card[onclick*="tool-3g-nb"]', perm: 'tool:3g-nb' },
      { selector: '.tool-card[onclick*="tool-hsn"]', perm: 'tool:hsn' },
      { selector: '.tool-card[onclick*="tool-psc-checker"]', perm: 'tool:psc' },
      { selector: '.tool-card[onclick*="tool-bsic"]', perm: 'tool:bsic' },
      { selector: '.tool-card[onclick*="tool-symmetry"]', perm: 'tool:symmetry' },
      { selector: '.tool-card[onclick*="tool-azimuth-opt"]', perm: 'tool:azimuth-opt' },
      { selector: '.tool-card[onclick*="tool-new-site"]', perm: 'tool:new-site' },
      { selector: '.tool-card[onclick*="tool-distance"]', perm: 'tool:distance' },
      { selector: '.tool-card[onclick*="tool-azimuth"]', perm: 'tool:azimuth' },
      { selector: '.tool-card[onclick*="tool-unit"]', perm: 'tool:unit' },
      { selector: '.tool-card[onclick*="tool-kml"]', perm: 'tool:kml' }
    ];

    toolCardPerms.forEach(item => {
      document.querySelectorAll(item.selector).forEach(el => {
        el.style.display = hasPermission(item.perm) ? '' : 'none';
      });
    });

    // 4. Add admin button
    if (role === 'admin' && !document.getElementById('addUserBtn')) {
      const b = document.createElement('button');
      b.id = 'addUserBtn';
      b.innerHTML = '<i data-lucide="user-plus"></i><span>Add user</span>';
      b.onclick = () => { closeUserMenu(); showAddUserModal(); };
      const um = document.getElementById('userMenu');
      if (um) um.prepend(b);
      if (window.lucide) lucide.createIcons();
    }

    console.log('%c🔐 Role: ' + role.toUpperCase(), 'color:#124191;font-weight:bold;');
  }

  async function checkAuthOnLoad() {
    try {
      const { data: { session } } = await db.auth.getSession();

      if (session && session.user) {
        const { data: profile } = await db.from('profiles')
          .select('*').eq('id', session.user.id).single();

        if (profile && profile.is_active) {
          State.currentUser = session.user;
          State.currentProfile = profile;
          document.getElementById('loginScreen').style.display = 'none';
          applyRoleBasedUI();

          setTimeout(async () => {
            if (State.map) {
              try { State.map.invalidateSize(); } catch (err) {}
            }
            await loadProjects();
            if (typeof loadCells === 'function') await loadCells();
          }, 500);

          toast('Welcome back, ' + (profile.full_name || profile.username), 'success', 2000);
          return;
        }
      }

      document.getElementById('loginScreen').style.display = 'flex';
      document.querySelector('.app').style.display = 'none';

    } catch (e) {
      console.error('Auth check error:', e);
      document.getElementById('loginScreen').style.display = 'flex';
      document.querySelector('.app').style.display = 'none';
    }
  }

  function showApp() {
    const app = document.querySelector('.app');
    if (app) app.style.display = '';
  }

  window.doLogin = doLogin;
  window.doLogout = doLogout;
  window.applyRoleBasedUI = applyRoleBasedUI;
  window.checkAuthOnLoad = checkAuthOnLoad;
  window.showApp = showApp;

  // Bind login form
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await doLogin();
      });
    }
  });

  // Monitor auth changes
  if (db && db.auth) {
    db.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        State.currentUser = null;
        State.currentProfile = null;
      }
    });
  }

  console.log('✅ Login loaded');
})();
