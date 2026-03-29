/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   ResearchFlow Admin \u2014 Complete JS
   \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */

'use strict';

const RF = {
  apiUrl:     window.RF_API_URL  || '/admin/selfstudyresearchflow/api/',
  userApiUrl: window.RF_USER_API || '/admin/selfstudyresearchflow/api/users/',
  projects:   [],
  users:      [],
  currentTab: 'dashboard',
  confirmCb:  null,
  pickerTargetId: null,

  // \u2500\u2500 CSRF \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  csrf() {
    const m = document.cookie.match(/csrftoken=([^;]+)/);
    return m ? m[1] : '';
  },

  // \u2500\u2500 Fetch wrapper \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  async req(url, opts = {}) {
    opts.headers = Object.assign(
      { 'X-CSRFToken': this.csrf(), 'Content-Type': 'application/json' },
      opts.headers || {}
    );
    try {
      const r = await fetch(url, opts);
      let data;
      try { data = await r.json(); } catch { data = {}; }
      return { ok: r.ok, status: r.status, data };
    } catch (e) {
      return { ok: false, status: 0, data: { error: e.message } };
    }
  },

  get(params) {
    return this.req(`${this.apiUrl}?${new URLSearchParams(params)}`);
  },

  post(params, body) {
    return this.req(
      `${this.apiUrl}?${new URLSearchParams(params)}`,
      { method: 'POST', body: JSON.stringify(body) }
    );
  },

  userGet(params) {
    return this.req(`${this.userApiUrl}?${new URLSearchParams(params)}`);
  },

  // \u2500\u2500 Toast \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  toast(msg, type = 'info', duration = 3500) {
    const icons = {
      success: 'fa-circle-check',
      error:   'fa-circle-exclamation',
      info:    'fa-circle-info',
      warn:    'fa-triangle-exclamation'
    };
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${msg}</span>`;
    document.getElementById('toastContainer').appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(40px)';
      el.style.transition = '.3s ease';
      setTimeout(() => el.remove(), 300);
    }, duration);
  },

  // \u2500\u2500 Modal helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  openModal(id)  { document.getElementById(id).classList.add('open'); },
  closeModal(id) { document.getElementById(id).classList.remove('open'); },

  confirm(title, msg, cb) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMsg').textContent   = msg;
    this.confirmCb = cb;
    this.openModal('modalConfirm');
  },

  // \u2500\u2500 Utility helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  fmtDate(s) {
    if (!s) return '\u2014';
    try {
      return new Date(s).toLocaleString(undefined, {
        dateStyle: 'medium', timeStyle: 'short'
      });
    } catch { return s; }
  },

  fmtSize(b) {
    if (b === undefined || b === null) return '\u2014';
    if (b < 1024)    return `${b} B`;
    if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1048576).toFixed(1)} MB`;
  },

  esc(s) {
    const d = document.createElement('div');
    d.textContent = String(s ?? '');
    return d.innerHTML;
  },

  badge(val, map) {
    const cls = (map && map[val]) ? map[val] : 'badge-draft';
    return `<span class="badge ${cls}">${this.esc(val || '\u2014')}</span>`;
  },

  shortId(id) {
    if (!id) return '\u2014';
    return `<code style="font-size:.72rem;color:var(--clr-txt-muted)" title="${this.esc(id)}">${id.slice(0, 8)}\u2026</code>`;
  },

  // \u2500\u2500 Tab switching \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  switchTab(name) {
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const pane = document.getElementById(`tab-${name}`);
    if (pane) pane.classList.add('active');
    const link = document.querySelector(`[data-tab="${name}"]`);
    if (link) link.classList.add('active');
    const spanEl = link ? link.querySelector('span') : null;
    document.getElementById('topbarTitle').textContent = spanEl ? spanEl.textContent : name;
    this.currentTab = name;
    this.loadTab(name);
  },

  loadTab(name) {
    const map = {
      dashboard:      () => this.loadDashboard(),
      projects:       () => this.loadProjects(),
      files:          () => this.populateProjectSelect('fileProjectSelect', 'files'),
      teams:          () => this.populateProjectSelect('teamProjectSelect', 'teams'),
      comments:       () => this.populateProjectSelect('commentProjectSelect', 'comments'),
      collaborations: () => this.loadCollaborations(),
      notifications:  () => this.loadNotifications(),
      activities:     () => this.loadActivities(),
      papers:         () => this.loadPapers(),
      search:         () => {},
      replicas:       () => this.loadReplicas(),
    };
    if (map[name]) map[name]();
  },

  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  // DASHBOARD
  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  async loadDashboard() {
    const r = await this.get({ action: 'dashboard' });
    if (!r.ok) {
      this.toast('Dashboard load failed: ' + (r.data.error || 'Unknown error'), 'error');
      return;
    }
    const d  = r.data;
    const st = d.stats || {};

    this._setText('s-files',  st.research_files ?? 0);
    this._setText('s-collab', st.collaborations  ?? 0);
    this._setText('s-views',  st.total_views     ?? 0);
    this._setText('s-dl',     st.downloads       ?? 0);

    // recent projects
    const rp = d.recent_projects || [];
    document.getElementById('dashRecentProjects').innerHTML = rp.length
      ? rp.map(p => `
          <div class="dash-list-item">
            <div style="flex:1;overflow:hidden">
              <div class="dash-list-main">${this.esc(p.title)}</div>
              <div class="dash-list-sub">${this.fmtDate(p.created_at)}</div>
            </div>
            ${this.badge(p.access_level, { public: 'badge-public', private: 'badge-private' })}
          </div>`).join('')
      : '<div class="empty-state"><i class="fa-solid fa-folder-open"></i>No recent projects</div>';

    // recent files
    const rf = d.recent_files || [];
    document.getElementById('dashRecentFiles').innerHTML = rf.length
      ? rf.map(f => `
          <div class="dash-list-item">
            <div style="flex:1;overflow:hidden">
              <div class="dash-list-main">${this.esc(f.original_filename)}</div>
              <div class="dash-list-sub">${this.fmtSize(f.file_size)}</div>
            </div>
            <span style="color:var(--clr-txt-muted);font-size:.75rem;white-space:nowrap">${this.fmtDate(f.uploaded_at)}</span>
          </div>`).join('')
      : '<div class="empty-state"><i class="fa-solid fa-file-lines"></i>No recent files</div>';

    // pending collaborations
    const pc = d.collaboration_requests || [];
    document.getElementById('dashPendingCollabs').innerHTML = pc.length
      ? pc.map(c => `
          <div class="dash-list-item">
            <div style="flex:1;overflow:hidden">
              <div class="dash-list-main">Project: ${this.shortId(c.project_id)}</div>
              <div class="dash-list-sub">From: ${this.shortId(c.requester_id)}</div>
            </div>
            ${this.badge('pending', { pending: 'badge-pending' })}
          </div>`).join('')
      : '<div class="empty-state"><i class="fa-solid fa-handshake"></i>No pending requests</div>';

    // recent activity
    const ra = d.recent_activity || [];
    document.getElementById('dashRecentActivity').innerHTML = ra.length
      ? ra.map(a => `
          <div class="dash-list-item">
            <div style="flex:1;overflow:hidden">
              <div class="dash-list-main">${this.esc(a.action)}</div>
              <div class="dash-list-sub">${this.esc(a.description || '')}</div>
            </div>
            <span style="color:var(--clr-txt-muted);font-size:.75rem;white-space:nowrap">${this.fmtDate(a.created_at)}</span>
          </div>`).join('')
      : '<div class="empty-state"><i class="fa-solid fa-chart-line"></i>No recent activity</div>';
  },

  _setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  },

  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  // PROJECTS
  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  async loadProjects() {
    const tbody = document.getElementById('projectsBody');
    tbody.innerHTML = `<tr><td colspan="8" class="loading-row"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading\u2026</td></tr>`;
    const r = await this.get({ action: 'projects' });
    if (!r.ok) {
      tbody.innerHTML = `<tr><td colspan="8" class="loading-row" style="color:var(--clr-danger)">Failed to load projects.</td></tr>`;
      this.toast('Failed to load projects', 'error');
      return;
    }
    this.projects = Array.isArray(r.data) ? r.data : (r.data.results || []);
    this.renderProjects();
  },

  renderProjects() {
    const q      = (document.getElementById('projectSearch')?.value || '').toLowerCase();
    const access = document.getElementById('projectAccessFilter')?.value || '';
    const status = document.getElementById('projectStatusFilter')?.value || '';

    let list = this.projects.filter(p => {
      if (access && p.access_level !== access) return false;
      if (status && p.status        !== status) return false;
      if (q) {
        const haystack = `${p.title} ${p.description} ${(p.keywords || []).join(' ')}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const tbody = document.getElementById('projectsBody');
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="loading-row">No projects found.</td></tr>`;
      return;
    }

    const accessMap = { public: 'badge-public', private: 'badge-private' };
    const statusMap = { draft: 'badge-draft', active: 'badge-active', completed: 'badge-completed' };

    tbody.innerHTML = list.map(p => `
      <tr>
        <td>
          <span class="truncate" style="max-width:200px;display:block" title="${this.esc(p.title)}">
            ${this.esc(p.title)}
          </span>
        </td>
        <td>${this.shortId(p.owner_id)}</td>
        <td>${this.badge(p.access_level, accessMap)}</td>
        <td>${this.badge(p.status, statusMap)}</td>
        <td>${p.views ?? 0}</td>
        <td>${p.downloads ?? 0}</td>
        <td style="white-space:nowrap">${this.fmtDate(p.created_at)}</td>
        <td>
          <div class="action-btns">
            <button class="btn btn-secondary btn-sm btn-icon" title="View Detail"
              data-action="viewProject" data-id="${p.id}">
              <i class="fa-solid fa-eye"></i>
            </button>
            <button class="btn btn-primary btn-sm btn-icon" title="Edit"
              data-action="editProject" data-id="${p.id}">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn btn-danger btn-sm btn-icon" title="Delete"
              data-action="deleteProject" data-id="${p.id}">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>`).join('');
  },

  viewProject(id) {
    const p = this.projects.find(x => x.id === id);
    if (!p) return;
    document.getElementById('detailProjectTitle').textContent = p.title || 'Project Detail';
    document.getElementById('detailProjectBody').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
        <div>
          <div class="form-group">
            <label>Project ID</label>
            <code style="font-size:.78rem;word-break:break-all;color:var(--clr-primary)">${this.esc(p.id)}</code>
          </div>
          <div class="form-group">
            <label>Owner ID</label>
            <code style="font-size:.78rem;word-break:break-all;color:var(--clr-txt-muted)">${this.esc(p.owner_id)}</code>
          </div>
          <div class="form-group">
            <label>Title</label>
            <span>${this.esc(p.title)}</span>
          </div>
          <div class="form-group">
            <label>Description</label>
            <span style="font-size:.85rem;color:var(--clr-txt-muted)">${this.esc(p.description || '\u2014')}</span>
          </div>
          <div class="form-group">
            <label>Keywords</label>
            <div style="display:flex;flex-wrap:wrap;gap:.35rem">
              ${(p.keywords || []).length
                ? p.keywords.map(k => `<span class="badge badge-draft">${this.esc(k)}</span>`).join('')
                : '\u2014'}
            </div>
          </div>
        </div>
        <div>
          <div class="form-group">
            <label>Access Level</label>
            ${this.badge(p.access_level, { public: 'badge-public', private: 'badge-private' })}
          </div>
          <div class="form-group">
            <label>Status</label>
            ${this.badge(p.status, { draft: 'badge-draft', active: 'badge-active', completed: 'badge-completed' })}
          </div>
          <div class="form-group">
            <label>Views</label>
            <span>${p.views ?? 0}</span>
          </div>
          <div class="form-group">
            <label>Downloads</label>
            <span>${p.downloads ?? 0}</span>
          </div>
          <div class="form-group">
            <label>DOI</label>
            <span>${this.esc(p.doi || '\u2014')}</span>
          </div>
          <div class="form-group">
            <label>Open Access</label>
            <span>${p.open_access ? '\u2705 Yes' : '\u274c No'}</span>
          </div>
          <div class="form-group">
            <label>Created At</label>
            <span style="font-size:.85rem">${this.fmtDate(p.created_at)}</span>
          </div>
          <div class="form-group">
            <label>Updated At</label>
            <span style="font-size:.85rem">${this.fmtDate(p.updated_at)}</span>
          </div>
        </div>
      </div>`;
    this.openModal('modalProjectDetail');
  },

  openNewProjectModal() {
    document.getElementById('modalProjectTitle').textContent = 'New Project';
    document.getElementById('projectEditId').value   = '';
    document.getElementById('projectOwnerId').value  = '';
    document.getElementById('projectTitle').value    = '';
    document.getElementById('projectDesc').value     = '';
    document.getElementById('projectAccess').value   = 'private';
    document.getElementById('projectStatus').value   = 'draft';
    document.getElementById('projectKeywords').value = '';
    this.openModal('modalProject');
  },

  openEditProjectModal(id) {
    const p = this.projects.find(x => x.id === id);
    if (!p) return;
    document.getElementById('modalProjectTitle').textContent = 'Edit Project';
    document.getElementById('projectEditId').value   = p.id;
    document.getElementById('projectOwnerId').value  = p.owner_id || '';
    document.getElementById('projectTitle').value    = p.title || '';
    document.getElementById('projectDesc').value     = p.description || '';
    document.getElementById('projectAccess').value   = p.access_level || 'private';
    document.getElementById('projectStatus').value   = p.status || 'draft';
    document.getElementById('projectKeywords').value = (p.keywords || []).join(', ');
    this.openModal('modalProject');
  },

  async saveProject() {
    const id       = document.getElementById('projectEditId').value.trim();
    const ownerId  = document.getElementById('projectOwnerId').value.trim();
    const title    = document.getElementById('projectTitle').value.trim();
    const desc     = document.getElementById('projectDesc').value.trim();
    const access   = document.getElementById('projectAccess').value;
    const status   = document.getElementById('projectStatus').value;
    const kwRaw    = document.getElementById('projectKeywords').value.trim();
    const keywords = kwRaw ? kwRaw.split(',').map(k => k.trim()).filter(Boolean) : [];

    if (!title) { this.toast('Title is required', 'warn'); return; }
    if (!ownerId) { this.toast('Owner User ID is required', 'warn'); return; }

    const btn = document.getElementById('btnSaveProject');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving\u2026';

    const body = { title, description: desc, access_level: access, status, keywords };

    let r;
    if (id) {
      r = await this.post({ action: 'update_project' }, { project_id: id, ...body });
    } else {
      // For create we send owner via X-User-ID equivalent embedded in body
      body.owner_id = ownerId;
      r = await this.post({ action: 'create_project' }, body);
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save';

    if (r.ok || r.status === 200 || r.status === 201) {
      this.toast(id ? 'Project updated' : 'Project created', 'success');
      this.closeModal('modalProject');
      this.loadProjects();
    } else {
      this.toast('Save failed: ' + (r.data.error || JSON.stringify(r.data)), 'error');
    }
  },

  async deleteProject(id) {
    const p = this.projects.find(x => x.id === id);
    this.confirm(
      'Delete Project',
      `Delete "${p ? p.title : id}"? This will remove all related files, comments, and teams.`,
      async () => {
        const r = await this.post({ action: 'delete_project' }, { project_id: id });
        if (r.ok || r.status === 204) {
          this.toast('Project deleted', 'success');
          this.loadProjects();
        } else {
          this.toast('Delete failed: ' + (r.data.error || ''), 'error');
        }
      }
    );
  },

  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  // POPULATE PROJECT SELECTS
  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  async populateProjectSelect(selectId, tabContext) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    if (this.projects.length === 0) await this.loadProjectsForSelect();
    const current = sel.value;
    sel.innerHTML = '<option value="">Select a project\u2026</option>' +
      this.projects.map(p => `<option value="${p.id}">${this.esc(p.title)}</option>`).join('');
    if (current) sel.value = current;
  },

  async loadProjectsForSelect() {
    const r = await this.get({ action: 'projects' });
    if (r.ok) {
      this.projects = Array.isArray(r.data) ? r.data : (r.data.results || []);
    }
  },

  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  // FILES
  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  async loadFiles(projectId) {
    if (!projectId) return;
    const tbody = document.getElementById('filesBody');
    tbody.innerHTML = `<tr><td colspan="7" class="loading-row"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading\u2026</td></tr>`;
    const r = await this.get({ action: 'files', project_id: projectId });
    if (!r.ok) {
      tbody.innerHTML = `<tr><td colspan="7" class="loading-row" style="color:var(--clr-danger)">Failed to load files.</td></tr>`;
      return;
    }
    const files = Array.isArray(r.data) ? r.data : (r.data.results || []);
    if (!files.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="loading-row">No files in this project.</td></tr>`;
      return;
    }
    const typeMap = {
      pdf: 'fa-file-pdf', doc: 'fa-file-word', txt: 'fa-file-lines',
      code: 'fa-file-code', data: 'fa-file-csv', other: 'fa-file'
    };
    tbody.innerHTML = files.map(f => `
      <tr>
        <td>
          <span style="display:flex;align-items:center;gap:.5rem">
            <i class="fa-solid ${typeMap[f.file_type] || 'fa-file'}" style="color:var(--clr-primary)"></i>
            <span class="truncate" style="max-width:200px" title="${this.esc(f.original_filename)}">${this.esc(f.original_filename)}</span>
          </span>
        </td>
        <td><span class="badge badge-draft">${this.esc(f.file_type || 'other')}</span></td>
        <td>${this.fmtSize(f.file_size)}</td>
        <td>${this.esc(f.version || '\u2014')}</td>
        <td>${this.shortId(f.uploaded_by)}</td>
        <td style="white-space:nowrap">${this.fmtDate(f.uploaded_at)}</td>
        <td>
          <div class="action-btns">
            ${f.download_url
              ? `<a href="${f.download_url}" class="btn btn-secondary btn-sm btn-icon" title="Download" target="_blank">
                   <i class="fa-solid fa-download"></i>
                 </a>`
              : ''}
            <button class="btn btn-danger btn-sm btn-icon" title="Delete"
              data-action="deleteFile" data-id="${f.id}">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>`).join('');
  },

  async deleteFile(fileId) {
    this.confirm('Delete File', 'Delete this file permanently?', async () => {
      const r = await this.post({ action: 'delete_file' }, { file_id: fileId });
      if (r.ok || r.status === 204) {
        this.toast('File deleted', 'success');
        const sel = document.getElementById('fileProjectSelect');
        if (sel && sel.value) this.loadFiles(sel.value);
      } else {
        this.toast('Delete failed: ' + (r.data.error || ''), 'error');
      }
    });
  },

  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  // TEAMS
  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  async loadTeam(projectId) {
    if (!projectId) return;
    const tbody = document.getElementById('teamsBody');
    tbody.innerHTML = `<tr><td colspan="5" class="loading-row"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading\u2026</td></tr>`;
    const r = await this.get({ action: 'team', project_id: projectId });
    if (!r.ok) {
      tbody.innerHTML = `<tr><td colspan="5" class="loading-row" style="color:var(--clr-danger)">Failed to load team.</td></tr>`;
      return;
    }
    const team = Array.isArray(r.data) ? r.data : (r.data.results || []);
    if (!team.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="loading-row">No team members found.</td></tr>`;
      return;
    }
    const roleMap = { owner: 'badge-active', collaborator: 'badge-public', viewer: 'badge-draft' };
    tbody.innerHTML = team.map(t => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:.5rem">
            <div class="user-avatar" style="width:28px;height:28px;font-size:.7rem">
              ${(t.user_id || '?').slice(0, 1).toUpperCase()}
            </div>
            ${this.shortId(t.user_id)}
          </div>
        </td>
        <td>${this.badge(t.role, roleMap)}</td>
        <td>${t.can_edit
          ? '<span style="color:var(--clr-success)"><i class="fa-solid fa-check"></i></span>'
          : '<span style="color:var(--clr-danger)"><i class="fa-solid fa-xmark"></i></span>'}</td>
        <td>${t.can_manage
          ? '<span style="color:var(--clr-success)"><i class="fa-solid fa-check"></i></span>'
          : '<span style="color:var(--clr-danger)"><i class="fa-solid fa-xmark"></i></span>'}</td>
        <td style="white-space:nowrap">${this.fmtDate(t.joined_at)}</td>
      </tr>`).join('');
  },

  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  // COLLABORATIONS
  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  async loadCollaborations() {
    const tbody = document.getElementById('collabBody');
    tbody.innerHTML = `<tr><td colspan="7" class="loading-row"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading\u2026</td></tr>`;
    const statusFilter = document.getElementById('collabStatusFilter')?.value || '';
    const params = { action: 'collaborations' };
    if (statusFilter) params.status = statusFilter;
    const r = await this.get(params);
    if (!r.ok) {
      tbody.innerHTML = `<tr><td colspan="7" class="loading-row" style="color:var(--clr-danger)">Failed to load.</td></tr>`;
      return;
    }
    const list = Array.isArray(r.data) ? r.data : (r.data.results || []);
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="loading-row">No collaboration requests found.</td></tr>`;
      return;
    }
    const statusMap = { pending: 'badge-pending', approved: 'badge-approved', rejected: 'badge-rejected' };
    tbody.innerHTML = list.map(c => `
      <tr>
        <td>${this.shortId(c.project_id)}</td>
        <td>${this.shortId(c.requester_id)}</td>
        <td>${this.shortId(c.recipient_id)}</td>
        <td>
          <span class="truncate" style="max-width:150px;display:block" title="${this.esc(c.message || '')}">
            ${this.esc(c.message || '\u2014')}
          </span>
        </td>
        <td>${this.badge(c.status, statusMap)}</td>
        <td style="white-space:nowrap">${this.fmtDate(c.created_at)}</td>
        <td>
          <div class="action-btns">
            ${c.status === 'pending' ? `
              <button class="btn btn-success btn-sm" title="Approve"
                data-action="respondCollab" data-id="${c.id}" data-type="approve">
                <i class="fa-solid fa-check"></i>
              </button>
              <button class="btn btn-danger btn-sm" title="Reject"
                data-action="respondCollab" data-id="${c.id}" data-type="reject">
                <i class="fa-solid fa-xmark"></i>
              </button>` : '\u2014'}
          </div>
        </td>
      </tr>`).join('');
  },

  async respondCollab(requestId, actionType) {
    const label = actionType === 'approve' ? 'Approve' : 'Reject';
    this.confirm(
      `${label} Request`,
      `Are you sure you want to ${label.toLowerCase()} this collaboration request?`,
      async () => {
        const r = await this.post(
          { action: 'respond_collaboration' },
          { request_id: requestId, action_type: actionType }
        );
        if (r.ok) {
          this.toast(`Request ${actionType}d successfully`, 'success');
          this.loadCollaborations();
        } else {
          this.toast('Action failed: ' + (r.data.error || ''), 'error');
        }
      }
    );
  },

  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  // COMMENTS
  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  async loadComments(projectId) {
    if (!projectId) return;
    const tbody = document.getElementById('commentsBody');
    tbody.innerHTML = `<tr><td colspan="4" class="loading-row"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading\u2026</td></tr>`;
    const r = await this.get({ action: 'comments', project_id: projectId });
    if (!r.ok) {
      tbody.innerHTML = `<tr><td colspan="4" class="loading-row" style="color:var(--clr-danger)">Failed to load comments.</td></tr>`;
      return;
    }
    const list = Array.isArray(r.data) ? r.data : (r.data.results || []);
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="loading-row">No comments found.</td></tr>`;
      return;
    }
    tbody.innerHTML = list.map(c => `
      <tr>
        <td>${this.shortId(c.author_id)}</td>
        <td>
          <span class="truncate" style="max-width:280px;display:block" title="${this.esc(c.content)}">
            ${this.esc(c.content)}
          </span>
        </td>
        <td style="white-space:nowrap">${this.fmtDate(c.created_at)}</td>
        <td>
          <button class="btn btn-danger btn-sm btn-icon" title="Delete"
            data-action="deleteComment" data-id="${c.id}">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>`).join('');
  },

  async deleteComment(commentId) {
    this.confirm('Delete Comment', 'Delete this comment permanently?', async () => {
      const r = await this.post({ action: 'delete_comment' }, { comment_id: commentId });
      if (r.ok || r.status === 204) {
        this.toast('Comment deleted', 'success');
        const sel = document.getElementById('commentProjectSelect');
        if (sel && sel.value) this.loadComments(sel.value);
      } else {
        this.toast('Delete failed: ' + (r.data.error || ''), 'error');
      }
    });
  },

  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  // NOTIFICATIONS
  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  async loadNotifications() {
    const tbody = document.getElementById('notifBody');
    tbody.innerHTML = `<tr><td colspan="7" class="loading-row"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading\u2026</td></tr>`;
    const r = await this.get({ action: 'notifications' });
    if (!r.ok) {
      tbody.innerHTML = `<tr><td colspan="7" class="loading-row" style="color:var(--clr-danger)">Failed to load notifications.</td></tr>`;
      return;
    }
    const list = Array.isArray(r.data) ? r.data : (r.data.results || []);
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="loading-row">No notifications found.</td></tr>`;
      return;
    }
    const typeMap = {
      info:    'badge-active',
      warning: 'badge-pending',
      error:   'badge-rejected',
      success: 'badge-approved'
    };
    tbody.innerHTML = list.map(n => `
      <tr style="${!n.is_read ? 'background:rgba(108,99,255,.05)' : ''}">
        <td>${this.badge(n.notification_type || 'info', typeMap)}</td>
        <td>
          <span class="truncate" style="max-width:160px;display:block" title="${this.esc(n.title)}">
            <strong>${this.esc(n.title)}</strong>
          </span>
        </td>
        <td>
          <span class="truncate" style="max-width:220px;display:block" title="${this.esc(n.message)}">
            ${this.esc(n.message || '\u2014')}
          </span>
        </td>
        <td>${this.shortId(n.user_id)}</td>
        <td>${n.is_read
          ? '<span class="badge badge-read">Read</span>'
          : '<span class="badge badge-unread">Unread</span>'}</td>
        <td style="white-space:nowrap">${this.fmtDate(n.created_at)}</td>
        <td>
          <div class="action-btns">
            ${!n.is_read ? `
              <button class="btn btn-secondary btn-sm btn-icon" title="Mark Read"
                data-action="markNotifRead" data-id="${n.id}">
                <i class="fa-solid fa-check"></i>
              </button>` : ''}
          </div>
        </td>
      </tr>`).join('');
  },

  async markNotifRead(notifId) {
    const r = await this.post({ action: 'mark_notification_read' }, { notification_id: notifId });
    if (r.ok) {
      this.toast('Notification marked as read', 'success');
      this.loadNotifications();
    } else {
      this.toast('Failed: ' + (r.data.error || ''), 'error');
    }
  },

  async markAllNotifRead() {
    const r = await this.post({ action: 'mark_all_notifications_read' }, {});
    if (r.ok) {
      this.toast(r.data.message || 'All notifications marked as read', 'success');
      this.loadNotifications();
    } else {
      this.toast('Failed: ' + (r.data.error || ''), 'error');
    }
  },

  async deleteAllNotifications() {
    this.confirm('Delete All Notifications', 'Delete all your notifications? This cannot be undone.', async () => {
      const r = await this.post({ action: 'delete_all_notifications' }, {});
      if (r.ok) {
        this.toast(r.data.message || 'Notifications deleted', 'success');
        this.loadNotifications();
      } else {
        this.toast('Failed: ' + (r.data.error || ''), 'error');
      }
    });
  },

  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  // ACTIVITIES
  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  async loadActivities() {
    const tbody = document.getElementById('activitiesBody');
    tbody.innerHTML = `<tr><td colspan="5" class="loading-row"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading\u2026</td></tr>`;
    const r = await this.get({ action: 'activities' });
    if (!r.ok) {
      tbody.innerHTML = `<tr><td colspan="5" class="loading-row" style="color:var(--clr-danger)">Failed to load activities.</td></tr>`;
      return;
    }
    const list = Array.isArray(r.data) ? r.data : (r.data.results || []);
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="loading-row">No activities found.</td></tr>`;
      return;
    }
    tbody.innerHTML = list.map(a => `
      <tr>
        <td>${this.shortId(a.user_id)}</td>
        <td><span class="badge badge-active">${this.esc(a.action)}</span></td>
        <td>
          <span class="truncate" style="max-width:260px;display:block" title="${this.esc(a.description)}">
            ${this.esc(a.description || '\u2014')}
          </span>
        </td>
        <td><code style="font-size:.72rem">${this.esc(a.ip_address || '\u2014')}</code></td>
        <td style="white-space:nowrap">${this.fmtDate(a.created_at)}</td>
      </tr>`).join('');
  },

  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  // IMPORTED PAPERS
  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  async loadPapers() {
    const tbody = document.getElementById('papersBody');
    tbody.innerHTML = `<tr><td colspan="7" class="loading-row"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading\u2026</td></tr>`;
    const r = await this.get({ action: 'imported_papers' });
    if (!r.ok) {
      tbody.innerHTML = `<tr><td colspan="7" class="loading-row" style="color:var(--clr-danger)">Failed to load papers.</td></tr>`;
      return;
    }
    const list = Array.isArray(r.data) ? r.data : (r.data.results || []);
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="loading-row">No imported papers found.</td></tr>`;
      return;
    }
    tbody.innerHTML = list.map(p => `
      <tr>
        <td>
          <span class="truncate" style="max-width:220px;display:block" title="${this.esc(p.title)}">
            ${this.esc(p.title || '\u2014')}
          </span>
        </td>
        <td>
          <span class="truncate" style="max-width:160px;display:block">
            ${this.esc(Array.isArray(p.authors) ? p.authors.slice(0, 2).join(', ') + (p.authors.length > 2 ? '\u2026' : '') : (p.authors || '\u2014'))}
          </span>
        </td>
        <td>${p.publication_year || '\u2014'}</td>
        <td>
          ${p.doi
            ? `<a href="https://doi.org/${p.doi}" target="_blank" style="color:var(--clr-primary);font-size:.78rem">${this.esc(p.doi)}</a>`
            : '\u2014'}
        </td>
        <td>${p.citation_count ?? 0}</td>
        <td>${p.open_access
          ? '<span style="color:var(--clr-success)">\u2705 Yes</span>'
          : '<span style="color:var(--clr-txt-muted)">No</span>'}</td>
        <td>
          <button class="btn btn-danger btn-sm btn-icon" title="Remove"
            data-action="deletePaper" data-id="${p.id}">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>`).join('');
  },

  async deletePaper(paperId) {
    this.confirm('Remove Paper', 'Remove this imported paper from the library?', async () => {
      const r = await this.post({ action: 'delete_imported_paper' }, { paper_id: paperId });
      if (r.ok || r.status === 204) {
        this.toast('Paper removed', 'success');
        this.loadPapers();
      } else {
        this.toast('Remove failed: ' + (r.data.error || ''), 'error');
      }
    });
  },

  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  // SEARCH
  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  async doSearch() {
    const q   = document.getElementById('globalSearchInput')?.value.trim() || '';
    const out = document.getElementById('searchResults');
    if (!q) { out.innerHTML = ''; return; }

    out.innerHTML = '<div class="empty-state"><i class="fa-solid fa-circle-notch fa-spin"></i> Searching\u2026</div>';
    const r = await this.get({ action: 'search', q });
    if (!r.ok) {
      out.innerHTML = `<div class="empty-state" style="color:var(--clr-danger)">Search failed.</div>`;
      return;
    }
    const list = r.data.results || [];
    if (!list.length) {
      out.innerHTML = `<div class="empty-state"><i class="fa-solid fa-magnifying-glass"></i> No results for "<strong>${this.esc(q)}</strong>"</div>`;
      return;
    }
    const accessMap = { public: 'badge-public', private: 'badge-private' };
    const statusMap = { draft: 'badge-draft', active: 'badge-active', completed: 'badge-completed' };
    out.innerHTML = list.map(p => `
      <div class="result-card">
        <div class="result-card-title" title="${this.esc(p.title)}">${this.esc(p.title)}</div>
        <div class="result-card-desc">${this.esc(p.description || 'No description')}</div>
        <div class="result-card-meta">
          ${this.badge(p.access_level, accessMap)}
          ${this.badge(p.status, statusMap)}
          ${p.publication_year ? `<span class="badge badge-draft">${p.publication_year}</span>` : ''}
          <span style="font-size:.72rem;color:var(--clr-txt-muted);margin-left:auto">${p.views ?? 0} views</span>
        </div>
      </div>`).join('');
  },

  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  // REPLICAS
  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  async loadReplicas() {
    const grid = document.getElementById('replicasGrid');
    grid.innerHTML = '<div class="empty-state"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading replicas\u2026</div>';
    const r = await this.get({ action: 'replicas' });
    if (!r.ok) {
      grid.innerHTML = '<div class="empty-state" style="color:var(--clr-danger)">Failed to load replicas.</div>';
      return;
    }
    const rf = r.data.research_flow_replicas || [];
    const up = r.data.userprofile_replicas   || [];

    // update topbar badge
    this._setText('replicaCount', rf.length);

    if (!rf.length && !up.length) {
      grid.innerHTML = '<div class="empty-state">No replicas found.</div>';
      return;
    }

    const buildCards = (urls, label, color) =>
      urls.map(url => `
        <div class="replica-card">
          <div class="replica-card-title">
            <span class="replica-dot" style="background:${color}"></span>
            ${this.esc(label)}
          </div>
          <div class="replica-url">${this.esc(url)}</div>
          <div style="margin-top:.6rem">
            <a href="${this.esc(url)}" target="_blank" class="btn btn-secondary btn-sm">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> Open
            </a>
          </div>
        </div>`).join('');

    grid.innerHTML =
      buildCards(rf, 'Research Flow Replica', 'var(--clr-success)') +
      buildCards(up, 'User Profile Replica',  'var(--clr-info)');
  },

  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  // USER PICKER
  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  async openUserPicker(targetInputId) {
    this.pickerTargetId = targetInputId;
    const list = document.getElementById('userPickerList');
    list.innerHTML = '<div class="empty-state"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading users\u2026</div>';
    document.getElementById('userPickerSearch').value = '';
    this.openModal('modalUserPicker');

    if (this.users.length === 0) {
      const r = await this.userGet({ action: 'list' });
      if (r.ok) {
        this.users = Array.isArray(r.data) ? r.data : (r.data.results || []);
      } else {
        list.innerHTML = `<div class="empty-state" style="color:var(--clr-danger)">Failed to load users.</div>`;
        return;
      }
    }
    this.renderUserPickerList('');
  },

  renderUserPickerList(query) {
    const list = document.getElementById('userPickerList');
    const q    = query.toLowerCase();
    const filtered = q
      ? this.users.filter(u =>
          (u.username || '').toLowerCase().includes(q) ||
          (u.email    || '').toLowerCase().includes(q) ||
          (String(u.user_id || '')).toLowerCase().includes(q)
        )
      : this.users;

    if (!filtered.length) {
      list.innerHTML = '<div class="empty-state">No users found.</div>';
      return;
    }
    list.innerHTML = filtered.map(u => {
      const initials = ((u.first_name || u.username || '?')[0]).toUpperCase();
      const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || '\u2014';
      return `
        <div class="user-picker-item" data-action="pickUser"
             data-user-id="${this.esc(u.user_id)}"
             data-username="${this.esc(u.username)}">
          <div class="user-avatar">${initials}</div>
          <div class="user-picker-info">
            <span class="user-picker-name">${this.esc(fullName)}</span>
            <span class="user-picker-email">${this.esc(u.email || '')}</span>
            <span class="user-picker-id">${this.esc(u.user_id || '')}</span>
          </div>
        </div>`;
    }).join('');
  },

  pickUser(userId) {
    if (this.pickerTargetId) {
      const input = document.getElementById(this.pickerTargetId);
      if (input) input.value = userId;
    }
    this.closeModal('modalUserPicker');
    this.pickerTargetId = null;
  },

  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  // REFRESH (topbar button)
  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  refresh() {
    // Invalidate project cache for selects
    this.projects = [];
    this.loadTab(this.currentTab);
    this.toast('Refreshed', 'info', 1800);
  },

  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  // INIT \u2014 wire up all events
  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  init() {
    // \u2500\u2500 Sidebar navigation \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    document.querySelectorAll('.nav-link[data-tab]').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        this.switchTab(link.dataset.tab);
        // close on mobile
        if (window.innerWidth <= 900) {
          document.getElementById('sidebar').classList.remove('open');
        }
      });
    });

    // \u2500\u2500 Sidebar toggle (mobile) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    document.getElementById('sidebarToggle')?.addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });

    // \u2500\u2500 Close overlay on sidebar background click (mobile) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    document.addEventListener('click', e => {
      const sidebar = document.getElementById('sidebar');
      const toggle  = document.getElementById('sidebarToggle');
      if (
        window.innerWidth <= 900 &&
        sidebar.classList.contains('open') &&
        !sidebar.contains(e.target) &&
        e.target !== toggle
      ) {
        sidebar.classList.remove('open');
      }
    });

    // \u2500\u2500 Refresh button \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    document.getElementById('btnRefresh')?.addEventListener('click', () => this.refresh());

    // \u2500\u2500 Modal close buttons \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => this.closeModal(btn.dataset.close));
    });

    // \u2500\u2500 Close modal on overlay click \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.classList.remove('open');
      });
    });

    // \u2500\u2500 Confirm modal OK \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    document.getElementById('btnConfirmOk')?.addEventListener('click', () => {
      this.closeModal('modalConfirm');
      if (typeof this.confirmCb === 'function') {
        this.confirmCb();
        this.confirmCb = null;
      }
    });

    // \u2500\u2500 New project button \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    document.getElementById('btnNewProject')?.addEventListener('click', () => {
      this.openNewProjectModal();
    });

    // \u2500\u2500 Save project \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    document.getElementById('btnSaveProject')?.addEventListener('click', () => {
      this.saveProject();
    });

    // \u2500\u2500 Project filters \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    document.getElementById('projectSearch')?.addEventListener('input', () => {
      this.renderProjects();
    });
    document.getElementById('projectAccessFilter')?.addEventListener('change', () => {
      this.renderProjects();
    });
    document.getElementById('projectStatusFilter')?.addEventListener('change', () => {
      this.renderProjects();
    });

    // \u2500\u2500 File project select \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    document.getElementById('fileProjectSelect')?.addEventListener('change', e => {
      this.loadFiles(e.target.value);
    });

    // \u2500\u2500 Team project select \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    document.getElementById('teamProjectSelect')?.addEventListener('change', e => {
      this.loadTeam(e.target.value);
    });

    // \u2500\u2500 Comment project select \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    document.getElementById('commentProjectSelect')?.addEventListener('change', e => {
      this.loadComments(e.target.value);
    });

    // \u2500\u2500 Collaboration status filter \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    document.getElementById('collabStatusFilter')?.addEventListener('change', () => {
      this.loadCollaborations();
    });

    // \u2500\u2500 Notification bulk actions \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    document.getElementById('btnMarkAllRead')?.addEventListener('click', () => {
      this.markAllNotifRead();
    });
    document.getElementById('btnDeleteAllNotif')?.addEventListener('click', () => {
      this.deleteAllNotifications();
    });

    // \u2500\u2500 Global search \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    document.getElementById('btnGlobalSearch')?.addEventListener('click', () => {
      this.doSearch();
    });
    document.getElementById('globalSearchInput')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') this.doSearch();
    });

    // \u2500\u2500 User picker open (button with data-open-picker) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    document.addEventListener('click', e => {
      const pickerBtn = e.target.closest('[data-open-picker]');
      if (pickerBtn) {
        e.preventDefault();
        this.openUserPicker(pickerBtn.dataset.openPicker);
      }
    });

    // \u2500\u2500 User picker search input \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    document.getElementById('userPickerSearch')?.addEventListener('input', e => {
      this.renderUserPickerList(e.target.value);
    });

    // \u2500\u2500 Delegated action handler (tables, picker list, etc.) \u2500\u2500\u2500\u2500\u2500\u2500\u2500
    document.addEventListener('click', e => {
      // find nearest element carrying data-action
      const el = e.target.closest('[data-action]');
      if (!el) return;
      const action = el.dataset.action;

      // Projects
      if (action === 'viewProject')   { this.viewProject(el.dataset.id); return; }
      if (action === 'editProject')   { this.openEditProjectModal(el.dataset.id); return; }
      if (action === 'deleteProject') { this.deleteProject(el.dataset.id); return; }

      // Files
      if (action === 'deleteFile')    { this.deleteFile(el.dataset.id); return; }

      // Collaborations
      if (action === 'respondCollab') {
        this.respondCollab(el.dataset.id, el.dataset.type);
        return;
      }

      // Comments
      if (action === 'deleteComment') { this.deleteComment(el.dataset.id); return; }

      // Notifications
      if (action === 'markNotifRead') { this.markNotifRead(el.dataset.id); return; }

      // Papers
      if (action === 'deletePaper')   { this.deletePaper(el.dataset.id); return; }

      // User picker selection
      if (action === 'pickUser')      { this.pickUser(el.dataset.userId); return; }
    });

    // \u2500\u2500 Load replica count badge on init \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    this.loadReplicaBadge();

    // \u2500\u2500 Load initial tab \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    this.switchTab('dashboard');
  },

  async loadReplicaBadge() {
    const r = await this.get({ action: 'replicas' });
    if (r.ok) {
      const count = (r.data.research_flow_replicas || []).length;
      this._setText('replicaCount', count);
    }
  },
};

// \u2500\u2500 Bootstrap \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
document.addEventListener('DOMContentLoaded', () => RF.init());