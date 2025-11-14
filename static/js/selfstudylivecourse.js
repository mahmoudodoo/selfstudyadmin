// Global variables
let teachers = [];
let liveCourseRooms = [];
let userProfiles = [];
let courses = [];

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', function() {
    loadInitialData();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Close modals when clicking outside
    window.addEventListener('click', function(event) {
        const teacherModal = document.getElementById('teacherModal');
        const roomModal = document.getElementById('roomModal');
        const confirmModal = document.getElementById('confirmModal');
        
        if (event.target === teacherModal) {
            closeTeacherModal();
        }
        if (event.target === roomModal) {
            closeRoomModal();
        }
        if (event.target === confirmModal) {
            closeConfirmModal();
        }
    });
}

// Load initial data
function loadInitialData() {
    showLoading();
    Promise.all([
        fetchTeachers(),
        fetchRooms(),
        fetchUserProfiles(),
        fetchCourses()
    ]).then(() => {
        updateUI();
        hideLoading();
    }).catch(error => {
        console.error('Error loading initial data:', error);
        showNotification('Error loading data. Please try again.', 'error');
        hideLoading();
    });
}

// API Functions
async function fetchTeachers() {
    try {
        const response = await fetch('?action=get_teachers');
        const data = await response.json();
        if (data.teachers) {
            teachers = data.teachers;
        }
    } catch (error) {
        console.error('Error fetching teachers:', error);
        throw error;
    }
}

async function fetchRooms() {
    try {
        const response = await fetch('?action=get_rooms');
        const data = await response.json();
        if (data.rooms) {
            liveCourseRooms = data.rooms;
        }
    } catch (error) {
        console.error('Error fetching rooms:', error);
        throw error;
    }
}

async function fetchUserProfiles() {
    try {
        const response = await fetch('?action=get_user_profiles');
        const data = await response.json();
        if (data.user_profiles) {
            userProfiles = data.user_profiles;
        }
    } catch (error) {
        console.error('Error fetching user profiles:', error);
        throw error;
    }
}

async function fetchCourses() {
    try {
        const response = await fetch('?action=get_courses');
        const data = await response.json();
        if (data.courses) {
            courses = data.courses;
        }
    } catch (error) {
        console.error('Error fetching courses:', error);
        throw error;
    }
}

// Update UI with loaded data
function updateUI() {
    updateStats();
    renderTeachersTable();
    renderRoomsTable();
    populateDropdowns();
}

function updateStats() {
    document.getElementById('teachers-count').textContent = teachers.length;
    document.getElementById('rooms-count').textContent = liveCourseRooms.length;
    document.getElementById('users-count').textContent = userProfiles.length;
    document.getElementById('courses-count').textContent = courses.length;
}

function renderTeachersTable() {
    const tbody = document.getElementById('teachers-tbody');
    tbody.innerHTML = '';

    teachers.forEach(teacher => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${teacher.teacher_id}</td>
            <td>${teacher.teachername}</td>
            <td>${teacher.my_live_courses_rooms ? teacher.my_live_courses_rooms.length : 0}</td>
            <td class="actions">
                <button class="btn btn-sm btn-warning" onclick="editTeacher('${teacher.teacher_id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="confirmDeleteTeacher('${teacher.teacher_id}', '${teacher.teachername}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function renderRoomsTable() {
    const tbody = document.getElementById('rooms-tbody');
    tbody.innerHTML = '';

    liveCourseRooms.forEach(room => {
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
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="confirmDeleteRoom('${room.room_id}', '${room.course_name}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function getTeacherName(teacherId) {
    const teacher = teachers.find(t => t.teacher_id === teacherId);
    return teacher ? teacher.teachername : 'Unknown';
}

function populateDropdowns() {
    populateUserSelect();
    populateCourseSelect();
    populateTeacherSelect();
    populateStudentSelect();
}

function populateUserSelect() {
    const select = document.getElementById('teacher_user_select');
    select.innerHTML = '<option value="">Select a user...</option>';
    
    userProfiles.forEach(user => {
        const option = document.createElement('option');
        option.value = user.user_id;
        option.textContent = user.username;
        option.setAttribute('data-username', user.username);
        select.appendChild(option);
    });
}

function populateCourseSelect() {
    const select = document.getElementById('course_select');
    select.innerHTML = '<option value="">Select a course...</option>';
    
    courses.forEach(course => {
        const option = document.createElement('option');
        option.value = course.title;
        option.textContent = course.title;
        select.appendChild(option);
    });
}

function populateTeacherSelect() {
    const select = document.getElementById('teacher_select');
    select.innerHTML = '<option value="">Select a teacher...</option>';
    
    teachers.forEach(teacher => {
        const option = document.createElement('option');
        option.value = teacher.teacher_id;
        option.textContent = teacher.teachername;
        select.appendChild(option);
    });
}

function populateStudentSelect() {
    const select = document.getElementById('student_select');
    select.innerHTML = '<option value="">Select a student...</option>';
    
    userProfiles.forEach(user => {
        const option = document.createElement('option');
        option.value = user.user_id;
        option.textContent = user.username;
        option.setAttribute('data-username', user.username);
        select.appendChild(option);
    });
}

// Teacher Functions
function openTeacherModal() {
    document.getElementById('teacherModalTitle').textContent = 'Add New Teacher';
    document.getElementById('teacherForm').reset();
    document.getElementById('teacher_id').value = '';
    document.getElementById('teacherModal').style.display = 'block';
}

function closeTeacherModal() {
    document.getElementById('teacherModal').style.display = 'none';
}

function fillTeacherName() {
    const select = document.getElementById('teacher_user_select');
    const selectedOption = select.options[select.selectedIndex];
    if (selectedOption.value) {
        document.getElementById('teachername').value = selectedOption.getAttribute('data-username');
    }
}

function editTeacher(teacherId) {
    const teacher = teachers.find(t => t.teacher_id === teacherId);
    if (teacher) {
        document.getElementById('teacherModalTitle').textContent = 'Edit Teacher';
        document.getElementById('teacher_id').value = teacher.teacher_id;
        document.getElementById('teachername').value = teacher.teachername;
        
        // Try to find matching user
        const userSelect = document.getElementById('teacher_user_select');
        for (let i = 0; i < userSelect.options.length; i++) {
            if (userSelect.options[i].getAttribute('data-username') === teacher.teachername) {
                userSelect.selectedIndex = i;
                break;
            }
        }
        
        document.getElementById('teacherModal').style.display = 'block';
    }
}

function saveTeacher() {
    const teacherId = document.getElementById('teacher_id').value;
    const teachername = document.getElementById('teachername').value.trim();
    
    if (!teachername) {
        showNotification('Please enter teacher name', 'error');
        return;
    }
    
    showLoading();
    
    const payload = {
        action: teacherId ? 'update_teacher' : 'create_teacher',
        teachername: teachername
    };
    
    if (teacherId) {
        payload.teacher_id = teacherId;
    }
    
    fetch('', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken()
        },
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(data => {
        hideLoading();
        if (data.success) {
            showNotification(`Teacher ${teacherId ? 'updated' : 'created'} successfully`, 'success');
            closeTeacherModal();
            refreshData();
        } else {
            showNotification(data.error || 'Operation failed', 'error');
        }
    })
    .catch(error => {
        hideLoading();
        console.error('Error saving teacher:', error);
        showNotification('Error saving teacher', 'error');
    });
}

// Room Functions
function openRoomModal() {
    document.getElementById('roomModalTitle').textContent = 'Add New Live Course Room';
    document.getElementById('roomForm').reset();
    document.getElementById('room_id').value = '';
    document.getElementById('roomModal').style.display = 'block';
}

function closeRoomModal() {
    document.getElementById('roomModal').style.display = 'none';
}

function fillStudentId() {
    const select = document.getElementById('student_select');
    const selectedOption = select.options[select.selectedIndex];
    if (selectedOption.value) {
        document.getElementById('student_id').value = selectedOption.value;
        document.getElementById('student_name').value = selectedOption.getAttribute('data-username');
    }
}

function editRoom(roomId) {
    const room = liveCourseRooms.find(r => r.room_id === roomId);
    if (room) {
        document.getElementById('roomModalTitle').textContent = 'Edit Live Course Room';
        document.getElementById('room_id').value = room.room_id;
        document.getElementById('course_select').value = room.course_name;
        document.getElementById('student_id').value = room.student_id;
        document.getElementById('student_name').value = room.student_name;
        document.getElementById('room_url').value = room.room_url;
        document.getElementById('teacher_select').value = room.teacher;
        
        // Set student select
        const studentSelect = document.getElementById('student_select');
        for (let i = 0; i < studentSelect.options.length; i++) {
            if (studentSelect.options[i].value === room.student_id) {
                studentSelect.selectedIndex = i;
                break;
            }
        }
        
        document.getElementById('roomModal').style.display = 'block';
    }
}

function saveRoom() {
    const roomId = document.getElementById('room_id').value;
    const courseName = document.getElementById('course_select').value;
    const studentId = document.getElementById('student_id').value;
    const studentName = document.getElementById('student_name').value;
    const roomUrl = document.getElementById('room_url').value.trim();
    const teacherId = document.getElementById('teacher_select').value;
    
    if (!courseName || !studentId || !roomUrl || !teacherId) {
        showNotification('Please fill all required fields', 'error');
        return;
    }
    
    showLoading();
    
    const payload = {
        action: roomId ? 'update_live_course_room' : 'create_live_course_room',
        course_name: courseName,
        student_id: studentId,
        student_name: studentName,
        room_url: roomUrl,
        teacher_id: teacherId
    };
    
    if (roomId) {
        payload.room_id = roomId;
    }
    
    fetch('', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken()
        },
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(data => {
        hideLoading();
        if (data.success) {
            showNotification(`Live course room ${roomId ? 'updated' : 'created'} successfully`, 'success');
            closeRoomModal();
            refreshData();
        } else {
            showNotification(data.error || 'Operation failed', 'error');
        }
    })
    .catch(error => {
        hideLoading();
        console.error('Error saving room:', error);
        showNotification('Error saving room', 'error');
    });
}

// Delete Functions
function confirmDeleteTeacher(teacherId, teacherName) {
    document.getElementById('confirmMessage').textContent = `Are you sure you want to delete teacher "${teacherName}"?`;
    document.getElementById('confirmActionBtn').onclick = () => deleteTeacher(teacherId);
    document.getElementById('confirmModal').style.display = 'block';
}

function confirmDeleteRoom(roomId, roomName) {
    document.getElementById('confirmMessage').textContent = `Are you sure you want to delete live course room "${roomName}"?`;
    document.getElementById('confirmActionBtn').onclick = () => deleteRoom(roomId);
    document.getElementById('confirmModal').style.display = 'block';
}

function deleteTeacher(teacherId) {
    showLoading();
    closeConfirmModal();
    
    fetch('', {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken()
        },
        body: JSON.stringify({
            action: 'delete_teacher',
            teacher_id: teacherId
        })
    })
    .then(response => response.json())
    .then(data => {
        hideLoading();
        if (data.success) {
            showNotification('Teacher deleted successfully', 'success');
            refreshData();
        } else {
            showNotification('Failed to delete teacher', 'error');
        }
    })
    .catch(error => {
        hideLoading();
        console.error('Error deleting teacher:', error);
        showNotification('Error deleting teacher', 'error');
    });
}

function deleteRoom(roomId) {
    showLoading();
    closeConfirmModal();
    
    fetch('', {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken()
        },
        body: JSON.stringify({
            action: 'delete_live_course_room',
            room_id: roomId
        })
    })
    .then(response => response.json())
    .then(data => {
        hideLoading();
        if (data.success) {
            showNotification('Live course room deleted successfully', 'success');
            refreshData();
        } else {
            showNotification('Failed to delete live course room', 'error');
        }
    })
    .catch(error => {
        hideLoading();
        console.error('Error deleting room:', error);
        showNotification('Error deleting room', 'error');
    });
}

// Utility Functions
function refreshData() {
    loadInitialData();
}

function closeConfirmModal() {
    document.getElementById('confirmModal').style.display = 'none';
}

function showLoading() {
    document.getElementById('loadingSpinner').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingSpinner').style.display = 'none';
}

function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">&times;</button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

function getCSRFToken() {
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

// Export functions for global access
window.openTeacherModal = openTeacherModal;
window.closeTeacherModal = closeTeacherModal;
window.fillTeacherName = fillTeacherName;
window.editTeacher = editTeacher;
window.saveTeacher = saveTeacher;
window.openRoomModal = openRoomModal;
window.closeRoomModal = closeRoomModal;
window.fillStudentId = fillStudentId;
window.editRoom = editRoom;
window.saveRoom = saveRoom;
window.confirmDeleteTeacher = confirmDeleteTeacher;
window.confirmDeleteRoom = confirmDeleteRoom;
window.deleteTeacher = deleteTeacher;
window.deleteRoom = deleteRoom;
window.closeConfirmModal = closeConfirmModal;
window.refreshData = refreshData;