document.addEventListener('DOMContentLoaded', function() {
    // Tab functionality
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            
            // Update active tab button
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Update active tab content
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
        });
    });
    
    // Certificate type toggle
    const certificateType = document.getElementById('certificate-type');
    const courseFields = document.getElementById('course-fields');
    const examFields = document.getElementById('exam-fields');
    
    certificateType.addEventListener('change', function() {
        if (this.value === 'course') {
            courseFields.style.display = 'block';
            examFields.style.display = 'none';
        } else if (this.value === 'exam') {
            courseFields.style.display = 'none';
            examFields.style.display = 'block';
        } else {
            courseFields.style.display = 'none';
            examFields.style.display = 'none';
        }
    });
    
    // Load users
    loadUsers();
    
    // Load courses when certificate type is set to course
    document.getElementById('certificate-type').addEventListener('change', function() {
        if (this.value === 'course') {
            loadCourses();
        } else if (this.value === 'exam') {
            loadExams();
        }
    });
    
    // Form submission for creating certificate
    const certificateForm = document.getElementById('certificate-form');
    certificateForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = new FormData(this);
        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
        
        fetch('/certificates/create/', {
            method: 'POST',
            body: formData,
            headers: {
                'X-CSRFToken': csrfToken
            }
        })
        .then(response => {
            if (response.redirected) {
                window.location.href = response.url;
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
    });
    
    // Search functionality
    const searchButton = document.getElementById('search-button');
    searchButton.addEventListener('click', searchCertificate);
    
    document.getElementById('search-certificate').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchCertificate();
        }
    });
    
    // Update certificate form
    const updateForm = document.getElementById('update-certificate-form');
    updateForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = new FormData(this);
        const certificateId = document.getElementById('update-certificate-id').value;
        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
        
        fetch(`/certificates/update/${certificateId}/`, {
            method: 'POST',
            body: formData,
            headers: {
                'X-CSRFToken': csrfToken
            }
        })
        .then(response => {
            if (response.redirected) {
                window.location.href = response.url;
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
    });
    
    // Delete certificate button
    const deleteButton = document.getElementById('delete-certificate');
    deleteButton.addEventListener('click', function() {
        const certificateId = document.getElementById('update-certificate-id').value;
        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
        
        if (confirm('Are you sure you want to delete this certificate? This action will be performed on all domains.')) {
            fetch(`/certificates/delete/${certificateId}/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrfToken,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `csrfmiddlewaretoken=${encodeURIComponent(csrfToken)}`
            })
            .then(response => {
                if (response.redirected) {
                    window.location.href = response.url;
                }
            })
            .catch(error => {
                console.error('Error:', error);
            });
        }
    });
});

/**
 * Loads users from all user profile domains and populates the user dropdown
 */
function loadUsers() {
    const userSelect = document.getElementById('user-id');
    const loadingIndicator = document.createElement('div');
    
    // Show loading state
    userSelect.innerHTML = '';
    loadingIndicator.textContent = 'Loading users...';
    loadingIndicator.className = 'loading-indicator';
    userSelect.parentNode.insertBefore(loadingIndicator, userSelect);
    userSelect.style.display = 'none';

    fetch('/certificates/users/')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server returned ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            // Remove loading indicator
            loadingIndicator.remove();
            userSelect.style.display = 'block';
            
            // Clear existing options
            userSelect.innerHTML = '<option value="">Select User</option>';
            
            // Validate response data
            if (!Array.isArray(data)) {
                throw new Error('Invalid data format: Expected array of users');
            }
            
            if (data.length === 0) {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'No users found';
                userSelect.appendChild(option);
                return;
            }
            
            // Populate dropdown with users
            data.forEach(user => {
                // Validate required fields
                if (!user.user_id || !user.username || !user.email) {
                    console.warn('Invalid user data:', user);
                    return;
                }
                
                const option = document.createElement('option');
                option.value = user.user_id;
                option.textContent = user.display_name || `${user.username} (${user.email})`;
                option.dataset.username = user.username;
                option.dataset.email = user.email;
                userSelect.appendChild(option);
            });
            
            // Enable course/exam loading when user selects a type
            document.getElementById('certificate-type').disabled = false;
        })
        .catch(error => {
            console.error('Error loading users:', error);
            
            // Update UI to show error state
            loadingIndicator.textContent = 'Failed to load users';
            loadingIndicator.className = 'error-indicator';
            
            const retryButton = document.createElement('button');
            retryButton.textContent = 'Retry';
            retryButton.className = 'retry-button';
            retryButton.addEventListener('click', () => {
                loadingIndicator.remove();
                loadUsers();
            });
            
            loadingIndicator.appendChild(document.createElement('br'));
            loadingIndicator.appendChild(retryButton);
        });
}

function loadCourses() {
    fetch('/certificates/courses/')
    .then(response => response.json())
    .then(data => {
        const courseSelect = document.getElementById('course-id');
        courseSelect.innerHTML = '<option value="">Select Course</option>';
        
        data.forEach(course => {
            const option = document.createElement('option');
            option.value = course.external_course_id;
            option.textContent = course.title;
            courseSelect.appendChild(option);
        });
    })
    .catch(error => {
        console.error('Error loading courses:', error);
    });
}

function loadExams() {
    fetch('/certificates/exams/')
    .then(response => response.json())
    .then(data => {
        const examSelect = document.getElementById('exam-id');
        examSelect.innerHTML = '<option value="">Select Exam</option>';
        
        data.forEach(exam => {
            const option = document.createElement('option');
            option.value = exam.external_id;
            option.textContent = exam.title;
            examSelect.appendChild(option);
        });
    })
    .catch(error => {
        console.error('Error loading exams:', error);
    });
}

function searchCertificate() {
    const searchValue = document.getElementById('search-certificate').value.trim();
    if (!searchValue) return;
    
    fetch(`/certificates/details/${searchValue}/`)
    .then(response => {
        if (!response.ok) {
            throw new Error('Certificate not found');
        }
        return response.json();
    })
    .then(data => {
        displayCertificateDetails(data);
    })
    .catch(error => {
        alert(error.message);
        console.error('Error:', error);
    });
}

function displayCertificateDetails(data) {
    const certificateDetails = document.getElementById('certificate-details');
    const certificateInfo = document.getElementById('certificate-info');
    
    certificateInfo.innerHTML = '';
    
    if (data.type === 'course') {
        // Display course certificate info
        const certificate = data.data;
        
        const infoItems = [
            { label: 'Certificate ID', value: certificate.certificate_id },
            { label: 'Type', value: 'Course Certificate' },
            { label: 'User ID', value: certificate.user_id },
            { label: 'Course ID', value: certificate.course_id },
            { label: 'Hours', value: certificate.hours },
            { label: 'Date', value: certificate.date },
            { label: 'Message', value: certificate.message || 'N/A' },
            { label: 'Created At', value: new Date(certificate.created_at).toLocaleString() }
        ];
        
        infoItems.forEach(item => {
            const div = document.createElement('div');
            div.className = 'certificate-info-item';
            
            const labelSpan = document.createElement('span');
            labelSpan.className = 'certificate-info-label';
            labelSpan.textContent = `${item.label}: `;
            
            const valueSpan = document.createElement('span');
            valueSpan.textContent = item.value;
            
            div.appendChild(labelSpan);
            div.appendChild(valueSpan);
            certificateInfo.appendChild(div);
        });
        
        // Set up update form for course certificate
        document.getElementById('update-certificate-id').value = certificate.certificate_id;
        document.getElementById('update-certificate-type').value = 'course';
        document.getElementById('update-hours').value = certificate.hours;
        document.getElementById('update-course-date').value = certificate.date;
        document.getElementById('update-message').value = certificate.message || '';
        
        // Show course fields and hide exam fields in update form
        document.getElementById('update-course-fields').style.display = 'block';
        document.getElementById('update-exam-fields').style.display = 'none';
        
    } else if (data.type === 'exam') {
        // Display exam certificate info
        const certificate = data.data;
        
        const infoItems = [
            { label: 'Certificate ID', value: certificate.certificate_id },
            { label: 'Type', value: 'Exam Certificate' },
            { label: 'User ID', value: certificate.user_id },
            { label: 'Exam ID', value: certificate.exam_id },
            { label: 'Taken Date', value: certificate.taken_date },
            { label: 'Expire Date', value: certificate.expire_date },
            { label: 'Message', value: certificate.message || 'N/A' },
            { label: 'Created At', value: new Date(certificate.created_at).toLocaleString() }
        ];
        
        infoItems.forEach(item => {
            const div = document.createElement('div');
            div.className = 'certificate-info-item';
            
            const labelSpan = document.createElement('span');
            labelSpan.className = 'certificate-info-label';
            labelSpan.textContent = `${item.label}: `;
            
            const valueSpan = document.createElement('span');
            valueSpan.textContent = item.value;
            
            div.appendChild(labelSpan);
            div.appendChild(valueSpan);
            certificateInfo.appendChild(div);
        });
        
        // Set up update form for exam certificate
        document.getElementById('update-certificate-id').value = certificate.certificate_id;
        document.getElementById('update-certificate-type').value = 'exam';
        document.getElementById('update-taken-date').value = certificate.taken_date;
        document.getElementById('update-expire-date').value = certificate.expire_date;
        document.getElementById('update-message').value = certificate.message || '';
        
        // Show exam fields and hide course fields in update form
        document.getElementById('update-course-fields').style.display = 'none';
        document.getElementById('update-exam-fields').style.display = 'block';
    }
    
    certificateDetails.style.display = 'block';
}