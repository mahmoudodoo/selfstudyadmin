class CertificateManager {
    constructor() {
        this.currentTab = 'course';
        this.pageSize = 9;
        this.currentPage = {
            course: 1,
            exam: 1
        };
        this.searchQuery = '';

        this.courseCertificates = [];
        this.examCertificates = [];
        this.users = [];
        this.courses = [];
        this.exams = [];
        this.currentDeleteAction = null;

        this.apiBase = '/selfstudycertificate/api';

        this.init();
    }

    init() {
        this.bindEvents();
        this.loadInitialData();
        this.updateStats();
    }

    bindEvents() {
        document.getElementById('course-certificate-form').addEventListener('submit', (e) => this.handleCourseCertificateSubmit(e));
        document.getElementById('exam-certificate-form').addEventListener('submit', (e) => this.handleExamCertificateSubmit(e));

        // Auto-populate on user/course/exam selection
        document.getElementById('course-user-id').addEventListener('change', () => this.updateCourseUserPreview());
        document.getElementById('course-course-id').addEventListener('change', () => this.updateCourseCoursePreview());
        document.getElementById('exam-user-id').addEventListener('change', () => this.updateExamUserPreview());
        document.getElementById('exam-exam-id').addEventListener('change', () => this.updateExamExamPreview());

        let searchTimeout;
        const searchInput = document.getElementById('globalSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.handleGlobalSearch(e.target.value);
                }, 300);
            });
        }

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target.id);
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
    }

    async loadInitialData() {
        this.showLoading();

        try {
            await this.loadUsers();
            await this.loadCourses();
            await this.loadExams();
            await this.loadCourseCertificates();
            await this.loadExamCertificates();

            this.currentPage = { course: 1, exam: 1 };
            this.searchQuery = '';
            const searchInput = document.getElementById('globalSearch');
            if (searchInput) searchInput.value = '';

            this.renderTables();
            this.updateStats();
            this.showToast('Data loaded successfully', 'success');
        } catch (error) {
            console.error('Failed to load initial data:', error);
            this.showToast('Failed to load initial data. Using demo data.', 'warning');
            this.renderTables();
            this.updateStats();
        } finally {
            this.hideLoading();
        }
    }

    async loadCourseCertificates() {
        try {
            const response = await this.makeRequest('GET', `${this.apiBase}/certificates/course/`);
            this.courseCertificates = response.data || [];
        } catch (error) {
            console.error('Failed to load course certificates:', error);
            this.courseCertificates = [];
        }
    }

    async loadExamCertificates() {
        try {
            const response = await this.makeRequest('GET', `${this.apiBase}/certificates/exam/`);
            this.examCertificates = response.data || [];
        } catch (error) {
            console.error('Failed to load exam certificates:', error);
            this.examCertificates = [];
        }
    }

    async loadUsers() {
        try {
            const response = await this.makeRequest('GET', `${this.apiBase}/lookup/users/`);
            this.users = response.data || [];
            this.populateUserSelects();
        } catch (error) {
            console.error('Failed to load users:', error);
            this.users = [];
        }
    }

    async loadCourses() {
        try {
            const response = await this.makeRequest('GET', `${this.apiBase}/lookup/courses/`);
            this.courses = response.data || [];
            this.populateCourseSelect();
        } catch (error) {
            console.error('Failed to load courses:', error);
            this.courses = [];
        }
    }

    async loadExams() {
        try {
            const response = await this.makeRequest('GET', `${this.apiBase}/lookup/exams/`);
            this.exams = response.data || [];
            this.populateExamSelect();
        } catch (error) {
            console.error('Failed to load exams:', error);
            this.exams = [];
        }
    }

    // ========== USER / COURSE / EXAM HELPERS ==========
    findUserById(userId) {
        return this.users.find(u => {
            const id = u.external_id || u.user_id || u.id;
            return id === userId;
        });
    }

    findCourseById(courseId) {
        return this.courses.find(c => {
            const id = c.external_course_id || c.external_id || c.course_id || c.id;
            return String(id) === String(courseId);
        });
    }

    findExamById(examId) {
        return this.exams.find(e => {
            const id = e.external_id || e.exam_id || e.id;
            return String(id) === String(examId);
        });
    }

    getUserFullName(user) {
        if (!user) return '';
        const first = (user.first_name || '').trim();
        const last = (user.last_name || '').trim();
        const fullName = `${first} ${last}`.trim();
        return fullName || user.username || '';
    }

    getUserImageUrl(user) {
        if (!user) return '';
        return user.image_url || '';
    }

    getCourseName(course) {
        if (!course) return '';
        return course.title || '';
    }

    getExamName(exam) {
        if (!exam) return '';
        return exam.title || '';
    }

    // ========== AUTO-POPULATE PREVIEW FIELDS ==========
    updateCourseUserPreview() {
        const userSelect = document.getElementById('course-user-id');
        const user = this.findUserById(userSelect.value);

        document.getElementById('course-user-full-name').value = this.getUserFullName(user);
        document.getElementById('course-user-image-url').value = this.getUserImageUrl(user);

        const preview = document.getElementById('course-user-preview');
        if (preview) {
            if (user) {
                const imageUrl = this.getUserImageUrl(user);
                preview.innerHTML = `
                <div class="preview-card">
                ${imageUrl ? `<img src="${imageUrl}" alt="User" class="preview-image">` : '<div class="preview-placeholder">👤</div>'}
                <div class="preview-info">
                <strong>${this.getUserFullName(user)}</strong>
                <small>${user.email || user.username || ''}</small>
                </div>
                </div>
                `;
                preview.style.display = 'block';
            } else {
                preview.innerHTML = '';
                preview.style.display = 'none';
            }
        }
    }

    updateCourseCoursePreview() {
        const courseSelect = document.getElementById('course-course-id');
        const course = this.findCourseById(courseSelect.value);

        document.getElementById('course-course-name').value = this.getCourseName(course);

        const preview = document.getElementById('course-course-preview');
        if (preview) {
            if (course) {
                preview.innerHTML = `<div class="preview-info"><strong>${this.getCourseName(course)}</strong></div>`;
                preview.style.display = 'block';
            } else {
                preview.innerHTML = '';
                preview.style.display = 'none';
            }
        }
    }

    updateExamUserPreview() {
        const userSelect = document.getElementById('exam-user-id');
        const user = this.findUserById(userSelect.value);

        document.getElementById('exam-user-full-name').value = this.getUserFullName(user);
        document.getElementById('exam-user-image-url').value = this.getUserImageUrl(user);

        const preview = document.getElementById('exam-user-preview');
        if (preview) {
            if (user) {
                const imageUrl = this.getUserImageUrl(user);
                preview.innerHTML = `
                <div class="preview-card">
                ${imageUrl ? `<img src="${imageUrl}" alt="User" class="preview-image">` : '<div class="preview-placeholder">👤</div>'}
                <div class="preview-info">
                <strong>${this.getUserFullName(user)}</strong>
                <small>${user.email || user.username || ''}</small>
                </div>
                </div>
                `;
                preview.style.display = 'block';
            } else {
                preview.innerHTML = '';
                preview.style.display = 'none';
            }
        }
    }

    updateExamExamPreview() {
        const examSelect = document.getElementById('exam-exam-id');
        const exam = this.findExamById(examSelect.value);

        document.getElementById('exam-exam-name').value = this.getExamName(exam);

        // Try to auto-fill course_name from exam.course_id if present
        if (exam && exam.course_id) {
            const course = this.findCourseById(exam.course_id);
            if (course) {
                document.getElementById('exam-course-name').value = this.getCourseName(course);
            }
        }

        const preview = document.getElementById('exam-exam-preview');
        if (preview) {
            if (exam) {
                preview.innerHTML = `<div class="preview-info"><strong>${this.getExamName(exam)}</strong></div>`;
                preview.style.display = 'block';
            } else {
                preview.innerHTML = '';
                preview.style.display = 'none';
            }
        }
    }

    populateUserSelects() {
        const courseSelect = document.getElementById('course-user-id');
        const examSelect = document.getElementById('exam-user-id');

        this.clearSelect(courseSelect);
        this.clearSelect(examSelect);

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select User';
        courseSelect.appendChild(defaultOption.cloneNode(true));
        examSelect.appendChild(defaultOption);

        this.users.forEach(user => {
            const option = document.createElement('option');
            const userId = user.external_id || user.user_id || user.id;
            option.value = userId;
            const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || user.email || 'Unknown User';
            option.textContent = `${displayName} (${userId})`;
            courseSelect.appendChild(option.cloneNode(true));
            examSelect.appendChild(option);
        });
    }

    populateCourseSelect() {
        const select = document.getElementById('course-course-id');
        this.clearSelect(select);

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select Course';
        select.appendChild(defaultOption);

        this.courses.forEach(course => {
            const option = document.createElement('option');
            const courseExternalId = course.external_course_id || course.external_id || course.course_id || course.id;
            option.value = courseExternalId;
            option.textContent = course.title || 'Untitled Course';
            select.appendChild(option);
        });
    }

    populateExamSelect() {
        const select = document.getElementById('exam-exam-id');
        this.clearSelect(select);

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select Exam';
        select.appendChild(defaultOption);

        this.exams.forEach(exam => {
            const option = document.createElement('option');
            const examExternalId = exam.external_id || exam.exam_id || exam.id;
            option.value = examExternalId;
            option.textContent = exam.title || 'Untitled Exam';
            select.appendChild(option);
        });
    }

    clearSelect(select) {
        select.innerHTML = '';
    }

    // ========== SEARCH AND FILTERING ==========
    handleGlobalSearch(query) {
        this.searchQuery = query.trim().toLowerCase();
        this.currentPage.course = 1;
        this.currentPage.exam = 1;
        this.renderCourseCertificatesTable();
        this.renderExamCertificatesTable();
    }

    filterDataBySearch(dataArray, type) {
        if (!this.searchQuery) return dataArray;

        const term = this.searchQuery.toLowerCase();
        return dataArray.filter(item => {
            if (item.certificate_id && item.certificate_id.toLowerCase().includes(term)) return true;

            if (item.user_full_name && item.user_full_name.toLowerCase().includes(term)) return true;

            const user = this.findUserById(item.user_id);
            if (user) {
                const userName = this.getUserFullName(user);
                if (userName.toLowerCase().includes(term)) return true;
            }

            if (type === 'course') {
                if (item.course_name && item.course_name.toLowerCase().includes(term)) return true;
                const course = this.findCourseById(item.course_id);
                if (course && course.title && course.title.toLowerCase().includes(term)) return true;
            } else {
                if (item.exam_name && item.exam_name.toLowerCase().includes(term)) return true;
                const exam = this.findExamById(item.exam_id);
                if (exam && exam.title && exam.title.toLowerCase().includes(term)) return true;
            }

            if (item.message && item.message.toLowerCase().includes(term)) return true;

            if (type === 'course') {
                if (item.date && item.date.includes(term)) return true;
            } else {
                if (item.taken_date && item.taken_date.includes(term)) return true;
                if (item.expire_date && item.expire_date.includes(term)) return true;
            }

            return false;
        });
    }

    // ========== PAGINATION ==========
    renderPagination(tabName, totalPages, currentPage) {
        const containerId = tabName === 'course' ? 'course-pagination' : 'exam-pagination';
        const container = document.getElementById(containerId);
        if (!container) return;

        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

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
            btn.addEventListener('click', () => {
                const page = btn.dataset.page;
                if (page === 'prev') {
                    this.changePage(tabName, currentPage - 1);
                } else if (page === 'next') {
                    this.changePage(tabName, currentPage + 1);
                } else {
                    this.changePage(tabName, parseInt(page, 10));
                }
            });
        });
    }

    changePage(tabName, page) {
        const totalPages = this.getTotalPages(tabName);
        if (page < 1 || page > totalPages) return;
        this.currentPage[tabName] = page;
        if (tabName === 'course') {
            this.renderCourseCertificatesTable();
        } else {
            this.renderExamCertificatesTable();
        }
    }

    getTotalPages(tabName) {
        let data, filtered;
        if (tabName === 'course') {
            data = this.courseCertificates;
            filtered = this.filterDataBySearch(data, 'course');
        } else {
            data = this.examCertificates;
            filtered = this.filterDataBySearch(data, 'exam');
        }
        return Math.ceil(filtered.length / this.pageSize);
    }

    // ========== TABLE RENDERING ==========
    renderTables() {
        this.renderCourseCertificatesTable();
        this.renderExamCertificatesTable();
    }

    renderCourseCertificatesTable() {
        const tbody = document.querySelector('#course-certificates-table tbody');
        tbody.innerHTML = '';

        const filtered = this.filterDataBySearch(this.courseCertificates, 'course');
        const totalPages = Math.ceil(filtered.length / this.pageSize);
        let currentPage = this.currentPage.course;
        if (totalPages > 0 && currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;
        this.currentPage.course = currentPage;

        const start = (currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        const pageData = filtered.slice(start, end);

        if (pageData.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `<td colspan="7" class="text-center">No course certificates found</td>`;
            tbody.appendChild(row);
        } else {
            pageData.forEach(certificate => {
                const user = this.findUserById(certificate.user_id);
                const course = this.findCourseById(certificate.course_id);

                const userDisplay = certificate.user_full_name || (user ? this.getUserFullName(user) : certificate.user_id);
                const courseDisplay = certificate.course_name || (course ? course.title : certificate.course_id);

                const row = document.createElement('tr');
                row.innerHTML = `
                <td>${certificate.certificate_id || 'N/A'}</td>
                <td>${userDisplay}</td>
                <td>${courseDisplay}</td>
                <td>${this.formatDate(certificate.date)}</td>
                <td>${certificate.hours || 0}</td>
                <td>${certificate.message || '-'}</td>
                <td class="actions">
                <button class="btn btn-outline btn-sm" onclick="certificateManager.editCourseCertificate('${certificate.certificate_id}')">
                <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-danger btn-sm" onclick="certificateManager.confirmDelete('course', '${certificate.certificate_id}')">
                <i class="fas fa-trash"></i> Delete
                </button>
                </td>
                `;
                tbody.appendChild(row);
            });
        }

        this.renderPagination('course', totalPages, currentPage);
    }

    renderExamCertificatesTable() {
        const tbody = document.querySelector('#exam-certificates-table tbody');
        tbody.innerHTML = '';

        const filtered = this.filterDataBySearch(this.examCertificates, 'exam');
        const totalPages = Math.ceil(filtered.length / this.pageSize);
        let currentPage = this.currentPage.exam;
        if (totalPages > 0 && currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;
        this.currentPage.exam = currentPage;

        const start = (currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        const pageData = filtered.slice(start, end);

        if (pageData.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `<td colspan="7" class="text-center">No exam certificates found</td>`;
            tbody.appendChild(row);
        } else {
            pageData.forEach(certificate => {
                const user = this.findUserById(certificate.user_id);
                const exam = this.findExamById(certificate.exam_id);
                const isExpired = new Date(certificate.expire_date) < new Date();

                const userDisplay = certificate.user_full_name || (user ? this.getUserFullName(user) : certificate.user_id);
                const examDisplay = certificate.exam_name || (exam ? exam.title : certificate.exam_id);

                const row = document.createElement('tr');
                row.innerHTML = `
                <td>${certificate.certificate_id || 'N/A'}</td>
                <td>${userDisplay}</td>
                <td>${examDisplay}</td>
                <td>${this.formatDate(certificate.taken_date)}</td>
                <td>${this.formatDate(certificate.expire_date)}</td>
                <td><span class="status-badge ${isExpired ? 'status-expired' : 'status-valid'}">${isExpired ? 'Expired' : 'Valid'}</span></td>
                <td class="actions">
                <button class="btn btn-outline btn-sm" onclick="certificateManager.editExamCertificate('${certificate.certificate_id}')">
                <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-danger btn-sm" onclick="certificateManager.confirmDelete('exam', '${certificate.certificate_id}')">
                <i class="fas fa-trash"></i> Delete
                </button>
                </td>
                `;
                tbody.appendChild(row);
            });
        }

        this.renderPagination('exam', totalPages, currentPage);
    }

    updateStats() {
        document.getElementById('course-cert-count').textContent = this.courseCertificates.length;
        document.getElementById('exam-cert-count').textContent = this.examCertificates.length;
        document.getElementById('user-count').textContent = this.users.length;
        document.getElementById('domain-count').textContent = this.courses.length + this.exams.length;
    }

    openCreateModal(type) {
        if (type === 'course') {
            document.getElementById('course-modal-title').textContent = 'Create Course Certificate';
            document.getElementById('course-certificate-form').reset();
            document.getElementById('course-certificate-id').value = '';
            document.getElementById('course-user-full-name').value = '';
            document.getElementById('course-user-image-url').value = '';
            document.getElementById('course-course-name').value = '';

            document.getElementById('course-date').value = new Date().toISOString().split('T')[0];
            document.getElementById('course-hours').value = 1;

            // Clear previews
            const userPrev = document.getElementById('course-user-preview');
            const coursePrev = document.getElementById('course-course-preview');
            if (userPrev) { userPrev.innerHTML = ''; userPrev.style.display = 'none'; }
            if (coursePrev) { coursePrev.innerHTML = ''; coursePrev.style.display = 'none'; }

            this.openModal('course-certificate-modal');
        } else {
            document.getElementById('exam-modal-title').textContent = 'Create Exam Certificate';
            document.getElementById('exam-certificate-form').reset();
            document.getElementById('exam-certificate-id').value = '';
            document.getElementById('exam-user-full-name').value = '';
            document.getElementById('exam-user-image-url').value = '';
            document.getElementById('exam-exam-name').value = '';
            document.getElementById('exam-course-name').value = '';

            const today = new Date().toISOString().split('T')[0];
            const nextYear = new Date();
            nextYear.setFullYear(nextYear.getFullYear() + 1);
            const nextYearStr = nextYear.toISOString().split('T')[0];

            document.getElementById('exam-taken-date').value = today;
            document.getElementById('exam-expire-date').value = nextYearStr;

            const userPrev = document.getElementById('exam-user-preview');
            const examPrev = document.getElementById('exam-exam-preview');
            if (userPrev) { userPrev.innerHTML = ''; userPrev.style.display = 'none'; }
            if (examPrev) { examPrev.innerHTML = ''; examPrev.style.display = 'none'; }

            this.openModal('exam-certificate-modal');
        }
    }

    editCourseCertificate(certificateId) {
        const certificate = this.courseCertificates.find(c => c.certificate_id === certificateId);
        if (!certificate) {
            this.showToast('Certificate not found', 'error');
            return;
        }

        document.getElementById('course-modal-title').textContent = 'Edit Course Certificate';
        document.getElementById('course-certificate-id').value = certificate.certificate_id;
        document.getElementById('course-user-id').value = certificate.user_id;
        document.getElementById('course-course-id').value = certificate.course_id;
        document.getElementById('course-date').value = certificate.date;
        document.getElementById('course-hours').value = certificate.hours;
        document.getElementById('course-message').value = certificate.message || '';

        // Populate denormalized fields (prefer existing stored values, fallback to lookup)
        const user = this.findUserById(certificate.user_id);
        const course = this.findCourseById(certificate.course_id);

        document.getElementById('course-user-full-name').value = certificate.user_full_name || this.getUserFullName(user);
        document.getElementById('course-user-image-url').value = certificate.user_image_url || this.getUserImageUrl(user);
        document.getElementById('course-course-name').value = certificate.course_name || this.getCourseName(course);

        this.updateCourseUserPreview();
        this.updateCourseCoursePreview();

        this.openModal('course-certificate-modal');
    }

    editExamCertificate(certificateId) {
        const certificate = this.examCertificates.find(c => c.certificate_id === certificateId);
        if (!certificate) {
            this.showToast('Certificate not found', 'error');
            return;
        }

        document.getElementById('exam-modal-title').textContent = 'Edit Exam Certificate';
        document.getElementById('exam-certificate-id').value = certificate.certificate_id;
        document.getElementById('exam-user-id').value = certificate.user_id;
        document.getElementById('exam-exam-id').value = certificate.exam_id;
        document.getElementById('exam-taken-date').value = certificate.taken_date;
        document.getElementById('exam-expire-date').value = certificate.expire_date;
        document.getElementById('exam-message').value = certificate.message || '';

        const user = this.findUserById(certificate.user_id);
        const exam = this.findExamById(certificate.exam_id);

        document.getElementById('exam-user-full-name').value = certificate.user_full_name || this.getUserFullName(user);
        document.getElementById('exam-user-image-url').value = certificate.user_image_url || this.getUserImageUrl(user);
        document.getElementById('exam-exam-name').value = certificate.exam_name || this.getExamName(exam);
        document.getElementById('exam-course-name').value = certificate.course_name || '';

        this.updateExamUserPreview();
        this.updateExamExamPreview();

        this.openModal('exam-certificate-modal');
    }

    async handleCourseCertificateSubmit(e) {
        e.preventDefault();

        const userSelect = document.getElementById('course-user-id');
        const courseSelect = document.getElementById('course-course-id');

        // Ensure auto-populated fields are up to date
        this.updateCourseUserPreview();
        this.updateCourseCoursePreview();

        const formData = {
            user_id: userSelect.value,
            user_full_name: document.getElementById('course-user-full-name').value,
            user_image_url: document.getElementById('course-user-image-url').value,
            course_external_id: courseSelect.value,
            course_name: document.getElementById('course-course-name').value,
            date: document.getElementById('course-date').value,
            hours: parseInt(document.getElementById('course-hours').value),
            message: document.getElementById('course-message').value || ''
        };

        const certificateId = document.getElementById('course-certificate-id').value;
        if (certificateId) {
            formData.certificate_id = certificateId;
        }

        if (!formData.user_id || !formData.course_external_id || !formData.date || !formData.hours) {
            this.showToast('Please fill all required fields', 'error');
            return;
        }

        await this.submitCertificate('course', formData);
    }

    async handleExamCertificateSubmit(e) {
        e.preventDefault();

        const userSelect = document.getElementById('exam-user-id');
        const examSelect = document.getElementById('exam-exam-id');

        this.updateExamUserPreview();
        this.updateExamExamPreview();

        const formData = {
            user_id: userSelect.value,
            user_full_name: document.getElementById('exam-user-full-name').value,
            user_image_url: document.getElementById('exam-user-image-url').value,
            exam_external_id: examSelect.value,
            exam_name: document.getElementById('exam-exam-name').value,
            course_name: document.getElementById('exam-course-name').value || '',
            taken_date: document.getElementById('exam-taken-date').value,
            expire_date: document.getElementById('exam-expire-date').value,
            message: document.getElementById('exam-message').value || ''
        };

        const certificateId = document.getElementById('exam-certificate-id').value;
        if (certificateId) {
            formData.certificate_id = certificateId;
        }

        if (!formData.user_id || !formData.exam_external_id || !formData.taken_date || !formData.expire_date) {
            this.showToast('Please fill all required fields', 'error');
            return;
        }

        await this.submitCertificate('exam', formData);
    }

    async submitCertificate(type, data) {
        this.showLoading();

        try {
            const certificateId = data.certificate_id;
            let response;

            if (certificateId) {
                response = await this.makeRequest('PUT', `${this.apiBase}/certificates/${type}/${certificateId}/`, data);
                this.showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} certificate updated successfully`, 'success');
            } else {
                response = await this.makeRequest('POST', `${this.apiBase}/certificates/${type}/`, data);
                this.showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} certificate created successfully`, 'success');
            }

            this.closeModal(`${type}-certificate-modal`);
            await this.loadInitialData();

        } catch (error) {
            console.error('Error submitting certificate:', error);
            this.showToast(error.message || `Failed to save ${type} certificate`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    confirmDelete(type, certificateId) {
        this.currentDeleteAction = { type, certificateId };
        this.openModal('delete-modal');
    }

    async executeDelete() {
        if (!this.currentDeleteAction) return;

        const { type, certificateId } = this.currentDeleteAction;
        this.showLoading();

        try {
            await this.makeRequest('DELETE', `${this.apiBase}/certificates/${type}/${certificateId}/`);
            this.showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} certificate deleted successfully`, 'success');
            this.closeModal('delete-modal');
            await this.loadInitialData();
        } catch (error) {
            console.error('Error deleting certificate:', error);
            this.showToast(error.message || `Failed to delete ${type} certificate`, 'error');
        } finally {
            this.hideLoading();
            this.currentDeleteAction = null;
        }
    }

    async makeRequest(method, url, data = null) {
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.getCSRFToken()
            },
            credentials: 'same-origin'
        };

        if (data && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, options);

            if (!response.ok) {
                let errorMessage = `HTTP error! status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    errorMessage = response.statusText || errorMessage;
                }
                throw new Error(errorMessage);
            }

            if (response.status === 204 || response.headers.get('content-length') === '0') {
                return { success: true };
            }

            return await response.json();

        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    getCSRFToken() {
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

    openModal(modalId) {
        document.getElementById(modalId).style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
        document.body.style.overflow = 'auto';
    }

    showLoading() {
        document.getElementById('loading-overlay').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loading-overlay').style.display = 'none';
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
        <div class="toast-icon">
        <i class="fas ${this.getToastIcon(type)}"></i>
        </div>
        <div class="toast-message">${message}</div>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
    }

    getToastIcon(type) {
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        return icons[type] || 'fa-info-circle';
    }

    formatDate(dateString) {
        if (!dateString) return '-';
        try {
            return new Date(dateString).toLocaleDateString();
        } catch (e) {
            return dateString;
        }
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`.tab-btn:nth-child(${tabName === 'course' ? 1 : 2})`).classList.add('active');

        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');

        this.currentTab = tabName;
    }

    async refreshData() {
        this.searchQuery = '';
        const searchInput = document.getElementById('globalSearch');
        if (searchInput) searchInput.value = '';
        this.currentPage = { course: 1, exam: 1 };
        await this.loadInitialData();
    }
}

function openCreateModal(type) {
    if (window.certificateManager) {
        window.certificateManager.openCreateModal(type);
    }
}

function closeModal(modalId) {
    if (window.certificateManager) {
        window.certificateManager.closeModal(modalId);
    }
}

function switchTab(tabName) {
    if (window.certificateManager) {
        window.certificateManager.switchTab(tabName);
    }
}

function refreshData() {
    if (window.certificateManager) {
        window.certificateManager.refreshData();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.certificateManager = new CertificateManager();

    document.getElementById('confirm-delete-btn').addEventListener('click', () => {
        if (window.certificateManager) {
            window.certificateManager.executeDelete();
        }
    });
});
