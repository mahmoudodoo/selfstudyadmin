// Global variables
let appData = {
    userprofiles: [],
    courses: [],
    teachers: [],
    live_course_rooms: []
};

// DOM Ready
document.addEventListener('DOMContentLoaded', function() {
    loadData();
});

// Load all data
async function loadData() {
    showLoading(true);
    
    try {
        const response = await fetch('/selfstudylivecourse/api/data/');
        const data = await response.json();
        
        if (data.success) {
            appData = data;
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
    updateTeachersTable();
    updateRoomsTable();
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

// Update teachers table
function updateTeachersTable() {
    const tbody = document.getElementById('teachersTableBody');
    tbody.innerHTML = '';
    
    if (appData.teachers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="no-data">No teachers found</td></tr>';
        return;
    }
    
    appData.teachers.forEach(teacher => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${teacher.teacher_id}</td>
            <td>${teacher.teachername}</td>
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

// Update rooms table
function updateRoomsTable() {
    const tbody = document.getElementById('roomsTableBody');
    tbody.innerHTML = '';
    
    if (appData.live_course_rooms.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="no-data">No live course rooms found</td></tr>';
        return;
    }
    
    appData.live_course_rooms.forEach(room => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${room.room_id}</td>
            <td>${room.course_name}</td>
            <td>${room.student_name}</td>
            <td>${getTeacherName(room.teacher)}</td>
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
            <span>${message}</span>
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