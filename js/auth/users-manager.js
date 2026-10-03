/* =========================================================
   🔐 USERS MANAGER — Admin Only
   ========================================================= */
(function() {
  'use strict';

  async function showUsersManager() {
    if (!requirePermission('action:manage-users', 'manage users')) return;

    const { data: users } = await db.from('profiles')
      .select('*').order('created_at', { ascending: false });

    const existing = document.getElementById('usersManagerModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'usersManagerModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(12,27,61,.7);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:99999;padding:20px;';

    const rows = (users || []).map(u =>
      '<tr style="border-bottom:1px solid #F0F3F9;">' +
        '<td style="padding:10px;"><b>' + escapeHtml(u.username) + '</b></td>' +
        '<td style="padding:10px;">' + escapeHtml(u.full_name || '—') + '</td>' +
        '<td style="padding:10px;">' +
          '<select onchange="updateUserRole(\'' + u.id + '\', this.value)" style="padding:5px 8px;border-radius:6px;border:1px solid #D7DEEA;font-size:12px;font-family:monospace;">' +
            ['admin','engineer','optimizer','viewer'].map(r =>
              '<option value="' + r + '"' + (u.role === r ? ' selected' : '') + '>' + r + '</option>'
            ).join('') +
          '</select>' +
        '</td>' +
        '<td style="padding:10px;">' +
          '<span style="background:' + (u.is_active ? '#E7F7EE;color:#1F9D55' : '#FCEAEA;color:#B91C1C') + ';padding:3px 10px;border-radius:10px;font-size:11px;font-weight:700;">' +
            (u.is_active ? 'Active' : 'Disabled') +
          '</span>' +
        '</td>' +
        '<td style="padding:10px;font-size:11px;color:#94A3B8;">' +
          (u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never') +
        '</td>' +
        '<td style="padding:10px;">' +
          '<button onclick="toggleUserActive(\'' + u.id + '\',' + !u.is_active + ')" style="padding:4px 10px;background:#F4F7FB;border:1px solid #D7DEEA;border-radius:6px;font-size:11px;cursor:pointer;">' +
            (u.is_active ? 'Disable' : 'Enable') +
          '</button>' +
        '</td>' +
      '</tr>'
    ).join('');

    modal.innerHTML =
      '<div style="background:#fff;border-radius:14px;width:100%;max-width:900px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 30px 80px rgba(0,0,0,.4);">' +
        '<div style="padding:20px 24px;border-bottom:1px solid #E9EEF6;display:flex;justify-content:space-between;align-items:center;">' +
          '<div>' +
            '<h3 style="margin:0;font-size:18px;color:#0C1B3D;">Users Management</h3>' +
            '<p style="margin:4px 0 0;font-size:12.5px;color:#5A6B87;">Manage roles and access permissions</p>' +
          '</div>' +
          '<button onclick="document.getElementById(\'usersManagerModal\').remove()" style="width:34px;height:34px;border-radius:8px;background:#FCEAEA;color:#D64545;border:none;cursor:pointer;font-size:16px;">✕</button>' +
        '</div>' +
        '<div style="padding:20px 24px;overflow-y:auto;">' +
          '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
            '<thead><tr style="background:#EAF2FB;">' +
              '<th style="padding:10px;text-align:left;font-size:11px;color:#124191;text-transform:uppercase;">Username</th>' +
              '<th style="padding:10px;text-align:left;font-size:11px;color:#124191;text-transform:uppercase;">Full Name</th>' +
              '<th style="padding:10px;text-align:left;font-size:11px;color:#124191;text-transform:uppercase;">Role</th>' +
              '<th style="padding:10px;text-align:left;font-size:11px;color:#124191;text-transform:uppercase;">Status</th>' +
              '<th style="padding:10px;text-align:left;font-size:11px;color:#124191;text-transform:uppercase;">Last Login</th>' +
              '<th style="padding:10px;text-align:left;font-size:11px;color:#124191;text-transform:uppercase;">Actions</th>' +
            '</tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);
    modal.addEventListener('click', e => {
      if (e.target.id === 'usersManagerModal') modal.remove();
    });
  }

  async function updateUserRole(userId, newRole) {
    if (!requirePermission('action:manage-users')) return;
    try {
      const { error } = await db.from('profiles')
        .update({ role: newRole }).eq('id', userId);
      if (error) throw error;
      toast('Role updated to ' + newRole, 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function toggleUserActive(userId, active) {
    if (!requirePermission('action:manage-users')) return;
    try {
      const { error } = await db.from('profiles')
        .update({ is_active: active }).eq('id', userId);
      if (error) throw error;
      toast('User ' + (active ? 'enabled' : 'disabled'), 'success');
      document.getElementById('usersManagerModal').remove();
      showUsersManager();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function showAddUserModal() {
    if (!hasPermission('action:manage-users')) {
      toast('You don\'t have permission', 'error');
      return;
    }

    const existing = document.getElementById('addUserModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'addUserModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(12,27,61,.7);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:99999;padding:20px;';

    modal.innerHTML =
      '<div style="background:#fff;border-radius:14px;width:100%;max-width:480px;box-shadow:0 30px 80px rgba(0,0,0,.4);">' +
        '<div style="padding:20px 24px;border-bottom:1px solid #E9EEF6;display:flex;justify-content:space-between;align-items:center;">' +
          '<div>' +
            '<h3 style="margin:0;font-size:17px;color:#0C1B3D;">Add New User</h3>' +
            '<p style="margin:4px 0 0;font-size:12px;color:#5A6B87;">Account created instantly</p>' +
          '</div>' +
          '<button onclick="document.getElementById(\'addUserModal\').remove()" style="width:32px;height:32px;border-radius:8px;background:#FCEAEA;color:#D64545;border:none;cursor:pointer;font-size:16px;">✕</button>' +
        '</div>' +
        '<div style="padding:20px 24px;">' +
          '<div style="margin-bottom:14px;">' +
            '<label style="display:block;font-size:11.5px;font-weight:700;color:#5A6B87;text-transform:uppercase;margin-bottom:6px;">Username *</label>' +
            '<input type="text" id="newUsername" placeholder="john.doe" style="width:100%;padding:11px 14px;border:1.5px solid #D7DEEA;border-radius:10px;font-size:13.5px;font-family:monospace;outline:none;box-sizing:border-box;">' +
          '</div>' +
          '<div style="margin-bottom:14px;">' +
            '<label style="display:block;font-size:11.5px;font-weight:700;color:#5A6B87;text-transform:uppercase;margin-bottom:6px;">Full Name</label>' +
            '<input type="text" id="newFullName" placeholder="John Doe" style="width:100%;padding:11px 14px;border:1.5px solid #D7DEEA;border-radius:10px;font-size:13.5px;outline:none;box-sizing:border-box;">' +
          '</div>' +
          '<div style="margin-bottom:14px;">' +
            '<label style="display:block;font-size:11.5px;font-weight:700;color:#5A6B87;text-transform:uppercase;margin-bottom:6px;">Password * (8+ chars)</label>' +
            '<input type="text" id="newPassword" placeholder="StrongPass123!" style="width:100%;padding:11px 14px;border:1.5px solid #D7DEEA;border-radius:10px;font-size:13.5px;font-family:monospace;outline:none;box-sizing:border-box;">' +
          '</div>' +
          '<div style="margin-bottom:14px;">' +
            '<label style="display:block;font-size:11.5px;font-weight:700;color:#5A6B87;text-transform:uppercase;margin-bottom:6px;">Role</label>' +
            '<select id="newRole" style="width:100%;padding:11px 14px;border:1.5px solid #D7DEEA;border-radius:10px;font-size:13.5px;font-family:inherit;outline:none;background:#fff;box-sizing:border-box;">' +
              '<option value="viewer">Viewer</option>' +
              '<option value="optimizer">Optimizer</option>' +
              '<option value="engineer">Engineer</option>' +
              '<option value="admin">Admin</option>' +
            '</select>' +
          '</div>' +
          '<div id="addUserError" style="display:none;background:#FCEAEA;color:#B91C1C;padding:10px 14px;border-radius:8px;font-size:12.5px;margin-bottom:14px;"></div>' +
        '</div>' +
        '<div style="padding:14px 24px;background:#FBFCFE;border-top:1px solid #E9EEF6;display:flex;gap:10px;justify-content:flex-end;border-radius:0 0 14px 14px;">' +
          '<button onclick="document.getElementById(\'addUserModal\').remove()" style="padding:9px 18px;background:#fff;color:#5A6B87;border:1.5px solid #D7DEEA;border-radius:9px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;">Cancel</button>' +
          '<button id="createUserBtn" onclick="handleCreateUser()" style="padding:9px 22px;background:#1F9D55;color:#fff;border:none;border-radius:9px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;">Create</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);
    setTimeout(() => document.getElementById('newUsername').focus(), 100);
    modal.addEventListener('click', e => {
      if (e.target.id === 'addUserModal') modal.remove();
    });
  }

  async function handleCreateUser() {
    const username = (document.getElementById('newUsername').value || '').trim().toLowerCase();
    const fullName = (document.getElementById('newFullName').value || '').trim();
    const password = document.getElementById('newPassword').value;
    const role = document.getElementById('newRole').value;
    const btn = document.getElementById('createUserBtn');
    const errBox = document.getElementById('addUserError');

    errBox.style.display = 'none';

    if (!username || username.length < 3) {
      errBox.textContent = 'Username must be at least 3 characters';
      errBox.style.display = 'block';
      return;
    }
    if (!/^[a-z0-9._-]+$/.test(username)) {
      errBox.textContent = 'Only letters, numbers, . _ -';
      errBox.style.display = 'block';
      return;
    }
    if (!password || password.length < 8) {
      errBox.textContent = 'Password must be at least 8 characters';
      errBox.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Creating...';

    try {
      const { data, error } = await db.rpc('admin_create_user', {
        p_username: username,
        p_password: password,
        p_full_name: fullName || username,
        p_role: role
      });

      if (error) throw error;
      if (data && data.error) throw new Error(data.error);

      toast('User created: ' + username, 'success');
      document.getElementById('addUserModal').remove();

      if (document.getElementById('usersManagerModal')) {
        document.getElementById('usersManagerModal').remove();
        showUsersManager();
      }
    } catch (e) {
      console.error(e);
      errBox.textContent = e.message || 'Failed to create';
      errBox.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create';
    }
  }

  window.showUsersManager = showUsersManager;
  window.updateUserRole = updateUserRole;
  window.toggleUserActive = toggleUserActive;
  window.showAddUserModal = showAddUserModal;
  window.handleCreateUser = handleCreateUser;

  console.log('✅ Users manager loaded');
})();
