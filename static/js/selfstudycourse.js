class CourseManager {
    constructor() {
        this.currentData = {
            courses: [],
            lessons: [],
            comments: [],
            homeworks: [],
            submissions: [],
            registrations: [],
            users: [],
            coursesList: []
        };
        this.currentTab = 'courses';
        this.deleteCallback = null;
        this.isLoading = false; // Track loading state
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadInitialData();
    }

    bindEvents() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Global search with debouncing
        let searchTimeout;
        document.getElementById('globalSearch').addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.handleGlobalSearch(e.target.value);
            }, 300);
        });

        // Form submission
        document.getElementById('entityForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmit();
        });

        // Modal close on outside click
        document.getElementById('createModal').addEventListener('click', (e) => {
            if (e.target.id === 'createModal') {
                this.closeModal();
            }
        });

        document.getElementById('deleteModal').addEventListener('click', (e) => {
            if (e.target.id === 'deleteModal') {
                this.closeDeleteModal();
            }
        });
    }

    switchTab(tabName) {
        // Update active tab button
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update active content section
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(`${tabName}-section`).classList.add('active');

        this.currentTab = tabName;
        
        // Load data if not already loaded
        if (this.currentData[tabName].length === 0) {
            this.loadTabData(tabName);
        }
    }

    async loadInitialData() {
        this.showLoading();
        try {
            // Load users and courses first for dropdowns
            await Promise.all([
                this.loadUsers(),
                this.loadCoursesList()
            ]);
            
            await this.loadTabData('courses');
            this.hideLoading();
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.hideLoading();
            this.showError('Failed to load initial data');
        }
    }

    async loadUsers() {
        try {
            const response = await fetch('/selfstudycourse/api/?action=get_users');
            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            this.currentData.users = Array.isArray(data) ? data : [];
        } catch (error) {
            console.error('Error loading users:', error);
            this.currentData.users = [];
        }
    }

    async loadCoursesList() {
        try {
            const response = await fetch('/selfstudycourse/api/?action=get_courses');
            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            this.currentData.coursesList = Array.isArray(data) ? data : [];
        } catch (error) {
            console.error('Error loading courses list:', error);
            this.currentData.coursesList = [];
        }
    }

    async loadTabData(tabName) {
        const endpoints = {
            courses: '/selfstudycourse/api/?action=get_courses',
            lessons: '/selfstudycourse/api/?action=get_lessons',
            comments: '/selfstudycourse/api/?action=get_comments',
            homeworks: '/selfstudycourse/api/?action=get_homeworks',
            submissions: '/selfstudycourse/api/?action=get_submitted_homeworks',
            registrations: '/selfstudycourse/api/?action=get_registrations'
        };

        try {
            const response = await fetch(endpoints[tabName]);
            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            this.currentData[tabName] = Array.isArray(data) ? data : [];
            this.renderTable(tabName, this.currentData[tabName]);
        } catch (error) {
            console.error(`Error loading ${tabName}:`, error);
            this.showError(`Failed to load ${tabName}`);
        }
    }

    renderTable(tabName, data) {
        const tbody = document.getElementById(`${tabName}-tbody`);
        if (!tbody) return;

        if (data.length === 0) {
            const colSpan = this.getColumnCount(tabName);
            tbody.innerHTML = `
                <tr>
                    <td colspan="${colSpan}" class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <h4>No data found</h4>
                        <p>No ${tabName} available</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = data.map(item => this.renderTableRow(tabName, item)).join('');
    }

    getColumnCount(tabName) {
        const counts = {
            courses: 5,
            lessons: 6,
            comments: 5,
            homeworks: 6,
            submissions: 6,
            registrations: 4
        };
        return counts[tabName] || 4;
    }

    renderTableRow(tabName, item) {
        const renderers = {
            courses: this.renderCourseRow.bind(this),
            lessons: this.renderLessonRow.bind(this),
            comments: this.renderCommentRow.bind(this),
            homeworks: this.renderHomeworkRow.bind(this),
            submissions: this.renderSubmissionRow.bind(this),
            registrations: this.renderRegistrationRow.bind(this)
        };

        return renderers[tabName](item);
    }

    renderCourseRow(course) {
        const firstChar = course.title ? course.title.charAt(0).toUpperCase() : '?';
        
        return `
            <tr>
                <td>
                    <div class="course-image-container">
                        ${course.image_url ? 
                            `<img src="${course.image_url}" alt="${course.title}" class="course-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" onload="this.nextElementSibling.style.display='none';">` : 
                            ''
                        }
                        <div class="course-image-fallback" style="${course.image_url ? 'display: none;' : ''}">
                            ${firstChar}
                        </div>
                    </div>
                </td>
                <td class="text-truncate" title="${course.title}">${course.title}</td>
                <td class="text-truncate" title="${course.description}">${course.description}</td>
                <td>${new Date(course.date_added).toLocaleDateString()}</td>
                <td>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-warning" onclick="courseManager.showEditModal('course', '${course.external_course_id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="courseManager.showDeleteModal('course', '${course.external_course_id}', '${this.escapeString(course.title)}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    renderLessonRow(lesson) {
        const courseTitle = this.getCourseTitle(lesson.course_external_id);
        return `
            <tr>
                <td class="text-truncate" title="${lesson.title}">${lesson.title}</td>
                <td class="text-truncate" title="${courseTitle}">${courseTitle}</td>
                <td class="text-truncate">
                    ${lesson.source_code_url ? 
                        `<a href="${lesson.source_code_url}" target="_blank">View Source</a>` : 
                        'N/A'
                    }
                </td>
                <td class="text-truncate">
                    ${lesson.reading_url ? 
                        `<a href="${lesson.reading_url}" target="_blank">View Reading</a>` : 
                        'N/A'
                    }
                </td>
                <td>${new Date(lesson.date_added).toLocaleDateString()}</td>
                <td>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-warning" onclick="courseManager.showEditModal('lesson', '${lesson.external_lesson_id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="courseManager.showDeleteModal('lesson', '${lesson.external_lesson_id}', '${this.escapeString(lesson.title)}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    renderCommentRow(comment) {
        const courseTitle = this.getCourseTitle(comment.course_external_id);
        const userName = this.getUserName(comment.user_id);
        return `
            <tr>
                <td class="text-truncate" title="${comment.content}">${comment.content}</td>
                <td title="${userName}">${userName}</td>
                <td class="text-truncate" title="${courseTitle}">${courseTitle}</td>
                <td>${new Date(comment.date_added).toLocaleDateString()}</td>
                <td>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-warning" onclick="courseManager.showEditModal('comment', '${comment.external_comment_id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="courseManager.showDeleteModal('comment', '${comment.external_comment_id}', '${this.escapeString(comment.content.substring(0, 30))}...')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    renderHomeworkRow(homework) {
        const courseTitle = this.getCourseTitle(homework.course_external_id);
        const lessonTitle = homework.lesson_external_id ? this.getLessonTitle(homework.lesson_external_id) : 'N/A';
        return `
            <tr>
                <td class="text-truncate" title="${homework.title}">${homework.title}</td>
                <td class="text-truncate" title="${courseTitle}">${courseTitle}</td>
                <td class="text-truncate" title="${lessonTitle}">${lessonTitle}</td>
                <td class="text-truncate">
                    <a href="${homework.homework_url}" target="_blank">View Homework</a>
                </td>
                <td class="text-truncate" title="${homework.description}">${homework.description}</td>
                <td>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-warning" onclick="courseManager.showEditModal('homework', '${homework.external_homework_id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="courseManager.showDeleteModal('homework', '${homework.external_homework_id}', '${this.escapeString(homework.title)}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    renderSubmissionRow(submission) {
        const userName = this.getUserName(submission.user_id);
        const homeworkTitle = this.getHomeworkTitle(submission.homework_external_id);
        return `
            <tr>
                <td title="${userName}">${userName}</td>
                <td class="text-truncate" title="${homeworkTitle}">${homeworkTitle}</td>
                <td class="text-truncate">
                    <a href="${submission.submitted_homework_url}" target="_blank">View Submission</a>
                </td>
                <td class="text-truncate" title="${submission.description || 'N/A'}">${submission.description || 'N/A'}</td>
                <td>${new Date(submission.date_submitted).toLocaleDateString()}</td>
                <td>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-warning" onclick="courseManager.showEditModal('submitted_homework', '${submission.external_submitted_homework_id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="courseManager.showDeleteModal('submitted_homework', '${submission.external_submitted_homework_id}', 'Submission by ${this.escapeString(userName)}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    renderRegistrationRow(registration) {
        const userName = this.getUserName(registration.user_id);
        const courseTitle = this.getCourseTitle(registration.course_external_id);
        return `
            <tr>
                <td title="${userName}">${userName}</td>
                <td class="text-truncate" title="${courseTitle}">${courseTitle}</td>
                <td>${new Date(registration.date_registered).toLocaleDateString()}</td>
                <td>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-danger" onclick="courseManager.showDeleteModal('registration', '${registration.external_id}', 'Registration for ${this.escapeString(userName)}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    // Helper methods for display names
    getCourseTitle(courseExternalId) {
        const course = this.currentData.coursesList.find(c => c.external_course_id === courseExternalId);
        return course ? course.title : courseExternalId;
    }

    getUserName(userId) {
        const user = this.currentData.users.find(u => u.user_id === userId);
        return user ? `${user.username} (${user.user_id})` : userId;
    }

    getLessonTitle(lessonExternalId) {
        const lesson = this.currentData.lessons.find(l => l.external_lesson_id === lessonExternalId);
        return lesson ? lesson.title : lessonExternalId;
    }

    getHomeworkTitle(homeworkExternalId) {
        const homework = this.currentData.homeworks.find(h => h.external_homework_id === homeworkExternalId);
        return homework ? homework.title : homeworkExternalId;
    }

    escapeString(str) {
        return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
    }

    handleGlobalSearch(query) {
        if (!query.trim()) {
            // Reset to original data if search is empty
            Object.keys(this.currentData).forEach(tab => {
                if (['courses', 'lessons', 'comments', 'homeworks', 'submissions', 'registrations'].includes(tab)) {
                    this.renderTable(tab, this.currentData[tab]);
                }
            });
            return;
        }

        const searchTerm = query.toLowerCase();
        
        Object.keys(this.currentData).forEach(tab => {
            if (['courses', 'lessons', 'comments', 'homeworks', 'submissions', 'registrations'].includes(tab)) {
                const filteredData = this.currentData[tab].filter(item => 
                    this.searchInItem(item, searchTerm)
                );
                this.renderTable(tab, filteredData);
            }
        });
    }

    searchInItem(item, searchTerm) {
        // Search in all string properties
        for (let key in item) {
            if (typeof item[key] === 'string' && item[key].toLowerCase().includes(searchTerm)) {
                return true;
            }
        }
        
        // Also search in related display names
        if (item.course_external_id) {
            const courseTitle = this.getCourseTitle(item.course_external_id);
            if (courseTitle.toLowerCase().includes(searchTerm)) return true;
        }
        
        if (item.user_id) {
            const userName = this.getUserName(item.user_id);
            if (userName.toLowerCase().includes(searchTerm)) return true;
        }
        
        return false;
    }

    showCreateModal(entityType) {
        this.currentEntity = { type: entityType, id: null };
        document.getElementById('modalTitle').textContent = `Create New ${this.formatEntityName(entityType)}`;
        document.getElementById('submitBtn').textContent = 'Create';
        this.renderFormFields(entityType);
        this.showModal();
    }

    async showEditModal(entityType, entityId) {
        try {
            this.showLoading();
            const entity = await this.fetchEntity(entityType, entityId);
            this.currentEntity = { type: entityType, id: entityId, data: entity };
            
            document.getElementById('modalTitle').textContent = `Edit ${this.formatEntityName(entityType)}`;
            document.getElementById('submitBtn').textContent = 'Update';
            this.renderFormFields(entityType, entity);
            this.showModal();
        } catch (error) {
            console.error('Error loading entity for edit:', error);
            this.showError('Failed to load entity for editing');
        } finally {
            this.hideLoading();
        }
    }

    async fetchEntity(entityType, entityId) {
        const endpoints = {
            course: `/selfstudycourse/api/?action=get_course&course_id=${entityId}`,
            lesson: `/selfstudycourse/api/?action=get_lessons`,
            comment: `/selfstudycourse/api/?action=get_comments`,
            homework: `/selfstudycourse/api/?action=get_homeworks`,
            submitted_homework: `/selfstudycourse/api/?action=get_submitted_homeworks`,
            registration: `/selfstudycourse/api/?action=get_registrations`
        };

        const response = await fetch(endpoints[entityType]);
        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        // For endpoints that return arrays, find the specific entity
        if (Array.isArray(data)) {
            return data.find(item => {
                const idField = this.getIdField(entityType);
                return item[idField] === entityId;
            });
        }

        return data;
    }

    getIdField(entityType) {
        const idFields = {
            course: 'external_course_id',
            lesson: 'external_lesson_id',
            comment: 'external_comment_id',
            homework: 'external_homework_id',
            submitted_homework: 'external_submitted_homework_id',
            registration: 'external_id'
        };
        return idFields[entityType];
    }

    renderFormFields(entityType, data = null) {
        const formFields = document.getElementById('formFields');
        const fieldsConfig = this.getFormFieldsConfig(entityType, data);
        
        formFields.innerHTML = fieldsConfig.map(field => {
            const value = data ? this.getFieldValue(field, data) : '';
            const required = field.required ? 'required' : '';
            
            if (field.type === 'textarea') {
                return `
                    <div class="form-group">
                        <label for="${field.name}">${field.label}</label>
                        <textarea id="${field.name}" name="${field.name}" class="form-control textarea" ${required}>${value}</textarea>
                    </div>
                `;
            } else if (field.type === 'file') {
                return `
                    <div class="form-group">
                        <label for="${field.name}">${field.label}</label>
                        <div class="file-input-wrapper">
                            <input type="file" id="${field.name}" name="${field.name}" class="file-input" accept="image/*" ${data ? '' : required}>
                        </div>
                    </div>
                `;
            } else if (field.type === 'select') {
                const options = field.options.map(option => {
                    const selected = this.isOptionSelected(field, option, data);
                    return `<option value="${option[field.valueField]}" ${selected}>${option[field.displayField]}</option>`;
                }).join('');
                
                return `
                    <div class="form-group">
                        <label for="${field.name}">${field.label}</label>
                        <select id="${field.name}" name="${field.name}" class="form-control" ${required}>
                            <option value="">Select ${field.label}</option>
                            ${options}
                        </select>
                    </div>
                `;
            } else {
                return `
                    <div class="form-group">
                        <label for="${field.name}">${field.label}</label>
                        <input type="${field.type}" id="${field.name}" name="${field.name}" class="form-control" value="${value}" ${required}>
                    </div>
                `;
            }
        }).join('');
    }

    getFieldValue(field, data) {
        if (field.type === 'select') {
            // For select fields, get the external_id value
            if (field.name === 'course_external_id' && data.course_external_id) {
                return data.course_external_id;
            }
            if (field.name === 'lesson_external_id' && data.lesson_external_id) {
                return data.lesson_external_id;
            }
            if (field.name === 'homework_external_id' && data.homework_external_id) {
                return data.homework_external_id;
            }
            if (field.name === 'user_id' && data.user_id) {
                return data.user_id;
            }
            return '';
        }
        return data[field.name] || '';
    }

    isOptionSelected(field, option, data) {
        if (!data) return '';
        
        if (field.name === 'course_external_id' && data.course_external_id === option.external_course_id) {
            return 'selected';
        }
        if (field.name === 'lesson_external_id' && data.lesson_external_id === option.external_lesson_id) {
            return 'selected';
        }
        if (field.name === 'homework_external_id' && data.homework_external_id === option.external_homework_id) {
            return 'selected';
        }
        if (field.name === 'user_id' && data.user_id === option.user_id) {
            return 'selected';
        }
        return '';
    }

    getFormFieldsConfig(entityType, data = null) {
        const userOptions = this.currentData.users.map(user => ({
            user_id: user.user_id,
            username: `${user.username} (${user.email})`
        }));

        const courseOptions = this.currentData.coursesList.map(course => ({
            external_course_id: course.external_course_id,
            title: course.title
        }));

        const lessonOptions = this.currentData.lessons.map(lesson => ({
            external_lesson_id: lesson.external_lesson_id,
            title: `${lesson.title} (${this.getCourseTitle(lesson.course_external_id)})`
        }));

        const homeworkOptions = this.currentData.homeworks.map(homework => ({
            external_homework_id: homework.external_homework_id,
            title: `${homework.title} (${this.getCourseTitle(homework.course_external_id)})`
        }));

        const configs = {
            course: [
                { name: 'title', label: 'Title', type: 'text', required: true },
                { name: 'description', label: 'Description', type: 'textarea', required: true },
                { name: 'image', label: 'Course Image', type: 'file', required: false }
            ],
            lesson: [
                { name: 'title', label: 'Title', type: 'text', required: true },
                { 
                    name: 'course_external_id', 
                    label: 'Course', 
                    type: 'select', 
                    required: true,
                    options: courseOptions,
                    valueField: 'external_course_id',
                    displayField: 'title'
                },
                { name: 'source_code_url', label: 'Source Code URL', type: 'url', required: false },
                { name: 'reading_url', label: 'Reading URL', type: 'url', required: false }
            ],
            comment: [
                { name: 'content', label: 'Content', type: 'textarea', required: true },
                { 
                    name: 'user_id', 
                    label: 'User', 
                    type: 'select', 
                    required: true,
                    options: userOptions,
                    valueField: 'user_id',
                    displayField: 'username'
                },
                { 
                    name: 'course_external_id', 
                    label: 'Course', 
                    type: 'select', 
                    required: true,
                    options: courseOptions,
                    valueField: 'external_course_id',
                    displayField: 'title'
                }
            ],
            homework: [
                { name: 'title', label: 'Title', type: 'text', required: true },
                { name: 'homework_url', label: 'Homework URL', type: 'url', required: true },
                { 
                    name: 'course_external_id', 
                    label: 'Course', 
                    type: 'select', 
                    required: true,
                    options: courseOptions,
                    valueField: 'external_course_id',
                    displayField: 'title'
                },
                { 
                    name: 'lesson_external_id', 
                    label: 'Lesson', 
                    type: 'select', 
                    required: false,
                    options: lessonOptions,
                    valueField: 'external_lesson_id',
                    displayField: 'title'
                },
                { name: 'description', label: 'Description', type: 'textarea', required: false }
            ],
            submitted_homework: [
                { 
                    name: 'user_id', 
                    label: 'User', 
                    type: 'select', 
                    required: true,
                    options: userOptions,
                    valueField: 'user_id',
                    displayField: 'username'
                },
                { 
                    name: 'homework_external_id', 
                    label: 'Homework', 
                    type: 'select', 
                    required: true,
                    options: homeworkOptions,
                    valueField: 'external_homework_id',
                    displayField: 'title'
                },
                { name: 'submitted_homework_url', label: 'Submission URL', type: 'url', required: true },
                { name: 'description', label: 'Description', type: 'textarea', required: false }
            ],
            registration: [
                { 
                    name: 'user_id', 
                    label: 'User', 
                    type: 'select', 
                    required: true,
                    options: userOptions,
                    valueField: 'user_id',
                    displayField: 'username'
                },
                { 
                    name: 'course_external_id', 
                    label: 'Course', 
                    type: 'select', 
                    required: true,
                    options: courseOptions,
                    valueField: 'external_course_id',
                    displayField: 'title'
                }
            ]
        };
        return configs[entityType] || [];
    }

    async handleFormSubmit() {
        const form = document.getElementById('entityForm');
        const formData = new FormData(form);
        
        const action = this.currentEntity.id ? 'update' : 'create';
        const entityType = this.currentEntity.type;
        
        formData.append('action', this.getActionName(entityType, action));
        
        if (this.currentEntity.id) {
            const idField = this.getIdField(entityType);
            formData.append(`${entityType}_id`, this.currentEntity.id);
        }

        try {
            this.showLoading();
            const response = await fetch('/selfstudycourse/api/', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.error) {
                throw new Error(result.error);
            }

            this.showSuccess(`${this.formatEntityName(entityType)} ${action === 'create' ? 'created' : 'updated'} successfully`);
            this.closeModal();
            
            // Refresh the appropriate data based on entity type
            if (entityType === 'course') {
                // When a course is created, refresh both courses list and courses data
                await Promise.all([
                    this.loadCoursesList(),
                    this.loadTabData('courses')
                ]);
            } else {
                // For other entities (like lessons), always refresh the courses list
                // to ensure dropdowns have the latest courses
                await Promise.all([
                    this.loadCoursesList(),
                    this.loadTabData(this.currentTab)
                ]);
            }
            
        } catch (error) {
            console.error('Error submitting form:', error);
            this.showError(`Failed to ${action} ${entityType}: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    getActionName(entityType, action) {
        const actionMap = {
            course: { create: 'create_course', update: 'update_course' },
            lesson: { create: 'create_lesson', update: 'update_lesson' },
            comment: { create: 'create_comment', update: 'update_comment' },
            homework: { create: 'create_homework', update: 'update_homework' },
            submitted_homework: { create: 'create_submitted_homework', update: 'update_submitted_homework' },
            registration: { create: 'create_registration', update: '' }
        };
        return actionMap[entityType][action];
    }

    showDeleteModal(entityType, entityId, entityName) {
        this.deleteCallback = () => this.performDelete(entityType, entityId);
        
        const modal = document.getElementById('deleteModal');
        const message = modal.querySelector('p');
        message.textContent = `Are you sure you want to delete "${entityName}"? This action cannot be undone.`;
        
        modal.style.display = 'block';
    }

    async performDelete(entityType, entityId) {
        try {
            this.showLoading();
            const response = await fetch('/selfstudycourse/api/', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: `delete_${entityType}`,
                    [`${entityType}_id`]: entityId
                })
            });

            const result = await response.json();

            if (result.error) {
                throw new Error(result.error);
            }

            this.showSuccess(`${this.formatEntityName(entityType)} deleted successfully`);
            
            // Wait for data refresh to complete before hiding spinner
            await this.loadTabData(this.currentTab);
            
            this.closeDeleteModal();
        } catch (error) {
            console.error('Error deleting entity:', error);
            this.showError(`Failed to delete ${entityType}: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    refreshCurrentTab() {
        return this.loadTabData(this.currentTab);
    }

    async refreshAllData() {
        this.showLoading();
        try {
            // Wait for ALL data loading operations to complete
            await Promise.all([
                this.loadUsers(),
                this.loadCoursesList(),
                this.loadTabData('courses'),
                this.loadTabData('lessons'),
                this.loadTabData('comments'),
                this.loadTabData('homeworks'),
                this.loadTabData('submissions'),
                this.loadTabData('registrations')
            ]);
            this.showSuccess('All data refreshed successfully');
        } catch (error) {
            console.error('Error refreshing data:', error);
            this.showError('Failed to refresh data');
        } finally {
            this.hideLoading();
        }
    }

    formatEntityName(entityType) {
        const names = {
            course: 'Course',
            lesson: 'Lesson',
            comment: 'Comment',
            homework: 'Homework',
            submitted_homework: 'Submitted Homework',
            registration: 'Registration'
        };
        return names[entityType] || entityType;
    }

    showModal() {
        document.getElementById('createModal').style.display = 'block';
    }

    closeModal() {
        document.getElementById('createModal').style.display = 'none';
        document.getElementById('entityForm').reset();
    }

    closeDeleteModal() {
        document.getElementById('deleteModal').style.display = 'none';
        this.deleteCallback = null;
    }

    showLoading() {
        if (this.isLoading) return; // Prevent multiple loading states
        this.isLoading = true;
        document.getElementById('loadingSpinner').style.display = 'flex';
        // Disable all buttons and form elements during loading
        this.disableUI(true);
    }

    hideLoading() {
        this.isLoading = false;
        document.getElementById('loadingSpinner').style.display = 'none';
        // Re-enable all buttons and form elements
        this.disableUI(false);
    }

    disableUI(disabled) {
        const buttons = document.querySelectorAll('button');
        const inputs = document.querySelectorAll('input, select, textarea');
        const elements = [...buttons, ...inputs];
        
        elements.forEach(element => {
            if (disabled) {
                element.setAttribute('disabled', 'disabled');
                element.style.opacity = '0.6';
                element.style.cursor = 'not-allowed';
            } else {
                element.removeAttribute('disabled');
                element.style.opacity = '';
                element.style.cursor = '';
            }
        });
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check' : 'exclamation'}-circle"></i>
                <span>${message}</span>
            </div>
        `;

        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#28a745' : '#dc3545'};
            color: white;
            padding: 16px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            animation: slideInRight 0.3s ease;
        `;

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Global functions for HTML onclick handlers
function showCreateModal(entityType) {
    courseManager.showCreateModal(entityType);
}

function closeModal() {
    courseManager.closeModal();
}

function closeDeleteModal() {
    courseManager.closeDeleteModal();
}

function refreshAllData() {
    courseManager.refreshAllData();
}

// Initialize course manager when DOM is loaded
let courseManager;
document.addEventListener('DOMContentLoaded', function() {
    courseManager = new CourseManager();
});

// Handle delete confirmation
document.getElementById('confirmDeleteBtn').addEventListener('click', function() {
    if (courseManager.deleteCallback) {
        courseManager.deleteCallback();
    }
});

// Add CSS for notifications
const notificationStyles = `
@keyframes slideInRight {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

@keyframes slideOutRight {
    from {
        transform: translateX(0);
        opacity: 1;
    }
    to {
        transform: translateX(100%);
        opacity: 0;
    }
}

.notification-content {
    display: flex;
    align-items: center;
    gap: 8px;
}

/* Loading spinner improvements */
#loadingSpinner {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: none;
    justify-content: center;
    align-items: center;
    z-index: 9999;
}

.spinner {
    border: 4px solid #f3f3f3;
    border-top: 4px solid #3498db;
    border-radius: 50%;
    width: 50px;
    height: 50px;
    animation: spin 2s linear infinite;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = notificationStyles;
document.head.appendChild(styleSheet);