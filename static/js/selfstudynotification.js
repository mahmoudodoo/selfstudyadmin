// SelfStudy Notification Management JavaScript
class NotificationManager {
    constructor() {
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.currentNotificationId = null;
        this.isEditing = false;
        this.users = []; // Store users for selection
        this.selectedUsers = []; // For multi-select in group notifications
        this.init();
    }

    init() {
        this.bindEvents();
        this.initializeUsers(); // Use template data instead of API
        this.loadNotifications();
        this.updateStats();
    }

    initializeUsers() {
        // Get users from template context
        try {
            // Check if users are available in global scope from template
            if (typeof window.templateUsers !== 'undefined') {
                this.users = window.templateUsers;
            } else {
                // Fallback: try to get from data attribute
                const usersData = document.getElementById('users-data');
                if (usersData) {
                    this.users = JSON.parse(usersData.textContent);
                } else {
                    this.users = [];
                }
            }
            this.populateUserDropdowns();
        } catch (error) {
            console.error('Error initializing users:', error);
            this.users = [];
        }
    }

    bindEvents() {
        // Modal controls
        document.getElementById('createNotificationBtn').addEventListener('click', () => this.openCreateModal());
        document.getElementById('closeModal').addEventListener('click', () => this.closeModal());
        document.getElementById('closeViewModal').addEventListener('click', () => this.closeViewModal());
        document.getElementById('closeDeleteModal').addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('cancelBtn').addEventListener('click', () => this.closeModal());
        document.getElementById('closeViewBtn').addEventListener('click', () => this.closeViewModal());
        document.getElementById('cancelDeleteBtn').addEventListener('click', () => this.closeDeleteModal());

        // Form submission
        document.getElementById('notificationForm').addEventListener('submit', (e) => this.handleFormSubmit(e));

        // Notification type change
        document.getElementById('notification_type').addEventListener('change', (e) => this.handleNotificationTypeChange(e));

        // Multi-user selection
        document.getElementById('multiUserSelect')?.addEventListener('change', (e) => this.handleMultiUserSelect(e));

        // Delete confirmation
        document.getElementById('confirmDeleteBtn').addEventListener('click', () => this.confirmDelete());

        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => this.refreshData());

        // Search functionality
        document.getElementById('searchInput').addEventListener('input', (e) => this.handleSearch(e));

        // Close modals on outside click
        this.setupModalCloseHandlers();

        // Toast close buttons
        document.querySelectorAll('.toast-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.toast').classList.remove('show');
            });
        });
    }

    populateUserDropdowns() {
        const recipientSelect = document.getElementById('recipient');
        const multiUserSelect = document.getElementById('multiUserSelect');

        // Clear existing options
        if (recipientSelect) {
            recipientSelect.innerHTML = '<option value="">Select a user...</option>';

            // Add users to single select using usernames
            this.users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.username;
                option.textContent = user.display_name;
                recipientSelect.appendChild(option);
            });
        }

        // Populate multi-select (for group notifications)
        if (multiUserSelect) {
            multiUserSelect.innerHTML = '<option value="">Select users...</option>';
            this.users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.username;
                option.textContent = user.display_name;
                multiUserSelect.appendChild(option);
            });
        }
    }

    handleNotificationTypeChange(e) {
        const notificationType = e.target.value;
        const recipientGroup = document.getElementById('recipientGroup');
        const multiUserGroup = document.getElementById('multiUserGroup');
        const recipientField = document.getElementById('recipient');
        const multiUserField = document.getElementById('multiUserSelect');

        if (notificationType === 'personal') {
            if (recipientGroup) recipientGroup.style.display = 'block';
            if (multiUserGroup) multiUserGroup.style.display = 'none';
            if (recipientField) recipientField.required = true;
            if (multiUserField) multiUserField.required = false;
        } else if (notificationType === 'group') {
            if (recipientGroup) recipientGroup.style.display = 'none';
            if (multiUserGroup) multiUserGroup.style.display = 'block';
            if (recipientField) recipientField.required = false;
            if (multiUserField) multiUserField.required = true;
        } else { // general
            if (recipientGroup) recipientGroup.style.display = 'none';
            if (multiUserGroup) multiUserGroup.style.display = 'none';
            if (recipientField) recipientField.required = false;
            if (multiUserField) multiUserField.required = false;
        }
    }

    handleMultiUserSelect(e) {
        const selectedOptions = Array.from(e.target.selectedOptions);
        this.selectedUsers = selectedOptions.map(option => option.value);

        // Update the selected users display
        this.updateSelectedUsersDisplay();
    }

    updateSelectedUsersDisplay() {
        const selectedUsersContainer = document.getElementById('selectedUsers');
        if (!selectedUsersContainer) return;

        selectedUsersContainer.innerHTML = '';

        if (this.selectedUsers.length === 0) {
            selectedUsersContainer.innerHTML = '<span class="no-users">No users selected</span>';
            return;
        }

        this.selectedUsers.forEach(username => {
            const user = this.users.find(u => u.username === username);
            const userBadge = document.createElement('span');
            userBadge.className = 'user-badge';
            userBadge.innerHTML = `
            ${user ? user.display_name : username}
            <button type="button" class="remove-user" data-username="${username}">
            <i class="fas fa-times"></i>
            </button>
            `;
            selectedUsersContainer.appendChild(userBadge);
        });

        // Add event listeners to remove buttons
        selectedUsersContainer.querySelectorAll('.remove-user').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const username = e.target.closest('.remove-user').getAttribute('data-username');
                this.removeSelectedUser(username);
            });
        });
    }

    removeSelectedUser(username) {
        this.selectedUsers = this.selectedUsers.filter(u => u !== username);
        this.updateSelectedUsersDisplay();

        // Also remove from multi-select
        const multiUserSelect = document.getElementById('multiUserSelect');
        if (multiUserSelect) {
            const option = Array.from(multiUserSelect.options).find(opt => opt.value === username);
            if (option) option.selected = false;
        }
    }

    setupModalCloseHandlers() {
        const modals = ['notificationModal', 'viewModal', 'deleteModal'];
        modals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        if (modalId === 'notificationModal') this.closeModal();
                        if (modalId === 'viewModal') this.closeViewModal();
                        if (modalId === 'deleteModal') this.closeDeleteModal();
                    }
                });
            }
        });
    }

    async loadNotifications() {
        this.showLoading();
        try {
            const response = await fetch('/selfstudynotification/api/');

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                let notifications = [];
                if (data.data && data.data.items) {
                    notifications = data.data.items;
                } else if (data.data && Array.isArray(data.data)) {
                    notifications = data.data;
                } else if (data.data && data.data.results) {
                    notifications = data.data.results;
                }

                this.renderNotifications(notifications);
                this.updateStats(notifications);
            } else {
                this.showError('Failed to load notifications: ' + data.error);
            }
        } catch (error) {
            console.error('Error loading notifications:', error);
            this.showError('Network error loading notifications: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    renderNotifications(notifications) {
        const tbody = document.getElementById('notificationsTableBody');
        if (!tbody) return;

        if (!notifications || notifications.length === 0) {
            tbody.innerHTML = `
            <tr>
            <td colspan="8" class="no-data">
            <i class="fas fa-bell-slash"></i>
            <p>No notifications found</p>
            </td>
            </tr>
            `;
            return;
        }

        tbody.innerHTML = notifications.map(notification => `
        <tr data-id="${notification.notification_id}">
        <td class="title-cell">${this.escapeHtml(notification.title)}</td>
        <td class="message-cell">${this.escapeHtml(notification.message)}</td>
        <td>
        <span class="badge badge-${notification.notification_type}">
        ${notification.notification_type.charAt(0).toUpperCase() + notification.notification_type.slice(1)}
        </span>
        </td>
        <td>
        ${notification.read ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-warning">No</span>'}
        </td>
        <td>${this.escapeHtml(notification.sender)}</td>
        <td>${this.getRecipientDisplay(notification.recipient, notification.notification_type)}</td>
        <td>${this.formatDate(notification.created_at)}</td>
        <td class="actions-cell">
        <button class="btn-icon view-btn" data-id="${notification.notification_id}" title="View">
        <i class="fas fa-eye"></i>
        </button>
        <button class="btn-icon edit-btn" data-id="${notification.notification_id}" title="Edit">
        <i class="fas fa-edit"></i>
        </button>
        <button class="btn-icon delete-btn" data-id="${notification.notification_id}" title="Delete">
        <i class="fas fa-trash"></i>
        </button>
        </td>
        </tr>
        `).join('');

        // Bind action buttons
        this.bindActionButtons();
    }

    getRecipientDisplay(recipient, notificationType) {
        if (!recipient) return 'All Users';

        if (notificationType === 'personal') {
            // Find user display name by username
            const user = this.users.find(u => u.username === recipient);
            return user ? user.display_name : recipient;
        } else if (notificationType === 'group') {
            // Handle comma-separated usernames
            const usernames = recipient.split(',');
            const userNames = usernames.map(username => {
                const user = this.users.find(u => u.username === username.trim());
                return user ? user.display_name : username.trim();
            });
            return userNames.join(', ');
        }

        return recipient;
    }

    bindActionButtons() {
        // View buttons
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const notificationId = e.currentTarget.getAttribute('data-id');
                this.viewNotification(notificationId);
            });
        });

        // Edit buttons
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const notificationId = e.currentTarget.getAttribute('data-id');
                this.editNotification(notificationId);
            });
        });

        // Delete buttons
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const notificationId = e.currentTarget.getAttribute('data-id');
                const title = e.currentTarget.closest('tr').querySelector('.title-cell').textContent;
                this.openDeleteModal(notificationId, title);
            });
        });
    }

    async viewNotification(notificationId) {
        this.showLoading();
        try {
            const response = await fetch(`/selfstudynotification/api/${notificationId}/`);
            const data = await response.json();

            if (data.success) {
                this.showViewModal(data.data);
            } else {
                this.showError('Failed to load notification details: ' + data.error);
            }
        } catch (error) {
            console.error('Error viewing notification:', error);
            this.showError('Network error loading notification details');
        } finally {
            this.hideLoading();
        }
    }

    async editNotification(notificationId) {
        this.showLoading();
        try {
            const response = await fetch(`/selfstudynotification/api/${notificationId}/`);
            const data = await response.json();

            if (data.success) {
                this.openEditModal(data.data);
            } else {
                this.showError('Failed to load notification for editing: ' + data.error);
            }
        } catch (error) {
            console.error('Error loading notification for edit:', error);
            this.showError('Network error loading notification for editing');
        } finally {
            this.hideLoading();
        }
    }

    openCreateModal() {
        this.isEditing = false;
        this.currentNotificationId = null;
        this.selectedUsers = [];

        document.getElementById('modalTitle').textContent = 'Create Notification';
        document.getElementById('submitBtn').querySelector('.btn-text').textContent = 'Create Notification';
        document.getElementById('notificationForm').reset();

        // Reset UI state
        this.handleNotificationTypeChange({ target: document.getElementById('notification_type') });
        this.updateSelectedUsersDisplay();

        // Reset read checkbox
        document.getElementById('read').checked = false;

        this.clearErrors();
        this.showModal('notificationModal');
    }

    openEditModal(notification) {
        this.isEditing = true;
        this.currentNotificationId = notification.notification_id;
        this.selectedUsers = [];

        document.getElementById('modalTitle').textContent = 'Edit Notification';
        document.getElementById('submitBtn').querySelector('.btn-text').textContent = 'Update Notification';

        // Fill form with notification data
        document.getElementById('title').value = notification.title;
        document.getElementById('message').value = notification.message;
        document.getElementById('notification_type').value = notification.notification_type;
        document.getElementById('sender').value = notification.sender;
        document.getElementById('read').checked = notification.read || false;

        // Handle recipient based on notification type
        if (notification.notification_type === 'personal') {
            document.getElementById('recipient').value = notification.recipient;
        } else if (notification.notification_type === 'group') {
            // Parse comma-separated usernames for group notifications
            if (notification.recipient) {
                this.selectedUsers = notification.recipient.split(',').map(u => u.trim());
                this.updateSelectedUsersDisplay();

                // Select the users in multi-select
                const multiUserSelect = document.getElementById('multiUserSelect');
                if (multiUserSelect) {
                    Array.from(multiUserSelect.options).forEach(option => {
                        option.selected = this.selectedUsers.includes(option.value);
                    });
                }
            }
        }

        // Update UI based on notification type
        this.handleNotificationTypeChange({ target: document.getElementById('notification_type') });

        this.clearErrors();
        this.showModal('notificationModal');
    }

    showViewModal(notification) {
        document.getElementById('viewTitle').textContent = notification.title;
        document.getElementById('viewMessage').textContent = notification.message;
        document.getElementById('viewType').innerHTML = `
        <span class="badge badge-${notification.notification_type}">
        ${notification.notification_type.charAt(0).toUpperCase() + notification.notification_type.slice(1)}
        </span>
        `;
        document.getElementById('viewRead').innerHTML = notification.read ?
        '<span class="badge badge-success">Yes</span>' :
        '<span class="badge badge-warning">No</span>';
        document.getElementById('viewSender').textContent = notification.sender;
        document.getElementById('viewRecipient').textContent = this.getRecipientDisplay(notification.recipient, notification.notification_type);

        // Show group UUID if it's a group notification
        if (notification.notification_type === 'group' && notification.group_name) {
            document.getElementById('viewGroupName').textContent = notification.group_name;
            document.getElementById('viewGroupNameContainer').style.display = 'block';
        } else {
            document.getElementById('viewGroupNameContainer').style.display = 'none';
        }

        document.getElementById('viewCreated').textContent = this.formatDate(notification.created_at);
        document.getElementById('viewUpdated').textContent = this.formatDate(notification.updated_at);
        document.getElementById('viewId').textContent = notification.notification_id;

        this.showModal('viewModal');
    }

    openDeleteModal(notificationId, title) {
        this.currentNotificationId = notificationId;
        document.getElementById('deleteNotificationTitle').textContent = title;
        this.showModal('deleteModal');
    }

    async handleFormSubmit(e) {
        e.preventDefault();

        if (!this.validateForm()) {
            return;
        }

        const formData = new FormData(e.target);
        const notificationType = formData.get('notification_type');
        let recipient = '';

        // Handle recipient based on notification type
        if (notificationType === 'personal') {
            recipient = formData.get('recipient');
        } else if (notificationType === 'group') {
            // Use selected users for group notifications
            recipient = this.selectedUsers.join(',');
        } else { // general
            // For general notifications, we'll let the backend handle getting all users
            recipient = ''; // Backend will populate this with all usernames
        }

        const data = {
            'title': formData.get('title'),
            'message': formData.get('message'),
            'notification_type': notificationType,
            'read': document.getElementById('read').checked,
            'sender': formData.get('sender') || 'admin',
            'recipient': recipient  // This will be processed by backend
        };

        this.setSubmitButtonLoading(true);

        try {
            let response;
            if (this.isEditing) {
                response = await fetch(`/selfstudynotification/api/${this.currentNotificationId}/`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this.getCsrfToken()
                    },
                    body: JSON.stringify(data)
                });
            } else {
                response = await fetch('/selfstudynotification/api/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this.getCsrfToken()
                    },
                    body: JSON.stringify(data)
                });
            }

            const result = await response.json();

            if (result.success) {
                this.showSuccess(this.isEditing ? 'Notification updated successfully!' : 'Notification created successfully!');
                this.closeModal();
                this.refreshData();
            } else {
                this.showError('Failed to save notification: ' + result.error);
            }
        } catch (error) {
            console.error('Error saving notification:', error);
            this.showError('Network error saving notification: ' + error.message);
        } finally {
            this.setSubmitButtonLoading(false);
        }
    }

    async confirmDelete() {
        if (!this.currentNotificationId) return;

        this.setDeleteButtonLoading(true);

        try {
            const response = await fetch(`/selfstudynotification/api/${this.currentNotificationId}/`, {
                method: 'DELETE',
                headers: {
                    'X-CSRFToken': this.getCsrfToken()
                }
            });

            const result = await response.json();

            if (result.success) {
                this.showSuccess('Notification deleted successfully!');
                this.closeDeleteModal();
                this.refreshData();
            } else {
                this.showError('Failed to delete notification: ' + result.error);
            }
        } catch (error) {
            console.error('Error deleting notification:', error);
            this.showError('Network error deleting notification: ' + error.message);
        } finally {
            this.setDeleteButtonLoading(false);
        }
    }

    validateForm() {
        let isValid = true;
        this.clearErrors();

        const title = document.getElementById('title').value.trim();
        const message = document.getElementById('message').value.trim();
        const notificationType = document.getElementById('notification_type').value;

        if (!title) {
            this.showFieldError('title', 'Title is required');
            isValid = false;
        }

        if (!message) {
            this.showFieldError('message', 'Message is required');
            isValid = false;
        }

        // Validate recipient based on notification type
        if (notificationType === 'personal') {
            const recipient = document.getElementById('recipient').value;
            if (!recipient) {
                this.showFieldError('recipient', 'Recipient is required for personal notifications');
                isValid = false;
            }
        } else if (notificationType === 'group') {
            if (this.selectedUsers.length === 0) {
                this.showFieldError('multiUserSelect', 'At least one recipient is required for group notifications');
                isValid = false;
            }
        }

        return isValid;
    }

    showFieldError(fieldName, message) {
        const errorElement = document.getElementById(fieldName + 'Error');
        if (errorElement) {
            errorElement.textContent = message;
        }
    }

    clearErrors() {
        document.querySelectorAll('.error-message').forEach(el => {
            el.textContent = '';
        });
    }

    handleSearch(e) {
        const searchTerm = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('#notificationsTableBody tr');

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    }

    refreshData() {
        this.loadNotifications();
    }

    updateStats(notifications = []) {
        const total = notifications.length;
        const general = notifications.filter(n => n.notification_type === 'general').length;
        const personal = notifications.filter(n => n.notification_type === 'personal').length;
        const group = notifications.filter(n => n.notification_type === 'group').length;

        const totalElement = document.getElementById('totalNotifications');
        const generalElement = document.getElementById('generalNotifications');
        const personalElement = document.getElementById('personalNotifications');
        const groupElement = document.getElementById('groupNotifications');

        if (totalElement) totalElement.textContent = total;
        if (generalElement) generalElement.textContent = general;
        if (personalElement) personalElement.textContent = personal;
        if (groupElement) groupElement.textContent = group;
    }

    // Utility Methods
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        }
    }

    closeModal() {
        const modal = document.getElementById('notificationModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }

    closeViewModal() {
        const modal = document.getElementById('viewModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }

    closeDeleteModal() {
        const modal = document.getElementById('deleteModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
            this.currentNotificationId = null;
        }
    }

    showLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.style.display = 'block';
    }

    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.style.display = 'none';
    }

    setSubmitButtonLoading(loading) {
        const btn = document.getElementById('submitBtn');
        if (!btn) return;

        const btnText = btn.querySelector('.btn-text');
        const btnLoader = btn.querySelector('.btn-loader');

        if (loading) {
            btn.disabled = true;
            if (btnText) btnText.style.display = 'none';
            if (btnLoader) btnLoader.style.display = 'block';
        } else {
            btn.disabled = false;
            if (btnText) btnText.style.display = 'block';
            if (btnLoader) btnLoader.style.display = 'none';
        }
    }

    setDeleteButtonLoading(loading) {
        const btn = document.getElementById('confirmDeleteBtn');
        if (!btn) return;

        const btnText = btn.querySelector('.btn-text');
        const btnLoader = btn.querySelector('.btn-loader');

        if (loading) {
            btn.disabled = true;
            if (btnText) btnText.style.display = 'none';
            if (btnLoader) btnLoader.style.display = 'block';
        } else {
            btn.disabled = false;
            if (btnText) btnText.style.display = 'block';
            if (btnLoader) btnLoader.style.display = 'none';
        }
    }

    showError(message) {
        this.showToast('errorToast', 'toastMessage', message);
    }

    showSuccess(message) {
        this.showToast('successToast', 'successToastMessage', message);
    }

    showToast(toastId, messageElementId, message) {
        const toast = document.getElementById(toastId);
        const messageElement = document.getElementById(messageElementId);

        if (toast && messageElement) {
            messageElement.textContent = message;
            toast.classList.add('show');

            setTimeout(() => {
                toast.classList.remove('show');
            }, 5000);
        }
    }

    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return 'Invalid Date';
        }
    }

    escapeHtml(unsafe) {
        if (unsafe === null || unsafe === undefined) return '';
        return unsafe
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    getCsrfToken() {
        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]');
        return csrfToken ? csrfToken.value : '';
    }
}

// Initialize the notification manager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    new NotificationManager();
});

// Export for potential use in other modules
window.NotificationManager = NotificationManager;
