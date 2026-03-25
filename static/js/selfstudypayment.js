// SelfStudy Payment Management JavaScript with Pagination
class PaymentManager {
    constructor() {
        this.payments = [];
        this.users = [];
        this.subscriptions = [];
        this.filteredPayments = [];
        this.currentPayment = null;
        this.csrfToken = this.getCSRFToken();
        
        // Pagination settings
        this.pageSize = 9;
        this.currentPage = 1;
        
        this.init();
    }

    getCSRFToken() {
        const tokenFromMeta = document.querySelector('meta[name="csrf-token"]')?.content;
        const tokenFromInput = document.querySelector('[name=csrfmiddlewaretoken]')?.value;
        const tokenFromCookie = this.getCookie('csrftoken');
        
        console.log('CSRF Token sources:', {
            meta: tokenFromMeta ? 'Found' : 'Not found',
            input: tokenFromInput ? 'Found' : 'Not found',
            cookie: tokenFromCookie ? 'Found' : 'Not found'
        });
        
        return tokenFromMeta || tokenFromInput || tokenFromCookie || '';
    }

    getCookie(name) {
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

    init() {
        console.log('Initializing Payment Manager...');
        this.loadPayments();
        this.loadUsers();
        this.loadSubscriptions();
        this.setupEventListeners();
    }

    async loadPayments() {
        this.showLoading();
        
        try {
            console.log('Loading payments...');
            const response = await this.makeRequest('get_payments');
            
            if (response.success) {
                this.payments = response.data;
                this.filteredPayments = [...this.payments];
                this.currentPage = 1;               // Reset to first page
                this.renderPayments();
                this.updateStats();
                this.hideLoading();
                console.log(`Successfully loaded ${this.payments.length} payments`);
            } else {
                console.error('Failed to load payments:', response.error);
                this.showError('Failed to load payments: ' + response.error);
                this.showEmptyState();
            }
        } catch (error) {
            console.error('Error loading payments:', error);
            this.showError('Failed to load payments. Please check your authentication and try again.');
            this.showEmptyState();
        }
    }

    async loadUsers() {
        try {
            console.log('Loading users...');
            const response = await this.makeRequest('get_users');
            
            if (response.success) {
                this.users = response.data;
                console.log(`Successfully loaded ${this.users.length} users`);
            } else {
                console.warn('Failed to load users:', response.error);
            }
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }

    async loadSubscriptions() {
        try {
            console.log('Loading subscription types...');
            const response = await this.makeRequest('get_subscriptions');
            
            if (response.success) {
                this.subscriptions = response.data;
                console.log(`Successfully loaded ${this.subscriptions.length} subscription types`);
                
                if (this.subscriptions.length > 0) {
                    console.log('First subscription type:', this.subscriptions[0]);
                }
            } else {
                console.warn('Failed to load subscription types:', response.error);
            }
        } catch (error) {
            console.error('Error loading subscription types:', error);
        }
    }

    async makeRequest(action, additionalData = {}) {
        const formData = new FormData();
        formData.append('action', action);
        
        Object.keys(additionalData).forEach(key => {
            if (additionalData[key] !== null && additionalData[key] !== undefined) {
                formData.append(key, additionalData[key]);
            }
        });
        
        console.log(`Making request: ${action}`, additionalData);
        
        try {
            const response = await fetch('', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRFToken': this.csrfToken,
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            
            console.log(`Response status: ${response.status}`);
            
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('text/html')) {
                const text = await response.text();
                console.error('Server returned HTML instead of JSON:', text.substring(0, 500));
                
                if (text.includes('CSRF')) {
                    throw new Error('CSRF verification failed. Please refresh the page.');
                } else if (response.status === 403) {
                    throw new Error('Authentication failed. Please check your permissions.');
                } else if (response.status === 404) {
                    throw new Error('Endpoint not found. Please check the URL.');
                } else {
                    throw new Error('Server returned HTML instead of JSON. Please check the endpoint.');
                }
            }
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`Request ${action} successful:`, data);
            return data;
            
        } catch (error) {
            console.error(`Request error for action ${action}:`, error);
            throw error;
        }
    }

    // ========== PAGINATION METHODS ==========
    renderPagination() {
        const container = document.getElementById('pagination');
        if (!container) return;

        const totalItems = this.filteredPayments.length;
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
        const totalPages = Math.ceil(this.filteredPayments.length / this.pageSize);
        if (page < 1 || page > totalPages) return;
        this.currentPage = page;
        this.renderPayments();
    }

    getPageData() {
        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        return this.filteredPayments.slice(start, end);
    }

    // ========== RENDERING (with pagination) ==========
    renderPayments() {
        const tbody = document.getElementById('payments-tbody');
        if (!tbody) return;

        const pageData = this.getPageData();

        if (pageData.length === 0) {
            this.showEmptyState();
            this.renderPagination();
            return;
        }

        tbody.innerHTML = pageData.map(payment => {
            const subscription = this.subscriptions.find(sub => this.normalizeId(sub.external_id) === this.normalizeId(payment.subscription_id));
            const subscriptionDisplay = subscription ? subscription.title : payment.subscription_id;
            
            return `
                <tr>
                    <td>
                        <div class="external-id">${this.truncateText(payment.external_id, 20)}</div>
                        <small class="text-muted">${this.formatDate(payment.created_at)}</small>
                    </td>
                    <td>${payment.user_id}</td>
                    <td>
                        <div class="subscription-display">
                            <strong>${subscriptionDisplay}</strong>
                            ${subscription ? `<br><small class="text-muted">${subscription.price} JOD</small>` : ''}
                        </div>
                    </td>
                    <td>
                        <strong>${payment.amount} ${payment.currency}</strong>
                    </td>
                    <td>
                        <span class="method-badge">${payment.payment_method}</span>
                    </td>
                    <td>
                        <span class="status-badge status-${payment.status.toLowerCase()}">
                            ${payment.status}
                        </span>
                    </td>
                    <td>${this.formatDate(payment.created_at)}</td>
                    <td>${this.formatDate(payment.expires_at)}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-sm btn-info" onclick="paymentManager.viewPayment('${payment.external_id}')" title="View Details">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-sm btn-warning" onclick="paymentManager.editPayment('${payment.external_id}')" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            ${this.getActionButtons(payment)}
                            <button class="btn btn-sm btn-danger" onclick="paymentManager.deletePayment('${payment.external_id}')" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        this.hideEmptyState();
        this.renderPagination();
    }

    getActionButtons(payment) {
        const buttons = [];
        
        if (payment.status === 'PENDING') {
            buttons.push(`
                <button class="btn btn-sm btn-success" onclick="paymentManager.markAsPaid('${payment.external_id}')" title="Mark as Paid">
                    <i class="fas fa-check"></i>
                </button>
            `);
        }
        
        if (payment.status === 'PAID') {
            buttons.push(`
                <button class="btn btn-sm btn-primary" onclick="paymentManager.verifyPayment('${payment.external_id}')" title="Verify">
                    <i class="fas fa-shield-check"></i>
                </button>
            `);
        }
        
        if (payment.status === 'PENDING' || payment.status === 'PAID') {
            buttons.push(`
                <button class="btn btn-sm btn-secondary" onclick="paymentManager.rejectPayment('${payment.external_id}')" title="Reject">
                    <i class="fas fa-times"></i>
                </button>
            `);
        }
        
        return buttons.join('');
    }

    updateStats() {
        const pending = this.payments.filter(p => p.status === 'PENDING').length;
        const paid = this.payments.filter(p => p.status === 'PAID').length;
        const verified = this.payments.filter(p => p.status === 'VERIFIED').length;
        const total = this.payments.length;
        
        document.getElementById('pending-count').textContent = pending;
        document.getElementById('paid-count').textContent = paid;
        document.getElementById('verified-count').textContent = verified;
        document.getElementById('total-count').textContent = total;
    }

    filterPayments() {
        const statusFilter = document.getElementById('status-filter').value;
        const userFilter = document.getElementById('user-filter').value.toLowerCase();
        const searchFilter = document.getElementById('search').value.toLowerCase();
        
        this.filteredPayments = this.payments.filter(payment => {
            const matchesStatus = !statusFilter || payment.status === statusFilter;
            const matchesUser = !userFilter || payment.user_id.toLowerCase().includes(userFilter);
            const matchesSearch = !searchFilter || 
                payment.external_id.toLowerCase().includes(searchFilter) ||
                payment.user_id.toLowerCase().includes(searchFilter) ||
                payment.subscription_id.toLowerCase().includes(searchFilter) ||
                (payment.reference && payment.reference.toLowerCase().includes(searchFilter));
            
            return matchesStatus && matchesUser && matchesSearch;
        });
        
        this.currentPage = 1;      // Reset to first page after filtering
        this.renderPayments();
    }

    openCreateModal() {
        this.currentPayment = null;
        document.getElementById('modal-title').textContent = 'Create Payment';
        document.getElementById('submit-text').textContent = 'Create Payment';
        document.getElementById('payment-form').reset();
        document.getElementById('payment-external-id').value = '';
        document.getElementById('subscription-details').style.display = 'none';
        this.openModal('payment-modal');
    }

    async editPayment(externalId) {
        try {
            console.log('Editing payment:', externalId);
            const response = await this.makeRequest('get_payment', { external_id: externalId });
            
            if (response.success) {
                this.currentPayment = response.data;
                this.populateEditForm();
                document.getElementById('modal-title').textContent = 'Edit Payment';
                document.getElementById('submit-text').textContent = 'Update Payment';
                this.openModal('payment-modal');
            } else {
                this.showError('Failed to load payment: ' + response.error);
            }
        } catch (error) {
            console.error('Error loading payment:', error);
            this.showError('Failed to load payment: ' + error.message);
        }
    }

    populateEditForm() {
        const payment = this.currentPayment;
        document.getElementById('payment-external-id').value = payment.external_id;
        document.getElementById('user-id').value = payment.user_id;
        document.getElementById('subscription-id').value = payment.subscription_id;
        document.getElementById('amount').value = payment.amount;
        document.getElementById('currency').value = payment.currency;
        document.getElementById('payment-method').value = payment.payment_method;
        document.getElementById('reference').value = payment.reference || '';
        document.getElementById('notes').value = payment.notes || '';
        
        const subscription = this.subscriptions.find(sub => this.normalizeId(sub.external_id) === this.normalizeId(payment.subscription_id));
        const detailsElement = document.getElementById('subscription-details');
        if (subscription) {
            let detailsHtml = `<strong>${subscription.title}</strong> - ${subscription.price} JOD`;
            
            if (subscription.description) {
                detailsHtml += `<br>${subscription.description}`;
            }
            
            if (subscription.duration_days) {
                detailsHtml += `<br><small>Duration: ${subscription.duration_days} days</small>`;
            }
            
            const features = this.extractFeatureNames(subscription.features);
            if (features.length > 0) {
                detailsHtml += `<br><small>Features: ${features.join(', ')}</small>`;
            }
            
            detailsElement.innerHTML = detailsHtml;
            detailsElement.style.display = 'block';
        } else {
            detailsElement.style.display = 'none';
        }
    }

    async submitPaymentForm(event) {
        event.preventDefault();
        
        const submitBtn = document.getElementById('submit-text');
        const spinner = document.getElementById('submit-spinner');
        
        submitBtn.style.display = 'none';
        spinner.style.display = 'inline-block';
        
        try {
            const isEdit = !!this.currentPayment;
            const action = isEdit ? 'update_payment' : 'create_payment';
            
            const formData = {
                'user_id': document.getElementById('user-id').value.trim(),
                'subscription_id': document.getElementById('subscription-id').value.trim(),
                'amount': document.getElementById('amount').value,
                'currency': document.getElementById('currency').value,
                'payment_method': document.getElementById('payment-method').value,
                'reference': document.getElementById('reference').value.trim(),
                'notes': document.getElementById('notes').value.trim()
            };
            
            if (isEdit) {
                formData['external_id'] = document.getElementById('payment-external-id').value;
            }
            
            console.log('Submitting payment form:', { action, formData });
            const response = await this.makeRequest(action, formData);
            
            if (response.success) {
                this.showSuccess(response.message);
                this.closeModal('payment-modal');
                this.loadPayments();
            } else {
                this.showError(response.error);
            }
        } catch (error) {
            console.error('Error saving payment:', error);
            this.showError('Failed to save payment: ' + error.message);
        } finally {
            submitBtn.style.display = 'inline';
            spinner.style.display = 'none';
        }
    }

    async viewPayment(externalId) {
        try {
            console.log('Viewing payment:', externalId);
            const response = await this.makeRequest('get_payment', { external_id: externalId });
            
            if (response.success) {
                this.showPaymentDetails(response.data);
            } else {
                this.showError('Failed to load payment details: ' + response.error);
            }
        } catch (error) {
            console.error('Error loading payment details:', error);
            this.showError('Failed to load payment details: ' + error.message);
        }
    }

    showPaymentDetails(payment) {
        const subscription = this.subscriptions.find(sub => this.normalizeId(sub.external_id) === this.normalizeId(payment.subscription_id));
        const subscriptionDisplay = subscription ? `${subscription.title} (${subscription.price} JOD)` : payment.subscription_id;
        
        const detailsHtml = `
            <div class="payment-details-grid">
                <div class="detail-item">
                    <div class="detail-label">External ID</div>
                    <div class="detail-value external-id">${payment.external_id}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">User ID</div>
                    <div class="detail-value">${payment.user_id}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Subscription Type</div>
                    <div class="detail-value">${subscriptionDisplay}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Amount</div>
                    <div class="detail-value"><strong>${payment.amount} ${payment.currency}</strong></div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Payment Method</div>
                    <div class="detail-value">${payment.payment_method}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Status</div>
                    <div class="detail-value">
                        <span class="status-badge status-${payment.status.toLowerCase()}">
                            ${payment.status}
                        </span>
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Reference</div>
                    <div class="detail-value">${payment.reference || 'N/A'}</div>
                </div>
                <div class="detail-item full-width">
                    <div class="detail-label">Notes</div>
                    <div class="detail-value">${payment.notes || 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Created At</div>
                    <div class="detail-value">${this.formatDate(payment.created_at)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Updated At</div>
                    <div class="detail-value">${this.formatDate(payment.updated_at)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Expires At</div>
                    <div class="detail-value">${this.formatDate(payment.expires_at)}</div>
                </div>
            </div>
        `;
        
        document.getElementById('payment-details').innerHTML = detailsHtml;
        this.openModal('details-modal');
    }

    async markAsPaid(externalId) {
        this.confirmAction(
            'Mark as Paid',
            'Are you sure you want to mark this payment as paid?',
            async () => {
                await this.performPaymentAction(externalId, 'mark_as_paid');
            }
        );
    }

    async verifyPayment(externalId) {
        this.confirmAction(
            'Verify Payment',
            'Are you sure you want to verify this payment? This will create a subscription.',
            async () => {
                await this.performPaymentAction(externalId, 'verify');
            }
        );
    }

    async rejectPayment(externalId) {
        this.confirmAction(
            'Reject Payment',
            'Are you sure you want to reject this payment?',
            async () => {
                await this.performPaymentAction(externalId, 'reject');
            }
        );
    }

    async performPaymentAction(externalId, actionType) {
        try {
            console.log(`Performing ${actionType} on payment:`, externalId);
            const response = await this.makeRequest('payment_action', {
                external_id: externalId,
                action_type: actionType
            });
            
            if (response.success) {
                this.showSuccess(response.message);
                this.loadPayments();
            } else {
                this.showError(response.error);
            }
        } catch (error) {
            console.error('Error performing payment action:', error);
            this.showError('Failed to perform action: ' + error.message);
        }
    }

    deletePayment(externalId) {
        const payment = this.payments.find(p => p.external_id === externalId);
        
        this.confirmAction(
            'Delete Payment',
            `Are you sure you want to delete payment ${externalId} for user ${payment?.user_id || 'unknown'}? This action cannot be undone.`,
            async () => {
                try {
                    const response = await this.makeRequest('delete_payment', { external_id: externalId });
                    
                    if (response.success) {
                        this.showSuccess(response.message);
                        this.loadPayments();
                    } else {
                        this.showError(response.error);
                    }
                } catch (error) {
                    console.error('Error deleting payment:', error);
                    this.showError('Failed to delete payment: ' + error.message);
                }
            }
        );
    }

    confirmAction(title, message, callback) {
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;
        
        const confirmBtn = document.getElementById('confirm-action-btn');
        confirmBtn.onclick = () => {
            callback();
            this.closeModal('confirm-modal');
        };
        
        this.openModal('confirm-modal');
    }

    openUserSelector() {
        this.renderUserList();
        this.openModal('user-modal');
    }

    renderUserList(filter = '') {
        const userList = document.getElementById('user-list');
        let filteredUsers = this.users;
        
        if (filter) {
            filteredUsers = this.users.filter(user => 
                (user.external_id && this.normalizeId(user.external_id).includes(filter.toLowerCase())) ||
                (user.username && user.username.toLowerCase().includes(filter.toLowerCase())) ||
                (user.user_id && this.normalizeId(user.user_id).includes(filter.toLowerCase())) ||
                (user.email && user.email.toLowerCase().includes(filter.toLowerCase())) ||
                (user.full_name && user.full_name.toLowerCase().includes(filter.toLowerCase()))
            );
        }
        
        userList.innerHTML = filteredUsers.map(user => {
            const userId = user.external_id || user.user_id || user.id || 'N/A';
            const userName = user.username || user.email || 'Unknown User';
            const displayName = user.full_name || user.first_name || user.username || userId;
            
            return `
                <div class="user-item" onclick="paymentManager.selectUser('${userId}')">
                    <div class="user-name">${displayName}</div>
                    <div class="user-id">${userId}</div>
                    ${user.email ? `<div class="user-email">${user.email}</div>` : ''}
                </div>
            `;
        }).join('');
        
        if (filteredUsers.length === 0) {
            userList.innerHTML = '<div class="empty-state"><p>No users found</p></div>';
        }
    }

    selectUser(userId) {
        document.getElementById('user-id').value = userId;
        this.closeModal('user-modal');
    }

    searchUsers() {
        const searchTerm = document.getElementById('user-search').value;
        this.renderUserList(searchTerm);
    }

    openSubscriptionSelector() {
        this.renderSubscriptionList();
        this.openModal('subscription-modal');
    }

    renderSubscriptionList(filter = '') {
        const subscriptionList = document.getElementById('subscription-list');
        let filteredSubscriptions = this.subscriptions;
        
        if (filter) {
            filteredSubscriptions = this.subscriptions.filter(subscription => {
                const title = subscription.title || '';
                const externalId = this.normalizeId(subscription.external_id);
                const description = subscription.description || '';
                
                return title.toLowerCase().includes(filter.toLowerCase()) ||
                       externalId.includes(filter.toLowerCase()) ||
                       description.toLowerCase().includes(filter.toLowerCase());
            });
        }
        
        subscriptionList.innerHTML = filteredSubscriptions.map(subscription => {
            const price = subscription.price ? `${subscription.price} JOD` : 'Price not set';
            const duration = subscription.duration_days ? `${subscription.duration_days} days` : 'Duration not set';
            const features = this.extractFeatureNames(subscription.features);
            
            return `
                <div class="subscription-item" onclick="paymentManager.selectSubscription('${subscription.external_id}')">
                    <div class="subscription-header">
                        <div class="subscription-title">${subscription.title}</div>
                        <div class="subscription-price">${price}</div>
                    </div>
                    <div class="subscription-id">ID: ${subscription.external_id}</div>
                    <div class="subscription-duration">${duration}</div>
                    ${subscription.description ? `<div class="subscription-description">${subscription.description}</div>` : ''}
                    ${features.length > 0 ? `
                        <div class="subscription-features">
                            <strong>Features:</strong> ${features.join(', ')}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
        
        if (filteredSubscriptions.length === 0) {
            subscriptionList.innerHTML = '<div class="empty-state"><p>No subscription types found</p></div>';
        }
    }

    selectSubscription(subscriptionId) {
        console.log('Selecting subscription:', subscriptionId);
        const subscription = this.subscriptions.find(sub => this.normalizeId(sub.external_id) === this.normalizeId(subscriptionId));
        
        if (subscription) {
            document.getElementById('subscription-id').value = subscription.external_id;
            
            const detailsElement = document.getElementById('subscription-details');
            let detailsHtml = `<strong>${subscription.title}</strong> - ${subscription.price} JOD`;
            
            if (subscription.description) {
                detailsHtml += `<br>${subscription.description}`;
            }
            
            if (subscription.duration_days) {
                detailsHtml += `<br><small>Duration: ${subscription.duration_days} days</small>`;
            }
            
            const features = this.extractFeatureNames(subscription.features);
            if (features.length > 0) {
                detailsHtml += `<br><small>Features: ${features.join(', ')}</small>`;
            }
            
            detailsElement.innerHTML = detailsHtml;
            detailsElement.style.display = 'block';
            
            if (subscription.price) {
                document.getElementById('amount').value = subscription.price;
                this.showSuccess(`Amount auto-filled with subscription price: ${subscription.price} JOD`);
            }
            
            this.closeModal('subscription-modal');
        } else {
            console.error('Subscription not found:', subscriptionId);
            this.showError('Selected subscription type not found. Please try again.');
        }
    }

    searchSubscriptions() {
        const searchTerm = document.getElementById('subscription-search').value;
        this.renderSubscriptionList(searchTerm);
    }

    resetAmount() {
        document.getElementById('amount').value = '';
        document.getElementById('amount').focus();
        this.showInfo('Amount field reset. You can now enter a custom amount.');
    }

    // Utility Methods
    normalizeId(id) {
        if (id === null || id === undefined) return '';
        return String(id).toLowerCase();
    }

    extractFeatureNames(features) {
        if (!features || !Array.isArray(features)) return [];
        
        return features.map(feature => {
            if (typeof feature === 'string') {
                return feature;
            } else if (feature && typeof feature === 'object') {
                return feature.name || feature.title || feature.feature || JSON.stringify(feature);
            }
            return String(feature);
        });
    }

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        } catch (e) {
            return 'Invalid Date';
        }
    }

    truncateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    openModal(modalId) {
        document.getElementById(modalId).style.display = 'block';
    }

    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    showLoading() {
        document.getElementById('loading-state').style.display = 'block';
        document.getElementById('payments-table').style.display = 'none';
        document.getElementById('empty-state').style.display = 'none';
    }

    hideLoading() {
        document.getElementById('loading-state').style.display = 'none';
        document.getElementById('payments-table').style.display = 'table';
    }

    showEmptyState() {
        document.getElementById('empty-state').style.display = 'block';
        document.getElementById('payments-table').style.display = 'none';
        document.getElementById('loading-state').style.display = 'none';
    }

    hideEmptyState() {
        document.getElementById('empty-state').style.display = 'none';
        document.getElementById('payments-table').style.display = 'table';
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showInfo(message) {
        this.showToast(message, 'info');
    }

    showToast(message, type) {
        const existingToasts = document.querySelectorAll('.toast');
        existingToasts.forEach(toast => toast.remove());
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
    }

    setupEventListeners() {
        window.onclick = (event) => {
            const modals = document.querySelectorAll('.modal');
            modals.forEach(modal => {
                if (event.target === modal) {
                    modal.style.display = 'none';
                }
            });
        };
        
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                const modals = document.querySelectorAll('.modal');
                modals.forEach(modal => {
                    modal.style.display = 'none';
                });
            }
        });
        
        console.log('Event listeners setup completed');
    }
}

// Global functions for HTML onclick handlers
function openCreateModal() {
    paymentManager.openCreateModal();
}

function closeModal(modalId) {
    paymentManager.closeModal(modalId);
}

function closeUserModal() {
    paymentManager.closeModal('user-modal');
}

function closeSubscriptionModal() {
    paymentManager.closeModal('subscription-modal');
}

function closeConfirmModal() {
    paymentManager.closeModal('confirm-modal');
}

function closeDetailsModal() {
    paymentManager.closeModal('details-modal');
}

function openUserSelector() {
    paymentManager.openUserSelector();
}

function openSubscriptionSelector() {
    paymentManager.openSubscriptionSelector();
}

function searchUsers() {
    paymentManager.searchUsers();
}

function searchSubscriptions() {
    paymentManager.searchSubscriptions();
}

function filterPayments() {
    paymentManager.filterPayments();
}

function refreshPayments() {
    paymentManager.loadPayments();
}

function submitPaymentForm(event) {
    paymentManager.submitPaymentForm(event);
}

function resetAmount() {
    paymentManager.resetAmount();
}

function toggleAccountFields() {
    // Implementation for showing/hiding account fields based on payment method
    const method = document.getElementById('payment-method').value;
    // Add logic to show/hide IBAN or Cliq specific fields if needed
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing Payment Manager...');
    window.paymentManager = new PaymentManager();
});