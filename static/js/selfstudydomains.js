/**
 * SelfStudy Domains Management JavaScript
 * Complete CRUD operations with dynamic domain discovery
 */

// Global variables
let currentAppId = null;
let currentReplicaId = null;
let appsData = [];
let replicasData = [];
let currentRegistry = null;
let currentTab = 'apps-tab';

// CSRF token for Django
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

const csrftoken = getCookie('csrftoken');

// Toast notification system
class Toast {
    static show(message, type = 'info', duration = 5000) {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        
        toast.innerHTML = `
            <i class="fas ${icons[type]} toast-icon"></i>
            <div class="toast-content">
                <div class="toast-title">${type.charAt(0).toUpperCase() + type.slice(1)}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        container.appendChild(toast);
        
        if (duration > 0) {
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, duration);
        }
        
        return toast;
    }
}

// API request helper
async function makeRequest(action, data = {}) {
    const formData = new FormData();
    formData.append('action', action);
    
    if (csrftoken) {
        formData.append('csrfmiddlewaretoken', csrftoken);
    }
    
    Object.keys(data).forEach(key => {
        formData.append(key, data[key]);
    });
    
    try {
        const response = await fetch(window.location.href, {
            method: 'POST',
            body: formData,
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Request failed:', error);
        Toast.show(`Request failed: ${error.message}`, 'error');
        throw error;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeTabs();
    loadData();
    setupEventListeners();
    updateLastUpdated();
});

// Tab management (now only two tabs)
function initializeTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            
            tabBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === tabId) {
                    content.classList.add('active');
                    currentTab = tabId;
                    
                    // Load specific data for tab
                    if (tabId === 'replicas-tab') {
                        loadReplicas();
                    }
                }
            });
        });
    });
}

// Setup event listeners
function setupEventListeners() {
    const searchInput = document.getElementById('globalSearch');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                filterData(this.value);
            }, 300);
        });
    }
    
    const refreshBtn = document.querySelector('[onclick="refreshData()"]');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshData);
    }
}

// Load all data
async function loadData() {
    try {
        showLoading('apps');
        showLoading('replicas');
        
        const appsResponse = await makeRequest('get_apps');
        if (appsResponse.success) {
            appsData = Array.isArray(appsResponse.apps) ? appsResponse.apps : [];
            currentRegistry = appsResponse.registry;
            renderAppsTable();
            updateAppsFilter();
            updateStatusBar();
        } else {
            Toast.show(appsResponse.error || 'Failed to load apps', 'error');
        }
        
        const replicasResponse = await makeRequest('get_replicas');
        if (replicasResponse.success) {
            replicasData = Array.isArray(replicasResponse.replicas) ? replicasResponse.replicas : [];
            renderReplicasTable();
            updateStatusBar();
        }
        
        loadRegistryStatus();
        
    } catch (error) {
        console.error('Error loading data:', error);
        Toast.show('Failed to load data. Please try again.', 'error');
    } finally {
        hideLoading('apps');
        hideLoading('replicas');
    }
}

// Render apps table
function renderAppsTable(apps = appsData) {
    const tbody = document.getElementById('appsTableBody');
    if (!tbody) return;
    
    if (apps.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <div class="no-data">
                        <i class="fas fa-inbox"></i>
                        <p>No applications found</p>
                    </div>
                </td>
            </tr>
        `;
        updateTableInfo('apps', 0, 0);
        return;
    }
    
    let html = '';
    apps.forEach(app => {
        const createdDate = new Date(app.created_at).toLocaleDateString();
        const replicaCount = app.replicas ? app.replicas.length : 0;
        
        html += `
            <tr data-app-id="${app.id}">
                <td>${app.id}</td>
                <td>
                    <strong>${escapeHtml(app.app_name)}</strong>
                    ${app.id === 8 ? '<span class="badge badge-primary ml-2">Self</span>' : ''}
                </td>
                <td>${escapeHtml(app.description || 'No description')}</td>
                <td>
                    ${app.github_link ? 
                        `<a href="${escapeHtml(app.github_link)}" target="_blank" class="text-primary">
                            <i class="fab fa-github"></i> View
                        </a>` : 
                        '<span class="text-muted">N/A</span>'
                    }
                </td>
                <td>
                    <span class="badge ${replicaCount > 0 ? 'badge-success' : 'badge-danger'}">
                        ${replicaCount} replica${replicaCount !== 1 ? 's' : ''}
                    </span>
                </td>
                <td>${createdDate}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn btn-view" onclick="viewAppReplicas(${app.id})" 
                                title="View Replicas">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="action-btn btn-edit" onclick="editApp(${app.id})" 
                                title="Edit App">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${app.id !== 8 ? `
                        <button class="action-btn btn-delete" onclick="deleteApp(${app.id})" 
                                title="Delete App">
                            <i class="fas fa-trash"></i>
                        </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    updateTableInfo('apps', apps.length, appsData.length);
}

// Render replicas table
function renderReplicasTable(replicas = replicasData) {
    const tbody = document.getElementById('replicasTableBody');
    if (!tbody) return;
    
    if (replicas.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <div class="no-data">
                        <i class="fas fa-inbox"></i>
                        <p>No replicas found</p>
                    </div>
                </td>
            </tr>
        `;
        updateTableInfo('replicas', 0, 0);
        return;
    }
    
    let html = '';
    replicas.forEach(replica => {
        const app = appsData.find(a => a.id === replica.app) || {};
        const createdDate = new Date(replica.created_at).toLocaleDateString();
        const url = replica.replica_url.replace(/\/$/, '');
        
        html += `
            <tr data-replica-id="${replica.id}">
                <td>${replica.id}</td>
                <td>
                    <strong>${escapeHtml(app.app_name || 'Unknown')}</strong>
                    <br><small class="text-muted">ID: ${replica.app}</small>
                </td>
                <td>
                    <a href="${escapeHtml(url)}" target="_blank" class="text-primary">
                        <i class="fas fa-external-link-alt"></i> ${escapeHtml(url)}
                    </a>
                </td>
                <td>
                    <small>
                        <strong>User:</strong> ${escapeHtml(replica.replica_username)}<br>
                        <strong>Admin:</strong> ${escapeHtml(replica.admin_username)}
                    </small>
                </td>
                <td>
                    <small>
                        <strong>Host:</strong> ${escapeHtml(replica.db_host)}<br>
                        <strong>DB:</strong> ${escapeHtml(replica.db_name)}
                    </small>
                </td>
                <td>${createdDate}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn btn-edit" onclick="editReplica(${replica.id})" 
                                title="Edit Replica">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn btn-delete" onclick="deleteReplica(${replica.id})" 
                                title="Delete Replica">
                            <i class="fas fa-trash"></i>
                        </button>
                        <button class="action-btn btn-view" onclick="testReplica(${replica.id})" 
                                title="Test Connection">
                            <i class="fas fa-plug"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    updateTableInfo('replicas', replicas.length, replicasData.length);
}

// Update apps filter dropdown
function updateAppsFilter() {
    const filter = document.getElementById('appFilter');
    if (!filter) return;
    
    let html = '<option value="">All Apps</option>';
    appsData.forEach(app => {
        html += `<option value="${app.id}">${escapeHtml(app.app_name)} (ID: ${app.id})</option>`;
    });
    
    filter.innerHTML = html;
}

// Filter data based on search
function filterData(searchTerm) {
    if (!searchTerm) {
        renderAppsTable(appsData);
        renderReplicasTable(replicasData);
        return;
    }
    
    const term = searchTerm.toLowerCase();
    
    const filteredApps = appsData.filter(app => 
        app.app_name.toLowerCase().includes(term) ||
        (app.description && app.description.toLowerCase().includes(term)) ||
        app.id.toString().includes(term)
    );
    renderAppsTable(filteredApps);
    
    const filteredReplicas = replicasData.filter(replica => {
        const app = appsData.find(a => a.id === replica.app);
        return (
            replica.replica_url.toLowerCase().includes(term) ||
            replica.db_host.toLowerCase().includes(term) ||
            replica.db_name.toLowerCase().includes(term) ||
            (app && app.app_name.toLowerCase().includes(term))
        );
    });
    renderReplicasTable(filteredReplicas);
}

// Filter replicas by app
function filterReplicasByApp() {
    const appId = document.getElementById('appFilter').value;
    if (!appId) {
        renderReplicasTable(replicasData);
        return;
    }
    
    const filtered = replicasData.filter(replica => replica.app == appId);
    renderReplicasTable(filtered);
}

// Update status bar
function updateStatusBar() {
    const registryStatus = document.getElementById('registryStatus');
    if (registryStatus && currentRegistry) {
        registryStatus.textContent = new URL(currentRegistry).hostname;
        registryStatus.style.color = 'var(--success-color)';
    }
    
    document.getElementById('appsCount').textContent = appsData.length;
    document.getElementById('replicasCount').textContent = replicasData.length;
    
    updateLastUpdated();
}

// Update last updated time
function updateLastUpdated() {
    const element = document.getElementById('lastUpdated');
    if (element) {
        const now = new Date();
        element.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
}

// Show loading state
function showLoading(type) {
    if (type === 'apps') {
        document.getElementById('loadingRow')?.classList.remove('hidden');
    } else if (type === 'replicas') {
        document.getElementById('replicasLoadingRow')?.classList.remove('hidden');
    }
}

// Hide loading state
function hideLoading(type) {
    if (type === 'apps') {
        document.getElementById('loadingRow')?.classList.add('hidden');
    } else if (type === 'replicas') {
        document.getElementById('replicasLoadingRow')?.classList.add('hidden');
    }
}

// Update table info
function updateTableInfo(type, showing, total) {
    const showingElement = document.getElementById(`${type}Showing`);
    const totalElement = document.getElementById(`${type}Total`);
    
    if (showingElement) showingElement.textContent = showing;
    if (totalElement) totalElement.textContent = total;
}

// Refresh all data
async function refreshData() {
    Toast.show('Refreshing data...', 'info', 2000);
    await loadData();
    Toast.show('Data refreshed successfully', 'success');
}

// Show create app modal
function showCreateAppModal() {
    document.getElementById('appModalTitle').innerHTML = '<i class="fas fa-plus"></i> Create New Application';
    document.getElementById('appForm').reset();
    document.getElementById('appId').value = '';
    clearFormErrors('appForm');
    showModal('appModal');
}

// Show edit app modal
async function editApp(appId) {
    try {
        const response = await makeRequest('get_app', { app_id: appId });
        if (response.success) {
            const app = response.app;
            document.getElementById('appModalTitle').innerHTML = '<i class="fas fa-edit"></i> Edit Application';
            document.getElementById('appId').value = app.id;
            document.getElementById('appName').value = app.app_name;
            document.getElementById('appDescription').value = app.description || '';
            document.getElementById('appGithub').value = app.github_link || '';
            clearFormErrors('appForm');
            showModal('appModal');
        } else {
            Toast.show(response.error || 'Failed to load app', 'error');
        }
    } catch (error) {
        console.error('Error loading app:', error);
        Toast.show('Failed to load app details', 'error');
    }
}

// Submit app form
async function submitAppForm() {
    const appId = document.getElementById('appId').value;
    const appName = document.getElementById('appName').value.trim();
    const description = document.getElementById('appDescription').value.trim();
    const githubLink = document.getElementById('appGithub').value.trim();
    
    clearFormErrors('appForm');
    let valid = true;
    
    if (!appName) {
        showError('appName', 'App name is required');
        valid = false;
    }
    
    if (!valid) return;
    
    const action = appId ? 'update_app' : 'create_app';
    const data = {
        app_id: appId || '',
        app_name: appName,
        description: description,
        github_link: githubLink
    };
    
    try {
        const response = await makeRequest(action, data);
        if (response.success) {
            Toast.show(response.message, 'success');
            closeAppModal();
            await refreshData();
        } else {
            if (response.app_name) {
                showError('appName', response.app_name[0]);
            } else {
                Toast.show(response.error || 'Operation failed', 'error');
            }
        }
    } catch (error) {
        console.error('Error saving app:', error);
        Toast.show('Failed to save application', 'error');
    }
}

// Show create replica modal
async function showCreateReplicaModal(appId = null) {
    document.getElementById('replicaModalTitle').innerHTML = '<i class="fas fa-plus"></i> Create New Replica';
    document.getElementById('replicaForm').reset();
    document.getElementById('replicaId').value = '';
    
    const appSelect = document.getElementById('replicaAppId');
    let html = '<option value="">Select Application</option>';
    appsData.forEach(app => {
        html += `<option value="${app.id}" ${app.id == appId ? 'selected' : ''}>
                    ${escapeHtml(app.app_name)} (ID: ${app.id})
                 </option>`;
    });
    appSelect.innerHTML = html;
    
    clearFormErrors('replicaForm');
    showModal('replicaModal');
}

// Show create replica modal for specific app
function showCreateReplicaModalForApp() {
    if (currentAppId) {
        showCreateReplicaModal(currentAppId);
        closeViewReplicasModal();
    }
}

// Show edit replica modal
async function editReplica(replicaId) {
    try {
        const replica = replicasData.find(r => r.id == replicaId);
        if (!replica) {
            Toast.show('Replica not found in current data', 'error');
            return;
        }
        
        document.getElementById('replicaModalTitle').innerHTML = '<i class="fas fa-edit"></i> Edit Replica';
        document.getElementById('replicaId').value = replica.id;
        
        const appSelect = document.getElementById('replicaAppId');
        let html = '<option value="">Select Application</option>';
        appsData.forEach(app => {
            html += `<option value="${app.id}" ${app.id == replica.app ? 'selected' : ''}>
                        ${escapeHtml(app.app_name)} (ID: ${app.id})
                     </option>`;
        });
        appSelect.innerHTML = html;
        
        document.getElementById('replicaUrl').value = replica.replica_url;
        document.getElementById('replicaUsername').value = replica.replica_username;
        document.getElementById('replicaPassword').value = replica.replica_password;
        document.getElementById('adminUsername').value = replica.admin_username;
        document.getElementById('adminPassword').value = replica.admin_password;
        document.getElementById('dbHost').value = replica.db_host;
        document.getElementById('dbName').value = replica.db_name;
        document.getElementById('dbUsername').value = replica.db_username;
        document.getElementById('dbPassword').value = replica.db_password;
        
        clearFormErrors('replicaForm');
        showModal('replicaModal');
        
    } catch (error) {
        console.error('Error loading replica:', error);
        Toast.show('Failed to load replica details', 'error');
    }
}

// Submit replica form
async function submitReplicaForm() {
    const replicaId = document.getElementById('replicaId').value;
    const appId = document.getElementById('replicaAppId').value;
    const replicaUrl = document.getElementById('replicaUrl').value.trim();
    const replicaUsername = document.getElementById('replicaUsername').value.trim();
    const replicaPassword = document.getElementById('replicaPassword').value.trim();
    const adminUsername = document.getElementById('adminUsername').value.trim();
    const adminPassword = document.getElementById('adminPassword').value.trim();
    const dbHost = document.getElementById('dbHost').value.trim();
    const dbName = document.getElementById('dbName').value.trim();
    const dbUsername = document.getElementById('dbUsername').value.trim();
    const dbPassword = document.getElementById('dbPassword').value.trim();
    
    clearFormErrors('replicaForm');
    let valid = true;
    
    const requiredFields = [
        { id: 'replicaAppId', value: appId, name: 'Application' },
        { id: 'replicaUrl', value: replicaUrl, name: 'Replica URL' },
        { id: 'replicaUsername', value: replicaUsername, name: 'Replica Username' },
        { id: 'replicaPassword', value: replicaPassword, name: 'Replica Password' },
        { id: 'adminUsername', value: adminUsername, name: 'Admin Username' },
        { id: 'adminPassword', value: adminPassword, name: 'Admin Password' },
        { id: 'dbHost', value: dbHost, name: 'Database Host' },
        { id: 'dbName', value: dbName, name: 'Database Name' },
        { id: 'dbUsername', value: dbUsername, name: 'Database Username' },
        { id: 'dbPassword', value: dbPassword, name: 'Database Password' }
    ];
    
    requiredFields.forEach(field => {
        if (!field.value) {
            showError(field.id, `${field.name} is required`);
            valid = false;
        }
    });
    
    if (!valid) return;
    
    const action = replicaId ? 'update_replica' : 'create_replica';
    const data = {
        replica_id: replicaId || '',
        app_id: appId,
        replica_url: replicaUrl,
        replica_username: replicaUsername,
        replica_password: replicaPassword,
        admin_username: adminUsername,
        admin_password: adminPassword,
        db_host: dbHost,
        db_name: dbName,
        db_username: dbUsername,
        db_password: dbPassword
    };
    
    try {
        const response = await makeRequest(action, data);
        if (response.success) {
            Toast.show(response.message, 'success');
            closeReplicaModal();
            await refreshData();
        } else {
            Toast.show(response.error || 'Operation failed', 'error');
        }
    } catch (error) {
        console.error('Error saving replica:', error);
        Toast.show('Failed to save replica', 'error');
    }
}

// View app replicas
async function viewAppReplicas(appId) {
    try {
        const response = await makeRequest('get_app', { app_id: appId });
        if (response.success) {
            const app = response.app;
            currentAppId = app.id;
            
            document.getElementById('modalAppName').textContent = app.app_name;
            document.getElementById('modalAppDescription').textContent = app.description || 'No description';
            
            const githubLink = document.getElementById('modalAppGithub');
            if (app.github_link) {
                githubLink.href = app.github_link;
                githubLink.textContent = 'View on GitHub';
            } else {
                githubLink.href = '#';
                githubLink.textContent = 'N/A';
            }
            
            const replicasList = document.getElementById('appReplicasList');
            const replicas = app.replicas || [];
            
            if (replicas.length === 0) {
                replicasList.innerHTML = `
                    <div class="no-data">
                        <i class="fas fa-inbox"></i>
                        <p>No replicas found for this application</p>
                    </div>
                `;
            } else {
                let html = '<div class="replicas-list">';
                replicas.forEach(replica => {
                    const url = replica.replica_url.replace(/\/$/, '');
                    html += `
                        <div class="replica-item">
                            <div class="replica-info">
                                <h5><a href="${escapeHtml(url)}" target="_blank">${escapeHtml(url)}</a></h5>
                                <p>
                                    <strong>DB:</strong> ${escapeHtml(replica.db_host)}/${escapeHtml(replica.db_name)} |
                                    <strong>User:</strong> ${escapeHtml(replica.replica_username)} |
                                    <strong>Admin:</strong> ${escapeHtml(replica.admin_username)}
                                </p>
                            </div>
                            <div class="replica-actions">
                                <button class="btn btn-sm btn-primary" onclick="editReplica(${replica.id})">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-danger" onclick="deleteReplica(${replica.id})">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
                replicasList.innerHTML = html;
            }
            
            showModal('viewReplicasModal');
        } else {
            Toast.show(response.error || 'Failed to load app', 'error');
        }
    } catch (error) {
        console.error('Error viewing app:', error);
        Toast.show('Failed to load app details', 'error');
    }
}

// Delete app
function deleteApp(appId) {
    const app = appsData.find(a => a.id == appId);
    if (!app) return;
    
    if (appId === 8) {
        Toast.show('Cannot delete SelfStudy Domains service', 'warning');
        return;
    }
    
    document.getElementById('deleteMessage').textContent = 
        `Are you sure you want to delete the application "${app.app_name}"? This will also delete all its replicas.`;
    
    currentAppId = appId;
    showModal('deleteModal');
}

// Delete replica
function deleteReplica(replicaId) {
    const replica = replicasData.find(r => r.id == replicaId);
    if (!replica) return;
    
    const app = appsData.find(a => a.id == replica.app);
    const appName = app ? app.app_name : 'Unknown';
    
    document.getElementById('deleteMessage').textContent = 
        `Are you sure you want to delete the replica for "${appName}" at ${replica.replica_url}?`;
    
    currentReplicaId = replicaId;
    showModal('deleteModal');
}

// Confirm deletion
async function confirmDelete() {
    const deleteModal = document.getElementById('deleteModal');
    
    try {
        if (currentAppId) {
            const response = await makeRequest('delete_app', { app_id: currentAppId });
            if (response.success) {
                Toast.show(response.message, 'success');
                await refreshData();
            } else {
                Toast.show(response.error || 'Failed to delete app', 'error');
            }
            currentAppId = null;
        } else if (currentReplicaId) {
            const response = await makeRequest('delete_replica', { replica_id: currentReplicaId });
            if (response.success) {
                Toast.show(response.message, 'success');
                await refreshData();
            } else {
                Toast.show(response.error || 'Failed to delete replica', 'error');
            }
            currentReplicaId = null;
        }
    } catch (error) {
        console.error('Error deleting:', error);
        Toast.show('Failed to delete', 'error');
    } finally {
        closeDeleteModal();
    }
}

// Load registry status
async function loadRegistryStatus() {
    try {
        const response = await makeRequest('get_registry_status');
        if (response.success) {
            // Not needed for display anymore but keep for registry modal
        }
    } catch (error) {
        console.error('Error loading registry status:', error);
    }
}

// Show registry status modal
async function showRegistryStatus() {
    try {
        const response = await makeRequest('get_registry_status');
        if (response.success) {
            const container = document.getElementById('registryStatusContent');
            let html = '<div class="registry-status">';
            
            response.registries.forEach(registry => {
                const isOnline = registry.status === 'online';
                const isCurrent = response.working_registry === registry.domain;
                
                html += `
                    <div class="registry-item ${registry.status}">
                        <div>
                            <div class="registry-domain">${registry.domain}</div>
                            ${isCurrent ? '<div class="badge badge-primary">Current</div>' : ''}
                            ${!isOnline && registry.error ? 
                                `<div class="text-danger small">${registry.error}</div>` : ''}
                        </div>
                        <div class="registry-status-badge ${registry.status}">
                            ${isOnline ? 'Online' : 'Offline'}
                            ${isOnline ? ` (${registry.status_code})` : ''}
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            container.innerHTML = html;
            showModal('registryStatusModal');
        } else {
            Toast.show('Failed to load registry status', 'error');
        }
    } catch (error) {
        console.error('Error loading registry status:', error);
        Toast.show('Failed to load registry status', 'error');
    }
}

// Test replica connection
async function testReplica(replicaId) {
    const replica = replicasData.find(r => r.id == replicaId);
    if (!replica) return;
    
    Toast.show(`Testing connection to ${replica.replica_url}...`, 'info');
    
    try {
        const url = replica.replica_url.replace(/\/$/, '') + '/health/';
        await fetch(url, { 
            method: 'GET',
            mode: 'no-cors'
        });
        
        Toast.show(`Connection to ${replica.replica_url} appears to be working`, 'success');
    } catch (error) {
        Toast.show(`Failed to connect to ${replica.replica_url}`, 'error');
    }
}

// Modal functions (using reliable display block, like selfstudycourse)
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    } else {
        console.error('Modal not found:', modalId);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

function closeAppModal() {
    closeModal('appModal');
    document.getElementById('appForm').reset();
}

function closeReplicaModal() {
    closeModal('replicaModal');
    document.getElementById('replicaForm').reset();
}

function closeViewReplicasModal() {
    closeModal('viewReplicasModal');
    currentAppId = null;
}

function closeDeleteModal() {
    closeModal('deleteModal');
    currentAppId = null;
    currentReplicaId = null;
}

function closeRegistryStatusModal() {
    closeModal('registryStatusModal');
}

// Clear search
function clearSearch() {
    document.getElementById('globalSearch').value = '';
    filterData('');
}

// Form error handling
function showError(fieldId, message) {
    const errorElement = document.getElementById(fieldId + 'Error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

function clearFormErrors(formId) {
    const form = document.getElementById(formId);
    if (form) {
        const errorElements = form.querySelectorAll('.form-error');
        errorElements.forEach(el => {
            el.textContent = '';
            el.style.display = 'none';
        });
    }
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Load replicas
async function loadReplicas() {
    try {
        const response = await makeRequest('get_replicas');
        if (response.success) {
            replicasData = Array.isArray(response.replicas) ? response.replicas : [];
            renderReplicasTable();
        }
    } catch (error) {
        console.error('Error loading replicas:', error);
    }
}