/* =========================================================
   🔐 PERMISSIONS — Role-Based Access Control
   ========================================================= */
(function() {
  'use strict';

  const PERMISSIONS = {
    admin: {
      'page:map': true, 'page:dashboard': true, 'page:projects': true,
      'page:import': true, 'page:cells': true, 'page:tools': true,
      'tool:pci': true, 'tool:gsm': true, 'tool:neighbor': true,
      'tool:3g-nb': true, 'tool:hsn': true, 'tool:psc': true,
      'tool:bsic': true, 'tool:symmetry': true, 'tool:azimuth-opt': true,
      'tool:distance': true, 'tool:azimuth': true, 'tool:unit': true,
      'tool:kml': true, 'tool:new-site': true,
      'action:edit-cells': true, 'action:delete-cells': true,
      'action:manage-users': true, 'action:manage-projects': true,
      'action:apply-changes': true
    },
    engineer: {
      'page:map': true, 'page:dashboard': true, 'page:projects': true,
      'page:import': true, 'page:cells': true, 'page:tools': true,
      'tool:pci': true, 'tool:gsm': true, 'tool:neighbor': true,
      'tool:3g-nb': true, 'tool:hsn': true, 'tool:psc': true,
      'tool:bsic': true, 'tool:symmetry': true, 'tool:azimuth-opt': true,
      'tool:distance': true, 'tool:azimuth': true, 'tool:unit': true,
      'tool:kml': true, 'tool:new-site': true,
      'action:edit-cells': true, 'action:delete-cells': false,
      'action:manage-users': false, 'action:manage-projects': true,
      'action:apply-changes': true
    },
    optimizer: {
      'page:map': true, 'page:dashboard': true, 'page:projects': false,
      'page:import': false, 'page:cells': true, 'page:tools': true,
      'tool:pci': true, 'tool:gsm': false, 'tool:neighbor': true,
      'tool:3g-nb': true, 'tool:hsn': true, 'tool:psc': true,
      'tool:bsic': true, 'tool:symmetry': true, 'tool:azimuth-opt': true,
      'tool:distance': true, 'tool:azimuth': true, 'tool:unit': true,
      'tool:kml': true, 'tool:new-site': false,
      'action:edit-cells': true, 'action:delete-cells': false,
      'action:manage-users': false, 'action:manage-projects': false,
      'action:apply-changes': true
    },
    viewer: {
      'page:map': true, 'page:dashboard': true, 'page:projects': false,
      'page:import': false, 'page:cells': true, 'page:tools': false,
      'tool:pci': false, 'tool:gsm': false, 'tool:neighbor': false,
      'tool:3g-nb': false, 'tool:hsn': false, 'tool:psc': false,
      'tool:bsic': false, 'tool:symmetry': false, 'tool:azimuth-opt': false,
      'tool:distance': true, 'tool:azimuth': true, 'tool:unit': true,
      'tool:kml': false, 'tool:new-site': false,
      'action:edit-cells': false, 'action:delete-cells': false,
      'action:manage-users': false, 'action:manage-projects': false,
      'action:apply-changes': false
    }
  };

  function hasPermission(perm) {
    const profile = State.currentProfile;
    if (!profile) return false;
    const rolePerms = PERMISSIONS[profile.role];
    return rolePerms && rolePerms[perm] === true;
  }

  function requirePermission(perm, action) {
    if (hasPermission(perm)) return true;
    if (typeof toast === 'function') {
      toast('You don\'t have permission for: ' + (action || perm), 'error', 4000);
    }
    return false;
  }

  window.PERMISSIONS = PERMISSIONS;
  window.hasPermission = hasPermission;
  window.requirePermission = requirePermission;

  console.log('✅ Permissions loaded');
})();
