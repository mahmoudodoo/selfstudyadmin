// SelfStudy All Auth Management JavaScript

class SelfStudyAllAuthManager {
    constructor() {
        this.baseUrl = '/selfstudyallauth/api/';
        this.currentPage = 1;
        this.pageSize = 9;               // ← Changed from 50 to 9
        this.totalPages = 1;
        this.currentFilter = 'all';
        this.selectedToken = null;
        this.confirmAction = null;
        this.userCache = new Map();
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.checkExpirations();
        this.loadReplicaInfo();
        
        // Check if we have initial tokens from Django template
        const initialTokens = document.querySelectorAll('#tokensTableBody tr[data-token]');
        if (initialTokens.length > 0) {
            // We have tokens from template, just load usernames
            this.loadUsernames();
        } else {
            // No tokens in template, load via API
            this.loadTokens(1);
        }
    }
    
    setupEventListeners() {
        // Search input
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.searchTokens();
                }
            });
        }
        
        // Close modals on background click
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeAllModals();
                }
            });
        });
        
        // Escape key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
    }
    
    // API Methods
    async makeRequest(action, method = 'GET', data = null) {
        this.showLoading();
        
        try {
            let url = this.baseUrl;
            const options = {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                credentials: 'same-origin'
            };
            
            if (method === 'GET') {
                const params = new URLSearchParams();
                params.set('action', action);
                if (data) {
                    Object.keys(data).forEach(key => {
                        if (data[key] !== null && data[key] !== undefined) {
                            params.set(key, data[key]);
                        }
                    });
                }
                url += `?${params.toString()}`;
            } else {
                if (data) {
                    data.action = action;
                    options.body = JSON.stringify(data);
                }
            }
            
            const response = await fetch(url, options);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const result = await response.json();
            this.hideLoading();
            return result;
            
        } catch (error) {
            this.hideLoading();
            console.error('API Request Error:', error);
            throw error;
        }
    }
    
    // Token Management
    async loadTokens(page = 1) {
        try {
            const params = {
                limit: this.pageSize,
                offset: (page - 1) * this.pageSize
            };
            
            const result = await this.makeRequest('list_tokens', 'GET', params);
            
            if (result.status_code === 200 && result.data) {
                this.renderTokens(result.data.tokens || []);
                this.totalPages = Math.ceil((result.data.count || 0) / this.pageSize);
                this.renderPagination();
                this.currentPage = page;
                
                // Load usernames for the tokens
                this.loadUsernames();
            } else {
                console.error('Failed to load tokens:', result);
                this.showError('Failed to load tokens', result.error || 'Unknown error');
            }
        } catch (error) {
            console.error('Failed to load tokens:', error);
            this.showError('Failed to load tokens', error.message);
            
            // Check if we have any tokens from template
            const hasTokens = document.querySelectorAll('#tokensTableBody tr[data-token]').length > 0;
            if (!hasTokens) {
                this.showNoTokensMessage();
            }
        }
    }
    
    async createToken(tokenData) {
        try {
            const result = await this.makeRequest('create_token', 'POST', tokenData);
            
            if (result.status_code === 201 || result.status_code === 200) {
                this.showSuccess('Token created successfully');
                this.closeCreateModal();
                this.loadTokens(1); // Reload tokens from API
                return true;
            } else {
                throw new Error(result.data?.error || result.error || 'Failed to create token');
            }
        } catch (error) {
            this.showError('Failed to create token', error.message);
            return false;
        }
    }
    
    async updateToken(token, data) {
        try {
            data.token = token;
            const result = await this.makeRequest('update_token', 'POST', data);
            
            if (result.status_code === 200) {
                this.showSuccess('Token updated successfully');
                this.closeEditModal();
                this.loadTokens(1);
                return true;
            } else {
                throw new Error(result.data?.error || result.error || 'Failed to update token');
            }
        } catch (error) {
            this.showError('Failed to update token', error.message);
            return false;
        }
    }
    
    async deleteToken(token) {
        try {
            const data = { token: token };
            const result = await this.makeRequest('delete_token', 'DELETE', data);
            
            if (result.status_code === 200) {
                this.showSuccess('Token deleted successfully');
                this.closeConfirmModal();
                
                // Remove the token row from UI
                const row = document.querySelector(`tr[data-token="${token}"]`);
                if (row) {
                    row.remove();
                }
                
                // Check if we have any tokens left
                const remainingTokens = document.querySelectorAll('#tokensTableBody tr[data-token]').length;
                if (remainingTokens === 0) {
                    this.showNoTokensMessage();
                }
                
                return true;
            } else {
                throw new Error(result.data?.error || result.error || 'Failed to delete token');
            }
        } catch (error) {
            this.showError('Failed to delete token', error.message);
            return false;
        }
    }
    
    async searchTokens() {
        const query = document.getElementById('searchInput').value.trim();
        if (!query) {
            this.loadTokens(1);
            return;
        }
        
        try {
            const data = {
                query: query,
                field: 'user_id',
                limit: 100   // Still fetch up to 100, but we'll paginate client‑side
            };
            
            const result = await this.makeRequest('search_tokens', 'POST', data);
            
            if (result.status_code === 200) {
                const allResults = result.data.results || [];
                // For simplicity, we just display all results (up to 100)
                // You could also implement client‑side pagination here if needed
                this.renderTokens(allResults);
                this.totalPages = Math.ceil(allResults.length / this.pageSize);
                this.renderPagination();
                this.currentPage = 1;
                this.loadUsernames();
            }
        } catch (error) {
            console.error('Search failed:', error);
            this.showError('Search failed', error.message);
        }
    }
    
    async validateToken(token) {
        try {
            const data = { token: token };
            const result = await this.makeRequest('validate_token', 'POST', data);
            
            if (result.status_code === 200) {
                return result.data;
            } else {
                throw new Error('Validation failed');
            }
        } catch (error) {
            console.error('Validation failed:', error);
            return null;
        }
    }
    
    // User Management
    async loadUsernames() {
        const usernameCells = document.querySelectorAll('.username-cell[data-user-id]');
        
        if (usernameCells.length === 0) return;
        
        const promises = Array.from(usernameCells).map(async (cell) => {
            const userId = cell.dataset.userId;
            if (userId) {
                try {
                    // Check cache first
                    if (this.userCache.has(userId)) {
                        const user = this.userCache.get(userId);
                        this.updateUsernameCell(cell, user);
                        return;
                    }
                    
                    // Fetch from API
                    const result = await this.makeRequest('get_user_by_id', 'GET', { user_id: userId });
                    
                    if (result.status_code === 200 && result.data) {
                        const user = result.data;
                        this.userCache.set(userId, user);
                        this.updateUsernameCell(cell, user);
                    } else {
                        cell.innerHTML = '<span class="na">User not found</span>';
                    }
                } catch (error) {
                    console.error(`Failed to load user ${userId}:`, error);
                    cell.innerHTML = '<span class="error">Error</span>';
                }
            }
        });
        
        await Promise.allSettled(promises);
    }
    
    updateUsernameCell(cell, user) {
        const username = user.username || 'N/A';
        const email = user.email || '';
        const firstName = user.first_name || '';
        const lastName = user.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim();
        
        let html = `<div class="user-info">`;
        html += `<strong class="username">${username}</strong>`;
        
        if (email) {
            html += `<br><small class="email">${email}</small>`;
        }
        
        if (fullName) {
            html += `<br><small class="name">${fullName}</small>`;
        }
        
        html += `</div>`;
        cell.innerHTML = html;
    }
    
    async getUserById(userId) {
        // Check cache first
        if (this.userCache.has(userId)) {
            return this.userCache.get(userId);
        }
        
        try {
            const result = await this.makeRequest('get_user_by_id', 'GET', { user_id: userId });
            
            if (result.status_code === 200 && result.data) {
                const user = result.data;
                this.userCache.set(userId, user);
                return user;
            }
            return null;
        } catch (error) {
            console.error('Failed to get user:', error);
            return null;
        }
    }
    
    // Replica Management
    async loadReplicaInfo() {
        try {
            const result = await this.makeRequest('get_replicas', 'GET');
            if (result.auth_replicas && result.user_replicas) {
                this.updateReplicaStatus(result);
            }
        } catch (error) {
            console.error('Failed to load replica info:', error);
        }
    }
    
    // UI Rendering
    renderTokens(tokens) {
        const tbody = document.getElementById('tokensTableBody');
        if (!tbody) return;
        
        if (tokens.length === 0) {
            this.showNoTokensMessage();
            return;
        }
        
        tbody.innerHTML = '';
        
        // Client‑side pagination if we have more tokens than pageSize
        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        const pageTokens = tokens.slice(start, end);
        
        pageTokens.forEach(token => {
            const row = this.createTokenRow(token);
            tbody.appendChild(row);
        });
        
        // Update totalPages based on tokens length
        this.totalPages = Math.ceil(tokens.length / this.pageSize);
        this.renderPagination();
    }
    
    createTokenRow(token) {
        const row = document.createElement('tr');
        row.dataset.token = token.token;
        
        const expiresDate = new Date(token.expires_at);
        const now = new Date();
        const daysRemaining = Math.ceil((expiresDate - now) / (1000 * 60 * 60 * 24));
        const isExpiringSoon = daysRemaining > 0 && daysRemaining <= 7;
        
        row.innerHTML = `
            <td class="token-cell">
                <code>${token.token.substring(0, 8)}...</code>
                <button class="btn-copy" onclick="copyToClipboard('${token.token}')" title="Copy token">
                    <i class="far fa-copy"></i>
                </button>
            </td>
            <td>${token.user_id.substring(0, 8)}...</td>
            <td class="username-cell" data-user-id="${token.user_id}">
                <span class="loading">Loading...</span>
            </td>
            <td>${new Date(token.created_at).toLocaleDateString()}</td>
            <td class="expiry-cell ${isExpiringSoon ? 'expiring-soon' : ''}" data-expires="${token.expires_at}">
                ${new Date(token.expires_at).toLocaleDateString()}
                ${daysRemaining > 0 ? `<br><small>(${daysRemaining} days)</small>` : ''}
            </td>
            <td>
                <span class="status-badge ${token.is_valid ? 'status-active' : 'status-expired'}">
                    ${token.is_valid ? 'Active' : 'Expired'}
                </span>
                ${!token.is_active ? '<br><small class="status-inactive">Inactive</small>' : ''}
            </td>
            <td class="actions-cell">
                <button class="btn-action" onclick="viewTokenDetails('${token.token}')" title="View">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn-action" onclick="openEditModal('${token.token}')" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-action btn-danger" onclick="confirmDelete('${token.token}')" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        return row;
    }
    
    showNoTokensMessage() {
        const tbody = document.getElementById('tokensTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px;">
                    <i class="fas fa-key" style="font-size: 3rem; color: #ddd; margin-bottom: 15px;"></i>
                    <p style="color: #666; font-size: 1.1rem;">No tokens found. Create your first token!</p>
                </td>
            </tr>
        `;
    }
    
    renderPagination(hide = false) {
        const pagination = document.getElementById('pagination');
        if (!pagination) return;
        
        if (hide || this.totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }
        
        let html = '';
        
        if (this.currentPage > 1) {
            html += `<button onclick="goToPage(${this.currentPage - 1})">Previous</button>`;
        }
        
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(this.totalPages, startPage + 4);
        
        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="${i === this.currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
        }
        
        if (this.currentPage < this.totalPages) {
            html += `<button onclick="goToPage(${this.currentPage + 1})">Next</button>`;
        }
        
        pagination.innerHTML = html;
    }
    
    updateReplicaStatus(data) {
        const authContainer = document.getElementById('authReplicas');
        if (authContainer && data.auth_replicas) {
            authContainer.innerHTML = data.auth_replicas.map(url => `
                <div class="replica-item">
                    <span class="replica-url">${url}</span>
                    <span class="replica-status-badge ${url === data.auth_healthy ? 'status-active' : 'status-inactive'}">
                        ${url === data.auth_healthy ? 'Active' : 'Standby'}
                    </span>
                </div>
            `).join('');
        }
        
        const userContainer = document.getElementById('userReplicas');
        if (userContainer && data.user_replicas) {
            userContainer.innerHTML = data.user_replicas.map(url => `
                <div class="replica-item">
                    <span class="replica-url">${url}</span>
                    <span class="replica-status-badge ${url === data.user_healthy ? 'status-active' : 'status-inactive'}">
                        ${url === data.user_healthy ? 'Active' : 'Standby'}
                    </span>
                </div>
            `).join('');
        }
    }
    
    // Modal Management
    openCreateModal() {
        document.getElementById('createModal').classList.add('show');
    }
    
    closeCreateModal() {
        document.getElementById('createModal').classList.remove('show');
        document.getElementById('createForm').reset();
    }
    
    async openEditModal(token) {
        try {
            const result = await this.makeRequest('get_token', 'GET', { token });
            
            if (result.status_code === 200 && result.data) {
                const tokenData = result.data;
                
                document.getElementById('editToken').value = token;
                document.getElementById('editTokenDisplay').value = token;
                document.getElementById('editUserId').value = tokenData.user_id;
                document.getElementById('editExpiresIn').value = 30;
                document.getElementById('editIsActive').value = tokenData.is_active.toString();
                
                const user = await this.getUserById(tokenData.user_id);
                if (user) {
                    document.getElementById('editUsername').value = user.username || 'N/A';
                    document.getElementById('editUserEmail').value = user.email || 'N/A';
                }
                
                document.getElementById('editModal').classList.add('show');
            }
        } catch (error) {
            this.showError('Failed to load token', error.message);
        }
    }
    
    closeEditModal() {
        document.getElementById('editModal').classList.remove('show');
    }
    
    async viewTokenDetails(token) {
        try {
            const result = await this.makeRequest('get_token', 'GET', { token });
            
            if (result.status_code === 200 && result.data) {
                const tokenData = result.data;
                
                document.getElementById('detailToken').textContent = token;
                document.getElementById('detailUserId').textContent = tokenData.user_id;
                document.getElementById('detailCreatedAt').textContent = new Date(tokenData.created_at).toLocaleString();
                document.getElementById('detailExpiresAt').textContent = new Date(tokenData.expires_at).toLocaleString();
                document.getElementById('detailIpAddress').textContent = tokenData.ip_address || 'N/A';
                document.getElementById('detailUserAgent').textContent = tokenData.user_agent || 'N/A';
                document.getElementById('detailStatus').textContent = tokenData.is_active ? 'Active' : 'Inactive';
                document.getElementById('detailIsValid').textContent = tokenData.is_valid ? 'Yes' : 'No';
                
                const expiresDate = new Date(tokenData.expires_at);
                const now = new Date();
                const daysRemaining = Math.ceil((expiresDate - now) / (1000 * 60 * 60 * 24));
                document.getElementById('detailDaysRemaining').textContent = daysRemaining > 0 ? `${daysRemaining} days` : 'Expired';
                
                const user = await this.getUserById(tokenData.user_id);
                if (user) {
                    document.getElementById('detailUsername').textContent = user.username || 'N/A';
                    document.getElementById('detailEmail').textContent = user.email || 'N/A';
                    document.getElementById('detailFullName').textContent = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'N/A';
                }
                
                this.selectedToken = token;
                document.getElementById('detailsModal').classList.add('show');
            }
        } catch (error) {
            this.showError('Failed to load token details', error.message);
        }
    }
    
    closeDetailsModal() {
        document.getElementById('detailsModal').classList.remove('show');
    }
    
    showReplicaInfo() {
        document.getElementById('replicaModal').classList.add('show');
    }
    
    closeReplicaModal() {
        document.getElementById('replicaModal').classList.remove('show');
    }
    
    confirmDelete(token) {
        this.selectedToken = token;
        document.getElementById('confirmMessage').textContent = `Are you sure you want to delete token ${token.substring(0, 8)}...?`;
        document.getElementById('confirmActionBtn').onclick = () => this.deleteToken(token);
        document.getElementById('confirmModal').classList.add('show');
    }
    
    closeConfirmModal() {
        document.getElementById('confirmModal').classList.remove('show');
        this.selectedToken = null;
    }
    
    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('show');
        });
        this.selectedToken = null;
    }
    
    // Utility Methods
    showLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.add('show');
        }
    }
    
    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.remove('show');
        }
    }
    
    showSuccess(message) {
        this.showNotification(message, 'success');
    }
    
    showError(title, message) {
        this.showNotification(`${title}: ${message}`, 'error');
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">&times;</button>
        `;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'success' ? '#d4edda' : '#f8d7da'};
            color: ${type === 'success' ? '#155724' : '#721c24'};
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            z-index: 3000;
            display: flex;
            justify-content: space-between;
            align-items: center;
            min-width: 300px;
            max-width: 500px;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
    
    getCsrfToken() {
        const name = 'csrftoken';
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
    
    checkExpirations() {
        const expiryCells = document.querySelectorAll('.expiry-cell');
        const now = new Date();
        
        expiryCells.forEach(cell => {
            const expiresAt = new Date(cell.dataset.expires);
            const daysRemaining = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
            
            if (daysRemaining <= 3 && daysRemaining > 0) {
                cell.classList.add('expiring-soon');
            }
        });
        
        setTimeout(() => this.checkExpirations(), 60000);
    }
    
    async validateCurrentToken() {
        if (!this.selectedToken) return;
        
        const container = document.getElementById('validationResult');
        const result = await this.validateToken(this.selectedToken);
        
        if (result && result.is_valid) {
            container.className = 'validation-result success';
            container.innerHTML = `
                <strong>✓ Token is valid</strong><br>
                User ID: ${result.user_id}<br>
                Expires: ${new Date(result.metadata.expires_at).toLocaleString()}<br>
                Days remaining: ${Math.round(result.metadata.time_remaining_days)}
            `;
        } else {
            container.className = 'validation-result error';
            container.innerHTML = `
                <strong>✗ Token is invalid</strong><br>
                ${result?.validation_details?.errors?.join('<br>') || 'Token validation failed'}
            `;
        }
    }
}

// Utility Functions
function onUserSelectChange(select) {
    const selectedOption = select.options[select.selectedIndex];
    
    if (selectedOption && selectedOption.value) {
        const username = selectedOption.dataset.username;
        const email = selectedOption.dataset.email;
        const firstName = selectedOption.dataset.firstName;
        const lastName = selectedOption.dataset.lastName;
        const userId = selectedOption.value;
        const fullName = `${firstName || ''} ${lastName || ''}`.trim();
        
        document.getElementById('username').value = username || '';
        document.getElementById('userId').value = userId || '';
        document.getElementById('userEmail').value = email || '';
        document.getElementById('userFullName').value = fullName || '';
    } else {
        document.getElementById('username').value = '';
        document.getElementById('userId').value = '';
        document.getElementById('userEmail').value = '';
        document.getElementById('userFullName').value = '';
    }
}

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        if (window.authManager) {
            window.authManager.showSuccess('Copied to clipboard');
        }
    } catch (err) {
        console.error('Failed to copy:', err);
    }
}

// Global Functions
let authManager;

function refreshData() {
    if (authManager) {
        authManager.loadTokens(1);
        authManager.loadReplicaInfo();
    }
}

function searchTokens() {
    if (authManager) {
        authManager.searchTokens();
    }
}

function filterTokens() {
    if (authManager) {
        const filter = document.getElementById('statusFilter').value;
        authManager.currentFilter = filter;
        authManager.loadTokens(1);
    }
}

function goToPage(page) {
    if (authManager) {
        authManager.loadTokens(page);
    }
}

function openCreateModal() {
    if (authManager) {
        authManager.openCreateModal();
    }
}

function closeCreateModal() {
    if (authManager) {
        authManager.closeCreateModal();
    }
}

function createToken() {
    if (!authManager) return;
    
    const username = document.getElementById('username').value.trim();
    const userId = document.getElementById('userId').value.trim();
    const expiresIn = document.getElementById('expiresIn').value;
    
    if (!username || !userId) {
        authManager.showError('Validation Error', 'Please select a user first');
        return;
    }
    
    if (!expiresIn || expiresIn < 1 || expiresIn > 365) {
        authManager.showError('Validation Error', 'Expires in must be between 1 and 365 days');
        return;
    }
    
    const tokenData = {
        user_id: userId,
        expires_in_days: parseInt(expiresIn) || 30
    };
    
    authManager.createToken(tokenData);
}

function openEditModal(token) {
    if (authManager) {
        authManager.openEditModal(token);
    }
}

function closeEditModal() {
    if (authManager) {
        authManager.closeEditModal();
    }
}

function updateToken() {
    if (!authManager) return;
    
    const token = document.getElementById('editToken').value;
    const expiresIn = document.getElementById('editExpiresIn').value;
    const isActive = document.getElementById('editIsActive').value === 'true';
    
    if (!expiresIn || expiresIn < 1 || expiresIn > 365) {
        authManager.showError('Validation Error', 'Expires in must be between 1 and 365 days');
        return;
    }
    
    const updateData = {
        expires_in_days: parseInt(expiresIn) || 30,
        is_active: isActive
    };
    
    authManager.updateToken(token, updateData);
}

function viewTokenDetails(token) {
    if (authManager) {
        authManager.viewTokenDetails(token);
    }
}

function closeDetailsModal() {
    if (authManager) {
        authManager.closeDetailsModal();
    }
}

function validateCurrentToken() {
    if (authManager) {
        authManager.validateCurrentToken();
    }
}

function confirmDelete(token) {
    if (authManager) {
        authManager.confirmDelete(token);
    }
}

function deleteToken(token) {
    if (authManager) {
        authManager.deleteToken(token);
    }
}

function closeConfirmModal() {
    if (authManager) {
        authManager.closeConfirmModal();
    }
}

function showReplicaInfo() {
    if (authManager) {
        authManager.showReplicaInfo();
    }
}

function closeReplicaModal() {
    if (authManager) {
        authManager.closeReplicaModal();
    }
}

function refreshReplicaInfo() {
    if (authManager) {
        authManager.loadReplicaInfo();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    authManager = new SelfStudyAllAuthManager();
    
    // Add CSS for notifications
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        .notification button {
            background: none;
            border: none;
            font-size: 1.2rem;
            cursor: pointer;
            margin-left: 10px;
            color: inherit;
        }
    `;
    document.head.appendChild(style);
});