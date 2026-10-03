/* =========================================================
   💾 PROJECTS — CRUD Operations
   ========================================================= */
(function() {
  'use strict';

  async function loadProjects() {
    try {
      const { data, error } = await db.from('rf_projects')
        .select('*').order('created_at', { ascending: false });
      if (error) throw error;

      State.allProjects = data || [];
      renderProjectsList();
      renderProjectSelect();
    } catch (e) {
      console.error(e);
      toast('Error loading projects: ' + e.message, 'error');
    }
  }

  function renderProjectsList() {
    const container = document.getElementById('projectsList');
    if (!container) return;

    if (!State.allProjects.length) {
      container.innerHTML = '<div style="text-align:center;padding:60px 20px;color:#5A6B87;grid-column:1/-1;">' +
        '<div style="font-size:56px;opacity:.3;margin-bottom:14px;">📁</div>' +
        '<h3 style="color:#0C1B3D;margin-bottom:8px;">No Projects Yet</h3>' +
        '</div>';
      return;
    }

    container.innerHTML = State.allProjects.map(p =>
      '<div style="background:#fff;border-radius:12px;padding:18px 20px;border:1px solid #E9EEF6;box-shadow:0 2px 8px rgba(12,27,61,.05);">' +
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;cursor:pointer;" onclick="openProject(' + p.id + ')">' +
          '<div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#124191,#00A1E0);display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;">📁</div>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-weight:700;font-size:14px;color:#0C1B3D;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
              escapeHtml(p.name) +
            '</div>' +
            '<div style="font-size:11.5px;color:#5A6B87;margin-top:2px;">' +
              escapeHtml(p.description || 'No description') +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;padding-top:12px;border-top:1px solid #F0F3F9;font-size:11.5px;color:#5A6B87;align-items:center;">' +
          '<span>' + new Date(p.created_at).toLocaleDateString('en-GB') + '</span>' +
          '<button onclick="event.stopPropagation();editProject(' + p.id + ')" style="margin-left:auto;padding:5px 10px;background:#EAF2FB;color:#124191;border:1px solid #D7DEEA;border-radius:6px;font-size:11.5px;font-weight:600;cursor:pointer;font-family:inherit;">Edit</button>' +
          '<button onclick="event.stopPropagation();deleteProject(' + p.id + ')" style="padding:5px 10px;background:#FCEAEA;color:#D64545;border:1px solid #F5D5D5;border-radius:6px;font-size:11.5px;font-weight:600;cursor:pointer;font-family:inherit;">Delete</button>' +
        '</div>' +
      '</div>'
    ).join('');
  }

  function renderProjectSelect() {
    const sel = document.getElementById('importProjectSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">Choose Project</option>' +
      State.allProjects.map(p =>
        '<option value="' + p.id + '">' + escapeHtml(p.name) + '</option>'
      ).join('');
  }

  function openProject(projectId) {
    State.currentProjectId = projectId;
    switchView('map');
    const proj = State.allProjects.find(p => p.id === projectId);
    const sub = document.getElementById('pageSubtitle');
    if (sub) sub.textContent = 'Project: ' + (proj ? proj.name : '');
    loadCells();
  }

  function openCreateProjectModal() {
    const m = document.getElementById('createProjectModal');
    if (m) {
      m.classList.add('show');
      setTimeout(() => {
        const inp = document.getElementById('newProjectName');
        if (inp) inp.focus();
      }, 200);
    }
  }

  function closeCreateProjectModal() {
    const m = document.getElementById('createProjectModal');
    if (m) m.classList.remove('show');
    const n = document.getElementById('newProjectName');
    const d = document.getElementById('newProjectDesc');
    if (n) n.value = '';
    if (d) d.value = '';
  }

  async function createProject() {
    const nameEl = document.getElementById('newProjectName');
    const descEl = document.getElementById('newProjectDesc');
    const name = (nameEl?.value || '').trim();
    const desc = (descEl?.value || '').trim();

    if (!name) { toast('Enter project name', 'error'); return; }

    const btn = document.getElementById('createProjectBtn');
    btn.disabled = true;
    btn.textContent = 'Creating...';

    try {
      const { data, error } = await db.from('rf_projects')
        .insert([{ name, description: desc }]).select().single();
      if (error) throw error;

      toast('Project created', 'success');
      closeCreateProjectModal();
      await loadProjects();

      if (data && data.id) {
        const sel = document.getElementById('importProjectSelect');
        if (sel) sel.value = data.id;
      }
    } catch (e) {
      toast('Error: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create';
    }
  }

  async function editProject(projectId) {
    const proj = State.allProjects.find(p => p.id === projectId);
    if (!proj) return;

    const newName = prompt('New project name:', proj.name);
    if (newName === null) return;
    const trimmed = newName.trim();
    if (!trimmed) { toast('Name cannot be empty', 'error'); return; }

    const newDesc = prompt('New description (optional):', proj.description || '');
    if (newDesc === null) return;

    try {
      const { error } = await db.from('rf_projects')
        .update({ name: trimmed, description: newDesc.trim() })
        .eq('id', projectId);
      if (error) throw error;
      toast('Project updated', 'success');
      await loadProjects();
    } catch (e) {
      toast('Error: ' + e.message, 'error');
    }
  }

  async function deleteProject(projectId) {
    const proj = State.allProjects.find(p => p.id === projectId);
    if (!proj) return;

    let cellCount = 0;
    try {
      const { count } = await db.from('rf_cells')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId);
      cellCount = count || 0;
    } catch (e) {}

    const msg = 'Delete project "' + proj.name + '"?\n\nWarning: This will delete ' + cellCount + ' cells inside it.';
    if (!confirm(msg)) return;

    try {
      const { error: cellErr } = await db.from('rf_cells').delete().eq('project_id', projectId);
      if (cellErr) throw cellErr;

      const { error: projErr } = await db.from('rf_projects').delete().eq('id', projectId);
      if (projErr) throw projErr;

      toast('Project deleted', 'success');
      await loadProjects();

      if (State.currentProjectId === projectId) {
        State.currentProjectId = null;
        await loadCells(false);
      }
    } catch (e) {
      toast('Error: ' + e.message, 'error');
    }
  }

  window.loadProjects = loadProjects;
  window.renderProjectsList = renderProjectsList;
  window.renderProjectSelect = renderProjectSelect;
  window.openProject = openProject;
  window.openCreateProjectModal = openCreateProjectModal;
  window.closeCreateProjectModal = closeCreateProjectModal;
  window.createProject = createProject;
  window.editProject = editProject;
  window.deleteProject = deleteProject;

  console.log('✅ Projects loaded');
})();
