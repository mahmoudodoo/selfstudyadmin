// Global variables
let appData = {
    userprofiles: [],
    courses: [],
    teachers: [],
    live_course_rooms: []
};

// Pagination state
let teachersCurrentPage = 1;
const teachersPageSize = 9;
let roomsCurrentPage = 1;
const roomsPageSize = 9;

// Filtered data (for search)
let filteredTeachers = [];
let filteredRooms = [];

// Search terms
let teachersSearchTerm = '';
let roomsSearchTerm = '';

// DOM Ready
document.addEventListener('DOMContentLoaded', function() {
    initializeTabs();
    initializeSearch();
    loadData();
});

// Initialize tabs functionality
function initializeTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            
            // Remove active class from all tabs and contents
            document.querySelectorAll('.tab-btn').forEach(tb => tb.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
            
            // Add active class to current tab and content
            this.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });
}

// Initialize search functionality with pagination reset
function initializeSearch() {
    const teachersSearch = document.getElementById('teachersSearch');
    const roomsSearch = document.getElementById('roomsSearch');
    
    if (teachersSearch) {
        teachersSearch.addEventListener('input', function() {
            teachersSearchTerm = this.value.toLowerCase();
            teachersCurrentPage = 1;  // Reset to first page
            applyTeachersFilter();
        });
    }
    
    if (roomsSearch) {
        roomsSearch.addEventListener('input', function() {
            roomsSearchTerm = this.value.toLowerCase();
            roomsCurrentPage = 1;  // Reset to first page
            applyRoomsFilter();
        });
    }
}

// Apply search filter to teachers data
function applyTeachersFilter() {
    if (!teachersSearchTerm) {
        filteredTeachers = [...appData.teachers];
    } else {
        filteredTeachers = appData.teachers.filter(teacher => {
            return teacher.teacher_id.toLowerCase().includes(teachersSearchTerm) ||
                   teacher.teachername.toLowerCase().includes(teachersSearchTerm);
        });
    }
    renderTeachersTable();
}

// Apply search filter to rooms data
function applyRoomsFilter() {
    if (!roomsSearchTerm) {
        filteredRooms = [...appData.live_course_rooms];
    } else {
        filteredRooms = appData.live_course_rooms.filter(room => {
            return room.room_id.toLowerCase().includes(roomsSearchTerm) ||
                   room.course_name.toLowerCase().includes(roomsSearchTerm) ||
                   room.student_name.toLowerCase().includes(roomsSearchTerm) ||
                   (getTeacherName(room.teacher) && getTeacherName(room.teacher).toLowerCase().includes(roomsSearchTerm)) ||
                   room.room_url.toLowerCase().includes(roomsSearchTerm);
        });
    }
    renderRoomsTable();
}

// Load all data
async function loadData() {
    showLoading(true);
    
    try {
        const response = await fetch('/selfstudylivecourse/api/data/');
        const data = await response.json();
        
        if (data.success) {
            appData = data;
            // Initialize filtered arrays
            filteredTeachers = [...appData.teachers];
            filteredRooms = [...appData.live_course_rooms];
            teachersCurrentPage = 1;
            roomsCurrentPage = 1;
            updateUI();
            showToast('Data loaded successfully', 'success');
        } else {
            throw new Error(data.error || 'Failed to load data');
        }
    } catch (error) {
        console.error('Error loading data:', error);
        showToast('Error loading data: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Update UI with loaded data
function updateUI() {
    updateStats();
    populateUserSelects();
    applyTeachersFilter();
    applyRoomsFilter();
}

// Update statistics
function updateStats() {
    document.getElementById('teachers-count').textContent = appData.teachers.length;
    document.getElementById('rooms-count').textContent = appData.live_course_rooms.length;
    document.getElementById('users-count').textContent = appData.userprofiles.length;
    document.getElementById('courses-count').textContent = appData.courses.length;
}

// Populate dropdown selects
function populateUserSelects() {
    const teacherUserSelect = document.getElementById('teacherUserSelect');
    const studentSelect = document.getElementById('studentSelect');
    const teacherSelect = document.getElementById('teacherSelect');
    const courseSelect = document.getElementById('courseSelect');
    
    // Clear existing options
    teacherUserSelect.innerHTML = '<option value="">Select a user...</option>';
    studentSelect.innerHTML = '<option value="">Select a student...</option>';
    teacherSelect.innerHTML = '<option value="">Select a teacher...</option>';
    courseSelect.innerHTML = '<option value="">Select a course...</option>';
    
    // Populate user profiles
    appData.userprofiles.forEach(user => {
        const option1 = document.createElement('option');
        option1.value = user.username;
        option1.textContent = user.username;
        option1.setAttribute('data-user-id', user.user_id);
        teacherUserSelect.appendChild(option1);
        
        const option2 = document.createElement('option');
        option2.value = user.username;
        option2.textContent = user.username;
        option2.setAttribute('data-user-id', user.user_id);
        studentSelect.appendChild(option2);
    });
    
    // Populate teachers
    appData.teachers.forEach(teacher => {
        const option = document.createElement('option');
        option.value = teacher.teacher_id;
        option.textContent = teacher.teachername;
        teacherSelect.appendChild(option);
    });
    
    // Populate courses
    appData.courses.forEach(course => {
        const option = document.createElement('option');
        option.value = course.title;
        option.textContent = course.title;
        courseSelect.appendChild(option);
    });
}

// Render teachers table with pagination
function renderTeachersTable() {
    const tbody = document.getElementById('teachersTableBody');
    tbody.innerHTML = '';
    
    const totalItems = filteredTeachers.length;
    const totalPages = Math.ceil(totalItems / teachersPageSize);
    if (teachersCurrentPage > totalPages && totalPages > 0) teachersCurrentPage = totalPages;
    if (teachersCurrentPage < 1) teachersCurrentPage = 1;
    
    const start = (teachersCurrentPage - 1) * teachersPageSize;
    const end = start + teachersPageSize;
    const pageTeachers = filteredTeachers.slice(start, end);
    
    if (pageTeachers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="no-data">No teachers found</td></tr>';
    } else {
        pageTeachers.forEach(teacher => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${teacher.teacher_id}</td>
                <td>${escapeHtml(teacher.teachername)}</td>
                <td class="actions">
                    <button class="btn btn-sm btn-warning" onclick="editTeacher('${teacher.teacher_id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteTeacher('${teacher.teacher_id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }
    
    renderTeachersPagination(totalItems);
}

// Render pagination for teachers
function renderTeachersPagination(totalItems) {
    const container = document.getElementById('teachersPagination');
    if (!container) return;
    
    const totalPages = Math.ceil(totalItems / teachersPageSize);
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = '<div class="pagination-controls">';
    html += `<button class="pagination-btn" data-page="prev" ${teachersCurrentPage === 1 ? 'disabled' : ''}>« Prev</button>`;
    
    let startPage = Math.max(1, teachersCurrentPage - 2);
    let endPage = Math.min(totalPages, teachersCurrentPage + 2);
    if (startPage > 1) {
        html += `<button class="pagination-btn" data-page="1">1</button>`;
        if (startPage > 2) html += '<span class="pagination-ellipsis">...</span>';
    }
    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="pagination-btn ${i === teachersCurrentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += '<span class="pagination-ellipsis">...</span>';
        html += `<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
    }
    html += `<button class="pagination-btn" data-page="next" ${teachersCurrentPage === totalPages ? 'disabled' : ''}>Next »</button>`;
    html += '</div>';
    
    container.innerHTML = html;
    
    // Attach event listeners
    container.querySelectorAll('.pagination-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.dataset.page;
            if (page === 'prev') {
                changeTeachersPage(teachersCurrentPage - 1);
            } else if (page === 'next') {
                changeTeachersPage(teachersCurrentPage + 1);
            } else {
                changeTeachersPage(parseInt(page, 10));
            }
        });
    });
}

function changeTeachersPage(page) {
    const totalPages = Math.ceil(filteredTeachers.length / teachersPageSize);
    if (page < 1 || page > totalPages) return;
    teachersCurrentPage = page;
    renderTeachersTable();
}

// Render rooms table with pagination
function renderRoomsTable() {
    const tbody = document.getElementById('roomsTableBody');
    tbody.innerHTML = '';
    
    const totalItems = filteredRooms.length;
    const totalPages = Math.ceil(totalItems / roomsPageSize);
    if (roomsCurrentPage > totalPages && totalPages > 0) roomsCurrentPage = totalPages;
    if (roomsCurrentPage < 1) roomsCurrentPage = 1;
    
    const start = (roomsCurrentPage - 1) * roomsPageSize;
    const end = start + roomsPageSize;
    const pageRooms = filteredRooms.slice(start, end);
    
    if (pageRooms.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="no-data">No live course rooms found</td></tr>';
    } else {
        pageRooms.forEach(room => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${room.room_id}</td>
                <td>${escapeHtml(room.course_name)}</td>
                <td>${escapeHtml(room.student_name)}</td>
                <td>${escapeHtml(getTeacherName(room.teacher))}</td>
                <td><a href="${room.room_url}" target="_blank">${room.room_url}</a></td>
                <td>${new Date(room.created_at).toLocaleString()}</td>
                <td class="actions">
                    <button class="btn btn-sm btn-warning" onclick="editRoom('${room.room_id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteRoom('${room.room_id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }
    
    renderRoomsPagination(totalItems);
}

// Render pagination for rooms
function renderRoomsPagination(totalItems) {
    const container = document.getElementById('roomsPagination');
    if (!container) return;
    
    const totalPages = Math.ceil(totalItems / roomsPageSize);
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = '<div class="pagination-controls">';
    html += `<button class="pagination-btn" data-page="prev" ${roomsCurrentPage === 1 ? 'disabled' : ''}>« Prev</button>`;
    
    let startPage = Math.max(1, roomsCurrentPage - 2);
    let endPage = Math.min(totalPages, roomsCurrentPage + 2);
    if (startPage > 1) {
        html += `<button class="pagination-btn" data-page="1">1</button>`;
        if (startPage > 2) html += '<span class="pagination-ellipsis">...</span>';
    }
    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="pagination-btn ${i === roomsCurrentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += '<span class="pagination-ellipsis">...</span>';
        html += `<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
    }
    html += `<button class="pagination-btn" data-page="next" ${roomsCurrentPage === totalPages ? 'disabled' : ''}>Next »</button>`;
    html += '</div>';
    
    container.innerHTML = html;
    
    container.querySelectorAll('.pagination-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.dataset.page;
            if (page === 'prev') {
                changeRoomsPage(roomsCurrentPage - 1);
            } else if (page === 'next') {
                changeRoomsPage(roomsCurrentPage + 1);
            } else {
                changeRoomsPage(parseInt(page, 10));
            }
        });
    });
}

function changeRoomsPage(page) {
    const totalPages = Math.ceil(filteredRooms.length / roomsPageSize);
    if (page < 1 || page > totalPages) return;
    roomsCurrentPage = page;
    renderRoomsTable();
}

// Get teacher name by ID
function getTeacherName(teacherId) {
    const teacher = appData.teachers.find(t => t.teacher_id === teacherId);
    return teacher ? teacher.teachername : 'Unknown';
}

// Modal functions
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    resetForm(modalId + ' form');
}

function resetForm(formSelector) {
    const form = document.querySelector(formSelector);
    if (form) {
        form.reset();
        document.getElementById('teacherId').value = '';
        document.getElementById('roomId').value = '';
        document.getElementById('teacherModalTitle').textContent = 'Add New Teacher';
        document.getElementById('roomModalTitle').textContent = 'Add New Live Course Room';
    }
}

// Fill teacher name from user selection
function fillTeacherName() {
    const userSelect = document.getElementById('teacherUserSelect');
    const selectedOption = userSelect.options[userSelect.selectedIndex];
    if (selectedOption.value) {
        document.getElementById('teacherName').value = selectedOption.value;
    }
}

// Fill student info from user selection
function fillStudentId() {
    const studentSelect = document.getElementById('studentSelect');
    const selectedOption = studentSelect.options[studentSelect.selectedIndex];
    if (selectedOption.value) {
        document.getElementById('studentName').value = selectedOption.value;
        document.getElementById('studentId').value = selectedOption.getAttribute('data-user-id');
    }
}

// Teacher operations
function editTeacher(teacherId) {
    const teacher = appData.teachers.find(t => t.teacher_id === teacherId);
    if (teacher) {
        document.getElementById('teacherId').value = teacher.teacher_id;
        document.getElementById('teacherName').value = teacher.teachername;
        document.getElementById('teacherModalTitle').textContent = 'Edit Teacher';
        openModal('teacherModal');
    }
}

async function saveTeacher() {
    const teacherId = document.getElementById('teacherId').value;
    const teacherName = document.getElementById('teacherName').value;
    
    if (!teacherName) {
        showToast('Please enter teacher name', 'warning');
        return;
    }
    
    const teacherData = {
        teachername: teacherName
    };
    
    showLoading(true);
    
    try {
        let url = '/selfstudylivecourse/api/data/';
        let method = 'POST';
        let requestData = {
            action: 'create_teacher',
            ...teacherData
        };
        
        if (teacherId) {
            // Update existing teacher
            method = 'PUT';
            requestData = {
                action: 'update_teacher',
                teacher_id: teacherId,
                ...teacherData
            };
        }
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': await getCsrfToken()
            },
            body: JSON.stringify(requestData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast(`Teacher ${teacherId ? 'updated' : 'created'} successfully`, 'success');
            closeModal('teacherModal');
            await loadData();
        } else {
            throw new Error(result.error || 'Operation failed');
        }
    } catch (error) {
        console.error('Error saving teacher:', error);
        showToast('Error saving teacher: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function deleteTeacher(teacherId) {
    if (!confirm('Are you sure you want to delete this teacher?')) {
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await fetch('/selfstudylivecourse/api/data/', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': await getCsrfToken()
            },
            body: JSON.stringify({
                action: 'delete_teacher',
                teacher_id: teacherId
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('Teacher deleted successfully', 'success');
            await loadData();
        } else {
            throw new Error(result.error || 'Delete failed');
        }
    } catch (error) {
        console.error('Error deleting teacher:', error);
        showToast('Error deleting teacher: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Room operations
function editRoom(roomId) {
    const room = appData.live_course_rooms.find(r => r.room_id === roomId);
    if (room) {
        document.getElementById('roomId').value = room.room_id;
        document.getElementById('courseSelect').value = room.course_name;
        document.getElementById('studentName').value = room.student_name;
        document.getElementById('studentId').value = room.student_id;
        document.getElementById('teacherSelect').value = room.teacher;
        document.getElementById('roomUrl').value = room.room_url;
        document.getElementById('roomModalTitle').textContent = 'Edit Live Course Room';
        openModal('roomModal');
    }
}

async function saveRoom() {
    const roomId = document.getElementById('roomId').value;
    const courseName = document.getElementById('courseSelect').value;
    const studentName = document.getElementById('studentName').value;
    const studentId = document.getElementById('studentId').value;
    const teacherId = document.getElementById('teacherSelect').value;
    const roomUrl = document.getElementById('roomUrl').value;
    
    // Validation
    if (!courseName || !studentName || !studentId || !teacherId || !roomUrl) {
        showToast('Please fill all required fields', 'warning');
        return;
    }
    
    const roomData = {
        course_name: courseName,
        student_name: studentName,
        student_id: studentId,
        teacher_id: teacherId,
        room_url: roomUrl
    };
    
    showLoading(true);
    
    try {
        let url = '/selfstudylivecourse/api/data/';
        let method = 'POST';
        let requestData = {
            action: 'create_live_course_room',
            ...roomData
        };
        
        if (roomId) {
            // Update existing room
            method = 'PUT';
            requestData = {
                action: 'update_live_course_room',
                room_id: roomId,
                ...roomData
            };
        }
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': await getCsrfToken()
            },
            body: JSON.stringify(requestData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast(`Live course room ${roomId ? 'updated' : 'created'} successfully`, 'success');
            closeModal('roomModal');
            await loadData();
        } else {
            throw new Error(result.error || 'Operation failed');
        }
    } catch (error) {
        console.error('Error saving room:', error);
        showToast('Error saving room: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function deleteRoom(roomId) {
    if (!confirm('Are you sure you want to delete this live course room?')) {
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await fetch('/selfstudylivecourse/api/data/', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': await getCsrfToken()
            },
            body: JSON.stringify({
                action: 'delete_live_course_room',
                room_id: roomId
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('Live course room deleted successfully', 'success');
            await loadData();
        } else {
            throw new Error(result.error || 'Delete failed');
        }
    } catch (error) {
        console.error('Error deleting room:', error);
        showToast('Error deleting room: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Utility functions
function refreshData() {
    loadData();
}

function showLoading(show) {
    document.getElementById('loadingSpinner').style.display = show ? 'flex' : 'none';
}

function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas fa-${getToastIcon(type)}"></i>
            <span>${escapeHtml(message)}</span>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 5000);
}

function getToastIcon(type) {
    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    return icons[type] || 'info-circle';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Fixed CSRF Token function
async function getCsrfToken() {
    // Method 1: Try to get from cookie
    const cookieValue = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrftoken='))
        ?.split('=')[1];
    
    if (cookieValue) {
        return cookieValue;
    }
    
    // Method 2: Try to get from meta tag
    const metaToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    if (metaToken) {
        return metaToken;
    }
    
    // Method 3: Try to get from form input
    const formToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value;
    if (formToken) {
        return formToken;
    }
    
    // Method 4: If all else fails, make a request to get the token
    try {
        const response = await fetch('/selfstudylivecourse/');
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Look for CSRF token in the parsed document
        const token = doc.querySelector('[name=csrfmiddlewaretoken]')?.value ||
                     doc.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        
        if (token) {
            return token;
        }
    } catch (error) {
        console.warn('Could not fetch CSRF token:', error);
    }
    
    console.warn('CSRF token not found. Some operations may fail.');
    return '';
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modals = document.getElementsByClassName('modal');
    for (let modal of modals) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    }
}

// Add CSRF token to all fetch requests
const originalFetch = window.fetch;
window.fetch = function(...args) {
    const [url, options = {}] = args;
    
    // Only add CSRF token for same-origin requests
    if (typeof url === 'string' && url.startsWith('/')) {
        options.headers = {
            ...options.headers,
            'X-CSRFToken': getCsrfToken()
        };
    }
    
    return originalFetch(url, options);
};