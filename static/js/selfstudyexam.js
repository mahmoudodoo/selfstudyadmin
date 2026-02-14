// SelfStudy Exam Management JavaScript - ENHANCED VERSION
class SelfStudyExamManager {
    constructor() {
        this.currentTab = 'exams';
        this.exams = [];
        this.quizzes = [];
        this.appointments = [];
        this.examResults = [];
        this.quizResults = [];
        this.courses = [];
        this.proctors = []; // Added proctors array
        this.courseMap = {}; // Map course_id to course name
        this.lessonMap = {}; // Map lesson_id to lesson name
        this.examMap = {}; // Map exam_id to exam name
        this.quizMap = {}; // Map quiz_id to quiz name
        this.proctorMap = {}; // Map proctor_id to proctor name
        this.userMap = {}; // Map user_id to username
        this.lessons = {};
        this.examQuestions = {};
        this.quizQuestions = {};
        this.currentQuestionAnswers = {};
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadInitialData();
        this.updateStats();
    }

    bindEvents() {
        // Form submissions
        document.getElementById('exam-form').addEventListener('submit', (e) => this.handleExamSubmit(e));
        document.getElementById('quiz-form').addEventListener('submit', (e) => this.handleQuizSubmit(e));
        document.getElementById('exam-question-form').addEventListener('submit', (e) => this.handleExamQuestionSubmit(e));
        document.getElementById('quiz-question-form').addEventListener('submit', (e) => this.handleQuizQuestionSubmit(e));
        document.getElementById('exam-answer-form').addEventListener('submit', (e) => this.handleExamAnswerSubmit(e));
        document.getElementById('quiz-answer-form').addEventListener('submit', (e) => this.handleQuizAnswerSubmit(e));
        document.getElementById('exam-appointment-form').addEventListener('submit', (e) => this.handleExamAppointmentSubmit(e));
        document.getElementById('exam-result-form').addEventListener('submit', (e) => this.handleExamResultSubmit(e));
        document.getElementById('quiz-result-form').addEventListener('submit', (e) => this.handleQuizResultSubmit(e));

        // Window events
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModals();
            }
        });
    }

    async loadInitialData() {
        this.showLoading();

        try {
            // First, build the course map from template data
            this.buildCourseMap();
            // Build proctor map from template data
            this.buildProctorMap();

            // Then fetch and build other maps
            await Promise.all([
                this.fetchExams(),
                this.fetchQuizzes()
            ]);

            // Build exam and quiz maps
            this.buildExamMap();
            this.buildQuizMap();

            this.updateTables();
            this.updateStats();
            this.showToast('Data loaded successfully!', 'success');
        } catch (error) {
            console.error('Error loading data:', error);
            this.showToast('Error loading data: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async loadTabData(tabName) {
        this.showLoading();

        try {
            switch(tabName) {
                case 'appointments':
                    await this.fetchExamAppointments();
                    break;
                case 'exam-results':
                    await this.fetchUserExamResults();
                    await this.buildUserMap(); // Build user map for results
                    break;
                case 'quiz-results':
                    await this.fetchUserQuizResults();
                    await this.buildUserMap(); // Build user map for results
                    break;
            }
            this.updateTables();
            this.updateStats();
        } catch (error) {
            console.error(`Error loading ${tabName} data:`, error);
            this.showToast(`Error loading ${tabName} data: ` + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    // Build course map from template data
    buildCourseMap() {
        // Course data is already loaded from template
        this.courses = window.courses || [];
        this.courseMap = {};
        this.courses.forEach(course => {
            this.courseMap[course.external_course_id] = course.title;
        });
    }

    // Build proctor map from template data
    buildProctorMap() {
        // Proctor data is loaded from template
        this.proctors = window.proctors || [];
        this.proctorMap = {};
        this.proctors.forEach(proctor => {
            // Map proctor's external_id to proctor's username
            this.proctorMap[proctor.external_id] = proctor.username;
        });
        console.log('Proctor map built:', this.proctorMap);
    }

    // Fetch proctors from API if needed
    async fetchProctors() {
        try {
            const response = await this.apiRequest('GET', { action: 'fetch_proctors' });
            if (response.success) {
                this.proctors = response.proctors || [];
                this.proctorMap = {};
                this.proctors.forEach(proctor => {
                    this.proctorMap[proctor.external_id] = proctor.username;
                });
                console.log('Proctors fetched from API:', this.proctors);
                console.log('Proctor map updated:', this.proctorMap);
            } else {
                throw new Error(response.error || 'Failed to fetch proctors');
            }
        } catch (error) {
            console.error('Error fetching proctors:', error);
            this.proctors = [];
            throw error;
        }
    }

    // Build exam map from exams data
    buildExamMap() {
        this.examMap = {};
        this.exams.forEach(exam => {
            this.examMap[exam.external_id] = exam.title;
        });
    }

    // Build quiz map from quizzes data
    buildQuizMap() {
        this.quizMap = {};
        this.quizzes.forEach(quiz => {
            this.quizMap[quiz.external_id] = quiz.title;
        });
    }

    // Build lesson map (will be populated when lessons are fetched)
    async buildLessonMap() {
        this.lessonMap = {};
        // Fetch lessons for all courses to build map
        const courseIds = [...new Set(this.quizzes.map(q => q.course_id))];

        for (const courseId of courseIds) {
            if (courseId) {
                try {
                    const lessons = await this.fetchLessons(courseId);
                    lessons.forEach(lesson => {
                        this.lessonMap[lesson.external_lesson_id] = lesson.title;
                    });
                } catch (error) {
                    console.error(`Error fetching lessons for course ${courseId}:`, error);
                }
            }
        }
    }

    // Build user map (simplified - in real app, you'd fetch user data)
    async buildUserMap() {
        this.userMap = {};
        // Build from exam results
        this.examResults.forEach(result => {
            if (result.username) {
                this.userMap[result.user] = result.username;
            }
        });
        // Build from quiz results
        this.quizResults.forEach(result => {
            if (result.username) {
                this.userMap[result.user] = result.username;
            }
        });
        // Build from appointments
        this.appointments.forEach(appointment => {
            if (appointment.username) {
                this.userMap[appointment.user] = appointment.username;
            }
        });
    }

    async fetchExams() {
        try {
            const response = await this.apiRequest('GET', { action: 'fetch_exams' });
            if (response.success) {
                this.exams = response.exams || [];
            } else {
                throw new Error(response.error || 'Failed to fetch exams');
            }
        } catch (error) {
            console.error('Error fetching exams:', error);
            this.exams = [];
            throw error;
        }
    }

    async fetchQuizzes() {
        try {
            const response = await this.apiRequest('GET', { action: 'fetch_quizzes' });
            if (response.success) {
                this.quizzes = response.quizzes || [];
                // Build lesson map after fetching quizzes
                await this.buildLessonMap();
            } else {
                throw new Error(response.error || 'Failed to fetch quizzes');
            }
        } catch (error) {
            console.error('Error fetching quizzes:', error);
            this.quizzes = [];
            throw error;
        }
    }

    async fetchExamAppointments() {
        try {
            const response = await this.apiRequest('GET', { action: 'fetch_exam_appointments' });
            if (response.success) {
                this.appointments = response.appointments || [];
                console.log('Appointments fetched:', this.appointments);
                // Log proctor IDs for debugging
                this.appointments.forEach(app => {
                    console.log(`Appointment ${app.external_id}: proctor_id=${app.proctor_id}, proctor=${app.proctor}`);
                });
            } else {
                throw new Error(response.error || 'Failed to fetch exam appointments');
            }
        } catch (error) {
            console.error('Error fetching exam appointments:', error);
            this.appointments = [];
            throw error;
        }
    }

    async fetchUserExamResults() {
        try {
            const response = await this.apiRequest('GET', { action: 'fetch_user_exam_results' });
            if (response.success) {
                this.examResults = response.results || [];
            } else {
                throw new Error(response.error || 'Failed to fetch user exam results');
            }
        } catch (error) {
            console.error('Error fetching user exam results:', error);
            this.examResults = [];
            throw error;
        }
    }

    async fetchUserQuizResults() {
        try {
            const response = await this.apiRequest('GET', { action: 'fetch_user_quiz_results' });
            if (response.success) {
                this.quizResults = response.results || [];
            } else {
                throw new Error(response.error || 'Failed to fetch user quiz results');
            }
        } catch (error) {
            console.error('Error fetching user quiz results:', error);
            this.quizResults = [];
            throw error;
        }
    }

    // FIXED: This method now properly filters questions by exam_id
    async fetchExamQuestions(examId) {
        if (!examId) return [];

        try {
            const response = await this.apiRequest('GET', {
                action: 'fetch_exam_questions',
                exam_id: examId
            });

            if (response.success) {
                const questions = response.questions || [];
                console.log(`Fetched ${questions.length} questions for exam ${examId}`);

                // Double-check filtering on client side
                const filteredQuestions = questions.filter(question => {
                    return question.exam === examId;
                });

                if (filteredQuestions.length !== questions.length) {
                    console.warn(`Filtered ${questions.length} questions down to ${filteredQuestions.length} for exam ${examId}`);
                }

                return filteredQuestions;
            } else {
                console.error('Failed to fetch exam questions:', response.error);
                return [];
            }
        } catch (error) {
            console.error('Error fetching exam questions:', error);
            return [];
        }
    }

    // FIXED: This method now properly filters questions by quiz_id
    async fetchQuizQuestions(quizId) {
        if (!quizId) return [];

        try {
            const response = await this.apiRequest('GET', {
                action: 'fetch_quiz_questions',
                quiz_id: quizId
            });

            if (response.success) {
                const questions = response.questions || [];
                console.log(`Fetched ${questions.length} questions for quiz ${quizId}`);

                // Double-check filtering on client side
                const filteredQuestions = questions.filter(question => {
                    return question.quiz === quizId;
                });

                if (filteredQuestions.length !== questions.length) {
                    console.warn(`Filtered ${questions.length} questions down to ${filteredQuestions.length} for quiz ${quizId}`);
                }

                return filteredQuestions;
            } else {
                console.error('Failed to fetch quiz questions:', response.error);
                return [];
            }
        } catch (error) {
            console.error('Error fetching quiz questions:', error);
            return [];
        }
    }

    async fetchExamQuestionDetails(questionId) {
        if (!questionId) return null;

        try {
            const response = await this.apiRequest('GET', {
                action: 'fetch_exam_question_details',
                question_id: questionId
            });
            return response.success ? response.question : null;
        } catch (error) {
            console.error('Error fetching exam question details:', error);
            return null;
        }
    }

    async fetchQuizQuestionDetails(questionId) {
        if (!questionId) return null;

        try {
            const response = await this.apiRequest('GET', {
                action: 'fetch_quiz_question_details',
                question_id: questionId
            });
            return response.success ? response.question : null;
        } catch (error) {
            console.error('Error fetching quiz question details:', error);
            return null;
        }
    }

    async fetchLessons(courseId) {
        if (!courseId) return [];

        try {
            const response = await this.apiRequest('GET', {
                action: 'fetch_lessons',
                course_id: courseId
            });
            return response.lessons || [];
        } catch (error) {
            console.error('Error fetching lessons:', error);
            return [];
        }
    }

    async apiRequest(method, data = null) {
        const url = '/selfstudyexam/api/';

        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'same-origin'
        };

        if (data && method === 'GET') {
            const params = new URLSearchParams(data);
            const fullUrl = url + '?' + params.toString();
            const response = await fetch(fullUrl, options);
            return await response.json();
        } else if (data && (method === 'POST')) {
            options.body = JSON.stringify(data);
            const response = await fetch(url, options);
            return await response.json();
        }
    }

    updateTables() {
        this.updateExamsTable();
        this.updateQuizzesTable();
        this.updateAppointmentsTable();
        this.updateExamResultsTable();
        this.updateQuizResultsTable();
        this.updateStatusBadges();
    }

    updateExamsTable() {
        const tbody = document.getElementById('exams-tbody');

        if (this.exams.length === 0) {
            tbody.innerHTML = `
            <tr>
            <td colspan="6" class="empty-state">
            <div class="empty-icon">📊</div>
            <p>No exams found</p>
            </td>
            </tr>
            `;
            return;
        }

        tbody.innerHTML = this.exams.map(exam => `
        <tr>
        <td>${this.escapeHtml(exam.title)}</td>
        <td>${this.escapeHtml(this.courseMap[exam.course_id] || exam.course_id)}</td>
        <td>${exam.exam_duration} min</td>
        <td>${exam.questions ? exam.questions.length : 0}</td>
        <td>${this.formatDate(exam.date_added)}</td>
        <td class="table-actions">
        <button class="btn btn-edit" onclick="examManager.editExam('${exam.external_id}')">
        <span class="btn-icon">✏️</span> Edit
        </button>
        <button class="btn btn-info" onclick="examManager.manageExamQuestions('${exam.external_id}', '${this.escapeHtml(exam.title)}')">
        <span class="btn-icon">❓</span> Questions
        </button>
        <button class="btn btn-danger" onclick="examManager.deleteExam('${exam.external_id}')">
        <span class="btn-icon">🗑️</span> Delete
        </button>
        </td>
        </tr>
        `).join('');
    }

    updateQuizzesTable() {
        const tbody = document.getElementById('quizzes-tbody');

        if (this.quizzes.length === 0) {
            tbody.innerHTML = `
            <tr>
            <td colspan="7" class="empty-state">
            <div class="empty-icon">📝</div>
            <p>No quizzes found</p>
            </td>
            </tr>
            `;
            return;
        }

        tbody.innerHTML = this.quizzes.map(quiz => `
        <tr>
        <td>${this.escapeHtml(quiz.title)}</td>
        <td>${this.escapeHtml(this.courseMap[quiz.course_id] || quiz.course_id)}</td>
        <td>${this.escapeHtml(this.lessonMap[quiz.lesson_id] || quiz.lesson_id)}</td>
        <td>${quiz.quiz_duration} min</td>
        <td>${quiz.questions ? quiz.questions.length : 0}</td>
        <td>${this.formatDate(quiz.date_added)}</td>
        <td class="table-actions">
        <button class="btn btn-edit" onclick="examManager.editQuiz('${quiz.external_id}')">
        <span class="btn-icon">✏️</span> Edit
        </button>
        <button class="btn btn-info" onclick="examManager.manageQuizQuestions('${quiz.external_id}', '${this.escapeHtml(quiz.title)}')">
        <span class="btn-icon">❓</span> Questions
        </button>
        <button class="btn btn-danger" onclick="examManager.deleteQuiz('${quiz.external_id}')">
        <span class="btn-icon">🗑️</span> Delete
        </button>
        </td>
        </tr>
        `).join('');
    }

    updateAppointmentsTable() {
        const tbody = document.getElementById('appointments-tbody');

        if (this.appointments.length === 0) {
            tbody.innerHTML = `
            <tr>
            <td colspan="10" class="empty-state">
            <div class="empty-icon">📅</div>
            <p>No exam appointments found</p>
            </td>
            </tr>
            `;
            return;
        }

        tbody.innerHTML = this.appointments.map(appointment => {
            // Get proctor username from proctorMap
            const proctorId = appointment.proctor_id || appointment.proctor;
            const proctorUsername = proctorId ? this.proctorMap[proctorId] : null;

            return `
            <tr>
            <td>${this.escapeHtml(appointment.username || appointment.user || 'N/A')}</td>
            <td>${this.escapeHtml(this.examMap[appointment.exam] || appointment.exam)}</td>
            <td>${this.formatDateTime(appointment.appointment_date)}</td>
            <td><span class="status-badge status-${appointment.appointment_status.toLowerCase().replace(/ /g, '-')}">${appointment.appointment_status}</span></td>
            <td>${proctorUsername ? this.escapeHtml(proctorUsername) : (proctorId ? this.escapeHtml(proctorId) : '-')}</td>
            <td>${appointment.can_start ? '<span class="status-badge status-scheduled">Yes</span>' : '<span class="status-badge status-cancelled">No</span>'}</td>
            <td>${appointment.is_entered ? '<span class="status-badge status-completed">Yes</span>' : '<span class="status-badge status-cancelled">No</span>'}</td>
            <td>${appointment.exam_time ? appointment.exam_time + ' min' : '-'}</td>
            <td>${this.formatDateTime(appointment.entered_datetime)}</td>
            <td class="table-actions">
            <button class="btn btn-edit" onclick="examManager.editExamAppointment('${appointment.external_id}')">
            <span class="btn-icon">✏️</span> Edit
            </button>
            <button class="btn btn-danger" onclick="examManager.deleteExamAppointment('${appointment.external_id}')">
            <span class="btn-icon">🗑️</span> Delete
            </button>
            </td>
            </tr>
            `;
        }).join('');
    }

    updateExamResultsTable() {
        const tbody = document.getElementById('exam-results-tbody');

        if (this.examResults.length === 0) {
            tbody.innerHTML = `
            <tr>
            <td colspan="7" class="empty-state">
            <div class="empty-icon">🎯</div>
            <p>No exam results found</p>
            </td>
            </tr>
            `;
            return;
        }

        tbody.innerHTML = this.examResults.map(result => `
        <tr>
        <td>${this.escapeHtml(result.username || result.user || 'N/A')}</td>
        <td>${this.escapeHtml(this.examMap[result.exam] || result.exam)}</td>
        <td><strong>${result.score}</strong></td>
        <td><span class="status-badge status-${result.result_status.toLowerCase()}">${result.result_status}</span></td>
        <td>${this.formatDateTime(result.date_taken)}</td>
        <td class="table-actions">
        <button class="btn btn-edit" onclick="examManager.editExamResult('${result.external_id}')">
        <span class="btn-icon">✏️</span> Edit
        </button>
        <button class="btn btn-danger" onclick="examManager.deleteExamResult('${result.external_id}')">
        <span class="btn-icon">🗑️</span> Delete
        </button>
        </td>
        </tr>
        `).join('');
    }

    updateQuizResultsTable() {
        const tbody = document.getElementById('quiz-results-tbody');

        if (this.quizResults.length === 0) {
            tbody.innerHTML = `
            <tr>
            <td colspan="7" class="empty-state">
            <div class="empty-icon">🎯</div>
            <p>No quiz results found</p>
            </td>
            </tr>
            `;
            return;
        }

        tbody.innerHTML = this.quizResults.map(result => `
        <tr>
        <td>${this.escapeHtml(result.username || result.user || 'N/A')}</td>
        <td>${this.escapeHtml(this.quizMap[result.quiz] || result.quiz)}</td>
        <td><strong>${result.score}</strong></td>
        <td><span class="status-badge status-${result.result_status.toLowerCase()}">${result.result_status}</span></td>
        <td>${this.formatDateTime(result.date_taken)}</td>
        <td class="table-actions">
        <button class="btn btn-edit" onclick="examManager.editQuizResult('${result.external_id}')">
        <span class="btn-icon">✏️</span> Edit
        </button>
        <button class="btn btn-danger" onclick="examManager.deleteQuizResult('${result.external_id}')">
        <span class="btn-icon">🗑️</span> Delete
        </button>
        </td>
        </tr>
        `).join('');
    }

    updateStats() {
        document.getElementById('exams-count').textContent = this.exams.length;
        document.getElementById('quizzes-count').textContent = this.quizzes.length;
        document.getElementById('appointments-count').textContent = this.appointments.length;
        document.getElementById('results-count').textContent = this.examResults.length + this.quizResults.length;
    }

    // Exam Methods
    openCreateExamModal() {
        document.getElementById('exam-modal-title').textContent = 'Create New Exam';
        document.getElementById('exam-form').reset();
        document.getElementById('exam-external-id').value = '';
        this.showModal('exam-modal');
    }

    async editExam(externalId) {
        const exam = this.exams.find(e => e.external_id === externalId);
        if (!exam) return;

        document.getElementById('exam-modal-title').textContent = 'Edit Exam';
        document.getElementById('exam-external-id').value = exam.external_id;
        document.getElementById('exam-title').value = exam.title;
        document.getElementById('exam-course-id').value = exam.course_id;
        document.getElementById('exam-duration').value = exam.exam_duration;
        document.getElementById('exam-instructions').value = exam.exam_instructions || '';
        document.getElementById('exam-video-url').value = exam.video_instructions_url || '';

        // Set course selection
        const courseSelect = document.getElementById('exam-course');
        const option = Array.from(courseSelect.options).find(opt =>
        opt.value === exam.course_id
        );
        if (option) {
            courseSelect.value = exam.course_id;
        }

        this.showModal('exam-modal');
    }

    async handleExamSubmit(e) {
        e.preventDefault();

        const formData = {
            action: document.getElementById('exam-external-id').value ? 'update_exam' : 'create_exam',
            external_id: document.getElementById('exam-external-id').value,
            title: document.getElementById('exam-title').value,
            course_id: document.getElementById('exam-course-id').value,
            exam_duration: parseInt(document.getElementById('exam-duration').value),
            exam_instructions: document.getElementById('exam-instructions').value,
            video_instructions_url: document.getElementById('exam-video-url').value
        };

        // Validate required fields
        if (!formData.title || !formData.course_id || !formData.exam_duration) {
            this.showToast('Please fill in all required fields', 'error');
            return;
        }

        this.showLoading();

        try {
            const response = await this.apiRequest('POST', formData);

            if (response.success) {
                this.showToast('Exam saved successfully!', 'success');
                this.closeExamModal();
                await this.loadInitialData();
            } else {
                throw new Error(response.error || 'Failed to save exam');
            }
        } catch (error) {
            this.showToast('Error saving exam: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async deleteExam(externalId) {
        if (!confirm('Are you sure you want to delete this exam? This action cannot be undone.')) {
            return;
        }

        this.showLoading();

        try {
            const response = await this.apiRequest('POST', {
                action: 'delete_exam',
                external_id: externalId
            });

            if (response.success) {
                this.showToast('Exam deleted successfully!', 'success');
                await this.loadInitialData();
            } else {
                throw new Error(response.error || 'Failed to delete exam');
            }
        } catch (error) {
            this.showToast('Error deleting exam: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    // Quiz Methods
    openCreateQuizModal() {
        document.getElementById('quiz-modal-title').textContent = 'Create New Quiz';
        document.getElementById('quiz-form').reset();
        document.getElementById('quiz-external-id').value = '';
        document.getElementById('quiz-lesson').innerHTML = '<option value="">Select a lesson</option>';
        document.getElementById('quiz-lesson-id').value = '';
        this.showModal('quiz-modal');
    }

    async editQuiz(externalId) {
        const quiz = this.quizzes.find(q => q.external_id === externalId);
        if (!quiz) return;

        document.getElementById('quiz-modal-title').textContent = 'Edit Quiz';
        document.getElementById('quiz-external-id').value = quiz.external_id;
        document.getElementById('quiz-title').value = quiz.title;
        document.getElementById('quiz-course-id').value = quiz.course_id;
        document.getElementById('quiz-lesson-id').value = quiz.lesson_id;
        document.getElementById('quiz-duration').value = quiz.quiz_duration;
        document.getElementById('quiz-description').value = quiz.description || '';

        // Set course selection and load lessons
        const courseSelect = document.getElementById('quiz-course');
        const courseOption = Array.from(courseSelect.options).find(opt =>
        opt.value === quiz.course_id
        );
        if (courseOption) {
            courseSelect.value = quiz.course_id;
            await this.loadLessonsForCourse(quiz.course_id, quiz.lesson_id);
        }

        this.showModal('quiz-modal');
    }

    async handleQuizSubmit(e) {
        e.preventDefault();

        const formData = {
            action: document.getElementById('quiz-external-id').value ? 'update_quiz' : 'create_quiz',
            external_id: document.getElementById('quiz-external-id').value,
            title: document.getElementById('quiz-title').value,
            course_id: document.getElementById('quiz-course-id').value,
            lesson_id: document.getElementById('quiz-lesson-id').value,
            quiz_duration: parseInt(document.getElementById('quiz-duration').value),
            description: document.getElementById('quiz-description').value
        };

        // Validate required fields
        if (!formData.title || !formData.course_id || !formData.lesson_id || !formData.quiz_duration) {
            this.showToast('Please fill in all required fields', 'error');
            return;
        }

        this.showLoading();

        try {
            const response = await this.apiRequest('POST', formData);

            if (response.success) {
                this.showToast('Quiz saved successfully!', 'success');
                this.closeQuizModal();
                await this.loadInitialData();
            } else {
                throw new Error(response.error || 'Failed to save quiz');
            }
        } catch (error) {
            this.showToast('Error saving quiz: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async deleteQuiz(externalId) {
        if (!confirm('Are you sure you want to delete this quiz? This action cannot be undone.')) {
            return;
        }

        this.showLoading();

        try {
            const response = await this.apiRequest('POST', {
                action: 'delete_quiz',
                external_id: externalId
            });

            if (response.success) {
                this.showToast('Quiz deleted successfully!', 'success');
                await this.loadInitialData();
            } else {
                throw new Error(response.error || 'Failed to delete quiz');
            }
        } catch (error) {
            this.showToast('Error deleting quiz: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    // FIXED: Question Management Methods - Now properly filtered
    async manageExamQuestions(examId, examTitle) {
        this.currentExamId = examId;
        document.getElementById('exam-questions-title').textContent = `Manage Questions: ${examTitle}`;

        this.showLoading();
        try {
            const questions = await this.fetchExamQuestions(examId);
            this.examQuestions[examId] = questions;
            this.updateExamQuestionsTable(examId);
            this.showModal('exam-questions-modal');
        } catch (error) {
            this.showToast('Error loading exam questions: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async manageQuizQuestions(quizId, quizTitle) {
        this.currentQuizId = quizId;
        document.getElementById('quiz-questions-title').textContent = `Manage Questions: ${quizTitle}`;

        this.showLoading();
        try {
            const questions = await this.fetchQuizQuestions(quizId);
            this.quizQuestions[quizId] = questions;
            this.updateQuizQuestionsTable(quizId);
            this.showModal('quiz-questions-modal');
        } catch (error) {
            this.showToast('Error loading quiz questions: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    updateExamQuestionsTable(examId) {
        const tbody = document.getElementById('exam-questions-tbody');
        const questions = this.examQuestions[examId] || [];

        if (questions.length === 0) {
            tbody.innerHTML = `
            <tr>
            <td colspan="6" class="empty-state">
            <div class="empty-icon">❓</div>
            <p>No questions found for this exam</p>
            <button class="btn btn-primary" onclick="openCreateExamQuestionModal()">
            <span class="btn-icon">➕</span> Add First Question
            </button>
            </td>
            </tr>
            `;
            return;
        }

        tbody.innerHTML = questions.map((question, index) => `
        <tr>
        <td>${index + 1}</td>
        <td>${this.escapeHtml(question.text)}</td>
        <td><span class="status-badge status-scheduled">${question.score || 1}</span></td>
        <td>${question.answers ? question.answers.length : 0}</td>
        <td>${this.getCorrectAnswerText(question.answers)}</td>
        <td class="table-actions">
        <button class="btn btn-edit" onclick="examManager.editExamQuestion('${question.external_id}')">
        <span class="btn-icon">✏️</span> Edit
        </button>
        <button class="btn btn-info" onclick="examManager.manageExamQuestionAnswers('${question.external_id}', '${this.escapeHtml(question.text)}')">
        <span class="btn-icon">📝</span> Answers
        </button>
        <button class="btn btn-danger" onclick="examManager.deleteExamQuestion('${question.external_id}')">
        <span class="btn-icon">🗑️</span> Delete
        </button>
        </td>
        </tr>
        `).join('');
    }

    updateQuizQuestionsTable(quizId) {
        const tbody = document.getElementById('quiz-questions-tbody');
        const questions = this.quizQuestions[quizId] || [];

        if (questions.length === 0) {
            tbody.innerHTML = `
            <tr>
            <td colspan="6" class="empty-state">
            <div class="empty-icon">❓</div>
            <p>No questions found for this quiz</p>
            <button class="btn btn-primary" onclick="openCreateQuizQuestionModal()">
            <span class="btn-icon">➕</span> Add First Question
            </button>
            </td>
            </tr>
            `;
            return;
        }

        tbody.innerHTML = questions.map((question, index) => `
        <tr>
        <td>${index + 1}</td>
        <td>${this.escapeHtml(question.text)}</td>
        <td><span class="status-badge status-scheduled">${question.score || 1}</span></td>
        <td>${question.answers ? question.answers.length : 0}</td>
        <td>${this.getCorrectAnswerText(question.answers)}</td>
        <td class="table-actions">
        <button class="btn btn-edit" onclick="examManager.editQuizQuestion('${question.external_id}')">
        <span class="btn-icon">✏️</span> Edit
        </button>
        <button class="btn btn-info" onclick="examManager.manageQuizQuestionAnswers('${question.external_id}', '${this.escapeHtml(question.text)}')">
        <span class="btn-icon">📝</span> Answers
        </button>
        <button class="btn btn-danger" onclick="examManager.deleteQuizQuestion('${question.external_id}')">
        <span class="btn-icon">🗑️</span> Delete
        </button>
        </td>
        </tr>
        `).join('');
    }

    getCorrectAnswerText(answers) {
        if (!answers || !Array.isArray(answers)) return '<span class="status-badge status-cancelled">None</span>';
        const correctAnswer = answers.find(answer => answer.is_correct);
        if (!correctAnswer) return '<span class="status-badge status-cancelled">No correct answer</span>';

        const answerText = this.escapeHtml(correctAnswer.text);
        const truncatedText = answerText.length > 30 ? answerText.substring(0, 30) + '...' : answerText;
        return `<span class="status-badge status-passed" title="${answerText}">${truncatedText}</span>`;
    }

    openCreateExamQuestionModal() {
        document.getElementById('exam-question-modal-title').textContent = 'Create New Exam Question';
        document.getElementById('exam-question-form').reset();
        document.getElementById('exam-question-external-id').value = '';
        document.getElementById('exam-question-exam-id').value = this.currentExamId;
        document.getElementById('exam-question-score').value = 1;
        this.showModal('exam-question-modal');
    }

    openCreateQuizQuestionModal() {
        document.getElementById('quiz-question-modal-title').textContent = 'Create New Quiz Question';
        document.getElementById('quiz-question-form').reset();
        document.getElementById('quiz-question-external-id').value = '';
        document.getElementById('quiz-question-quiz-id').value = this.currentQuizId;
        document.getElementById('quiz-question-score').value = 1;
        this.showModal('quiz-question-modal');
    }

    async editExamQuestion(questionId) {
        try {
            const question = await this.fetchExamQuestionDetails(questionId);
            if (question) {
                document.getElementById('exam-question-modal-title').textContent = 'Edit Exam Question';
                document.getElementById('exam-question-external-id').value = question.external_id;
                document.getElementById('exam-question-exam-id').value = question.exam;
                document.getElementById('exam-question-text').value = question.text;
                document.getElementById('exam-question-score').value = question.score || 1;

                this.showModal('exam-question-modal');
            } else {
                throw new Error('Failed to fetch question details');
            }
        } catch (error) {
            this.showToast('Error loading question: ' + error.message, 'error');
        }
    }

    async editQuizQuestion(questionId) {
        try {
            const question = await this.fetchQuizQuestionDetails(questionId);
            if (question) {
                document.getElementById('quiz-question-modal-title').textContent = 'Edit Quiz Question';
                document.getElementById('quiz-question-external-id').value = question.external_id;
                document.getElementById('quiz-question-quiz-id').value = question.quiz;
                document.getElementById('quiz-question-text').value = question.text;
                document.getElementById('quiz-question-score').value = question.score || 1;

                this.showModal('quiz-question-modal');
            } else {
                throw new Error('Failed to fetch question details');
            }
        } catch (error) {
            this.showToast('Error loading question: ' + error.message, 'error');
        }
    }

    async manageExamQuestionAnswers(questionId, questionText) {
        this.currentQuestionId = questionId;
        this.currentQuestionType = 'exam';
        document.getElementById('exam-answers-title').textContent = `Manage Answers: ${questionText}`;

        this.showLoading();
        try {
            const question = await this.fetchExamQuestionDetails(questionId);
            if (question && question.answers) {
                this.currentQuestionAnswers = question.answers;
                this.updateExamAnswersTable();
                this.showModal('exam-answers-modal');
            } else {
                this.currentQuestionAnswers = [];
                this.updateExamAnswersTable();
                this.showModal('exam-answers-modal');
            }
        } catch (error) {
            this.showToast('Error loading answers: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async manageQuizQuestionAnswers(questionId, questionText) {
        this.currentQuestionId = questionId;
        this.currentQuestionType = 'quiz';
        document.getElementById('quiz-answers-title').textContent = `Manage Answers: ${questionText}`;

        this.showLoading();
        try {
            const question = await this.fetchQuizQuestionDetails(questionId);
            if (question && question.answers) {
                this.currentQuestionAnswers = question.answers;
                this.updateQuizAnswersTable();
                this.showModal('quiz-answers-modal');
            } else {
                this.currentQuestionAnswers = [];
                this.updateQuizAnswersTable();
                this.showModal('quiz-answers-modal');
            }
        } catch (error) {
            this.showToast('Error loading answers: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    updateExamAnswersTable() {
        const tbody = document.getElementById('exam-answers-tbody');
        const answers = this.currentQuestionAnswers || [];

        if (answers.length === 0) {
            tbody.innerHTML = `
            <tr>
            <td colspan="4" class="empty-state">
            <div class="empty-icon">📝</div>
            <p>No answers found for this question</p>
            <button class="btn btn-primary" onclick="openCreateExamAnswerModal()">
            <span class="btn-icon">➕</span> Add First Answer
            </button>
            </td>
            </tr>
            `;
            return;
        }

        tbody.innerHTML = answers.map((answer, index) => `
        <tr>
        <td>${index + 1}</td>
        <td>${this.escapeHtml(answer.text)}</td>
        <td>${answer.is_correct ? '<span class="status-badge status-passed">✅ Correct</span>' : '<span class="status-badge status-cancelled">❌ Incorrect</span>'}</td>
        <td class="table-actions">
        <button class="btn btn-edit" onclick="examManager.editExamAnswer('${answer.external_id}')">
        <span class="btn-icon">✏️</span> Edit
        </button>
        <button class="btn btn-danger" onclick="examManager.deleteExamAnswer('${answer.external_id}')">
        <span class="btn-icon">🗑️</span> Delete
        </button>
        </td>
        </tr>
        `).join('');
    }

    updateQuizAnswersTable() {
        const tbody = document.getElementById('quiz-answers-tbody');
        const answers = this.currentQuestionAnswers || [];

        if (answers.length === 0) {
            tbody.innerHTML = `
            <tr>
            <td colspan="4" class="empty-state">
            <div class="empty-icon">📝</div>
            <p>No answers found for this question</p>
            <button class="btn btn-primary" onclick="openCreateQuizAnswerModal()">
            <span class="btn-icon">➕</span> Add First Answer
            </button>
            </td>
            </tr>
            `;
            return;
        }

        tbody.innerHTML = answers.map((answer, index) => `
        <tr>
        <td>${index + 1}</td>
        <td>${this.escapeHtml(answer.text)}</td>
        <td>${answer.is_correct ? '<span class="status-badge status-passed">✅ Correct</span>' : '<span class="status-badge status-cancelled">❌ Incorrect</span>'}</td>
        <td class="table-actions">
        <button class="btn btn-edit" onclick="examManager.editQuizAnswer('${answer.external_id}')">
        <span class="btn-icon">✏️</span> Edit
        </button>
        <button class="btn btn-danger" onclick="examManager.deleteQuizAnswer('${answer.external_id}')">
        <span class="btn-icon">🗑️</span> Delete
        </button>
        </td>
        </tr>
        `).join('');
    }

    openCreateExamAnswerModal() {
        document.getElementById('exam-answer-modal-title').textContent = 'Create New Exam Answer';
        document.getElementById('exam-answer-form').reset();
        document.getElementById('exam-answer-external-id').value = '';
        document.getElementById('exam-answer-question-id').value = this.currentQuestionId;
        document.getElementById('exam-answer-is-correct').checked = false;
        this.showModal('exam-answer-modal');
    }

    openCreateQuizAnswerModal() {
        document.getElementById('quiz-answer-modal-title').textContent = 'Create New Quiz Answer';
        document.getElementById('quiz-answer-form').reset();
        document.getElementById('quiz-answer-external-id').value = '';
        document.getElementById('quiz-answer-question-id').value = this.currentQuestionId;
        document.getElementById('quiz-answer-is-correct').checked = false;
        this.showModal('quiz-answer-modal');
    }

    async editExamAnswer(answerId) {
        const answer = this.currentQuestionAnswers.find(a => a.external_id === answerId);
        if (!answer) return;

        document.getElementById('exam-answer-modal-title').textContent = 'Edit Exam Answer';
        document.getElementById('exam-answer-external-id').value = answer.external_id;
        document.getElementById('exam-answer-question-id').value = this.currentQuestionId;
        document.getElementById('exam-answer-text').value = answer.text;
        document.getElementById('exam-answer-is-correct').checked = answer.is_correct;

        this.showModal('exam-answer-modal');
    }

    async editQuizAnswer(answerId) {
        const answer = this.currentQuestionAnswers.find(a => a.external_id === answerId);
        if (!answer) return;

        document.getElementById('quiz-answer-modal-title').textContent = 'Edit Quiz Answer';
        document.getElementById('quiz-answer-external-id').value = answer.external_id;
        document.getElementById('quiz-answer-question-id').value = this.currentQuestionId;
        document.getElementById('quiz-answer-text').value = answer.text;
        document.getElementById('quiz-answer-is-correct').checked = answer.is_correct;

        this.showModal('quiz-answer-modal');
    }

    // ENHANCED: Edit Exam Appointment with ALL fields
    async editExamAppointment(externalId) {
        const appointment = this.appointments.find(a => a.external_id === externalId);
        if (!appointment) return;

        document.getElementById('exam-appointment-modal-title').textContent = 'Edit Exam Appointment';
        document.getElementById('exam-appointment-external-id').value = appointment.external_id;
        document.getElementById('exam-appointment-status').value = appointment.appointment_status;
        document.getElementById('exam-appointment-can-start').checked = appointment.can_start;
        document.getElementById('exam-appointment-is-entered').checked = appointment.is_entered;
        document.getElementById('exam-appointment-proctor').value = appointment.proctor_id || '';

        // Format appointment date for datetime-local input
        const appointmentDate = new Date(appointment.appointment_date);
        const formattedDate = appointmentDate.toISOString().slice(0, 16);
        document.getElementById('exam-appointment-date').value = formattedDate;

        // Format entered datetime if exists
        if (appointment.entered_datetime) {
            const enteredDate = new Date(appointment.entered_datetime);
            const formattedEnteredDate = enteredDate.toISOString().slice(0, 16);
            document.getElementById('exam-appointment-entered-datetime').value = formattedEnteredDate;
        } else {
            document.getElementById('exam-appointment-entered-datetime').value = '';
        }

        // Set other fields
        document.getElementById('exam-appointment-room1').value = appointment.room_url_1 || '';
        document.getElementById('exam-appointment-room2').value = appointment.room_url_2 || '';
        document.getElementById('exam-appointment-time').value = appointment.exam_time || '';

        this.showModal('exam-appointment-modal');
    }

    async editExamResult(externalId) {
        const result = this.examResults.find(r => r.external_id === externalId);
        if (!result) return;

        document.getElementById('exam-result-modal-title').textContent = 'Edit Exam Result';
        document.getElementById('exam-result-external-id').value = result.external_id;
        document.getElementById('exam-result-score').value = result.score;
        document.getElementById('exam-result-status').value = result.result_status;
        document.getElementById('exam-result-message').value = result.result_message || '';

        this.showModal('exam-result-modal');
    }

    async editQuizResult(externalId) {
        const result = this.quizResults.find(r => r.external_id === externalId);
        if (!result) return;

        document.getElementById('quiz-result-modal-title').textContent = 'Edit Quiz Result';
        document.getElementById('quiz-result-external-id').value = result.external_id;
        document.getElementById('quiz-result-score').value = result.score;
        document.getElementById('quiz-result-status').value = result.result_status;
        document.getElementById('quiz-result-message').value = result.result_message || '';

        this.showModal('quiz-result-modal');
    }

    // NEW: Delete methods for appointments and results
    async deleteExamAppointment(externalId) {
        if (!confirm('Are you sure you want to delete this exam appointment? This action cannot be undone.')) {
            return;
        }

        this.showLoading();

        try {
            const response = await this.apiRequest('POST', {
                action: 'delete_exam_appointment',
                external_id: externalId
            });

            if (response.success) {
                this.showToast('Exam appointment deleted successfully!', 'success');
                await this.loadTabData('appointments');
            } else {
                throw new Error(response.error || 'Failed to delete exam appointment');
            }
        } catch (error) {
            this.showToast('Error deleting exam appointment: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async deleteExamResult(externalId) {
        if (!confirm('Are you sure you want to delete this exam result? This action cannot be undone.')) {
            return;
        }

        this.showLoading();

        try {
            const response = await this.apiRequest('POST', {
                action: 'delete_user_exam_result',
                external_id: externalId
            });

            if (response.success) {
                this.showToast('Exam result deleted successfully!', 'success');
                await this.loadTabData('exam-results');
            } else {
                throw new Error(response.error || 'Failed to delete exam result');
            }
        } catch (error) {
            this.showToast('Error deleting exam result: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async deleteQuizResult(externalId) {
        if (!confirm('Are you sure you want to delete this quiz result? This action cannot be undone.')) {
            return;
        }

        this.showLoading();

        try {
            const response = await this.apiRequest('POST', {
                action: 'delete_user_quiz_result',
                external_id: externalId
            });

            if (response.success) {
                this.showToast('Quiz result deleted successfully!', 'success');
                await this.loadTabData('quiz-results');
            } else {
                throw new Error(response.error || 'Failed to delete quiz result');
            }
        } catch (error) {
            this.showToast('Error deleting quiz result: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    // ENHANCED: Handle Exam Appointment Submit with ALL fields
    async handleExamAppointmentSubmit(e) {
        e.preventDefault();

        const formData = {
            action: 'update_exam_appointment',
            external_id: document.getElementById('exam-appointment-external-id').value,
            appointment_status: document.getElementById('exam-appointment-status').value,
            appointment_date: document.getElementById('exam-appointment-date').value,
            can_start: document.getElementById('exam-appointment-can-start').checked,
            is_entered: document.getElementById('exam-appointment-is-entered').checked,
            entered_datetime: document.getElementById('exam-appointment-entered-datetime').value || null,
            proctor_id: document.getElementById('exam-appointment-proctor').value,
            room_url_1: document.getElementById('exam-appointment-room1').value,
            room_url_2: document.getElementById('exam-appointment-room2').value,
            exam_time: document.getElementById('exam-appointment-time').value ? parseInt(document.getElementById('exam-appointment-time').value) : null
        };

        // Validate required fields
        if (!formData.appointment_date) {
            this.showToast('Appointment date is required', 'error');
            return;
        }

        this.showLoading();

        try {
            const response = await this.apiRequest('POST', formData);

            if (response.success) {
                this.showToast('Exam appointment updated successfully!', 'success');
                this.closeExamAppointmentModal();
                await this.loadTabData('appointments');
            } else {
                throw new Error(response.error || 'Failed to update exam appointment');
            }
        } catch (error) {
            this.showToast('Error updating exam appointment: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async handleExamResultSubmit(e) {
        e.preventDefault();

        const formData = {
            action: 'update_user_exam_result',
            external_id: document.getElementById('exam-result-external-id').value,
            score: parseFloat(document.getElementById('exam-result-score').value),
            result_status: document.getElementById('exam-result-status').value,
            result_message: document.getElementById('exam-result-message').value
        };

        // Validate required fields
        if (isNaN(formData.score) || formData.score < 0) {
            this.showToast('Please enter a valid score', 'error');
            return;
        }

        this.showLoading();

        try {
            const response = await this.apiRequest('POST', formData);

            if (response.success) {
                this.showToast('Exam result updated successfully!', 'success');
                this.closeExamResultModal();
                await this.loadTabData('exam-results');
            } else {
                throw new Error(response.error || 'Failed to update exam result');
            }
        } catch (error) {
            this.showToast('Error updating exam result: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async handleQuizResultSubmit(e) {
        e.preventDefault();

        const formData = {
            action: 'update_user_quiz_result',
            external_id: document.getElementById('quiz-result-external-id').value,
            score: parseFloat(document.getElementById('quiz-result-score').value),
            result_status: document.getElementById('quiz-result-status').value,
            result_message: document.getElementById('quiz-result-message').value
        };

        // Validate required fields
        if (isNaN(formData.score) || formData.score < 0) {
            this.showToast('Please enter a valid score', 'error');
            return;
        }

        this.showLoading();

        try {
            const response = await this.apiRequest('POST', formData);

            if (response.success) {
                this.showToast('Quiz result updated successfully!', 'success');
                this.closeQuizResultModal();
                await this.loadTabData('quiz-results');
            } else {
                throw new Error(response.error || 'Failed to update quiz result');
            }
        } catch (error) {
            this.showToast('Error updating quiz result: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async handleExamQuestionSubmit(e) {
        e.preventDefault();

        const formData = {
            action: document.getElementById('exam-question-external-id').value ? 'update_exam_question' : 'create_exam_question',
            external_id: document.getElementById('exam-question-external-id').value,
            exam: document.getElementById('exam-question-exam-id').value,
            text: document.getElementById('exam-question-text').value,
            score: parseInt(document.getElementById('exam-question-score').value) || 1
        };

        if (!formData.text || !formData.exam) {
            this.showToast('Please fill in all required fields', 'error');
            return;
        }

        this.showLoading();

        try {
            const response = await this.apiRequest('POST', formData);

            if (response.success) {
                this.showToast('Exam question saved successfully!', 'success');
                this.closeExamQuestionModal();
                // Refresh the questions list
                await this.manageExamQuestions(this.currentExamId, '');
            } else {
                throw new Error(response.error || 'Failed to save exam question');
            }
        } catch (error) {
            this.showToast('Error saving exam question: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async handleQuizQuestionSubmit(e) {
        e.preventDefault();

        const formData = {
            action: document.getElementById('quiz-question-external-id').value ? 'update_quiz_question' : 'create_quiz_question',
            external_id: document.getElementById('quiz-question-external-id').value,
            quiz: document.getElementById('quiz-question-quiz-id').value,
            text: document.getElementById('quiz-question-text').value,
            score: parseInt(document.getElementById('quiz-question-score').value) || 1
        };

        if (!formData.text || !formData.quiz) {
            this.showToast('Please fill in all required fields', 'error');
            return;
        }

        this.showLoading();

        try {
            const response = await this.apiRequest('POST', formData);

            if (response.success) {
                this.showToast('Quiz question saved successfully!', 'success');
                this.closeQuizQuestionModal();
                // Refresh the questions list
                await this.manageQuizQuestions(this.currentQuizId, '');
            } else {
                throw new Error(response.error || 'Failed to save quiz question');
            }
        } catch (error) {
            this.showToast('Error saving quiz question: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async handleExamAnswerSubmit(e) {
        e.preventDefault();

        const formData = {
            action: document.getElementById('exam-answer-external-id').value ? 'update_exam_answer' : 'create_exam_answer',
            external_id: document.getElementById('exam-answer-external-id').value,
            exam_question: document.getElementById('exam-answer-question-id').value,
            text: document.getElementById('exam-answer-text').value,
            is_correct: document.getElementById('exam-answer-is-correct').checked
        };

        if (!formData.text || !formData.exam_question) {
            this.showToast('Please fill in all required fields', 'error');
            return;
        }

        this.showLoading();

        try {
            const response = await this.apiRequest('POST', formData);

            if (response.success) {
                this.showToast('Exam answer saved successfully!', 'success');
                this.closeExamAnswerModal();
                // Refresh the answers list
                await this.manageExamQuestionAnswers(this.currentQuestionId, '');
            } else {
                throw new Error(response.error || 'Failed to save exam answer');
            }
        } catch (error) {
            this.showToast('Error saving exam answer: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async handleQuizAnswerSubmit(e) {
        e.preventDefault();

        const formData = {
            action: document.getElementById('quiz-answer-external-id').value ? 'update_quiz_answer' : 'create_quiz_answer',
            external_id: document.getElementById('quiz-answer-external-id').value,
            quiz_question: document.getElementById('quiz-answer-question-id').value,
            text: document.getElementById('quiz-answer-text').value,
            is_correct: document.getElementById('quiz-answer-is-correct').checked
        };

        if (!formData.text || !formData.quiz_question) {
            this.showToast('Please fill in all required fields', 'error');
            return;
        }

        this.showLoading();

        try {
            const response = await this.apiRequest('POST', formData);

            if (response.success) {
                this.showToast('Quiz answer saved successfully!', 'success');
                this.closeQuizAnswerModal();
                // Refresh the answers list
                await this.manageQuizQuestionAnswers(this.currentQuestionId, '');
            } else {
                throw new Error(response.error || 'Failed to save quiz answer');
            }
        } catch (error) {
            this.showToast('Error saving quiz answer: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async deleteExamQuestion(questionId) {
        if (!confirm('Are you sure you want to delete this exam question? This action cannot be undone.')) {
            return;
        }

        this.showLoading();

        try {
            const response = await this.apiRequest('POST', {
                action: 'delete_exam_question',
                external_id: questionId
            });

            if (response.success) {
                this.showToast('Exam question deleted successfully!', 'success');
                // Refresh the questions list
                await this.manageExamQuestions(this.currentExamId, '');
            } else {
                throw new Error(response.error || 'Failed to delete exam question');
            }
        } catch (error) {
            this.showToast('Error deleting exam question: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async deleteQuizQuestion(questionId) {
        if (!confirm('Are you sure you want to delete this quiz question? This action cannot be undone.')) {
            return;
        }

        this.showLoading();

        try {
            const response = await this.apiRequest('POST', {
                action: 'delete_quiz_question',
                external_id: questionId
            });

            if (response.success) {
                this.showToast('Quiz question deleted successfully!', 'success');
                // Refresh the questions list
                await this.manageQuizQuestions(this.currentQuizId, '');
            } else {
                throw new Error(response.error || 'Failed to delete quiz question');
            }
        } catch (error) {
            this.showToast('Error deleting quiz question: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async deleteExamAnswer(answerId) {
        if (!confirm('Are you sure you want to delete this exam answer? This action cannot be undone.')) {
            return;
        }

        this.showLoading();

        try {
            const response = await this.apiRequest('POST', {
                action: 'delete_exam_answer',
                external_id: answerId
            });

            if (response.success) {
                this.showToast('Exam answer deleted successfully!', 'success');
                // Refresh the answers list
                await this.manageExamQuestionAnswers(this.currentQuestionId, '');
            } else {
                throw new Error(response.error || 'Failed to delete exam answer');
            }
        } catch (error) {
            this.showToast('Error deleting exam answer: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async deleteQuizAnswer(answerId) {
        if (!confirm('Are you sure you want to delete this quiz answer? This action cannot be undone.')) {
            return;
        }

        this.showLoading();

        try {
            const response = await this.apiRequest('POST', {
                action: 'delete_quiz_answer',
                external_id: answerId
            });

            if (response.success) {
                this.showToast('Quiz answer deleted successfully!', 'success');
                // Refresh the answers list
                await this.manageQuizQuestionAnswers(this.currentQuestionId, '');
            } else {
                throw new Error(response.error || 'Failed to delete quiz answer');
            }
        } catch (error) {
            this.showToast('Error deleting quiz answer: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    // ===== NEW: Import Exam JSON methods =====
    openImportExamModal() {
        document.getElementById('import-exam-modal').style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    closeImportExamModal() {
        const modal = document.getElementById('import-exam-modal');
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        // Clear fields
        document.getElementById('exam-json-file').value = '';
        document.getElementById('exam-json-text').value = '';
    }

    handleExamFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('exam-json-text').value = e.target.result;
        };
        reader.readAsText(file);
    }

    validateExamJSON() {
        const jsonText = document.getElementById('exam-json-text').value.trim();
        if (!jsonText) {
            this.showToast('Please paste JSON or upload a file', 'error');
            return false;
        }
        try {
            const data = JSON.parse(jsonText);
            // Basic required fields
            if (!data.external_id || !data.title || !data.course_id || !data.exam_duration) {
                this.showToast('Missing required fields: external_id, title, course_id, exam_duration', 'error');
                return false;
            }
            if (!Array.isArray(data.questions)) {
                this.showToast('questions must be an array', 'error');
                return false;
            }
            this.showToast('JSON is valid', 'success');
            return true;
        } catch (e) {
            this.showToast('Invalid JSON: ' + e.message, 'error');
            return false;
        }
    }

    async submitExamJSON() {
        if (!this.validateExamJSON()) return;
        const jsonText = document.getElementById('exam-json-text').value.trim();
        let examData;
        try {
            examData = JSON.parse(jsonText);
        } catch (e) {
            return; // already validated
        }

        this.showLoading();
        try {
            const response = await this.apiRequest('POST', {
                action: 'create_exam_full',
                ...examData
            });
            if (response.success) {
                this.showToast('Exam created successfully!', 'success');
                this.closeImportExamModal();
                await this.loadInitialData(); // refresh tables
            } else {
                throw new Error(response.error || 'Failed to create exam');
            }
        } catch (error) {
            this.showToast('Error: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    // ===== NEW: Import Quiz JSON methods =====
    openImportQuizModal() {
        document.getElementById('import-quiz-modal').style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    closeImportQuizModal() {
        const modal = document.getElementById('import-quiz-modal');
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        document.getElementById('quiz-json-file').value = '';
        document.getElementById('quiz-json-text').value = '';
    }

    handleQuizFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('quiz-json-text').value = e.target.result;
        };
        reader.readAsText(file);
    }

    validateQuizJSON() {
        const jsonText = document.getElementById('quiz-json-text').value.trim();
        if (!jsonText) {
            this.showToast('Please paste JSON or upload a file', 'error');
            return false;
        }
        try {
            const data = JSON.parse(jsonText);
            if (!data.external_id || !data.title || !data.course_id || !data.lesson_id || !data.quiz_duration) {
                this.showToast('Missing required fields: external_id, title, course_id, lesson_id, quiz_duration', 'error');
                return false;
            }
            if (!Array.isArray(data.questions)) {
                this.showToast('questions must be an array', 'error');
                return false;
            }
            this.showToast('JSON is valid', 'success');
            return true;
        } catch (e) {
            this.showToast('Invalid JSON: ' + e.message, 'error');
            return false;
        }
    }

    async submitQuizJSON() {
        if (!this.validateQuizJSON()) return;
        const jsonText = document.getElementById('quiz-json-text').value.trim();
        let quizData;
        try {
            quizData = JSON.parse(jsonText);
        } catch (e) {
            return;
        }

        this.showLoading();
        try {
            const response = await this.apiRequest('POST', {
                action: 'create_quiz_full',
                ...quizData
            });
            if (response.success) {
                this.showToast('Quiz created successfully!', 'success');
                this.closeImportQuizModal();
                await this.loadInitialData();
            } else {
                throw new Error(response.error || 'Failed to create quiz');
            }
        } catch (error) {
            this.showToast('Error: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    // Course and Lesson Handling
    async onCourseSelect(type) {
        const courseSelect = document.getElementById(`${type}-course`);
        const courseIdInput = document.getElementById(`${type}-course-id`);
        const selectedOption = courseSelect.options[courseSelect.selectedIndex];

        if (selectedOption && selectedOption.value) {
            courseIdInput.value = selectedOption.value;

            if (type === 'quiz') {
                await this.loadLessonsForCourse(selectedOption.value);
            }
        } else {
            courseIdInput.value = '';
            if (type === 'quiz') {
                document.getElementById('quiz-lesson').innerHTML = '<option value="">Select a lesson</option>';
                document.getElementById('quiz-lesson-id').value = '';
            }
        }
    }

    async loadLessonsForCourse(courseId, selectedLessonId = '') {
        const lessonSelect = document.getElementById('quiz-lesson');
        const lessonIdInput = document.getElementById('quiz-lesson-id');

        lessonSelect.innerHTML = '<option value="">Loading lessons...</option>';
        lessonSelect.disabled = true;

        try {
            const lessons = await this.fetchLessons(courseId);

            lessonSelect.innerHTML = '<option value="">Select a lesson</option>';
            lessons.forEach(lesson => {
                const option = document.createElement('option');
                option.value = lesson.external_lesson_id;
                option.textContent = lesson.title;
                option.dataset.id = lesson.external_lesson_id;
                if (lesson.external_lesson_id === selectedLessonId) {
                    option.selected = true;
                    lessonIdInput.value = lesson.external_lesson_id;
                }
                lessonSelect.appendChild(option);
            });

            lessonSelect.disabled = false;

            if (lessons.length === 0) {
                this.showToast('No lessons found for this course', 'warning');
            }
        } catch (error) {
            lessonSelect.innerHTML = '<option value="">Error loading lessons</option>';
            console.error('Error loading lessons:', error);
        }
    }

    onLessonSelect() {
        const lessonSelect = document.getElementById('quiz-lesson');
        const lessonIdInput = document.getElementById('quiz-lesson-id');
        const selectedOption = lessonSelect.options[lessonSelect.selectedIndex];

        if (selectedOption && selectedOption.value) {
            lessonIdInput.value = selectedOption.value;
        } else {
            lessonIdInput.value = '';
        }
    }

    // UI Utility Methods
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';

        // Add animation class
        setTimeout(() => {
            modal.querySelector('.modal-content').style.transform = 'translateY(0) scale(1)';
            modal.querySelector('.modal-content').style.opacity = '1';
        }, 10);
    }

    closeModals() {
        this.closeExamModal();
        this.closeQuizModal();
        this.closeExamQuestionsModal();
        this.closeQuizQuestionsModal();
        this.closeExamQuestionModal();
        this.closeQuizQuestionModal();
        this.closeExamAnswersModal();
        this.closeQuizAnswersModal();
        this.closeExamAnswerModal();
        this.closeQuizAnswerModal();
        this.closeExamAppointmentModal();
        this.closeExamResultModal();
        this.closeQuizResultModal();
        this.closeImportExamModal();
        this.closeImportQuizModal();
    }

    closeExamModal() {
        const modal = document.getElementById('exam-modal');
        modal.querySelector('.modal-content').style.transform = 'translateY(-60px) scale(0.95)';
        modal.querySelector('.modal-content').style.opacity = '0';
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }, 300);
    }

    closeQuizModal() {
        const modal = document.getElementById('quiz-modal');
        modal.querySelector('.modal-content').style.transform = 'translateY(-60px) scale(0.95)';
        modal.querySelector('.modal-content').style.opacity = '0';
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }, 300);
    }

    closeExamQuestionsModal() {
        const modal = document.getElementById('exam-questions-modal');
        modal.querySelector('.modal-content').style.transform = 'translateY(-60px) scale(0.95)';
        modal.querySelector('.modal-content').style.opacity = '0';
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }, 300);
    }

    closeQuizQuestionsModal() {
        const modal = document.getElementById('quiz-questions-modal');
        modal.querySelector('.modal-content').style.transform = 'translateY(-60px) scale(0.95)';
        modal.querySelector('.modal-content').style.opacity = '0';
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }, 300);
    }

    closeExamQuestionModal() {
        const modal = document.getElementById('exam-question-modal');
        modal.querySelector('.modal-content').style.transform = 'translateY(-60px) scale(0.95)';
        modal.querySelector('.modal-content').style.opacity = '0';
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }, 300);
    }

    closeQuizQuestionModal() {
        const modal = document.getElementById('quiz-question-modal');
        modal.querySelector('.modal-content').style.transform = 'translateY(-60px) scale(0.95)';
        modal.querySelector('.modal-content').style.opacity = '0';
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }, 300);
    }

    closeExamAnswersModal() {
        const modal = document.getElementById('exam-answers-modal');
        modal.querySelector('.modal-content').style.transform = 'translateY(-60px) scale(0.95)';
        modal.querySelector('.modal-content').style.opacity = '0';
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }, 300);
    }

    closeQuizAnswersModal() {
        const modal = document.getElementById('quiz-answers-modal');
        modal.querySelector('.modal-content').style.transform = 'translateY(-60px) scale(0.95)';
        modal.querySelector('.modal-content').style.opacity = '0';
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }, 300);
    }

    closeExamAnswerModal() {
        const modal = document.getElementById('exam-answer-modal');
        modal.querySelector('.modal-content').style.transform = 'translateY(-60px) scale(0.95)';
        modal.querySelector('.modal-content').style.opacity = '0';
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }, 300);
    }

    closeQuizAnswerModal() {
        const modal = document.getElementById('quiz-answer-modal');
        modal.querySelector('.modal-content').style.transform = 'translateY(-60px) scale(0.95)';
        modal.querySelector('.modal-content').style.opacity = '0';
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }, 300);
    }

    closeExamAppointmentModal() {
        const modal = document.getElementById('exam-appointment-modal');
        modal.querySelector('.modal-content').style.transform = 'translateY(-60px) scale(0.95)';
        modal.querySelector('.modal-content').style.opacity = '0';
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }, 300);
    }

    closeExamResultModal() {
        const modal = document.getElementById('exam-result-modal');
        modal.querySelector('.modal-content').style.transform = 'translateY(-60px) scale(0.95)';
        modal.querySelector('.modal-content').style.opacity = '0';
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }, 300);
    }

    closeQuizResultModal() {
        const modal = document.getElementById('quiz-result-modal');
        modal.querySelector('.modal-content').style.transform = 'translateY(-60px) scale(0.95)';
        modal.querySelector('.modal-content').style.opacity = '0';
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }, 300);
    }

    showLoading() {
        const overlay = document.getElementById('loading-overlay');
        overlay.style.display = 'flex';
        overlay.style.opacity = '1';
    }

    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 300);
    }

    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
        <span class="toast-icon">${this.getToastIcon(type)}</span>
        <span>${message}</span>
        `;

        container.appendChild(toast);

        // Auto remove after 5 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
        }, 5000);
    }

    getToastIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️'
        };
        return icons[type] || 'ℹ️';
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDate(dateString) {
        if (!dateString) return 'N/A';

        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch {
            return dateString;
        }
    }

    formatDateTime(dateString) {
        if (!dateString) return 'N/A';

        try {
            const date = new Date(dateString);
            return date.toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateString;
        }
    }

    updateStatusBadges() {
        // Apply status badge classes to all status elements
        document.querySelectorAll('.status-badge').forEach(badge => {
            const status = badge.textContent.toLowerCase().replace(/ /g, '-');
            const statusClasses = [
                'status-passed', 'status-failed', 'status-scheduled',
                'status-in-progress', 'status-completed', 'status-cancelled',
                'status-expired', 'status-taken-but-failed'
            ];

            // Remove existing status classes
            badge.classList.remove(...statusClasses);

            // Add appropriate class
            if (status.includes('passed')) {
                badge.classList.add('status-passed');
            } else if (status.includes('failed') || status.includes('taken-but-failed')) {
                badge.classList.add('status-failed');
            } else if (status.includes('scheduled')) {
                badge.classList.add('status-scheduled');
            } else if (status.includes('in-progress')) {
                badge.classList.add('status-in-progress');
            } else if (status.includes('completed')) {
                badge.classList.add('status-completed');
            } else if (status.includes('cancelled')) {
                badge.classList.add('status-cancelled');
            } else if (status.includes('expired')) {
                badge.classList.add('status-expired');
            } else {
                badge.classList.add('status-cancelled');
            }
        });
    }
}

// Global functions for HTML onclick handlers
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // Activate the clicked tab button
    const activeTabBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    if (activeTabBtn) {
        activeTabBtn.classList.add('active');
    }

    // Activate the corresponding tab content
    const tabContent = document.getElementById(`${tabName}-tab`);
    if (tabContent) {
        tabContent.classList.add('active');
    }

    examManager.currentTab = tabName;
    examManager.loadTabData(tabName);
}

function openCreateExamModal() {
    examManager.openCreateExamModal();
}

function openCreateQuizModal() {
    examManager.openCreateQuizModal();
}

function openCreateExamQuestionModal() {
    examManager.openCreateExamQuestionModal();
}

function openCreateQuizQuestionModal() {
    examManager.openCreateQuizQuestionModal();
}

function openCreateExamAnswerModal() {
    examManager.openCreateExamAnswerModal();
}

function openCreateQuizAnswerModal() {
    examManager.openCreateQuizAnswerModal();
}

function closeExamModal() {
    examManager.closeExamModal();
}

function closeQuizModal() {
    examManager.closeQuizModal();
}

function closeExamQuestionsModal() {
    examManager.closeExamQuestionsModal();
}

function closeQuizQuestionsModal() {
    examManager.closeQuizQuestionsModal();
}

function closeExamQuestionModal() {
    examManager.closeExamQuestionModal();
}

function closeQuizQuestionModal() {
    examManager.closeQuizQuestionModal();
}

function closeExamAnswersModal() {
    examManager.closeExamAnswersModal();
}

function closeQuizAnswersModal() {
    examManager.closeQuizAnswersModal();
}

function closeExamAnswerModal() {
    examManager.closeExamAnswerModal();
}

function closeQuizAnswerModal() {
    examManager.closeQuizAnswerModal();
}

function closeExamAppointmentModal() {
    examManager.closeExamAppointmentModal();
}

function closeExamResultModal() {
    examManager.closeExamResultModal();
}

function closeQuizResultModal() {
    examManager.closeQuizResultModal();
}

// ===== NEW: Global functions for import modals =====
function openImportExamModal() {
    examManager.openImportExamModal();
}

function closeImportExamModal() {
    examManager.closeImportExamModal();
}

function handleExamFileUpload(event) {
    examManager.handleExamFileUpload(event);
}

function validateExamJSON() {
    examManager.validateExamJSON();
}

function submitExamJSON() {
    examManager.submitExamJSON();
}

function openImportQuizModal() {
    examManager.openImportQuizModal();
}

function closeImportQuizModal() {
    examManager.closeImportQuizModal();
}

function handleQuizFileUpload(event) {
    examManager.handleQuizFileUpload(event);
}

function validateQuizJSON() {
    examManager.validateQuizJSON();
}

function submitQuizJSON() {
    examManager.submitQuizJSON();
}

function onCourseSelect(type) {
    examManager.onCourseSelect(type);
}

function onLessonSelect() {
    examManager.onLessonSelect();
}

async function refreshData() {
    await examManager.loadInitialData();
}

// Initialize the exam manager when the page loads
let examManager;
document.addEventListener('DOMContentLoaded', function() {
    examManager = new SelfStudyExamManager();
});