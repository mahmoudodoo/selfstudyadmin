/**
 * SelfStudy OTP Management JavaScript
 * Professional, responsive OTP management interface
 */

class OTPManager {
    constructor() {
        this.baseUrl = window.location.origin;
        this.users = [];
        this.allOtps = [];          // Store all OTPs
        this.filteredOtps = [];     // Filtered OTPs after search
        this.currentPage = 1;
        this.pageSize = 9;
        this.searchQuery = '';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupModals();
        this.setupToast();
        this.setupTableActions();
        this.checkSystemStatus();
        this.loadUsers();
        this.loadOTPs();
    }

    setupEventListeners() {
        // Generate OTP button
        document.getElementById('generateOtpBtn')?.addEventListener('click', () => {
            this.showModal('generateOtpModal');
            this.clearGenerateForm();
        });

        // Verify OTP button
        document.getElementById('verifyOtpBtn')?.addEventListener('click', () => {
            this.showModal('verifyOtpModal');
            this.clearVerifyForm();
        });

        // Resend OTP button
        document.getElementById('resendOtpBtn')?.addEventListener('click', () => {
            this.showModal('resendOtpModal');
            this.clearResendForm();
        });

        // Refresh buttons
        document.getElementById('refreshDataBtn')?.addEventListener('click', () => {
            this.refreshAllData();
        });

        document.getElementById('refreshDomainsBtn')?.addEventListener('click', () => {
            this.refreshDomains();
        });

        document.getElementById('refreshOtpListBtn')?.addEventListener('click', () => {
            this.refreshOtpList();
        });

        // Search input for OTP table
        const searchInput = document.getElementById('searchOtpInput');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.handleSearch(e.target.value);
                }, 300);
            });
        }

        // User selection in modals
        const generateUsername = document.getElementById('generateUsername');
        const verifyUserId = document.getElementById('verifyUserId');
        const resendUsername = document.getElementById('resendUsername');

        if (generateUsername) {
            generateUsername.addEventListener('change', (e) => {
                this.handleUserSelection(e.target, 'generateUserId', 'generateEmail', 'userFullName', 'userStatusBadge');
            });
        }

        if (verifyUserId) {
            verifyUserId.addEventListener('change', (e) => {
                this.handleUserSelectionForVerify(e.target);
            });
        }

        if (resendUsername) {
            resendUsername.addEventListener('change', (e) => {
                this.handleUserSelection(e.target, 'resendUserId', 'resendEmail');
            });
        }

        // Refresh users buttons
        document.getElementById('refreshUsersBtn')?.addEventListener('click', () => {
            this.loadUsers(true);
        });

        document.getElementById('refreshUsersVerifyBtn')?.addEventListener('click', () => {
            this.loadUsers(true, 'verifyUserId');
        });

        document.getElementById('refreshUsersResendBtn')?.addEventListener('click', () => {
            this.loadUsers(true, 'resendUsername');
        });

        // Form submission buttons
        document.getElementById('submitGenerateOtp')?.addEventListener('click', () => {
            this.generateOTP();
        });

        document.getElementById('submitVerifyOtp')?.addEventListener('click', () => {
            this.verifyOTP();
        });

        document.getElementById('submitResendOtp')?.addEventListener('click', () => {
            this.resendOTP();
        });

        // Copy domain buttons
        document.querySelectorAll('.copy-domain-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const domain = e.currentTarget.dataset.domain;
                this.copyToClipboard(domain);
                this.showToast('Copied!', 'Domain URL copied to clipboard', 'success');
            });
        });
    }

    setupModals() {
        // Close modals on close button click
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeAllModals();
            });
        });

        // Close modals on overlay click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeAllModals();
                }
            });
        });

        // Close modals on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
    }

    setupToast() {
        // Toast container is already in HTML
    }

    setupTableActions() {
        // Copy OTP code (using event delegation for dynamic elements)
        document.getElementById('otpTableBody')?.addEventListener('click', (e) => {
            const copyBtn = e.target.closest('.copy-otp-btn');
            if (copyBtn) {
                const code = copyBtn.dataset.code;
                this.copyToClipboard(code);
                this.showToast('Copied!', 'OTP code copied to clipboard', 'success');
                return;
            }

            const deleteBtn = e.target.closest('.delete-otp-btn');
            if (deleteBtn) {
                const userId = deleteBtn.dataset.userId;
                const row = deleteBtn.closest('tr');
                if (confirm(`Are you sure you want to delete OTP for user ${userId}?`)) {
                    this.deleteOTP(userId);
                }
                return;
            }
        });
    }

    showModal(modalId) {
        this.closeAllModals();
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            
            // Load fresh users when modal opens
            if (modalId.includes('generate') || modalId.includes('resend')) {
                this.loadUsers();
            }
        }
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
        document.body.style.overflow = '';
    }

    showLoading(show = true) {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.toggle('active', show);
        }
    }

    showToast(title, message, type = 'info', duration = 5000) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icons = {
            success: 'M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z',
            error: 'M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z',
            info: 'M13,9H11V7H13M13,17H11V11H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z'
        };

        toast.innerHTML = `
            <div class="toast-icon">
                <svg viewBox="0 0 24 24" width="20" height="20">
                    <path fill="currentColor" d="${icons[type] || icons.info}" />
                </svg>
            </div>
            <div class="toast-content">
                <h4 class="toast-title">${title}</h4>
                <p class="toast-message">${message}</p>
            </div>
            <button class="toast-close">
                <svg viewBox="0 0 24 24" width="16" height="16">
                    <path fill="currentColor" d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />
                </svg>
            </button>
        `;

        container.appendChild(toast);

        // Auto remove after duration
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            }
        }, duration);

        // Close button
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        });

        // Remove toast when clicking anywhere
        toast.addEventListener('click', (e) => {
            if (e.target === toast || e.target.closest('.toast-content')) {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }
        });
    }

    async loadUsers(forceRefresh = false, targetSelectId = null) {
        this.showLoading(true);

        try {
            const formData = new FormData();
            formData.append('action', 'fetch_users');

            const response = await fetch(this.baseUrl + '/selfstudyotp/', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRFToken': this.getCSRFToken()
                }
            });

            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Server returned non-JSON response');
            }

            const data = await response.json();

            if (data.success) {
                this.users = data.users || [];
                this.populateUserSelects(this.users);
                
                // Update stats
                const totalUsersElement = document.getElementById('totalUsersCount');
                if (totalUsersElement) {
                    totalUsersElement.textContent = this.users.length;
                }
                
                if (!targetSelectId) {
                    this.showToast('Success', `Loaded ${this.users.length} users`, 'success');
                }
            } else {
                this.showToast('Error', data.message || 'Failed to load users', 'error');
            }
        } catch (error) {
            console.error('Load users error:', error);
            this.showToast('Error', 'Failed to load users from server', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    getCSRFToken() {
        // Try to get CSRF token from cookie
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

    populateUserSelects(users) {
        // Update all user selects
        const selects = ['generateUsername', 'verifyUserId', 'resendUsername'];
        
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (!select) return;
            
            // Save current value
            const currentValue = select.value;
            
            // Clear options except first
            while (select.options.length > 1) {
                select.remove(1);
            }
            
            // Add new options
            users.forEach(user => {
                const option = document.createElement('option');
                if (selectId === 'verifyUserId') {
                    option.value = user.user_id;
                    option.setAttribute('data-username', user.username);
                    option.setAttribute('data-email', user.email);
                    option.textContent = `${user.username} (${user.email})`;
                } else {
                    option.value = user.username;
                    option.setAttribute('data-user-id', user.user_id);
                    option.setAttribute('data-email', user.email);
                    option.setAttribute('data-verified', user.is_email_verified);
                    option.textContent = `${user.username} (${user.email})`;
                }
                select.appendChild(option);
            });
            
            // Restore value if it still exists
            if (currentValue) {
                select.value = currentValue;
                if (!select.value && selectId === 'verifyUserId') {
                    // Trigger change for verify modal
                    this.handleUserSelectionForVerify(select);
                } else if (!select.value) {
                    // Trigger change for other modals
                    const targetUserIdField = selectId === 'generateUsername' ? 'generateUserId' : 'resendUserId';
                    const targetEmailField = selectId === 'generateUsername' ? 'generateEmail' : 'resendEmail';
                    this.handleUserSelection(select, targetUserIdField, targetEmailField);
                }
            }
        });
    }

    handleUserSelection(selectElement, userIdFieldId, emailFieldId, fullNameFieldId = null, statusBadgeId = null) {
        const selectedOption = selectElement.options[selectElement.selectedIndex];
        
        if (selectedOption.value) {
            const userId = selectedOption.getAttribute('data-user-id');
            const email = selectedOption.getAttribute('data-email');
            const isVerified = selectedOption.getAttribute('data-verified') === 'true';
            
            // Update user ID field
            const userIdField = document.getElementById(userIdFieldId);
            if (userIdField) {
                userIdField.value = userId;
            }
            
            // Update email field
            const emailField = document.getElementById(emailFieldId);
            if (emailField) {
                emailField.value = email;
            }
            
            // Update full name if provided
            if (fullNameFieldId) {
                const fullNameField = document.getElementById(fullNameFieldId);
                if (fullNameField) {
                    const user = this.users.find(u => u.user_id === userId);
                    if (user) {
                        const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'N/A';
                        fullNameField.textContent = fullName || '-';
                    }
                }
            }
            
            // Update status badge if provided
            if (statusBadgeId) {
                const statusBadge = document.getElementById(statusBadgeId);
                if (statusBadge) {
                    statusBadge.textContent = isVerified ? 'Verified' : 'Unverified';
                    statusBadge.dataset.status = isVerified ? 'verified' : 'unverified';
                }
            }
        } else {
            // Clear fields if no user selected
            const userIdField = document.getElementById(userIdFieldId);
            const emailField = document.getElementById(emailFieldId);
            const fullNameField = document.getElementById(fullNameFieldId);
            const statusBadge = document.getElementById(statusBadgeId);
            
            if (userIdField) userIdField.value = '';
            if (emailField) emailField.value = '';
            if (fullNameField) fullNameField.textContent = '-';
            if (statusBadge) {
                statusBadge.textContent = 'Unknown';
                statusBadge.dataset.status = '';
            }
        }
    }

    handleUserSelectionForVerify(selectElement) {
        const selectedOption = selectElement.options[selectElement.selectedIndex];
        
        if (selectedOption.value) {
            const username = selectedOption.getAttribute('data-username');
            const email = selectedOption.getAttribute('data-email');
            
            // Update display
            const nameField = document.getElementById('selectedUserName');
            const emailField = document.getElementById('selectedUserEmail');
            
            if (nameField) nameField.textContent = username;
            if (emailField) emailField.textContent = email;
        } else {
            const nameField = document.getElementById('selectedUserName');
            const emailField = document.getElementById('selectedUserEmail');
            
            if (nameField) nameField.textContent = 'No user selected';
            if (emailField) emailField.textContent = '-';
        }
    }

    clearGenerateForm() {
        const form = document.getElementById('generateOtpForm');
        if (form) {
            form.reset();
            const fullNameField = document.getElementById('userFullName');
            if (fullNameField) fullNameField.textContent = '-';
            const statusBadge = document.getElementById('userStatusBadge');
            if (statusBadge) {
                statusBadge.textContent = 'Unknown';
                statusBadge.dataset.status = '';
            }
        }
    }

    clearVerifyForm() {
        const form = document.getElementById('verifyOtpForm');
        if (form) form.reset();
        const nameField = document.getElementById('selectedUserName');
        const emailField = document.getElementById('selectedUserEmail');
        if (nameField) nameField.textContent = 'No user selected';
        if (emailField) emailField.textContent = '-';
    }

    clearResendForm() {
        const form = document.getElementById('resendOtpForm');
        if (form) form.reset();
    }

    async generateOTP() {
        const form = document.getElementById('generateOtpForm');
        if (!form) return;

        const username = document.getElementById('generateUsername')?.value.trim();
        const userId = document.getElementById('generateUserId')?.value.trim();
        const email = document.getElementById('generateEmail')?.value.trim();

        if (!username || !userId || !email) {
            this.showToast('Error', 'Please select a user', 'error');
            return;
        }

        this.showLoading(true);

        try {
            const formData = new FormData();
            formData.append('action', 'generate_otp');
            formData.append('username', username);
            formData.append('user_id', userId);
            formData.append('email', email);

            const response = await fetch(this.baseUrl + '/selfstudyotp/', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRFToken': this.getCSRFToken()
                }
            });

            const data = await response.json();

            if (data.success) {
                this.showToast('Success', data.message, 'success');
                this.closeAllModals();
                
                // Refresh OTP list
                this.refreshOtpList();
                
                // Show OTP details
                setTimeout(() => {
                    if (data.data) {
                        const msg = `OTP generated and ${data.data.email_sent ? 'email sent' : 'email failed to send'}. Created at: ${new Date(data.data.created_at).toLocaleString()}`;
                        this.showToast('OTP Generated', msg, 'info');
                    }
                }, 1000);
            } else {
                this.showToast('Error', data.message, 'error');
            }
        } catch (error) {
            console.error('Generate OTP error:', error);
            this.showToast('Error', 'Failed to generate OTP', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async verifyOTP() {
        const form = document.getElementById('verifyOtpForm');
        if (!form) return;

        const userId = document.getElementById('verifyUserId')?.value.trim();
        const code = document.getElementById('verifyCode')?.value.trim();

        if (!userId || !code) {
            this.showToast('Error', 'Please fill all required fields', 'error');
            return;
        }

        if (!/^\d{6}$/.test(code)) {
            this.showToast('Error', 'OTP code must be 6 digits', 'error');
            return;
        }

        this.showLoading(true);

        try {
            const formData = new FormData();
            formData.append('action', 'verify_otp');
            formData.append('user_id', userId);
            formData.append('code', code);

            const response = await fetch(this.baseUrl + '/selfstudyotp/', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRFToken': this.getCSRFToken()
                }
            });

            const data = await response.json();

            if (data.success) {
                this.showToast('Success', data.message, 'success');
                this.closeAllModals();
                
                // Refresh OTP list
                this.refreshOtpList();
                
                // Show verification details
                setTimeout(() => {
                    if (data.data) {
                        const msg = `Email verified: ${data.data.email_verified ? 'Yes' : 'No'}. Verified via: ${data.data.verified_domain || 'N/A'}`;
                        this.showToast('OTP Verified', msg, 'info');
                    }
                }, 1000);
            } else {
                this.showToast('Error', data.message, 'error');
            }
        } catch (error) {
            console.error('Verify OTP error:', error);
            this.showToast('Error', 'Failed to verify OTP', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async resendOTP() {
        const form = document.getElementById('resendOtpForm');
        if (!form) return;

        const username = document.getElementById('resendUsername')?.value.trim();
        const userId = document.getElementById('resendUserId')?.value.trim();
        const email = document.getElementById('resendEmail')?.value.trim();

        if (!username || !userId || !email) {
            this.showToast('Error', 'Please select a user', 'error');
            return;
        }

        this.showLoading(true);

        try {
            const formData = new FormData();
            formData.append('action', 'resend_otp');
            formData.append('username', username);
            formData.append('user_id', userId);
            formData.append('email', email);

            const response = await fetch(this.baseUrl + '/selfstudyotp/', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRFToken': this.getCSRFToken()
                }
            });

            const data = await response.json();

            if (data.success) {
                this.showToast('Success', data.message, 'success');
                this.closeAllModals();
                
                // Refresh OTP list
                this.refreshOtpList();
                
                // Show resend details
                setTimeout(() => {
                    if (data.data) {
                        const msg = `OTP resent and ${data.data.email_sent ? 'email sent' : 'email failed to send'}`;
                        this.showToast('OTP Resent', msg, 'info');
                    }
                }, 1000);
            } else {
                this.showToast('Error', data.message, 'error');
            }
        } catch (error) {
            console.error('Resend OTP error:', error);
            this.showToast('Error', 'Failed to resend OTP', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async deleteOTP(userId) {
        this.showLoading(true);

        try {
            const formData = new FormData();
            formData.append('action', 'delete_otp');
            formData.append('user_id', userId);

            const response = await fetch(this.baseUrl + '/selfstudyotp/', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRFToken': this.getCSRFToken()
                }
            });

            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}`);
            }

            const data = await response.json();

            if (data.success) {
                this.showToast('Success', data.message, 'success');
                // Refresh the OTP list to reflect deletion
                await this.loadOTPs(true);
            } else {
                this.showToast('Error', data.message, 'error');
            }
        } catch (error) {
            console.error('Delete OTP error:', error);
            this.showToast('Error', 'Failed to delete OTP from server', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async refreshAllData() {
        this.showLoading(true);
        
        try {
            await Promise.all([
                this.loadUsers(true),
                this.refreshDomains(),
                this.refreshOtpList()
            ]);
            
            this.showToast('Success', 'All data refreshed successfully', 'success');
        } catch (error) {
            console.error('Refresh all data error:', error);
            this.showToast('Error', 'Failed to refresh all data', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async refreshDomains() {
        // In a real app, this would refresh the domains from the registry
        // For now, just show a success message
        this.showToast('Success', 'Domains refreshed successfully', 'success');
    }

    // ========== OTP TABLE WITH PAGINATION & SEARCH ==========

    async loadOTPs(forceRefresh = false) {
        this.showLoading(true);

        try {
            const formData = new FormData();
            formData.append('action', 'fetch_otps');

            const response = await fetch(this.baseUrl + '/selfstudyotp/', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRFToken': this.getCSRFToken()
                }
            });

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Server returned non-JSON response');
            }

            const data = await response.json();

            if (data.success) {
                this.allOtps = data.otps || [];
                this.filteredOtps = [...this.allOtps];
                this.currentPage = 1;
                this.searchQuery = '';
                const searchInput = document.getElementById('searchOtpInput');
                if (searchInput) searchInput.value = '';
                this.renderOTPTable();
                
                // Update stats
                const activeOtpsElement = document.getElementById('activeOtpsCount');
                if (activeOtpsElement) {
                    activeOtpsElement.textContent = this.allOtps.length;
                }
                
                if (forceRefresh) {
                    this.showToast('Success', `Loaded ${this.allOtps.length} OTPs`, 'success');
                }
            } else {
                this.showToast('Error', data.message || 'Failed to load OTPs', 'error');
            }
        } catch (error) {
            console.error('Load OTPs error:', error);
            this.showToast('Error', 'Failed to load OTPs from server', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    handleSearch(query) {
        this.searchQuery = query.trim().toLowerCase();
        this.applyFilter();
        this.currentPage = 1;
        this.renderOTPTable();
    }

    applyFilter() {
        if (!this.searchQuery) {
            this.filteredOtps = [...this.allOtps];
            return;
        }

        this.filteredOtps = this.allOtps.filter(otp => {
            return (
                (otp.user_id && otp.user_id.toLowerCase().includes(this.searchQuery)) ||
                (otp.username && otp.username.toLowerCase().includes(this.searchQuery)) ||
                (otp.email && otp.email.toLowerCase().includes(this.searchQuery)) ||
                (otp.code && otp.code.toLowerCase().includes(this.searchQuery))
            );
        });
    }

    renderPagination() {
        const container = document.getElementById('otpPagination');
        if (!container) return;

        const totalItems = this.filteredOtps.length;
        const totalPages = Math.ceil(totalItems / this.pageSize);

        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let currentPage = this.currentPage;
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;
        this.currentPage = currentPage;

        let html = '<div class="pagination-controls">';
        html += `<button class="pagination-btn" data-page="prev" ${currentPage === 1 ? 'disabled' : ''}>« Prev</button>`;

        let start = Math.max(1, currentPage - 2);
        let end = Math.min(totalPages, currentPage + 2);
        if (start > 1) {
            html += `<button class="pagination-btn" data-page="1">1</button>`;
            if (start > 2) html += '<span class="pagination-ellipsis">...</span>';
        }
        for (let i = start; i <= end; i++) {
            html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        if (end < totalPages) {
            if (end < totalPages - 1) html += '<span class="pagination-ellipsis">...</span>';
            html += `<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
        }
        html += `<button class="pagination-btn" data-page="next" ${currentPage === totalPages ? 'disabled' : ''}>Next »</button>`;
        html += '</div>';

        container.innerHTML = html;

        container.querySelectorAll('.pagination-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = btn.dataset.page;
                if (page === 'prev') {
                    this.changePage(currentPage - 1);
                } else if (page === 'next') {
                    this.changePage(currentPage + 1);
                } else {
                    this.changePage(parseInt(page, 10));
                }
            });
        });
    }

    changePage(page) {
        const totalPages = Math.ceil(this.filteredOtps.length / this.pageSize);
        if (page < 1 || page > totalPages) return;
        this.currentPage = page;
        this.renderOTPTable();
    }

    renderOTPTable() {
        const tableBody = document.getElementById('otpTableBody');
        if (!tableBody) return;

        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        const pageOtps = this.filteredOtps.slice(start, end);

        if (pageOtps.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-table">
                        <div class="empty-state">
                            <svg viewBox="0 0 24 24" width="48" height="48">
                                <path fill="currentColor" d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6Z" />
                            </svg>
                            <p>No OTP records found</p>
                            <p class="empty-subtext">Generate your first OTP to see records here</p>
                        </div>
                    </td>
                </tr>
            `;
            this.renderPagination();
            return;
        }

        let html = '';
        pageOtps.forEach(otp => {
            const createdDate = new Date(otp.created_at);
            const formattedDate = createdDate.toLocaleString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            const statusClass = otp.is_used ? 'status-used' : 'status-active';
            const statusText = otp.is_used ? 'Used' : 'Active';
            
            // Truncate user_id for display
            const displayUserId = otp.user_id.length > 12 ? 
                otp.user_id.substring(0, 12) + '...' : 
                otp.user_id;
            
            html += `
                <tr data-user-id="${otp.user_id}">
                    <td><span class="text-monospace" title="${otp.user_id}">${displayUserId}</span></td>
                    <td>${otp.username || '-'}</td>
                    <td>${otp.email}</td>
                    <td><span class="otp-code">${otp.code}</span></td>
                    <td>${formattedDate}</td>
                    <td>
                        <span class="status-badge ${statusClass}">
                            ${statusText}
                        </span>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-icon btn-sm action-btn copy-otp-btn" 
                                    title="Copy OTP" 
                                    data-code="${otp.code}">
                                <svg viewBox="0 0 24 24" width="14" height="14">
                                    <path fill="currentColor" d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z" />
                                </svg>
                            </button>
                            <button class="btn btn-icon btn-sm action-btn delete-otp-btn" 
                                    title="Delete OTP" 
                                    data-user-id="${otp.user_id}">
                                <svg viewBox="0 0 24 24" width="14" height="14">
                                    <path fill="currentColor" d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" />
                                </svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        tableBody.innerHTML = html;
        this.renderPagination();
    }

    async refreshOtpList() {
        await this.loadOTPs(true);
        this.showToast('Success', 'OTP list refreshed', 'success');
    }

    updateStats() {
        const otpCount = this.allOtps.length;
        const activeOtpsElement = document.getElementById('activeOtpsCount');
        if (activeOtpsElement) {
            activeOtpsElement.textContent = otpCount;
        }
    }

    checkSystemStatus() {
        try {
            const otpDomains = document.querySelectorAll('#otpDomainList .domain-item').length;
            const otpDomainCount = document.getElementById('otpDomainCount');
            if (otpDomainCount) {
                otpDomainCount.textContent = otpDomains;
            }
            
            // Update user domain count if element exists
            const userDomainCount = document.getElementById('userDomainCount');
            if (userDomainCount) {
                const userDomains = document.querySelectorAll('#userDomainList .domain-item').length;
                userDomainCount.textContent = userDomains;
            }
            
        } catch (error) {
            console.error('System status check error:', error);
        }
    }

    copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text);
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.otpManager = new OTPManager();
});