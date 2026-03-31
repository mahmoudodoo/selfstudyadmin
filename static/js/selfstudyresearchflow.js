// CSRF token
function getCSRFToken() {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, 10) === 'csrftoken=') {
                cookieValue = decodeURIComponent(cookie.substring(10));
                break;
            }
        }
    }
    return cookieValue;
}

// Spinner
function showSpinner() {
    let spinner = document.getElementById('global-spinner');
    if (!spinner) {
        spinner = document.createElement('div');
        spinner.id = 'global-spinner';
        spinner.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: 60px; height: 60px; border: 5px solid rgba(78,205,196,0.3);
            border-top: 5px solid #4ECDC4; border-radius: 50%;
            animation: spin 1s linear infinite; z-index: 10000;
        `;
        document.body.appendChild(spinner);
        if (!document.querySelector('#spinner-keyframes')) {
            const style = document.createElement('style');
            style.id = 'spinner-keyframes';
            style.textContent = `@keyframes spin { 0% { transform: translate(-50%, -50%) rotate(0deg); } 100% { transform: translate(-50%, -50%) rotate(360deg); } }`;
            document.head.appendChild(style);
        }
    }
    spinner.style.display = 'block';
}
function hideSpinner() {
    const s = document.getElementById('global-spinner');
    if (s) s.style.display = 'none';
}

// API fetch
const apiFetch = async (url, options = {}) => {
    showSpinner();
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Token ${window.AUTH_TOKEN || ''}`,
        'X-CSRFToken': getCSRFToken()
    };
    try {
        const response = await fetch(url, { ...options, headers });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
        return data;
    } finally {
        hideSpinner();
    }
};

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tabId = btn.dataset.tab;
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
        loadTabData(tabId);
    });
});

async function loadTabData(tabId) {
    if (tabId === 'researchers') await loadResearchers();
    else if (tabId === 'projects') await loadProjects();
    else if (tabId === 'openalex') await loadOpenAlex();
    else if (tabId === 'local-libraries') await loadLocalLibraries();
    else if (tabId === 'activities') await loadActivities();
    else if (tabId === 'teams') await loadTeams();
    else if (tabId === 'collaborations') await loadCollaborations();
}

async function loadResearchers() {
    const data = await apiFetch('/selfstudyresearchflow/api/researchers/');
    const tbody = document.querySelector('#researchers-table tbody');
    tbody.innerHTML = data.map(p => `
        <tr>
            <td>${p.user_id}</td>
            <td>${p.username || ''}</td>
            <td>${p.first_name || ''}</td>
            <td>${p.last_name || ''}</td>
            <td>${p.email || ''}</td>
            <td>
                <button class="edit-btn" data-id="${p.id}" data-resource="researcher">Edit</button>
                <button class="delete-btn" data-id="${p.id}" data-resource="researcher">Delete</button>
            </td>
        </tr>
    `).join('');
    attachActionButtons();
}

async function loadProjects() {
    const data = await apiFetch('/selfstudyresearchflow/api/projects/');
    const tbody = document.querySelector('#projects-table tbody');
    tbody.innerHTML = data.map(p => `
        <tr>
            <td>${p.id}</td>
            <td>${p.title}</td>
            <td>${p.owner_id || ''}</td>
            <td>${p.access_level}</td>
            <td>${p.status}</td>
            <td>
                <button class="edit-btn" data-id="${p.id}" data-resource="project">Edit</button>
                <button class="delete-btn" data-id="${p.id}" data-resource="project">Delete</button>
            </td>
        </tr>
    `).join('');
    attachActionButtons();
}

async function loadOpenAlex() {
    const data = await apiFetch('/selfstudyresearchflow/api/openalex-libraries/');
    const tbody = document.querySelector('#openalex-table tbody');
    tbody.innerHTML = data.map(p => `
        <tr>
            <td>${p.id}</td>
            <td>${p.title}</td>
            <td>${p.user_id || ''}</td>
            <td>${p.doi || ''}</td>
            <td>
                <button class="edit-btn" data-id="${p.id}" data-resource="openalex">Edit</button>
                <button class="delete-btn" data-id="${p.id}" data-resource="openalex">Delete</button>
            </td>
        </tr>
    `).join('');
    attachActionButtons();
}

async function loadLocalLibraries() {
    const data = await apiFetch('/selfstudyresearchflow/api/local-libraries/');
    const tbody = document.querySelector('#local-libraries-table tbody');
    tbody.innerHTML = data.map(p => `
        <tr>
            <td>${p.id}</td>
            <td>${p.title}</td>
            <td>${p.owner_id || ''}</td>
            <td>${p.access_level}</td>
            <td>${p.status}</td>
            <td>
                <button class="edit-btn" data-id="${p.id}" data-resource="local_library">Edit</button>
                <button class="delete-btn" data-id="${p.id}" data-resource="local_library">Delete</button>
            </td>
        </tr>
    `).join('');
    attachActionButtons();
}

async function loadActivities() {
    const data = await apiFetch('/selfstudyresearchflow/api/activities/');
    const tbody = document.querySelector('#activities-table tbody');
    tbody.innerHTML = data.map(a => `
        <tr>
            <td>${a.id}</td>
            <td>${a.user_id || ''}</td>
            <td>${a.action}</td>
            <td>${a.description}</td>
            <td>${a.created_at}</td>
            <td><button class="delete-btn" data-id="${a.id}" data-resource="activity">Delete</button></td>
        </tr>
    `).join('');
    attachActionButtons();
}

async function loadTeams() {
    const tbody = document.querySelector('#teams-table tbody');
    tbody.innerHTML = '<tr><td colspan="5">Teams management coming soon</td></tr>';
}

async function loadCollaborations() {
    const data = await apiFetch('/selfstudyresearchflow/api/collaborations/');
    const tbody = document.querySelector('#collaborations-table tbody');
    tbody.innerHTML = data.map(c => `
        <tr>
            <td>${c.id}</td>
            <td>${c.project_id || ''}</td>
            <td>${c.requester_id || ''}</td>
            <td>${c.recipient_id || ''}</td>
            <td>${c.status}</td>
            <td><button class="delete-btn" data-id="${c.id}" data-resource="collaboration">Delete</button></td>
        </tr>
    `).join('');
    attachActionButtons();
}

// Helper: get researcher profiles for owner dropdown
let researcherListCache = null;
async function getResearcherList() {
    if (!researcherListCache) {
        researcherListCache = await apiFetch('/selfstudyresearchflow/api/researcher-profiles-list/');
    }
    return researcherListCache;
}

// Helper: get users from userprofile for researcher creation
let userListCache = null;
async function getUserList() {
    if (!userListCache) {
        userListCache = await apiFetch('/selfstudyresearchflow/api/users/');
    }
    return userListCache;
}

// Forms
async function openEditModal(resource, id) {
    if (resource === 'researcher') {
        const item = await apiFetch(`/selfstudyresearchflow/api/researchers/${id}/`);
        await showResearcherForm(item, id);
    } else if (resource === 'project') {
        const item = await apiFetch(`/selfstudyresearchflow/api/projects/${id}/`);
        await showProjectForm(item, id);
    } else if (resource === 'openalex') {
        const item = await apiFetch(`/selfstudyresearchflow/api/openalex-libraries/${id}/`);
        showOpenAlexForm(item, id);
    } else if (resource === 'local_library') {
        const item = await apiFetch(`/selfstudyresearchflow/api/local-libraries/${id}/`);
        await showProjectForm(item, id);
    }
}

function openCreateModal(resource) {
    if (resource === 'researcher') showResearcherForm({}, null);
    else if (resource === 'project') showProjectForm({}, null);
    else if (resource === 'openalex') showOpenAlexForm({}, null);
    else if (resource === 'local_library') showProjectForm({}, null);
    else if (resource === 'collaboration') showCollaborationForm({}, null);
}

async function showResearcherForm(data, id) {
    const modal = document.getElementById('generic-modal');
    const title = document.getElementById('modal-title');
    const fieldsDiv = document.getElementById('modal-fields');
    title.innerText = id ? 'Edit Researcher Profile' : 'Create Researcher Profile';

    const users = await getUserList();
    const selectedUserId = data.user_id || '';

    let userOptions = '<option value="">-- Select User --</option>';
    users.forEach(u => {
        userOptions += `<option value="${u.user_id}" data-first="${u.first_name}" data-last="${u.last_name}" data-email="${u.email}" data-username="${u.username}" ${u.user_id === selectedUserId ? 'selected' : ''}>${u.username} (${u.first_name} ${u.last_name})</option>`;
    });

    const html = `
        <div style="margin-bottom: 15px;">
            <label>Select User (auto-fills below)</label>
            <select id="user-select" onchange="autoFillResearcherFields()">${userOptions}</select>
        </div>
        <label>User ID (auto)</label><input type="text" id="user_id" name="user_id" value="${data.user_id || ''}" readonly>
        <label>Username (auto)</label><input type="text" id="username" name="username" value="${data.username || ''}" readonly>
        <label>First Name (auto)</label><input type="text" id="first_name" name="first_name" value="${data.first_name || ''}" readonly>
        <label>Last Name (auto)</label><input type="text" id="last_name" name="last_name" value="${data.last_name || ''}" readonly>
        <label>Email (auto)</label><input type="email" id="email" name="email" value="${data.email || ''}" readonly>
        <hr>
        <label>University</label><input name="university" value="${data.university || ''}">
        <label>Institution</label><input name="institution" value="${data.institution || ''}">
        <label>Department</label><input name="department" value="${data.department || ''}">
        <label>Bio</label><textarea name="bio">${data.bio || ''}</textarea>
        <label>Research Interests (comma separated)</label><input name="research_interests" value="${(data.research_interests || []).join(', ')}">
        <label>ORCID ID</label><input name="orcid_id" value="${data.orcid_id || ''}">
        <label>Google Scholar ID</label><input name="google_scholar_id" value="${data.google_scholar_id || ''}">
        <label>Website</label><input name="website" value="${data.website || ''}">
    `;
    fieldsDiv.innerHTML = html;
    modal.style.display = 'flex';

    window.autoFillResearcherFields = function() {
        const select = document.getElementById('user-select');
        const selected = select.options[select.selectedIndex];
        if (selected.value) {
            document.getElementById('user_id').value = selected.value;
            document.getElementById('username').value = selected.dataset.username || '';
            document.getElementById('first_name').value = selected.dataset.first || '';
            document.getElementById('last_name').value = selected.dataset.last || '';
            document.getElementById('email').value = selected.dataset.email || '';
        } else {
            document.getElementById('user_id').value = '';
            document.getElementById('username').value = '';
            document.getElementById('first_name').value = '';
            document.getElementById('last_name').value = '';
            document.getElementById('email').value = '';
        }
    };
    if (selectedUserId) window.autoFillResearcherFields();

    document.getElementById('modal-form').onsubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const payload = {
            user_id: formData.get('user_id'),
            username: formData.get('username'),
            first_name: formData.get('first_name'),
            last_name: formData.get('last_name'),
            email: formData.get('email'),
            university: formData.get('university'),
            institution: formData.get('institution'),
            department: formData.get('department'),
            bio: formData.get('bio'),
            research_interests: formData.get('research_interests').split(',').map(s => s.trim()).filter(s => s),
            orcid_id: formData.get('orcid_id'),
            google_scholar_id: formData.get('google_scholar_id'),
            website: formData.get('website')
        };
        let url = '/selfstudyresearchflow/api/researchers/';
        let method = 'POST';
        if (id) {
            url = `/selfstudyresearchflow/api/researchers/${id}/`;
            method = 'PUT';
        }
        try {
            await apiFetch(url, { method, body: JSON.stringify(payload) });
            modal.style.display = 'none';
            loadTabData('researchers');
        } catch (err) { alert(err.message); }
    };
}

async function showProjectForm(data, id) {
    const modal = document.getElementById('generic-modal');
    const title = document.getElementById('modal-title');
    const fieldsDiv = document.getElementById('modal-fields');
    title.innerText = id ? 'Edit Project' : 'Create Project';

    const researchers = await getResearcherList();
    const selectedOwnerId = data.owner_id || '';

    let ownerOptions = '<option value="">-- Select Owner (Researcher) --</option>';
    researchers.forEach(r => {
        ownerOptions += `<option value="${r.user_id}" ${r.user_id === selectedOwnerId ? 'selected' : ''}>${r.name} (${r.user_id})</option>`;
    });

    const html = `
        <label>Title</label><input name="title" value="${data.title || ''}" required>
        <label>Description</label><textarea name="description">${data.description || ''}</textarea>
        <label>Access Level</label><select name="access_level">
            <option value="private" ${data.access_level === 'private' ? 'selected' : ''}>Private</option>
            <option value="public" ${data.access_level === 'public' ? 'selected' : ''}>Public</option>
        </select>
        <label>Status</label><select name="status">
            <option value="draft" ${data.status === 'draft' ? 'selected' : ''}>Draft</option>
            <option value="published" ${data.status === 'published' ? 'selected' : ''}>Published</option>
        </select>
        <label>Owner (Researcher)</label>
        <select name="owner_id" required>${ownerOptions}</select>
    `;
    fieldsDiv.innerHTML = html;
    modal.style.display = 'flex';

    document.getElementById('modal-form').onsubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const payload = Object.fromEntries(formData.entries());
        let url = '/selfstudyresearchflow/api/projects/';
        let method = 'POST';
        if (id) {
            url = `/selfstudyresearchflow/api/projects/${id}/`;
            method = 'PUT';
        }
        try {
            await apiFetch(url, { method, body: JSON.stringify(payload) });
            modal.style.display = 'none';
            loadTabData('projects');
        } catch (err) { alert(err.message); }
    };
}

function showOpenAlexForm(data, id) {
    const modal = document.getElementById('generic-modal');
    const title = document.getElementById('modal-title');
    const fieldsDiv = document.getElementById('modal-fields');
    title.innerText = id ? 'Edit OpenAlex Paper' : 'Import OpenAlex Paper';
    const html = `
        <label>Title</label><input name="title" value="${data.title || ''}" required>
        <label>DOI</label><input name="doi" value="${data.doi || ''}">
        <label>User ID (from researcher profile)</label><input name="user_id" value="${data.user_id || ''}" required>
        <label>OpenAlex ID</label><input name="openalex_id" value="${data.openalex_id || ''}">
        <label>Authors (JSON array)</label><textarea name="authors">${JSON.stringify(data.authors || [])}</textarea>
        <label>Abstract</label><textarea name="abstract">${data.abstract || ''}</textarea>
    `;
    fieldsDiv.innerHTML = html;
    modal.style.display = 'flex';
    document.getElementById('modal-form').onsubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        let payload = Object.fromEntries(formData.entries());
        if (payload.authors) {
            try { payload.authors = JSON.parse(payload.authors); } catch(e) { payload.authors = []; }
        }
        let url = '/selfstudyresearchflow/api/openalex-libraries/';
        let method = 'POST';
        if (id) {
            url = `/selfstudyresearchflow/api/openalex-libraries/${id}/`;
            method = 'PUT';
        }
        try {
            await apiFetch(url, { method, body: JSON.stringify(payload) });
            modal.style.display = 'none';
            loadTabData('openalex');
        } catch (err) { alert(err.message); }
    };
}

function showCollaborationForm(data, id) {
    const modal = document.getElementById('generic-modal');
    const title = document.getElementById('modal-title');
    const fieldsDiv = document.getElementById('modal-fields');
    title.innerText = 'Create Collaboration Request';
    const html = `
        <label>Project ID</label><input name="project_id" value="${data.project_id || ''}" required>
        <label>Message</label><textarea name="message">${data.message || ''}</textarea>
    `;
    fieldsDiv.innerHTML = html;
    modal.style.display = 'flex';
    document.getElementById('modal-form').onsubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const payload = Object.fromEntries(formData.entries());
        try {
            await apiFetch('/selfstudyresearchflow/api/collaborations/', { method: 'POST', body: JSON.stringify(payload) });
            modal.style.display = 'none';
            loadTabData('collaborations');
        } catch (err) { alert(err.message); }
    };
}

function attachActionButtons() {
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.removeEventListener('click', btn._listener);
        btn.addEventListener('click', () => openEditModal(btn.dataset.resource, btn.dataset.id));
        btn._listener = () => openEditModal(btn.dataset.resource, btn.dataset.id);
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.removeEventListener('click', btn._listener);
        btn.addEventListener('click', () => deleteItem(btn.dataset.resource, btn.dataset.id));
        btn._listener = () => deleteItem(btn.dataset.resource, btn.dataset.id);
    });
    document.querySelectorAll('.create-btn').forEach(btn => {
        btn.removeEventListener('click', btn._listener);
        btn.addEventListener('click', () => openCreateModal(btn.dataset.resource));
        btn._listener = () => openCreateModal(btn.dataset.resource);
    });
}

async function deleteItem(resource, id) {
    if (!confirm('Are you sure?')) return;
    await apiFetch(`/selfstudyresearchflow/api/${resource}s/${id}/`, { method: 'DELETE' });
    loadTabData(document.querySelector('.tab-btn.active').dataset.tab);
}

// Close modal
document.querySelector('.close').addEventListener('click', () => {
    document.getElementById('generic-modal').style.display = 'none';
});
window.onclick = (e) => {
    if (e.target === document.getElementById('generic-modal')) {
        document.getElementById('generic-modal').style.display = 'none';
    }
};

// Test connection button
document.getElementById('test-connection-btn')?.addEventListener('click', async () => {
    const resultDiv = document.getElementById('test-result');
    resultDiv.innerHTML = 'Testing ResearchFlow connection...';
    try {
        const data = await apiFetch('/selfstudyresearchflow/api/diagnostic/');
        resultDiv.innerHTML = `<pre style="background: rgba(0,0,0,0.5); padding: 10px; border-radius: 8px; overflow-x: auto; max-height: 300px;">${JSON.stringify(data, null, 2)}</pre>`;
    } catch (err) {
        resultDiv.innerHTML = `<span style="color: #ff6b6b;">Error: ${err.message}</span>`;
    }
});

// Initial load
loadTabData('researchers');