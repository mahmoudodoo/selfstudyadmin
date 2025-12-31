// SelfStudy Proctor Management JavaScript

// Global variables
let currentProctors = [];
let currentPage = 1;
let totalPages = 1;
let proctorsPerPage = 10;
let currentProctorId = null;
let currentProctorName = '';
let userProfilesCache = [];
let userProfilesLoaded = false;

// API URLs
const API_BASE = '/selfstudyproctor/api/';

// DOM Elements
const elements = {
    proctorModal: document.getElementById('proctor-modal'),
    availabilityModal: document.getElementById('availability-modal'),
    findAvailableModal: document.getElementById('find-available-modal'),
    deleteModal: document.getElementById('delete-modal'),
    loadingOverlay: document.getElementById('loading-overlay'),
    proctorsTableBody: document.getElementById('proctors-table-body'),
    pagination: document.getElementById('pagination'),
    notificationContainer: document.getElementById('notification-container')
};

// Utility Functions
function showNotification(title, message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️'
    };
    
    notification.innerHTML = `
        <div class="notification-icon">${icons[type] || 'ℹ️'}</div>
        <div class="notification-content">
            <div class="notification-title">${title}</div>
            <div class="notification-message">${message}</div>
        </div>
    `;
    
    elements.notificationContainer.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

function showLoading(show = true) {
    if (show) {
        elements.loadingOverlay.classList.add('show');
    } else {
        elements.loadingOverlay.classList.remove('show');
    }
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (e) {
        return 'Invalid Date';
    }
}

function formatPhone(phone) {
    if (!phone || phone === 'null') return 'N/A';
    return phone;
}

// Modal Functions
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.classList.remove('show');
    });
    document.body.style.overflow = '';
    resetProctorForm();
}

function closeAvailabilityModal() {
    document.getElementById('availability-modal').classList.remove('show');
    document.body.style.overflow = '';
}

function closeFindModal() {
    document.getElementById('find-available-modal').classList.remove('show');
    document.body.style.overflow = '';
}

function closeDeleteModal() {
    document.getElementById('delete-modal').classList.remove('show');
    document.body.style.overflow = '';
}

// Proctor Management Functions
async function loadProctors() {
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE}?action=list`);
        if (response.ok) {
            const proctors = await response.json();
            currentProctors = Array.isArray(proctors) ? proctors : [];
            renderProctorsTable(currentProctors);
            updateStats();
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to load proctors');
        }
    } catch (error) {
        showNotification('Error', error.message, 'error');
        currentProctors = [];
        renderProctorsTable([]);
    } finally {
        showLoading(false);
    }
}

function renderProctorsTable(proctors) {
    const tbody = elements.proctorsTableBody;
    tbody.innerHTML = '';
    
    if (!proctors || proctors.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <div class="empty-state-content">
                        <div class="empty-state-icon">👨‍🏫</div>
                        <h3>No Proctors Found</h3>
                        <p>Click "Add Proctor" to create your first proctor.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    // Calculate pagination
    const startIndex = (currentPage - 1) * proctorsPerPage;
    const endIndex = startIndex + proctorsPerPage;
    const pageProctors = proctors.slice(startIndex, endIndex);
    
    pageProctors.forEach(proctor => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>
                <div class="user-info">
                    <div class="user-name">${escapeHtml(proctor.username || 'N/A')}</div>
                    <div class="user-id">ID: ${escapeHtml(proctor.user_id || 'N/A')}</div>
                </div>
            </td>
            <td>${escapeHtml(proctor.email || 'N/A')}</td>
            <td>${escapeHtml(formatPhone(proctor.phone))}</td>
            <td>${formatDate(proctor.date_created)}</td>
            <td>
                <span class="status-badge ${proctor.is_active ? 'status-active' : 'status-inactive'}">
                    ${proctor.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                <div class="action-buttons-cell">
                    <button class="action-btn edit-btn" onclick="editProctor('${escapeHtml(proctor.external_id)}')" title="Edit">
                        ✏️
                    </button>
                    <button class="action-btn availability-btn" onclick="viewAvailability('${escapeHtml(proctor.external_id)}', '${escapeHtml(proctor.username || 'Proctor')}')" title="Availability">
                        📅
                    </button>
                    <button class="action-btn delete-btn" onclick="deleteProctor('${escapeHtml(proctor.external_id)}', '${escapeHtml(proctor.username || 'Proctor')}')" title="Delete">
                        🗑️
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    renderPagination(proctors.length);
}

function renderPagination(totalItems) {
    totalPages = Math.ceil(totalItems / proctorsPerPage);
    const pagination = elements.pagination;
    pagination.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    // Previous button
    const prevButton = document.createElement('button');
    prevButton.className = 'pagination-btn';
    prevButton.innerHTML = '« Previous';
    prevButton.disabled = currentPage === 1;
    prevButton.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            renderProctorsTable(currentProctors);
        }
    };
    pagination.appendChild(prevButton);
    
    // Page numbers
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement('button');
        pageButton.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
        pageButton.textContent = i;
        pageButton.onclick = () => {
            currentPage = i;
            renderProctorsTable(currentProctors);
        };
        pagination.appendChild(pageButton);
    }
    
    // Next button
    const nextButton = document.createElement('button');
    nextButton.className = 'pagination-btn';
    nextButton.innerHTML = 'Next »';
    nextButton.disabled = currentPage === totalPages;
    nextButton.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderProctorsTable(currentProctors);
        }
    };
    pagination.appendChild(nextButton);
}

function openCreateModal() {
    document.getElementById('modal-title').textContent = 'Add New Proctor';
    document.getElementById('external_id').value = '';
    resetProctorForm();
    openModal('proctor-modal');
}

function resetProctorForm() {
    document.getElementById('proctor-form').reset();
    document.getElementById('user-search-results').innerHTML = '';
    document.getElementById('user-search-results').classList.remove('show');
    document.getElementById('user_id').value = '';
    document.getElementById('first_name').value = '';
    document.getElementById('last_name').value = '';
    currentProctorId = null;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function searchUserProfiles(query) {
    if (query.length < 2) {
        document.getElementById('user-search-results').innerHTML = '';
        document.getElementById('user-search-results').classList.remove('show');
        return;
    }
    
    try {
        // Load user profiles if not already loaded
        if (!userProfilesLoaded) {
            await loadUserProfiles();
        }
        
        const searchTerm = query.toLowerCase();
        const results = userProfilesCache.filter(user =>
            user.username.toLowerCase().includes(searchTerm) ||
            user.email.toLowerCase().includes(searchTerm) ||
            (user.first_name && user.first_name.toLowerCase().includes(searchTerm)) ||
            (user.last_name && user.last_name.toLowerCase().includes(searchTerm))
        ).slice(0, 8); // Limit to 8 results
        
        const resultsContainer = document.getElementById('user-search-results');
        resultsContainer.innerHTML = '';
        
        if (results.length === 0) {
            const noResult = document.createElement('div');
            noResult.className = 'search-result-item no-result';
            noResult.textContent = 'No users found. Enter user details manually.';
            resultsContainer.appendChild(noResult);
        } else {
            results.forEach(user => {
                const item = document.createElement('div');
                item.className = 'search-result-item';
                item.innerHTML = `
                    <div><strong>${escapeHtml(user.username)}</strong></div>
                    <div style="font-size: 12px; color: #666;">${escapeHtml(user.email)}</div>
                    <div style="font-size: 11px; color: #999;">
                        ${escapeHtml(user.first_name || '')} ${escapeHtml(user.last_name || '')}
                    </div>
                `;
                item.onclick = () => selectUserProfile(user);
                resultsContainer.appendChild(item);
            });
        }
        
        resultsContainer.classList.add('show');
    } catch (error) {
        console.error('Error searching user profiles:', error);
        // Show notification but don't break the UI
        showNotification('Info', 'User profile search unavailable. Enter details manually.', 'warning');
    }
}

async function loadUserProfiles() {
    if (userProfilesLoaded) return;
    
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE}?action=get_user_profiles`);
        if (response.ok) {
            const data = await response.json();
            userProfilesCache = Array.isArray(data) ? data : [];
            userProfilesLoaded = true;
            console.log(`Loaded ${userProfilesCache.length} user profiles`);
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to load user profiles');
        }
    } catch (error) {
        console.error('Error loading user profiles:', error);
        showNotification('Warning', 'Unable to load user profiles. You can still enter proctor details manually.', 'warning');
        userProfilesCache = [];
    } finally {
        showLoading(false);
    }
}

function selectUserProfile(user) {
    // Fill the form with user data
    document.getElementById('username').value = user.username || '';
    document.getElementById('email').value = user.email || '';
    document.getElementById('user_id').value = user.user_id || '';
    document.getElementById('first_name').value = user.first_name || '';
    document.getElementById('last_name').value = user.last_name || '';
    document.getElementById('phone').value = user.phone || '';
    
    // Clear search results
    document.getElementById('user-search-results').innerHTML = '';
    document.getElementById('user-search-results').classList.remove('show');
}

async function saveProctor() {
    const form = document.getElementById('proctor-form');
    
    // Validate required fields
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const userId = document.getElementById('user_id').value.trim();
    
    if (!username || !email || !userId) {
        showNotification('Error', 'Username, Email, and User ID are required fields', 'error');
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showNotification('Error', 'Please enter a valid email address', 'error');
        return;
    }
    
    const formData = new FormData(form);
    const proctorData = {
        username: username,
        email: email,
        user_id: userId,
        phone: formData.get('phone') || '',
        is_active: document.getElementById('is_active').checked
    };
    
    // Add external_id if provided
    const externalId = document.getElementById('external_id').value.trim();
    if (externalId) {
        proctorData.external_id = externalId;
    }
    
    showLoading(true);
    
    try {
        let url = `${API_BASE}?action=create`;
        let method = 'POST';
        
        if (currentProctorId) {
            // Update existing proctor
            url = `${API_BASE}${currentProctorId}/?action=update`;
            method = 'PUT';
        }
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(proctorData)
        });
        
        if (response.ok) {
            const result = await response.json();
            showNotification('Success', 
                currentProctorId ? 'Proctor updated successfully' : 'Proctor created successfully');
            closeModal();
            loadProctors();
        } else {
            const error = await response.json();
            throw new Error(error.error || `Failed to save proctor: ${response.status}`);
        }
    } catch (error) {
        showNotification('Error', error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function editProctor(proctorId) {
    showLoading(true);
    currentProctorId = proctorId;
    
    try {
        const response = await fetch(`${API_BASE}?action=get&id=${proctorId}`);
        if (response.ok) {
            const proctor = await response.json();
            
            document.getElementById('modal-title').textContent = 'Edit Proctor';
            document.getElementById('username').value = proctor.username || '';
            document.getElementById('email').value = proctor.email || '';
            document.getElementById('user_id').value = proctor.user_id || '';
            document.getElementById('external_id').value = proctor.external_id || '';
            document.getElementById('phone').value = proctor.phone || '';
            document.getElementById('is_active').checked = proctor.is_active || false;
            
            // Note: We don't auto-fill first_name/last_name from proctor data
            // as they might not be stored in the proctor model
            
            openModal('proctor-modal');
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to load proctor data');
        }
    } catch (error) {
        showNotification('Error', error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function deleteProctor(proctorId, proctorName) {
    currentProctorId = proctorId;
    currentProctorName = proctorName;
    
    const deleteMessage = document.querySelector('#delete-modal .modal-body p');
    if (deleteMessage) {
        deleteMessage.textContent = `Are you sure you want to delete proctor "${proctorName}"?`;
    }
    
    openModal('delete-modal');
}

async function confirmDelete() {
    if (!currentProctorId) return;
    
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE}${currentProctorId}/`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification('Success', `Proctor "${currentProctorName}" deleted successfully`);
            closeDeleteModal();
            loadProctors();
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete proctor');
        }
    } catch (error) {
        showNotification('Error', error.message, 'error');
    } finally {
        showLoading(false);
        currentProctorId = null;
        currentProctorName = '';
    }
}

// Availability Functions
function openFindAvailableModal() {
    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('find-date').value = today;
    openModal('find-available-modal');
}

async function findAvailableProctors() {
    const date = document.getElementById('find-date').value;
    const time = document.getElementById('find-time').value;
    
    if (!date) {
        showNotification('Error', 'Please select a date', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE}?action=find&date=${date}&time=${time}`);
        if (response.ok) {
            const proctors = await response.json();
            displayAvailableProctors(proctors);
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to find available proctors');
        }
    } catch (error) {
        showNotification('Error', error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function displayAvailableProctors(proctors) {
    const container = document.getElementById('available-proctors-list');
    container.innerHTML = '';
    
    if (!proctors || !Array.isArray(proctors) || proctors.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">😕</div>
                <h3>No Proctors Available</h3>
                <p>No proctors are available at the selected time.</p>
            </div>
        `;
        return;
    }
    
    proctors.forEach(proctor => {
        const card = document.createElement('div');
        card.className = 'available-proctor-card';
        card.innerHTML = `
            <div class="proctor-info">
                <div class="proctor-name">${escapeHtml(proctor.username || 'Unknown')}</div>
                <div class="proctor-email">${escapeHtml(proctor.email || 'No email')}</div>
                <div class="proctor-phone">${escapeHtml(formatPhone(proctor.phone))}</div>
            </div>
            <div class="proctor-actions">
                <button class="btn btn-secondary" onclick="viewAvailability('${escapeHtml(proctor.external_id)}', '${escapeHtml(proctor.username || 'Proctor')}')">
                    View Schedule
                </button>
                <button class="btn btn-primary" onclick="editProctor('${escapeHtml(proctor.external_id)}')">
                    Edit
                </button>
            </div>
        `;
        container.appendChild(card);
    });
}

async function viewAvailability(proctorId, proctorName) {
    currentProctorId = proctorId;
    
    // Set the title
    document.getElementById('availability-title').textContent = `Availability - ${proctorName}`;
    
    // Load availability
    await refreshAvailability();
    
    // Open modal
    openModal('availability-modal');
}

async function refreshAvailability() {
    if (!currentProctorId) return;
    
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    
    if (!startDate || !endDate) {
        showNotification('Error', 'Please select both start and end dates', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await fetch(
            `${API_BASE}?action=availability&proctor_id=${currentProctorId}&start_date=${startDate}&end_date=${endDate}`
        );
        
        if (response.ok) {
            const availability = await response.json();
            displayAvailability(availability);
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to load availability');
        }
    } catch (error) {
        showNotification('Error', error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function displayAvailability(availabilityData) {
    const container = document.getElementById('availability-grid');
    container.innerHTML = '';
    
    if (!availabilityData || !Array.isArray(availabilityData) || availabilityData.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📅</div>
                <h3>No Availability Data</h3>
                <p>No availability data found for the selected period.</p>
            </div>
        `;
        return;
    }
    
    availabilityData.forEach(day => {
        const dayCard = document.createElement('div');
        dayCard.className = `availability-day ${day.is_available ? '' : 'unavailable'}`;
        
        try {
            const dayDate = new Date(day.day);
            const formattedDate = dayDate.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
            
            let hoursHtml = '';
            if (day.available_hours && Array.isArray(day.available_hours) && day.available_hours.length > 0) {
                day.available_hours.forEach(hour => {
                    const hourId = hour.id || '';
                    const startTime = formatTime12Hour(hour.start_time);
                    const endTime = formatTime12Hour(hour.end_time);
                    
                    hoursHtml += `
                        <div class="availability-hour">
                            <div class="hour-time">
                                ${startTime} - ${endTime}
                            </div>
                            <div class="hour-toggle ${hour.is_available ? 'active' : ''}" 
                                 onclick="toggleHourAvailability('${hourId}', ${!hour.is_available})">
                            </div>
                        </div>
                    `;
                });
            } else {
                hoursHtml = '<div class="no-hours">No hours configured</div>';
            }
            
            dayCard.innerHTML = `
                <div class="availability-day-header">
                    <div class="availability-date">${formattedDate}</div>
                    <div class="availability-toggle ${day.is_available ? 'active' : ''}"
                         onclick="toggleDayAvailability(${day.id}, ${!day.is_available})">
                    </div>
                </div>
                <div class="availability-hours">
                    ${hoursHtml}
                </div>
            `;
            
            container.appendChild(dayCard);
        } catch (error) {
            console.error('Error rendering availability day:', error);
        }
    });
}

function formatTime12Hour(timeString) {
    if (!timeString) return 'N/A';
    try {
        const [hours, minutes] = timeString.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    } catch (e) {
        return timeString;
    }
}

async function toggleDayAvailability(dayId, isAvailable) {
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE}?action=update_day`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                day_id: dayId,
                is_available: isAvailable
            })
        });
        
        if (response.ok) {
            showNotification('Success', 'Day availability updated');
            await refreshAvailability();
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update availability');
        }
    } catch (error) {
        showNotification('Error', error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function toggleHourAvailability(hourId, isAvailable) {
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE}?action=update_hour`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                hour_id: hourId,
                is_available: isAvailable
            })
        });
        
        if (response.ok) {
            showNotification('Success', 'Hour availability updated');
            await refreshAvailability();
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update hour availability');
        }
    } catch (error) {
        showNotification('Error', error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Search Function
function searchProctors() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase().trim();
    
    if (!searchTerm) {
        renderProctorsTable(currentProctors);
        return;
    }
    
    const filteredProctors = currentProctors.filter(proctor => {
        if (!proctor) return false;
        
        return (
            (proctor.username && proctor.username.toLowerCase().includes(searchTerm)) ||
            (proctor.email && proctor.email.toLowerCase().includes(searchTerm)) ||
            (proctor.user_id && proctor.user_id.toLowerCase().includes(searchTerm)) ||
            (proctor.phone && proctor.phone.toLowerCase().includes(searchTerm)) ||
            (proctor.first_name && proctor.first_name.toLowerCase().includes(searchTerm)) ||
            (proctor.last_name && proctor.last_name.toLowerCase().includes(searchTerm))
        );
    });
    
    renderProctorsTable(filteredProctors);
}

// Stats Functions
async function loadStats() {
    // Active proctors count
    const activeProctors = currentProctors.filter(p => p && p.is_active).length;
    document.getElementById('active-proctors').textContent = activeProctors;
    
    // Today's availability
    const today = new Date().toISOString().split('T')[0];
    try {
        const response = await fetch(`${API_BASE}?action=find&date=${today}&time=10:00`);
        if (response.ok) {
            const proctors = await response.json();
            const count = Array.isArray(proctors) ? proctors.length : 0;
            document.getElementById('today-availability').textContent = count;
        }
    } catch (error) {
        document.getElementById('today-availability').textContent = '0';
    }
    
    // Available now
    try {
        const now = new Date();
        const currentHour = now.getHours().toString().padStart(2, '0');
        const currentTime = `${currentHour}:00`;
        
        const response = await fetch(`${API_BASE}?action=find&date=${today}&time=${currentTime}`);
        if (response.ok) {
            const proctors = await response.json();
            const count = Array.isArray(proctors) ? proctors.length : 0;
            document.getElementById('available-now').textContent = count;
        }
    } catch (error) {
        document.getElementById('available-now').textContent = '0';
    }
    
    // Replicas online
    try {
        const response = await fetch(`${API_BASE}?action=get_replicas&app_id=21`);
        if (response.ok) {
            const data = await response.json();
            const count = data.replicas ? data.replicas.length : 0;
            document.getElementById('replicas-online').textContent = count;
        }
    } catch (error) {
        document.getElementById('replicas-online').textContent = '0';
    }
}

function updateStats() {
    const activeProctors = currentProctors.filter(p => p && p.is_active).length;
    document.getElementById('active-proctors').textContent = activeProctors;
}

function refreshProctors() {
    currentPage = 1;
    loadProctors();
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Close modals when clicking outside
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('show');
                document.body.style.overflow = '';
            }
        });
    });
    
    // Search on Enter key
    document.getElementById('search-input').addEventListener('keyup', function(e) {
        if (e.key === 'Enter') {
            searchProctors();
        }
    });
    
    // Close search results when clicking elsewhere
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.input-with-search')) {
            document.getElementById('user-search-results').classList.remove('show');
        }
    });
    
    // Load initial data
    loadProctors();
    // Pre-load user profiles in background
    loadUserProfiles();
});

// Export functions for use in HTML
window.openCreateModal = openCreateModal;
window.openFindAvailableModal = openFindAvailableModal;
window.editProctor = editProctor;
window.deleteProctor = deleteProctor;
window.viewAvailability = viewAvailability;
window.refreshAvailability = refreshAvailability;
window.saveProctor = saveProctor;
window.confirmDelete = confirmDelete;
window.findAvailableProctors = findAvailableProctors;
window.toggleDayAvailability = toggleDayAvailability;
window.toggleHourAvailability = toggleHourAvailability;
window.searchProctors = searchProctors;
window.refreshProctors = refreshProctors;
window.closeModal = closeModal;
window.closeAvailabilityModal = closeAvailabilityModal;
window.closeFindModal = closeFindModal;
window.closeDeleteModal = closeDeleteModal;
window.searchUserProfiles = searchUserProfiles;