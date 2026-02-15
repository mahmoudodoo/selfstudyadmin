// SelfStudy Media Management JavaScript

class MediaManager {
    constructor() {
        this.currentReplica = null;
        this.currentMediaType = 'profile_images';
        this.currentPage = 1;
        this.totalPages = 1;
        this.selectedMediaId = null;
        this.selectedReferenceId = null;
        this.mediaData = [];
        
        // Cache for external data
        this.externalDataCache = {
            users: { data: [], timestamp: 0, ttl: 300000 }, // 5 minutes
            courses: { data: [], timestamp: 0, ttl: 300000 },
            lessons: { data: [], timestamp: 0, ttl: 300000 },
            exams: { data: [], timestamp: 0, ttl: 300000 }
        };
        
        // Cache for reference names (course_id -> course_name)
        this.referenceCache = {
            users: {},
            courses: {},
            lessons: {},
            exams: {}
        };
        
        // Track course IDs for lessons
        this.lessonToCourseMap = {};
        
        // Flag to prevent multiple simultaneous fetches
        this.isFetchingExternalData = false;
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.updateUI();
        
        // Set initial random replica
        const replicaSelect = document.getElementById('replica-url');
        if (replicaSelect.value) {
            this.currentReplica = replicaSelect.value;
            this.testReplica();
        }
    }
    
    bindEvents() {
        // Replica selection
        document.getElementById('replica-url').addEventListener('change', (e) => {
            this.currentReplica = e.target.value;
            this.testReplica();
            this.loadMedia();
        });
        
        document.getElementById('refresh-replicas').addEventListener('click', () => {
            this.loadReplicas();
        });
        
        // Media type selection
        document.querySelectorAll('.type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentMediaType = e.target.dataset.type;
                this.currentPage = 1;
                this.updateListTitle();
                this.updateTableHeaders();
                this.loadMedia();
            });
        });
        
        // Search
        document.getElementById('search-media').addEventListener('input', (e) => {
            this.filterMedia(e.target.value);
        });
        
        // Add media button
        document.getElementById('add-media').addEventListener('click', () => {
            this.showMediaModal('add');
        });
        
        // Pagination
        document.getElementById('prev-page').addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.loadMedia();
            }
        });
        
        document.getElementById('next-page').addEventListener('click', () => {
            if (this.currentPage < this.totalPages) {
                this.currentPage++;
                this.loadMedia();
            }
        });
        
        // File upload
        const fileInput = document.getElementById('media-file');
        const fileUpload = fileInput.closest('.file-upload');
        
        fileInput.addEventListener('change', (e) => {
            this.updateFilePreview(e.target.files[0]);
        });
        
        // Drag and drop
        fileUpload.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileUpload.classList.add('dragover');
        });
        
        fileUpload.addEventListener('dragleave', () => {
            fileUpload.classList.remove('dragover');
        });
        
        fileUpload.addEventListener('drop', (e) => {
            e.preventDefault();
            fileUpload.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) {
                fileInput.files = e.dataTransfer.files;
                this.updateFilePreview(file);
            }
        });
        
        // Clear file
        document.getElementById('clear-file').addEventListener('click', () => {
            fileInput.value = '';
            document.getElementById('file-name').textContent = 'No file selected';
            document.getElementById('file-preview').classList.remove('active');
            document.getElementById('file-preview').innerHTML = '';
        });
        
        // Media form
        document.getElementById('media-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveMedia();
        });
        
        // Lookup reference
        document.getElementById('lookup-reference').addEventListener('click', () => {
            this.showLookupModal();
        });
        
        // Lookup modal tabs
        document.querySelectorAll('.lookup-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.lookup-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.loadLookupData(e.target.dataset.type);
            });
        });
        
        // Lookup search
        document.getElementById('search-lookup').addEventListener('click', () => {
            const type = document.querySelector('.lookup-tab.active').dataset.type;
            const query = document.getElementById('lookup-search').value;
            this.searchLookupData(type, query);
        });
        
        document.getElementById('lookup-search').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const type = document.querySelector('.lookup-tab.active').dataset.type;
                const query = e.target.value;
                this.searchLookupData(type, query);
            }
        });
        
        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeModal(btn.closest('.modal'));
            });
        });
        
        // Modal cancel buttons
        document.querySelectorAll('.modal-cancel').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeModal(btn.closest('.modal'));
            });
        });
        
        // Confirm delete
        document.getElementById('confirm-delete').addEventListener('click', () => {
            this.deleteMedia();
        });
        
        // Close modals on outside click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal);
                }
            });
        });
    }
    
    async loadReplicas() {
        try {
            this.showLoading('#refresh-replicas');
            const response = await fetch('/selfstudymedia/api/replicas/');
            const data = await response.json();
            
            if (data.status === 'success') {
                const select = document.getElementById('replica-url');
                select.innerHTML = '<option value="">-- Select a replica --</option>';
                
                data.data.forEach(replica => {
                    const option = document.createElement('option');
                    option.value = replica.url;
                    option.textContent = `${replica.url} ${replica.healthy ? '✅' : '❌'}`;
                    select.appendChild(option);
                });
                
                // Select random healthy replica
                const healthyReplicas = data.data.filter(r => r.healthy);
                if (healthyReplicas.length > 0) {
                    const randomIndex = Math.floor(Math.random() * healthyReplicas.length);
                    select.value = healthyReplicas[randomIndex].url;
                    this.currentReplica = healthyReplicas[randomIndex].url;
                    this.testReplica();
                    this.loadMedia();
                }
                
                this.showToast('Replicas refreshed successfully', 'success');
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Failed to load replicas:', error);
            this.showToast('Failed to load replicas', 'error');
        } finally {
            this.hideLoading('#refresh-replicas');
        }
    }
    
    async testReplica() {
        if (!this.currentReplica) return;
        
        const statusElement = document.getElementById('replica-status');
        statusElement.textContent = 'Testing connection...';
        statusElement.className = 'status-indicator';
        
        try {
            // Test by fetching metrics
            const response = await fetch(`${this.currentReplica}/metrics/`, {
                headers: {
                    'Authorization': `Token ${this.getAuthToken()}`
                }
            });
            
            if (response.status === 200 || response.status === 401) {
                statusElement.textContent = 'Connected ✓';
                statusElement.classList.add('connected');
            } else {
                throw new Error('Connection failed');
            }
        } catch (error) {
            statusElement.textContent = 'Connection failed ✗';
            console.error('Replica test failed:', error);
        }
    }
    
    async fetchMedia() {
        if (!this.currentReplica) {
            throw new Error('No replica selected');
        }
        
        const params = new URLSearchParams({
            media_type: this.currentMediaType,
            replica_url: this.currentReplica
        });
        
        const response = await fetch(`/selfstudymedia/api/media/?${params}`);
        const data = await response.json();
        
        if (data.status === 'success') {
            this.mediaData = Array.isArray(data.data) ? data.data : [data.data];
            
            // Load reference data for all media items at once
            await this.loadReferenceDataForMedia();
            
            this.renderMediaTable();
            this.updatePagination();
        } else {
            throw new Error(data.message);
        }
    }
    
    async loadReferenceDataForMedia() {
        // Determine what external data we need based on media type
        let dataTypes = [];
        
        switch(this.currentMediaType) {
            case 'profile_images':
                dataTypes = ['users'];
                break;
            case 'course_images':
                dataTypes = ['courses'];
                break;
            case 'lesson_images':
            case 'lesson_videos':
                dataTypes = ['lessons', 'courses'];
                break;
            case 'instruction_videos':
                dataTypes = ['exams'];
                break;
        }
        
        // Load all required data types
        for (const type of dataTypes) {
            await this.loadExternalData(type);
        }
        
        // Build reference cache for all media items
        this.buildReferenceCache();
    }
    
    async loadExternalData(type) {
        // Check cache first
        const cache = this.externalDataCache[type];
        const now = Date.now();
        
        if (cache.data.length > 0 && (now - cache.timestamp) < cache.ttl && !this.isFetchingExternalData) {
            return cache.data;
        }
        
        try {
            this.isFetchingExternalData = true;
            const response = await fetch(`/selfstudymedia/api/external-data/?type=${type}`);
            const data = await response.json();
            
            if (data.status === 'success') {
                cache.data = data.data;
                cache.timestamp = now;
                
                // Clear old reference cache for this type
                this.referenceCache[type] = {};
                
                // Process and cache the data
                data.data.forEach(item => {
                    if (!item.id) return;
                    
                    let name = '';
                    switch(type) {
                        case 'users':
                            name = item.full_name || item.username || `User ${item.id.substring(0, 8)}`;
                            break;
                        case 'courses':
                            name = item.title || `Course ${item.id.substring(0, 8)}`;
                            break;
                        case 'lessons':
                            name = item.title || `Lesson ${item.id.substring(0, 8)}`;
                            if (item.course_id) {
                                this.lessonToCourseMap[item.id] = item.course_id;
                            }
                            if (item.course_name) {
                                this.referenceCache.courses[item.course_id] = item.course_name;
                            }
                            break;
                        case 'exams':
                            name = item.title || `Exam ${item.id.substring(0, 8)}`;
                            break;
                    }
                    
                    // Store in reference cache
                    this.referenceCache[type][item.id] = name;
                });
                
                return cache.data;
            }
        } catch (error) {
            console.error(`Failed to load ${type}:`, error);
            // Don't clear cache on error, use existing cache if available
        } finally {
            this.isFetchingExternalData = false;
        }
        
        return cache.data || [];
    }
    
    buildReferenceCache() {
        // This method ensures all media items have their reference names cached
        for (const media of this.mediaData) {
            let referenceId, type;
            
            switch(this.currentMediaType) {
                case 'profile_images':
                    referenceId = media.user_id;
                    type = 'users';
                    // Also check if media has username field
                    if (media.username && !this.referenceCache[type][referenceId]) {
                        this.referenceCache[type][referenceId] = media.username;
                    }
                    break;
                case 'course_images':
                    referenceId = media.course_id;
                    type = 'courses';
                    // Also check if media has course_name field
                    if (media.course_name && !this.referenceCache[type][referenceId]) {
                        this.referenceCache[type][referenceId] = media.course_name;
                    }
                    break;
                case 'lesson_images':
                case 'lesson_videos':
                    referenceId = media.lesson_id;
                    type = 'lessons';
                    // Also check if media has lesson_name field
                    if (media.lesson_name && !this.referenceCache[type][referenceId]) {
                        this.referenceCache[type][referenceId] = media.lesson_name;
                    }
                    // Also check if media has course_name field
                    if (media.course_name) {
                        const courseId = this.lessonToCourseMap[referenceId];
                        if (courseId && !this.referenceCache.courses[courseId]) {
                            this.referenceCache.courses[courseId] = media.course_name;
                        }
                    }
                    break;
                case 'instruction_videos':
                    referenceId = media.exam_id;
                    type = 'exams';
                    // Also check if media has exam_name field
                    if (media.exam_name && !this.referenceCache[type][referenceId]) {
                        this.referenceCache[type][referenceId] = media.exam_name;
                    }
                    break;
            }
            
            if (referenceId && !this.referenceCache[type][referenceId]) {
                // If not in cache, create a placeholder
                let placeholder = '';
                switch(type) {
                    case 'users':
                        placeholder = `User ${referenceId.substring(0, 8)}`;
                        break;
                    case 'courses':
                        placeholder = `Course ${referenceId.substring(0, 8)}`;
                        break;
                    case 'lessons':
                        placeholder = `Lesson ${referenceId.substring(0, 8)}`;
                        break;
                    case 'exams':
                        placeholder = `Exam ${referenceId.substring(0, 8)}`;
                        break;
                }
                this.referenceCache[type][referenceId] = placeholder;
            }
        }
    }
    
    getReferenceName(referenceId) {
        if (!referenceId) return 'Unknown';
        
        let type = '';
        switch(this.currentMediaType) {
            case 'profile_images':
                type = 'users';
                break;
            case 'course_images':
                type = 'courses';
                break;
            case 'lesson_images':
            case 'lesson_videos':
                type = 'lessons';
                break;
            case 'instruction_videos':
                type = 'exams';
                break;
        }
        
        // Check if we have a cached name
        const cachedName = this.referenceCache[type][referenceId];
        if (cachedName) {
            // Don't return IDs that look like UUIDs
            const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (uuidPattern.test(cachedName) || cachedName.startsWith('ID:')) {
                return `Unknown ${type.slice(0, -1)}`;
            }
            return cachedName;
        }
        
        return `Unknown ${type.slice(0, -1)}`;
    }
    
    getCourseNameForLesson(lessonId) {
        if (!lessonId) return 'No Course';
        
        const courseId = this.lessonToCourseMap[lessonId];
        if (!courseId) return 'No Course';
        
        const courseName = this.referenceCache.courses[courseId];
        if (!courseName) return 'No Course';
        
        // Don't return IDs that look like UUIDs
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidPattern.test(courseName) || courseName.startsWith('ID:')) {
            return 'Unnamed Course';
        }
        
        return courseName;
    }
    
    renderMediaTable() {
        const tbody = document.getElementById('media-table-body');
        
        if (!this.mediaData || this.mediaData.length === 0) {
            this.renderEmptyTable('No media items found');
            return;
        }
        
        tbody.innerHTML = '';
        
        this.mediaData.forEach(media => {
            const row = document.createElement('tr');
            
            // Determine reference ID based on media type
            let referenceId = '';
            let referenceName = '';
            let courseName = '';
            
            // Get reference name from media fields first, then from cache
            if (this.currentMediaType === 'profile_images') {
                referenceId = media.user_id;
                referenceName = media.username || this.getReferenceName(referenceId);
            } else if (this.currentMediaType === 'course_images') {
                referenceId = media.course_id;
                referenceName = media.course_name || this.getReferenceName(referenceId);
            } else if (this.currentMediaType === 'lesson_images' || this.currentMediaType === 'lesson_videos') {
                referenceId = media.lesson_id;
                referenceName = media.lesson_name || this.getReferenceName(referenceId);
                courseName = media.course_name || this.getCourseNameForLesson(referenceId);
            } else if (this.currentMediaType === 'instruction_videos') {
                referenceId = media.exam_id;
                referenceName = media.exam_name || this.getReferenceName(referenceId);
            }
            
            // Get file URL
            const fileUrl = media.image || media.video;
            const isVideo = this.currentMediaType.includes('video');
            const initials = this.getInitials(referenceName);
            
            // Create thumbnail
            let thumbnailHtml = '';
            if (fileUrl) {
                // Create image element that will show fallback only on error
                thumbnailHtml = `
                    <div class="media-thumbnail ${isVideo ? 'video-thumbnail' : ''}" 
                         data-url="${fileUrl}" data-name="${referenceName}">
                        ${!isVideo ? `
                            <img src="${fileUrl}" alt="${referenceName}" 
                                 class="thumbnail-image"
                                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                            <div class="thumbnail-initials" style="background-color: ${this.getColorForInitials(initials)}; display: none;">
                                ${initials}
                            </div>
                        ` : `
                            <div class="thumbnail-initials" style="background-color: ${this.getColorForInitials(initials)}">
                                ${initials}
                            </div>
                            <div class="play-icon">▶</div>
                        `}
                    </div>
                `;
            } else {
                // No file URL - show fallback immediately
                thumbnailHtml = `
                    <div class="media-thumbnail no-file" style="background-color: ${this.getColorForInitials(initials)}">
                        <div class="thumbnail-initials">
                            ${initials}
                        </div>
                    </div>
                `;
            }
            
            // Build row HTML based on media type
            let rowHtml = '';
            
            if (this.currentMediaType === 'profile_images') {
                rowHtml = `
                    <td>${media.id || 'N/A'}</td>
                    <td>${referenceName}</td>
                    <td>${thumbnailHtml}</td>
                    <td>${new Date(media.created_at).toLocaleDateString()}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-view" data-id="${referenceId}">View</button>
                            <button class="btn-edit" data-id="${referenceId}">Edit</button>
                            <button class="btn-delete" data-id="${referenceId}">Delete</button>
                        </div>
                    </td>
                `;
            } else if (this.currentMediaType === 'course_images') {
                rowHtml = `
                    <td>${media.id || 'N/A'}</td>
                    <td>${referenceName}</td>
                    <td>${thumbnailHtml}</td>
                    <td>${new Date(media.created_at).toLocaleDateString()}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-view" data-id="${referenceId}">View</button>
                            <button class="btn-edit" data-id="${referenceId}">Edit</button>
                            <button class="btn-delete" data-id="${referenceId}">Delete</button>
                        </div>
                    </td>
                `;
            } else if (this.currentMediaType === 'lesson_images' || this.currentMediaType === 'lesson_videos') {
                rowHtml = `
                    <td>${media.id || 'N/A'}</td>
                    <td>${referenceName}</td>
                    <td>${courseName}</td>
                    <td>${thumbnailHtml}</td>
                    <td>${new Date(media.created_at).toLocaleDateString()}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-view" data-id="${referenceId}">View</button>
                            <button class="btn-edit" data-id="${referenceId}">Edit</button>
                            <button class="btn-delete" data-id="${referenceId}">Delete</button>
                        </div>
                    </td>
                `;
            } else if (this.currentMediaType === 'instruction_videos') {
                rowHtml = `
                    <td>${media.id || 'N/A'}</td>
                    <td>${referenceName}</td>
                    <td>${thumbnailHtml}</td>
                    <td>${new Date(media.created_at).toLocaleDateString()}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-view" data-id="${referenceId}">View</button>
                            <button class="btn-edit" data-id="${referenceId}">Edit</button>
                            <button class="btn-delete" data-id="${referenceId}">Delete</button>
                        </div>
                    </td>
                `;
            }
            
            row.innerHTML = rowHtml;
            tbody.appendChild(row);
        });
        
        // Add event listeners to action buttons
        tbody.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const referenceId = e.target.dataset.id;
                this.viewMedia(referenceId);
            });
        });
        
        tbody.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const referenceId = e.target.dataset.id;
                this.showMediaModal('edit', referenceId);
            });
        });
        
        tbody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const referenceId = e.target.dataset.id;
                this.showDeleteModal(referenceId);
            });
        });
        
        // Add event listeners to thumbnails
        tbody.querySelectorAll('.media-thumbnail').forEach(thumbnail => {
            thumbnail.addEventListener('click', (e) => {
                const fileUrl = e.currentTarget.dataset.url;
                const name = e.currentTarget.dataset.name;
                if (fileUrl) {
                    this.viewMediaByUrl(fileUrl, name);
                }
            });
        });
    }
    
    getInitials(name) {
        if (!name) return '??';
        
        // Remove any numbers or special characters for initials
        const letters = name.match(/[A-Za-z]/g);
        if (letters && letters.length >= 2) {
            return (letters[0] + letters[1]).toUpperCase();
        }
        
        // Fallback to first two characters
        const cleanName = name.replace(/[^A-Za-z0-9]/g, '');
        if (cleanName.length >= 2) {
            return cleanName.substring(0, 2).toUpperCase();
        }
        
        return '??';
    }
    
    getColorForInitials(initials) {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
            '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
        ];
        if (!initials || initials === '??') return '#6c757d';
        const index = (initials.charCodeAt(0) + (initials.charCodeAt(1) || 0)) % colors.length;
        return colors[index];
    }
    
    updateTableHeaders() {
        const thead = document.getElementById('table-headers');
        let headers = '';
        
        switch(this.currentMediaType) {
            case 'profile_images':
                headers = `
                    <th>ID</th>
                    <th>Username</th>
                    <th>Image</th>
                    <th>Created</th>
                    <th>Actions</th>
                `;
                break;
            case 'course_images':
                headers = `
                    <th>ID</th>
                    <th>Course Name</th>
                    <th>Image</th>
                    <th>Created</th>
                    <th>Actions</th>
                `;
                break;
            case 'lesson_images':
            case 'lesson_videos':
                headers = `
                    <th>ID</th>
                    <th>Lesson Name</th>
                    <th>Course Name</th>
                    <th>${this.currentMediaType === 'lesson_images' ? 'Image' : 'Video'}</th>
                    <th>Created</th>
                    <th>Actions</th>
                `;
                break;
            case 'instruction_videos':
                headers = `
                    <th>ID</th>
                    <th>Exam Name</th>
                    <th>Video</th>
                    <th>Created</th>
                    <th>Actions</th>
                `;
                break;
        }
        
        thead.innerHTML = headers;
    }
    
    renderEmptyTable(message) {
        const tbody = document.getElementById('media-table-body');
        const colCount = document.getElementById('table-headers').children.length;
        tbody.innerHTML = `
            <tr>
                <td colspan="${colCount}" class="empty-state">${message}</td>
            </tr>
        `;
    }
    
    showTableLoading() {
        const tbody = document.getElementById('media-table-body');
        const colCount = document.getElementById('table-headers').children.length;
        tbody.innerHTML = `
            <tr>
                <td colspan="${colCount}" class="empty-state">
                    <div class="loading">Loading...</div>
                </td>
            </tr>
        `;
    }
    
    async loadMedia() {
        try {
            this.showTableLoading();
            await this.fetchMedia();
        } catch (error) {
            console.error('Failed to load media:', error);
            this.showToast(`Failed to load media: ${error.message}`, 'error');
            this.renderEmptyTable('Failed to load media data');
        }
    }
    
    updateUI() {
        this.updateListTitle();
        this.updateTableHeaders();
        this.updatePagination();
    }
    
    updateListTitle() {
        const title = document.getElementById('list-title');
        const typeLabels = {
            'profile_images': 'Profile Images',
            'course_images': 'Course Images',
            'lesson_images': 'Lesson Images',
            'lesson_videos': 'Lesson Videos',
            'instruction_videos': 'Instruction Videos'
        };
        title.textContent = typeLabels[this.currentMediaType] || 'Media';
    }
    
    updatePagination() {
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        const pageInfo = document.getElementById('page-info');
        
        prevBtn.disabled = this.currentPage <= 1;
        nextBtn.disabled = this.currentPage >= this.totalPages;
        pageInfo.textContent = `Page ${this.currentPage} of ${this.totalPages}`;
    }
    
    async viewMedia(referenceId) {
        const media = this.mediaData.find(m => {
            if (this.currentMediaType === 'profile_images') return m.user_id === referenceId;
            if (this.currentMediaType === 'course_images') return m.course_id === referenceId;
            if (this.currentMediaType === 'lesson_images' || this.currentMediaType === 'lesson_videos') return m.lesson_id === referenceId;
            if (this.currentMediaType === 'instruction_videos') return m.exam_id === referenceId;
            return false;
        });
        
        if (!media) return;
        
        const fileUrl = media.image || media.video;
        let referenceName = '';
        if (this.currentMediaType === 'profile_images') {
            referenceName = media.username || this.getReferenceName(referenceId);
        } else if (this.currentMediaType === 'course_images') {
            referenceName = media.course_name || this.getReferenceName(referenceId);
        } else if (this.currentMediaType === 'lesson_images' || this.currentMediaType === 'lesson_videos') {
            referenceName = media.lesson_name || this.getReferenceName(referenceId);
        } else if (this.currentMediaType === 'instruction_videos') {
            referenceName = media.exam_name || this.getReferenceName(referenceId);
        }
        
        if (fileUrl) {
            this.viewMediaByUrl(fileUrl, referenceName);
        } else {
            this.showPreviewFallback(referenceName);
        }
    }
    
    viewMediaByUrl(fileUrl, referenceName = '') {
        const preview = document.getElementById('media-preview-content');
        const extension = fileUrl.split('.').pop().toLowerCase();
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(extension);
        const isVideo = ['mp4', 'avi', 'mov', 'webm', 'mkv', 'flv', 'wmv'].includes(extension);
        
        if (isImage) {
            const img = new Image();
            img.src = fileUrl;
            img.alt = referenceName;
            img.className = 'preview-image';
            img.onload = () => {
                preview.innerHTML = '';
                preview.appendChild(img);
            };
            img.onerror = () => {
                this.showPreviewFallback(referenceName, false);
            };
            preview.innerHTML = '<div class="loading">Loading image...</div>';
        } else if (isVideo) {
            const video = document.createElement('video');
            video.controls = true;
            video.className = 'preview-video';
            video.innerHTML = `
                <source src="${fileUrl}" type="video/${extension === 'mov' ? 'quicktime' : extension}">
                Your browser does not support the video tag.
            `;
            video.addEventListener('error', () => {
                this.showPreviewFallback(referenceName, true);
            });
            preview.innerHTML = '';
            preview.appendChild(video);
        } else {
            this.showPreviewFallback(referenceName, isVideo);
        }
    }
    
    showPreviewFallback(name, isVideo = false) {
        const preview = document.getElementById('media-preview-content');
        const initials = this.getInitials(name);
        
        preview.innerHTML = `
            <div class="preview-fallback" style="background-color: ${this.getColorForInitials(initials)}">
                <div class="preview-initials">${initials}</div>
                <div class="preview-message">${isVideo ? 'Video' : 'Image'} not available</div>
                ${name ? `<div class="preview-name">${name}</div>` : ''}
            </div>
        `;
    }
    
    showMediaModal(mode, referenceId = null) {
        if (!this.currentReplica) {
            this.showToast('Please select a replica first', 'warning');
            return;
        }
        
        this.selectedReferenceId = referenceId;
        const modal = document.getElementById('media-modal');
        const title = document.getElementById('modal-title');
        const form = document.getElementById('media-form');
        const label = document.getElementById('reference-label');
        
        // Set modal title
        title.textContent = mode === 'add' ? 'Add Media' : 'Edit Media';
        
        // Set form values
        document.getElementById('media-type').value = this.currentMediaType;
        document.getElementById('form-replica-url').value = this.currentReplica;
        
        // Clear form
        form.reset();
        document.getElementById('file-name').textContent = 'No file selected';
        document.getElementById('file-preview').classList.remove('active');
        document.getElementById('file-preview').innerHTML = '';
        document.getElementById('reference-details').classList.remove('active');
        
        // Create hidden inputs for reference name and course name
        this.removeHiddenInputs();
        
        // Set label based on media type
        switch(this.currentMediaType) {
            case 'profile_images':
                label.textContent = 'User ID:';
                break;
            case 'course_images':
                label.textContent = 'Course ID:';
                break;
            case 'lesson_images':
            case 'lesson_videos':
                label.textContent = 'Lesson ID:';
                break;
            case 'instruction_videos':
                label.textContent = 'Exam ID:';
                break;
        }
        
        // If editing, load media data
        if (mode === 'edit' && referenceId) {
            document.getElementById('reference-id').value = referenceId;
            
            // Try to show reference name
            const referenceName = this.getReferenceName(referenceId);
            if (referenceName !== referenceId) {
                const details = document.getElementById('reference-details');
                details.innerHTML = `<strong>Selected:</strong> ${referenceName}`;
                details.classList.add('active');
                
                // Add hidden input for reference name
                this.addHiddenInput('reference_name', referenceName);
                
                // For lessons, also add course name
                if (this.currentMediaType === 'lesson_images' || this.currentMediaType === 'lesson_videos') {
                    const courseName = this.getCourseNameForLesson(referenceId);
                    if (courseName && courseName !== 'No Course') {
                        this.addHiddenInput('course_name', courseName);
                    }
                }
            }
        }
        
        modal.classList.add('active');
    }
    
    removeHiddenInputs() {
        // Remove any existing hidden inputs
        const existingHiddenInputs = document.querySelectorAll('input[type="hidden"]');
        existingHiddenInputs.forEach(input => {
            if (input.id !== 'media-id' && input.id !== 'media-type' && input.id !== 'form-replica-url') {
                input.remove();
            }
        });
    }
    
    addHiddenInput(name, value) {
        const form = document.getElementById('media-form');
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
    }
    
    async saveMedia() {
        try {
            const form = document.getElementById('media-form');
            const formData = new FormData(form);
            
            // Validate required fields
            const referenceId = formData.get('reference_id');
            const file = formData.get('file');
            
            if (!referenceId) {
                this.showToast('Reference ID is required', 'error');
                return;
            }
            
            if (!file || file.size === 0) {
                this.showToast('Media file is required', 'error');
                return;
            }
            
            this.showLoading('#media-form button[type="submit"]');
            
            const response = await fetch('/selfstudymedia/api/media/', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                this.showToast(data.message, 'success');
                this.closeModal(document.getElementById('media-modal'));
                this.loadMedia();
            } else {
                throw new Error(data.message);
            }
            
        } catch (error) {
            console.error('Failed to save media:', error);
            this.showToast(`Failed to save media: ${error.message}`, 'error');
        } finally {
            this.hideLoading('#media-form button[type="submit"]');
        }
    }
    
    showDeleteModal(referenceId) {
        this.selectedReferenceId = referenceId;
        const modal = document.getElementById('delete-modal');
        const message = document.getElementById('delete-message');
        
        const referenceName = this.getReferenceName(referenceId);
        message.textContent = `Are you sure you want to delete media for "${referenceName}"? This action cannot be undone.`;
        
        modal.classList.add('active');
    }
    
    async deleteMedia() {
        try {
            if (!this.selectedReferenceId) return;
            
            const response = await fetch('/selfstudymedia/api/media/', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify({
                    reference_id: this.selectedReferenceId,
                    media_type: this.currentMediaType,
                    replica_url: this.currentReplica
                })
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                this.showToast(data.message, 'success');
                this.closeModal(document.getElementById('delete-modal'));
                this.loadMedia();
            } else {
                throw new Error(data.message);
            }
            
        } catch (error) {
            console.error('Failed to delete media:', error);
            this.showToast(`Failed to delete media: ${error.message}`, 'error');
        }
    }
    
    showLookupModal() {
        const modal = document.getElementById('lookup-modal');
        modal.classList.add('active');
        
        // Determine which tab to show based on media type
        let defaultTab = 'users';
        if (this.currentMediaType === 'course_images') {
            defaultTab = 'courses';
        } else if (this.currentMediaType === 'lesson_images' || this.currentMediaType === 'lesson_videos') {
            defaultTab = 'lessons';
        } else if (this.currentMediaType === 'instruction_videos') {
            defaultTab = 'exams';
        }
        
        // Activate the correct tab
        document.querySelectorAll('.lookup-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.type === defaultTab) {
                tab.classList.add('active');
            }
        });
        
        // Load initial data
        this.loadLookupData(defaultTab);
    }
    
    async loadLookupData(type) {
        try {
            const data = await this.loadExternalData(type);
            
            if (data.length > 0) {
                this.renderLookupTable(type, data);
            } else {
                this.renderEmptyLookupTable();
            }
        } catch (error) {
            console.error(`Failed to load ${type}:`, error);
            this.showToast(`Failed to load ${type}: ${error.message}`, 'error');
            this.renderEmptyLookupTable();
        }
    }
    
    renderLookupTable(type, data) {
        const tbody = document.getElementById('lookup-results-body');
        
        tbody.innerHTML = '';
        
        data.forEach(item => {
            const row = document.createElement('tr');
            
            const idField = item.id || 'N/A';
            const nameField = this.referenceCache[type][item.id] || item.id || 'Unknown';
            // For lessons, include course name if available
            const courseName = item.course_name || '';
            
            row.innerHTML = `
                <td>${idField}</td>
                <td>
                    ${nameField}
                    ${courseName ? `<div style="font-size: 0.8em; color: #666;">Course: ${courseName}</div>` : ''}
                </td>
                <td>
                    <button class="select-btn" data-id="${idField}" data-name="${nameField}" data-course="${courseName}">
                        Select
                    </button>
                </td>
            `;
            
            tbody.appendChild(row);
        });
        
        // Add event listeners to select buttons
        tbody.querySelectorAll('.select-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                const name = e.target.dataset.name;
                const courseName = e.target.dataset.course;
                this.selectReference(id, name, courseName);
            });
        });
    }
    
    renderEmptyLookupTable(message = 'No data available') {
        const tbody = document.getElementById('lookup-results-body');
        tbody.innerHTML = `
            <tr>
                <td colspan="3" style="text-align: center; padding: 40px; color: #6c757d; font-style: italic;">
                    ${message}
                </td>
            </tr>
        `;
    }
    
    selectReference(id, name, courseName = '') {
        // Update reference ID field
        document.getElementById('reference-id').value = id;
        
        // Remove existing hidden inputs
        this.removeHiddenInputs();
        
        // Add reference name as hidden input
        this.addHiddenInput('reference_name', name);
        
        // For lessons, also add course name if available
        if (courseName && (this.currentMediaType === 'lesson_images' || this.currentMediaType === 'lesson_videos')) {
            this.addHiddenInput('course_name', courseName);
        }
        
        // Show reference details
        const details = document.getElementById('reference-details');
        let detailsHtml = `<strong>Selected:</strong> ${name}`;
        if (courseName) {
            detailsHtml += `<br><strong>Course:</strong> ${courseName}`;
        }
        details.innerHTML = detailsHtml;
        details.classList.add('active');
        
        // Close only the lookup modal
        this.closeModal(document.getElementById('lookup-modal'));
    }
    
    searchLookupData(type, query) {
        const data = this.externalDataCache[type].data;
        
        if (!query || !data || data.length === 0) {
            this.renderLookupTable(type, data);
            return;
        }
        
        const filtered = data.filter(item => {
            const searchable = JSON.stringify(item).toLowerCase();
            return searchable.includes(query.toLowerCase());
        });
        
        if (filtered.length === 0) {
            this.renderEmptyLookupTable('No matching results found');
            return;
        }
        
        this.renderLookupTable(type, filtered);
    }
    
    updateFilePreview(file) {
        if (!file) return;
        
        const fileName = document.getElementById('file-name');
        const preview = document.getElementById('file-preview');
        
        fileName.textContent = file.name;
        
        // Clear previous preview
        preview.innerHTML = '';
        preview.classList.remove('active');
        
        // Check file type
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.innerHTML = `<img src="${e.target.result}" alt="Preview" style="max-width: 100%; max-height: 200px;">`;
                preview.classList.add('active');
            };
            reader.readAsDataURL(file);
        } else if (file.type.startsWith('video/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.innerHTML = `
                    <video controls style="max-width: 100%; max-height: 200px;">
                        <source src="${e.target.result}" type="${file.type}">
                        Your browser does not support the video tag.
                    </video>
                `;
                preview.classList.add('active');
            };
            reader.readAsDataURL(file);
        } else {
            preview.innerHTML = `<p>File type: ${file.type}</p>`;
            preview.classList.add('active');
        }
    }
    
    filterMedia(query) {
        if (!query) {
            this.renderMediaTable();
            return;
        }
        
        const filtered = this.mediaData.filter(media => {
            const searchable = JSON.stringify(media).toLowerCase();
            return searchable.includes(query.toLowerCase());
        });
        
        const tbody = document.getElementById('media-table-body');
        tbody.innerHTML = '';
        
        if (filtered.length === 0) {
            this.renderEmptyTable('No matching media items found');
            return;
        }
        
        // Re-render filtered data (simplified)
        filtered.forEach(media => {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="6">Filtered item - use search with proper implementation</td>';
            tbody.appendChild(row);
        });
    }
    
    closeModal(modal) {
        if (modal) {
            modal.classList.remove('active');
        }
    }
    
    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type}`;
        
        // Show toast
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        // Hide after 5 seconds
        setTimeout(() => {
            toast.classList.remove('show');
        }, 5000);
    }
    
    showLoading(selector) {
        const element = document.querySelector(selector);
        if (element) {
            element.classList.add('loading');
            element.disabled = true;
        }
    }
    
    hideLoading(selector) {
        const element = document.querySelector(selector);
        if (element) {
            element.classList.remove('loading');
            element.disabled = false;
        }
    }
    
    getCsrfToken() {
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
    
    getAuthToken() {
        // This should return the actual auth token from your Django context
        return document.body.dataset.authToken || '';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.mediaManager = new MediaManager();
});