// SelfStudy All Auth Management JavaScript

class SelfStudyAllAuthManager {
    constructor() {
        this.baseUrl = '/selfstudyallauth/api/';
        this.currentPage = 1;
        this.pageSize = 20;
        this.totalPages = 1;
        this.currentSort = 'created_at';
        this.currentFilter = 'all';
        this.selectedToken = null;
        this.confirmAction = null;
        
        this.init();
    }
    
    init() {
        this.loadUsernames();
        this.setupEventListeners();
        this.checkExpirations();
        this.loadReplicaInfo();
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
        
        // Username search
        const usernameInput = document.getElementById('username');
        if (usernameInput) {
            usernameInput.addEventListener('input', debounce(() => {
                this.searchUsers(usernameInput.value);
            }, 300));
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
                }
            };
            
            if (method === 'GET') {
                const params = new URLSearchParams();
                params.set('action', action);
                if (data) {
                    Object.keys(data).forEach(key => {
                        params.set(key, data[key]);
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
            const result = await response.json();
            
            this.hideLoading();
            
            if (!response.ok) {
                throw new Error(result.error || `HTTP ${response.status}`);
            }
            
            return result;
        } catch (error) {
            this.hideLoading();
            this.showError('Request failed', error.message);
            throw error;
        }
    }
    
    // Token Management
    async loadTokens(page = 1) {
        try {
            const params = {
                limit: this.pageSize,
                offset: (page - 1) * this.pageSize,
                sort_by: this.currentSort
            };
            
            const result = await this.makeRequest('list_tokens', 'GET', params);
            
            if (result.data && result.data.tokens) {
                this.renderTokens(result.data.tokens);
                this.totalPages = Math.ceil(result.data.count / this.pageSize);
                this.renderPagination();
                this.currentPage = page;
            }
        } catch (error) {
            console.error('Failed to load tokens:', error);
        }
    }
    
    async createToken(tokenData) {
        try {
            const result = await this.makeRequest('create_token', 'POST', tokenData);
            
            if (result.status_code === 201 || result.status_code === 200) {
                this.showSuccess('Token created successfully');
                this.closeCreateModal();
                this.loadTokens();
            } else {
                throw new Error(result.data?.error || 'Failed to create token');
            }
        } catch (error) {
            this.showError('Failed to create token', error.message);
        }
    }
    
    async updateToken(token, data) {
        try {
            data.token = token;
            const result = await this.makeRequest('update_token', 'POST', data);
            
            if (result.status_code === 200) {
                this.showSuccess('Token updated successfully');
                this.closeEditModal();
                this.loadTokens();
            } else {
                throw new Error(result.data?.error || 'Failed to update token');
            }
        } catch (error) {
            this.showError('Failed to update token', error.message);
        }
    }
    
    async deleteToken(token) {
        try {
            const result = await this.makeRequest('delete_token', 'DELETE', { token });
            
            if (result.status_code === 200) {
                this.showSuccess('Token deleted successfully');
                this.closeConfirmModal();
                this.loadTokens();
            } else {
                throw new Error(result.data?.error || 'Failed to delete token');
            }
        } catch (error) {
            this.showError('Failed to delete token', error.message);
        }
    }
    
    async searchTokens() {
        const query = document.getElementById('searchInput').value.trim();
        if (!query) {
            this.loadTokens();
            return;
        }
        
        try {
            const data = {
                query: query,
                field: 'user_id',
                limit: 100
            };
            
            const result = await this.makeRequest('search_tokens', 'POST', data);
            
            if (result.status_code === 200) {
                this.renderTokens(result.data.results || []);
                this.renderPagination(true); // Hide pagination for search results
            }
        } catch (error) {
            console.error('Search failed:', error);
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
    async searchUsers(query) {
        if (query.length < 3) {
            this.clearAutocomplete();
            return;
        }
        
        try {
            const result = await this.makeRequest('search_user', 'GET', { username: query });
            
            if (result.status_code === 200 && result.data) {
                this.showUserAutocomplete([result.data]);
            } else if (result.status_code === 404) {
                this.clearAutocomplete();
            }
        } catch (error) {
            console.error('User search failed:', error);
        }
    }
    
    async loadUsernames() {
        const usernameCells = document.querySelectorAll('.username-cell');
        
        usernameCells.forEach(async cell => {
            const userId = cell.dataset.userId;
            if (userId) {
                try {
                    // Try to get username from user profile service
                    const result = await this.makeRequest('search_user', 'GET', { user_id: userId });
                    
                    if (result.status_code === 200 && result.data) {
                        const user = result.data;
                        cell.innerHTML = `<span class="username">${user.username || 'N/A'}</span>`;
                        if (user.email) {
                            cell.innerHTML += `<br><small class="email">${user.email}</small>`;
                        }
                    } else {
                        cell.innerHTML = '<span class="na">N/A</span>';
                    }
                } catch (error) {
                    cell.innerHTML = '<span class="na">Error</span>';
                }
            }
        });
    }
    
    async getUserByUsername(username) {
        try {
            const result = await this.makeRequest('search_user', 'GET', { username: username });
            
            if (result.status_code === 200 && result.data) {
                return result.data;
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
        
        tbody.innerHTML = '';
        
        tokens.forEach(token => {
            const row = this.createTokenRow(token);
            tbody.appendChild(row);
        });
        
        // Load usernames for the new rows
        setTimeout(() => this.loadUsernames(), 100);
    }
    
    createTokenRow(token) {
        const row = document.createElement('tr');
        row.dataset.token = token.token;
        
        const expiresDate = new Date(token.expires_at);
        const now = new Date();
        const daysRemaining = Math.ceil((expiresDate - now) / (1000 * 60 * 60 * 24));
        
        row.innerHTML = `
            <td class="token-cell">
                <code>${token.token.substring(0, 8)}...</code>
                <button class="btn-copy" onclick="copyToClipboard('${token.token}')">
                    <i class="far fa-copy"></i>
                </button>
            </td>
            <td>${token.user_id.substring(0, 8)}...</td>
            <td class="username-cell" data-user-id="${token.user_id}">
                <span class="loading">Loading...</span>
            </td>
            <td>${new Date(token.created_at).toLocaleDateString()}</td>
            <td class="expiry-cell" data-expires="${token.expires_at}">
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
        
        // Highlight expiring soon
        if (daysRemaining > 0 && daysRemaining <= 7) {
            row.classList.add('expiring-soon');
        }
        
        return row;
    }
    
    renderPagination(hide = false) {
        const pagination = document.getElementById('pagination');
        if (!pagination) return;
        
        if (hide || this.totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }
        
        let html = '';
        
        // Previous button
        if (this.currentPage > 1) {
            html += `<button onclick="goToPage(${this.currentPage - 1})">Previous</button>`;
        }
        
        // Page numbers
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(this.totalPages, startPage + 4);
        
        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="${i === this.currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
        }
        
        // Next button
        if (this.currentPage < this.totalPages) {
            html += `<button onclick="goToPage(${this.currentPage + 1})">Next</button>`;
        }
        
        pagination.innerHTML = html;
    }
    
    showUserAutocomplete(users) {
        const container = document.getElementById('userAutocomplete');
        if (!container) return;
        
        container.innerHTML = '';
        
        users.forEach(user => {
            const div = document.createElement('div');
            div.className = 'user-autocomplete-item';
            div.innerHTML = `
                <strong>${user.username}</strong><br>
                <small>${user.email || 'No email'} • ${user.user_id.substring(0, 8)}...</small>
            `;
            div.onclick = () => this.selectUser(user);
            container.appendChild(div);
        });
        
        container.style.display = 'block';
    }
    
    clearAutocomplete() {
        const container = document.getElementById('userAutocomplete');
        if (container) {
            container.innerHTML = '';
            container.style.display = 'none';
        }
    }
    
    selectUser(user) {
        document.getElementById('username').value = user.username;
        document.getElementById('userId').value = user.user_id;
        document.getElementById('userEmail').value = user.email || '';
        this.clearAutocomplete();
    }
    
    updateReplicaStatus(data) {
        // Update auth replicas
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
        
        // Update user replicas
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
        document.getElementById('username').focus();
    }
    
    closeCreateModal() {
        document.getElementById('createModal').classList.remove('show');
        document.getElementById('createForm').reset();
        this.clearAutocomplete();
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
                
                // Try to get username
                const user = await this.getUserByUsernameFromId(tokenData.user_id);
                if (user) {
                    document.getElementById('editUsername').value = user.username || 'N/A';
                } else {
                    document.getElementById('editUsername').value = 'Loading...';
                    setTimeout(async () => {
                        const user = await this.getUserByUsernameFromId(tokenData.user_id);
                        if (user) {
                            document.getElementById('editUsername').value = user.username || 'N/A';
                        }
                    }, 1000);
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
                
                // Update details modal
                document.getElementById('detailToken').textContent = token;
                document.getElementById('detailUserId').textContent = tokenData.user_id;
                document.getElementById('detailCreatedAt').textContent = new Date(tokenData.created_at).toLocaleString();
                document.getElementById('detailExpiresAt').textContent = new Date(tokenData.expires_at).toLocaleString();
                document.getElementById('detailIpAddress').textContent = tokenData.ip_address || 'N/A';
                document.getElementById('detailUserAgent').textContent = tokenData.user_agent || 'N/A';
                document.getElementById('detailStatus').textContent = tokenData.is_active ? 'Active' : 'Inactive';
                document.getElementById('detailIsValid').textContent = tokenData.is_valid ? 'Yes' : 'No';
                
                // Calculate days remaining
                const expiresDate = new Date(tokenData.expires_at);
                const now = new Date();
                const daysRemaining = Math.ceil((expiresDate - now) / (1000 * 60 * 60 * 24));
                document.getElementById('detailDaysRemaining').textContent = daysRemaining > 0 ? `${daysRemaining} days` : 'Expired';
                
                // Try to get username and email
                const user = await this.getUserByUsernameFromId(tokenData.user_id);
                if (user) {
                    document.getElementById('detailUsername').textContent = user.username || 'N/A';
                    document.getElementById('detailEmail').textContent = user.email || 'N/A';
                } else {
                    document.getElementById('detailUsername').textContent = 'Loading...';
                    document.getElementById('detailEmail').textContent = 'Loading...';
                }
                
                // Store token for validation
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
        this.clearAutocomplete();
    }
    
    // Utility Methods
    showLoading() {
        document.getElementById('loadingOverlay').classList.add('show');
    }
    
    hideLoading() {
        document.getElementById('loadingOverlay').classList.remove('show');
    }
    
    showSuccess(message) {
        this.showNotification(message, 'success');
    }
    
    showError(title, message) {
        this.showNotification(`${title}: ${message}`, 'error');
    }
    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">&times;</button>
        `;
        
        // Add styles
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
        
        // Auto-remove after 5 seconds
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
        // Check for tokens expiring soon
        const expiryCells = document.querySelectorAll('.expiry-cell');
        const now = new Date();
        
        expiryCells.forEach(cell => {
            const expiresAt = new Date(cell.dataset.expires);
            const daysRemaining = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
            
            if (daysRemaining <= 3 && daysRemaining > 0) {
                cell.style.color = '#e74c3c';
                cell.style.fontWeight = 'bold';
            }
        });
        
        // Check again in 1 minute
        setTimeout(() => this.checkExpirations(), 60000);
    }
    
    async getUserByUsernameFromId(userId) {
        // This is a simplified version - in production, you'd need an endpoint
        // that can get user by ID from the user profile service
        try {
            // Try to get from local cache first
            const cached = sessionStorage.getItem(`user_${userId}`);
            if (cached) {
                return JSON.parse(cached);
            }
            
            // If not cached, we can't easily get username from ID without proper endpoint
            return null;
        } catch (error) {
            return null;
        }
    }
    
    async validateCurrentToken() {
        if (!this.selectedToken) return;
        
        const result = await this.validateToken(this.selectedToken);
        const container = document.getElementById('validationResult');
        
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
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        // Show copied notification
        const manager = window.authManager;
        if (manager) {
            manager.showSuccess('Copied to clipboard');
        }
    } catch (err) {
        console.error('Failed to copy:', err);
    }
}

// Global Functions for HTML onclick handlers
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
        // In production, this would trigger a new API call with filter
        console.log('Filter changed to:', filter);
    }
}

function sortTokens() {
    if (authManager) {
        const sortBy = document.getElementById('sortBy').value;
        authManager.currentSort = sortBy;
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

function searchUser() {
    const username = document.getElementById('username').value.trim();
    if (username && authManager) {
        authManager.searchUsers(username);
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
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        .notification button {
            background: none;
            border: none;
            font-size: 1.2rem;
            cursor: pointer;
            margin-left: 10px;
            color: inherit;
        }
        
        .expiring-sown td {
            background-color: #fff3cd !important;
        }
        
        .username {
            font-weight: 500;
        }
        
        .email {
            color: #666;
            font-size: 0.85rem;
        }
        
        .na {
            color: #999;
            font-style: italic;
        }
    `;
    document.head.appendChild(style);
});