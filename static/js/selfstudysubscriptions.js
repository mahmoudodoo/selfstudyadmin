/**
 * SelfStudy Subscriptions Management JavaScript
 * Handles dynamic domain discovery, CRUD operations, and UI interactions
 * Updated for external_id support
 */

// Global variables
let currentResourceType = '';
let currentResourceId = '';
let selectedUserId = '';
let selectedUserEmail = '';
let currentDomains = [];
let currentServiceDomain = '';
let currentTable = null;

// CSRF Token setup for AJAX requests
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

// DataTable configurations updated for external_id
const tableConfigs = {
    features: {
        columns: [
            { data: 'external_id' },
            { data: 'name' },
            { data: 'description' },
            {
                data: null,
                render: function(data, type, row) {
                    return `
                    <div class="action-buttons">
                    <button class="btn btn-sm btn-primary" onclick="editFeature('${row.external_id}')">
                    <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteResource('feature', '${row.external_id}')">
                    <i class="fas fa-trash"></i> Delete
                    </button>
                    </div>
                    `;
                }
            }
        ],
        order: [[1, 'asc']] // Order by name
    },
    subscription_types: {
        columns: [
            { data: 'external_id' },
            { data: 'title' },
            { data: 'description' },
            {
                data: 'price',
                render: function(data) {
                    return `$${parseFloat(data).toFixed(2)}`;
                }
            },
            {
                data: 'features',
                render: function(data) {
                    if (!data || data.length === 0) return 'No features';
                    return data.map(f => f.name).join(', ');
                }
            },
            {
                data: null,
                render: function(data, type, row) {
                    return `
                    <div class="action-buttons">
                    <button class="btn btn-sm btn-primary" onclick="editSubscriptionType('${row.external_id}')">
                    <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteResource('subscription_type', '${row.external_id}')">
                    <i class="fas fa-trash"></i> Delete
                    </button>
                    </div>
                    `;
                }
            }
        ],
        order: [[1, 'asc']] // Order by title
    },
    subscriptions: {
        columns: [
            { data: 'external_id' },
            { data: 'title' },
            { data: 'user_id' },
            {
                data: 'subscription_type',
                render: function(data) {
                    return data ? data.title : 'No type';
                }
            },
            {
                data: 'is_active',
                render: function(data) {
                    return data ?
                    '<span class="status-badge status-active">Active</span>' :
                    '<span class="status-badge status-inactive">Inactive</span>';
                }
            },
            {
                data: 'created_date',
                render: function(data) {
                    return data ? new Date(data).toLocaleDateString() : '';
                }
            },
            {
                data: 'expire_date',
                render: function(data) {
                    return data ? new Date(data).toLocaleDateString() : '';
                }
            },
            {
                data: null,
                render: function(data, type, row) {
                    return `
                    <div class="action-buttons">
                    <button class="btn btn-sm btn-primary" onclick="editSubscription('${row.external_id}')">
                    <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteResource('subscription', '${row.external_id}')">
                    <i class="fas fa-trash"></i> Delete
                    </button>
                    </div>
                    `;
                }
            }
        ],
        order: [[6, 'desc']] // Order by expire_date
    }
};

// Initialize when document is ready
$(document).ready(function() {
    initializePage();
    setupEventListeners();
});

function initializePage() {
    loadInitialData();
    loadStats();
    setupDataTables();
}

function setupEventListeners() {
    // Tab switching
    $('.tab-btn').on('click', function() {
        const tabId = $(this).data('tab');
        switchTab(tabId);
        $(this).addClass('active').siblings().removeClass('active');
    });

    // User search
    $('#user-search').on('keypress', function(e) {
        if (e.which === 13) {
            searchByUser();
        }
    });
}

function loadInitialData() {
    showLoading();

    // Load domains first
    loadDomains().then(() => {
        // Load data for all tabs
        Promise.all([
            loadFeatures(),
                    loadSubscriptionTypes(),
                    loadSubscriptions()
        ]).finally(() => {
            hideLoading();
        });
    }).catch(error => {
        console.error('Error loading initial data:', error);
        hideLoading();
        showNotification('Failed to load initial data', 'error');
    });
}

function loadStats() {
    // Load stats asynchronously
    setTimeout(() => {
        // These would be updated from actual API responses
        updateStats();
    }, 500);
}

function updateStats() {
    // This function would be called after data is loaded to update stats
    const featuresCount = $('#features-table').DataTable().data().count();
    const subscriptionsCount = $('#subscriptions-table').DataTable().data().count();
    const typesCount = $('#subscription-types-table').DataTable().data().count();

    $('#total-features').text(featuresCount);
    $('#active-subscriptions').text(subscriptionsCount);
    $('#subscription-types').text(typesCount);
    $('#available-domains').text(currentDomains.length);
}

async function loadDomains() {
    try {
        const response = await $.ajax({
            url: '/selfstudysubscriptions/api/',
            type: 'GET',
            data: {
                action: 'domains',
                app_id: 22
            }
        });

        currentDomains = response.domains || [];
        updateDomainsDisplay();

        if (currentDomains.length > 0) {
            currentServiceDomain = currentDomains[0];
            updateServiceStatus(true);
        } else {
            updateServiceStatus(false);
        }

        return currentDomains;
    } catch (error) {
        console.error('Error loading domains:', error);
        currentDomains = [];
        updateServiceStatus(false);
        showNotification('Failed to load service domains', 'error');
        return [];
    }
}

function updateDomainsDisplay() {
    const domainsGrid = $('#domains-grid');
    domainsGrid.empty();

    if (currentDomains.length === 0) {
        domainsGrid.html(`
        <div class="no-data">
        <i class="fas fa-exclamation-triangle fa-3x"></i>
        <h3>No service domains available</h3>
        <p>Please check your connection and try again.</p>
        </div>
        `);
        return;
    }

    currentDomains.forEach((domain, index) => {
        const isCurrent = domain === currentServiceDomain;
        domainsGrid.append(`
        <div class="domain-card ${isCurrent ? 'active' : ''}">
        <div class="domain-header">
        <h4>Instance ${index + 1}</h4>
        <span class="domain-status-badge status-active">Active</span>
        </div>
        <div class="domain-url">${domain}</div>
        <div class="domain-health">
        <i class="fas fa-check-circle"></i> Service is responsive
        </div>
        ${isCurrent ? '<div class="current-indicator">Currently in use</div>' : ''}
        </div>
        `);
    });
}

function updateServiceStatus(isActive) {
    const statusIndicator = $('#service-status');
    const currentDomainSpan = $('#current-domain');

    if (isActive) {
        statusIndicator.removeClass('inactive').addClass('active');
        currentDomainSpan.text(currentServiceDomain);
    } else {
        statusIndicator.removeClass('active').addClass('inactive');
        currentDomainSpan.text('Service unavailable');
    }
}

function setupDataTables() {
    // Initialize all tables
    for (const [key, config] of Object.entries(tableConfigs)) {
        $(`#${key.replace('_', '-')}-table`).DataTable({
            responsive: true,
            paging: true,
            pageLength: 10,
            searching: true,
            ordering: true,
            info: true,
            autoWidth: false,
            columns: config.columns,
            order: config.order,
            language: {
                emptyTable: "No data available in table",
                info: "Showing _START_ to _END_ of _TOTAL_ entries",
                infoEmpty: "Showing 0 to 0 of 0 entries",
                infoFiltered: "(filtered from _MAX_ total entries)",
                                                       lengthMenu: "Show _MENU_ entries",
                                                       loadingRecords: "Loading...",
                                                       processing: "Processing...",
                                                       search: "Search:",
                                                       zeroRecords: "No matching records found"
            }
        });
    }
}

async function loadFeatures() {
    try {
        const response = await $.ajax({
            url: '/selfstudysubscriptions/api/',
            type: 'GET',
            data: { action: 'features' }
        });

        const table = $('#features-table').DataTable();
        table.clear();
        table.rows.add(response).draw();

        $('#total-features').text(response.length);

    } catch (error) {
        console.error('Error loading features:', error);
        showNotification('Failed to load features', 'error');
    }
}

async function loadSubscriptionTypes() {
    try {
        const response = await $.ajax({
            url: '/selfstudysubscriptions/api/',
            type: 'GET',
            data: { action: 'subscription-types' }
        });

        const table = $('#subscription-types-table').DataTable();
        table.clear();
        table.rows.add(response).draw();

        $('#subscription-types').text(response.length);

    } catch (error) {
        console.error('Error loading subscription types:', error);
        showNotification('Failed to load subscription types', 'error');
    }
}

async function loadSubscriptions() {
    try {
        const response = await $.ajax({
            url: '/selfstudysubscriptions/api/',
            type: 'GET',
            data: { action: 'subscriptions' }
        });

        const table = $('#subscriptions-table').DataTable();
        table.clear();
        table.rows.add(response).draw();

        const activeCount = response.filter(sub => sub.is_active).length;
        $('#active-subscriptions').text(activeCount);

    } catch (error) {
        console.error('Error loading subscriptions:', error);
        showNotification('Failed to load subscriptions', 'error');
    }
}

function searchByUser() {
    const userId = $('#user-search').val().trim();
    if (!userId) {
        showNotification('Please enter a user ID', 'warning');
        return;
    }

    showLoading();

    $.ajax({
        url: '/selfstudysubscriptions/api/',
        type: 'GET',
        data: {
            action: 'subscriptions',
            user_id: userId
        }
    }).done(function(response) {
        const table = $('#subscriptions-table').DataTable();
        table.clear();
        table.rows.add(response).draw();

        showNotification(`Found ${response.length} subscriptions for user ${userId}`, 'success');

    }).fail(function(error) {
        console.error('Error searching subscriptions:', error);
        showNotification('Failed to search subscriptions', 'error');

    }).always(function() {
        hideLoading();
    });
}

function clearSearch() {
    $('#user-search').val('');
    loadSubscriptions();
}

function switchTab(tabId) {
    // Hide all tab contents
    $('.tab-content').removeClass('active').hide();

    // Show selected tab content
    $(`#${tabId.replace('_', '-')}-tab`).addClass('active').show();

    // Redraw DataTable if needed
    const tableId = `${tabId.replace('_', '-')}-table`;
    if ($.fn.DataTable.isDataTable(`#${tableId}`)) {
        $(`#${tableId}`).DataTable().columns.adjust().responsive.recalc();
    }
}

// Modal Functions
function showCreateModal(resourceType) {
    currentResourceType = resourceType;
    currentResourceId = '';

    const modalTitle = getModalTitle(resourceType);
    const formFields = getFormFields(resourceType);

    $('#modal-title').text(modalTitle);
    $('#create-form').html(formFields);
    $('#submit-btn').text(currentResourceId ? 'Update' : 'Create');

    // Load dynamic data for form
    loadFormDependencies(resourceType);

    $('#createModal').fadeIn();
}

function closeModal() {
    $('#createModal').fadeOut();
    resetForm();
}

function getModalTitle(resourceType) {
    const titles = {
        'feature': 'Create New Feature',
        'subscription_type': 'Create New Subscription Plan',
        'subscription': 'Create New Subscription'
    };
    return titles[resourceType] || 'Create';
}

function getFormFields(resourceType) {
    switch(resourceType) {
        case 'feature':
            return `
            <div class="form-group">
            <label for="external_id">External ID (Optional)</label>
            <input type="text" id="external_id" class="form-control">
            <small class="form-text text-muted">Leave blank to auto-generate UUID</small>
            </div>
            <div class="form-group">
            <label for="name">Feature Name *</label>
            <input type="text" id="name" class="form-control" required>
            </div>
            <div class="form-group">
            <label for="description">Description</label>
            <textarea id="description" class="form-control" rows="3"></textarea>
            </div>
            `;

        case 'subscription_type':
            return `
            <div class="form-group">
            <label for="external_id">External ID (Optional)</label>
            <input type="text" id="external_id" class="form-control">
            <small class="form-text text-muted">Leave blank to auto-generate UUID</small>
            </div>
            <div class="form-group">
            <label for="title">Plan Title *</label>
            <input type="text" id="title" class="form-control" required>
            </div>
            <div class="form-group">
            <label for="description">Description *</label>
            <textarea id="description" class="form-control" rows="3" required></textarea>
            </div>
            <div class="form-group">
            <label for="price">Price ($) *</label>
            <input type="number" id="price" class="form-control" step="0.01" min="0" required>
            </div>
            <div class="form-group">
            <label for="features">Features</label>
            <select id="features" class="form-control" multiple style="height: 150px;">
            <!-- Features will be loaded dynamically -->
            </select>
            <small class="form-text text-muted">Hold Ctrl/Cmd to select multiple features</small>
            </div>
            `;

        case 'subscription':
            return `
            <div class="form-group">
            <label for="external_id">External ID *</label>
            <input type="text" id="external_id" class="form-control" required>
            <small class="form-text text-muted">Unique identifier for the subscription</small>
            </div>
            <div class="form-group">
            <label for="title">Title *</label>
            <input type="text" id="title" class="form-control" required>
            </div>
            <div class="form-group">
            <label for="user_id">User *</label>
            <div class="user-select-container">
            <input type="text" id="user_id" class="form-control" value="${selectedUserId}" readonly>
            <button type="button" class="btn btn-sm btn-primary" onclick="showUserModal()">
            <i class="fas fa-user"></i> Select User
            </button>
            </div>
            <small id="user-email" class="form-text text-muted">${selectedUserEmail || 'No user selected'}</small>
            </div>
            <div class="form-group">
            <label for="subscription_type">Subscription Plan *</label>
            <select id="subscription_type" class="form-control" required>
            <option value="">Select a plan</option>
            <!-- Plans will be loaded dynamically -->
            </select>
            </div>
            <div class="form-group">
            <label for="is_active">Status</label>
            <select id="is_active" class="form-control">
            <option value="true">Active</option>
            <option value="false">Inactive</option>
            </select>
            </div>
            <div class="form-group">
            <label for="expire_date">Expiration Date *</label>
            <input type="date" id="expire_date" class="form-control" required>
            </div>
            `;

        default:
            return '<p>Form not available for this resource type.</p>';
    }
}

function loadFormDependencies(resourceType) {
    if (resourceType === 'subscription_type') {
        loadFeaturesForSelect();
    } else if (resourceType === 'subscription') {
        loadSubscriptionTypesForSelect();
    }
}

function populateEditForm(data, resourceType) {
    switch(resourceType) {
        case 'feature':
            $('#external_id').val(data.external_id);
            $('#name').val(data.name);
            $('#description').val(data.description);
            break;

        case 'subscription_type':
            $('#external_id').val(data.external_id);
            $('#title').val(data.title);
            $('#description').val(data.description);
            $('#price').val(data.price);
            // Load features into select
            loadFeaturesForSelect(data.features);
            break;

        case 'subscription':
            $('#external_id').val(data.external_id);
            $('#title').val(data.title);
            selectedUserId = data.user_id;
            $('#user_id').val(data.user_id);
            $('#is_active').val(data.is_active.toString());
            if (data.expire_date) {
                $('#expire_date').val(data.expire_date.split('T')[0]);
            }
            // Load subscription types
            loadSubscriptionTypesForSelect(data.subscription_type?.external_id);
            break;
    }
}

async function loadFeaturesForSelect(selectedFeatures = []) {
    try {
        const response = await $.ajax({
            url: '/selfstudysubscriptions/api/',
            type: 'GET',
            data: { action: 'features' }
        });

        const select = $('#features');
        select.empty();

        response.forEach(feature => {
            const isSelected = selectedFeatures.some(f => f.external_id === feature.external_id);
            select.append(`
            <option value="${feature.external_id}" ${isSelected ? 'selected' : ''}>
            ${feature.name}
            </option>
            `);
        });

    } catch (error) {
        console.error('Error loading features for select:', error);
    }
}

async function loadSubscriptionTypesForSelect(selectedType = null) {
    try {
        const response = await $.ajax({
            url: '/selfstudysubscriptions/api/',
            type: 'GET',
            data: { action: 'subscription-types' }
        });

        const select = $('#subscription_type');
        select.empty().append('<option value="">Select a plan</option>');

        response.forEach(type => {
            select.append(`
            <option value="${type.external_id}" ${selectedType === type.external_id ? 'selected' : ''}>
            ${type.title} ($${type.price})
            </option>
            `);
        });

    } catch (error) {
        console.error('Error loading subscription types for select:', error);
    }
}

function editFeature(externalId) {
    showLoading();

    $.ajax({
        url: '/selfstudysubscriptions/api/',
        type: 'GET',
        data: { action: 'features' }
    }).done(function(response) {
        const feature = response.find(f => f.external_id === externalId);
        if (feature) {
            currentResourceType = 'feature';
            currentResourceId = externalId;

            $('#modal-title').text('Edit Feature');
            $('#create-form').html(getFormFields('feature'));
            populateEditForm(feature, 'feature');
            $('#submit-btn').text('Update');

            $('#createModal').fadeIn();
        }
    }).fail(function(error) {
        console.error('Error loading feature:', error);
        showNotification('Failed to load feature data', 'error');
    }).always(function() {
        hideLoading();
    });
}

function editSubscriptionType(externalId) {
    showLoading();

    $.ajax({
        url: '/selfstudysubscriptions/api/',
        type: 'GET',
        data: { action: 'subscription-types' }
    }).done(function(response) {
        const type = response.find(t => t.external_id === externalId);
        if (type) {
            currentResourceType = 'subscription_type';
            currentResourceId = externalId;

            $('#modal-title').text('Edit Subscription Plan');
            $('#create-form').html(getFormFields('subscription_type'));
            $('#submit-btn').text('Update');

            // Populate form and load features
            populateEditForm(type, 'subscription_type');

            $('#createModal').fadeIn();
        }
    }).fail(function(error) {
        console.error('Error loading subscription type:', error);
        showNotification('Failed to load subscription type data', 'error');
    }).always(function() {
        hideLoading();
    });
}

function editSubscription(externalId) {
    showLoading();

    $.ajax({
        url: '/selfstudysubscriptions/api/',
        type: 'GET',
        data: {
            action: 'subscriptions',
            user_id: '' // Get all subscriptions
        }
    }).done(function(response) {
        const subscription = response.find(s => s.external_id === externalId);
        if (subscription) {
            currentResourceType = 'subscription';
            currentResourceId = externalId;

            $('#modal-title').text('Edit Subscription');
            $('#create-form').html(getFormFields('subscription'));
            $('#submit-btn').text('Update');

            // Populate form and load subscription types
            populateEditForm(subscription, 'subscription');

            $('#createModal').fadeIn();
        }
    }).fail(function(error) {
        console.error('Error loading subscription:', error);
        showNotification('Failed to load subscription data', 'error');
    }).always(function() {
        hideLoading();
    });
}

function submitForm() {
    const formData = getFormData();

    if (!validateForm(formData)) {
        return;
    }

    showLoading();

    const apiData = {
        ...formData,
        resource_type: currentResourceType
    };

    if (currentResourceId) {
        apiData.id = currentResourceId;
    }

    const method = currentResourceId ? 'PUT' : 'POST';

    $.ajax({
        url: '/selfstudysubscriptions/api/',
        type: method,
        contentType: 'application/json',
        data: JSON.stringify(apiData),
           beforeSend: function(xhr, settings) {
               if (!/^(GET|HEAD|OPTIONS|TRACE)$/i.test(settings.type) && !this.crossDomain) {
                   xhr.setRequestHeader("X-CSRFToken", csrftoken);
               }
           }
    }).done(function(response) {
        showNotification(
            currentResourceId ? 'Updated successfully!' : 'Created successfully!',
            'success'
        );

        closeModal();
        reloadCurrentTab();

    }).fail(function(error) {
        console.error('Error submitting form:', error);
        const errorMsg = error.responseJSON?.error || error.responseJSON?.detail || 'Failed to save data';
        showNotification(errorMsg, 'error');

    }).always(function() {
        hideLoading();
    });
}

function getFormData() {
    const formData = {};

    switch(currentResourceType) {
        case 'feature':
            formData.external_id = $('#external_id').val() || undefined;
            formData.name = $('#name').val();
            formData.description = $('#description').val();
            break;

        case 'subscription_type':
            formData.external_id = $('#external_id').val() || undefined;
            formData.title = $('#title').val();
            formData.description = $('#description').val();
            formData.price = $('#price').val();
            formData.features = $('#features').val() || [];
            break;

        case 'subscription':
            formData.external_id = $('#external_id').val();
            formData.title = $('#title').val();
            formData.user_id = $('#user_id').val();
            formData.subscription_type = $('#subscription_type').val();
            formData.is_active = $('#is_active').val() === 'true';
            formData.expire_date = $('#expire_date').val();
            break;
    }

    return formData;
}

function validateForm(data) {
    switch(currentResourceType) {
        case 'feature':
            if (!data.name?.trim()) {
                showNotification('Feature name is required', 'warning');
                return false;
            }
            break;

        case 'subscription_type':
            if (!data.title?.trim()) {
                showNotification('Plan title is required', 'warning');
                return false;
            }
            if (!data.description?.trim()) {
                showNotification('Description is required', 'warning');
                return false;
            }
            if (!data.price || parseFloat(data.price) < 0) {
                showNotification('Valid price is required', 'warning');
                return false;
            }
            break;

        case 'subscription':
            if (!data.external_id?.trim()) {
                showNotification('External ID is required', 'warning');
                return false;
            }
            if (!data.title?.trim()) {
                showNotification('Title is required', 'warning');
                return false;
            }
            if (!data.user_id?.trim()) {
                showNotification('User is required', 'warning');
                return false;
            }
            if (!data.subscription_type) {
                showNotification('Subscription plan is required', 'warning');
                return false;
            }
            if (!data.expire_date) {
                showNotification('Expiration date is required', 'warning');
                return false;
            }
            break;
    }

    return true;
}

function resetForm() {
    currentResourceType = '';
    currentResourceId = '';
    $('#create-form').empty();
}

function reloadCurrentTab() {
    const activeTab = $('.tab-btn.active').data('tab');

    switch(activeTab) {
        case 'features':
            loadFeatures();
            break;
        case 'subscription_types':
            loadSubscriptionTypes();
            break;
        case 'subscriptions':
            loadSubscriptions();
            break;
        case 'domains':
            loadDomains();
            break;
    }
}

// User Selection Modal
function showUserModal() {
    loadUsers();
    $('#userModal').fadeIn();
}

function closeUserModal() {
    $('#userModal').fadeOut();
}

async function loadUsers() {
    try {
        const response = await $.ajax({
            url: '/selfstudysubscriptions/api/',
            type: 'GET',
            data: { action: 'users' }
        });

        const userList = $('#user-list');
        userList.empty();

        if (response.length === 0) {
            userList.html('<p class="no-data">No users found</p>');
            return;
        }

        response.forEach(user => {
            // Escape quotes in email for JS
            const safeEmail = (user.email || '').replace(/"/g, '&quot;');
            userList.append(`
            <div class="user-item" data-user-id="${user.user_id}" data-email="${safeEmail}">
            <div class="user-info">
            <div class="user-details">
            <div class="user-id">${user.user_id}</div>
            <div class="user-email">${user.email || 'No email'}</div>
            </div>
            <button class="btn btn-sm btn-primary user-select-btn" onclick="selectUser('${user.user_id}', '${safeEmail}')">
            Select
            </button>
            </div>
            </div>
            `);
        });

    } catch (error) {
        console.error('Error loading users:', error);
        $('#user-list').html('<p class="error">Failed to load users</p>');
    }
}

function searchUsers() {
    const searchTerm = $('#user-search-modal').val().toLowerCase();
    $('.user-item').each(function() {
        const userId = $(this).data('user-id').toLowerCase();
        const email = $(this).data('email').toLowerCase();

        if (userId.includes(searchTerm) || email.includes(searchTerm)) {
            $(this).show();
        } else {
            $(this).hide();
        }
    });
}

function selectUser(userId, email) {
    selectedUserId = userId;
    selectedUserEmail = email;

    $('#user_id').val(userId);
    $('#user-email').text(email || 'No email available');

    closeUserModal();
}

// Delete Confirmation
function deleteResource(resourceType, resourceId) {
    currentResourceType = resourceType;
    currentResourceId = resourceId;

    const resourceName = getResourceName(resourceType);
    $('#confirm-title').text(`Delete ${resourceName}`);
    $('#confirm-message').text(`Are you sure you want to delete this ${resourceName.toLowerCase()}? This action cannot be undone.`);
    $('#confirm-action-btn').text('Delete');
    $('#confirm-action-btn').off('click').on('click', performDelete);

    $('#confirmModal').fadeIn();
}

function getResourceName(resourceType) {
    const names = {
        'feature': 'Feature',
        'subscription_type': 'Subscription Plan',
        'subscription': 'Subscription'
    };
    return names[resourceType] || 'Resource';
}

function closeConfirmModal() {
    $('#confirmModal').fadeOut();
    currentResourceType = '';
    currentResourceId = '';
}

function performDelete() {
    showLoading();

    $.ajax({
        url: '/selfstudysubscriptions/api/',
        type: 'DELETE',
        data: {
            resource_type: currentResourceType,
           id: currentResourceId
        },
        beforeSend: function(xhr, settings) {
            if (!/^(GET|HEAD|OPTIONS|TRACE)$/i.test(settings.type) && !this.crossDomain) {
                xhr.setRequestHeader("X-CSRFToken", csrftoken);
            }
        }
    }).done(function(response) {
        showNotification('Deleted successfully!', 'success');
        closeConfirmModal();
        reloadCurrentTab();

    }).fail(function(error) {
        console.error('Error deleting resource:', error);
        const errorMsg = error.responseJSON?.error || error.responseJSON?.detail || 'Failed to delete resource';
        showNotification(errorMsg, 'error');

    }).always(function() {
        hideLoading();
    });
}

// Utility Functions
function showLoading() {
    $('#loadingOverlay').fadeIn();
}

function hideLoading() {
    $('#loadingOverlay').fadeOut();
}

function showNotification(message, type = 'info') {
    // Remove existing notifications
    $('.notification').remove();

    const notification = $(`
    <div class="notification notification-${type}">
    <span>${message}</span>
    <button class="notification-close">&times;</button>
    </div>
    `);

    $('body').append(notification);

    // Animate in
    notification.css({opacity: 0, bottom: '-50px'}).animate({
        opacity: 1,
        bottom: '20px'
    }, 300);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        notification.animate({
            opacity: 0,
            bottom: '-50px'
        }, 300, function() {
            $(this).remove();
        });
    }, 5000);

    // Close button
    notification.find('.notification-close').on('click', function() {
        notification.animate({
            opacity: 0,
            bottom: '-50px'
        }, 300, function() {
            $(this).remove();
        });
    });
}

// Add notification styles dynamically
$(document).ready(function() {
    $('head').append(`
    <style>
    .notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        min-width: 300px;
        max-width: 400px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .notification-success {
        background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
    }

    .notification-error {
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }

    .notification-warning {
        background: linear-gradient(135deg, #f6d365 0%, #fda085 100%);
    }

    .notification-info {
        background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    }

    .notification-close {
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        margin-left: 15px;
        opacity: 0.8;
        transition: opacity 0.3s;
    }

    .notification-close:hover {
        opacity: 1;
    }
    </style>
    `);
});
