// SelfStudy User Lab Management JavaScript
class SelfStudyUserLabManager {
    constructor() {
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.currentStudentId = null;
        this.students = [];
        this.filteredStudents = [];
        this.selectedReplica = null;
        
        this.initializeEventListeners();
        this.loadInitialData();
    }

    initializeEventListeners() {
        // Modal controls
        document.getElementById('addStudentBtn')?.addEventListener('click', () => this.openStudentModal());
        document.getElementById('addFirstStudentBtn')?.addEventListener('click', () => this.openStudentModal());
        document.getElementById('modalClose')?.addEventListener('click', () => this.closeStudentModal());
        document.getElementById('cancelBtn')?.addEventListener('click', () => this.closeStudentModal());
        document.getElementById('saveStudentBtn')?.addEventListener('click', () => this.saveStudent());
        
        // Delete modal controls
        document.getElementById('deleteModalClose')?.addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('cancelDeleteBtn')?.addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('confirmDeleteBtn')?.addEventListener('click', () => this.confirmDelete());
        
        // Refresh and search
        document.getElementById('refreshBtn')?.addEventListener('click', () => this.refreshData());
        document.getElementById('retryBtn')?.addEventListener('click', () => this.refreshData());
        document.getElementById('refreshReplicasBtn')?.addEventListener('click', () => this.refreshReplicaStatus());
        document.getElementById('searchInput')?.addEventListener('input', (e) => this.handleSearch(e.target.value));
        document.getElementById('statusFilter')?.addEventListener('change', (e) => this.handleFilter(e.target.value));
        
        // Pagination
        document.getElementById('prevPage')?.addEventListener('click', () => this.previousPage());
        document.getElementById('nextPage')?.addEventListener('click', () => this.nextPage());
        
        // Form submission
        document.getElementById('studentForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveStudent();
        });
        
        // Replica selection
        this.initializeReplicaSelection();
    }

    initializeReplicaSelection() {
        // Add click listeners to replica select buttons
        document.querySelectorAll('.btn-select-replica').forEach(button => {
            button.addEventListener('click', (e) => {
                const replicaCard = e.target.closest('.replica-card');
                const replicaUrl = replicaCard.dataset.replicaUrl;
                this.selectReplica(replicaUrl);
            });
        });
    }

    async selectReplica(replicaUrl) {
        try {
            const response = await fetch('/selfstudyuserlab/api/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({
                    action: 'set_replica',
                    replica_url: replicaUrl
                })
            });
            
            const result = await response.json();
            
            if (result.error) {
                throw new Error(result.error);
            }
            
            this.selectedReplica = replicaUrl;
            document.getElementById('selectedReplicaUrl').textContent = replicaUrl;
            this.showToast('Success', `Replica set to ${replicaUrl}`, 'success');
            
            // Update UI to show selected replica
            this.updateReplicaSelectionUI();
            
            // Reload data from the selected replica
            await this.refreshData();
            
        } catch (error) {
            console.error('Error selecting replica:', error);
            this.showToast('Error', error.message, 'error');
        }
    }

    updateReplicaSelectionUI() {
        // Remove selected class from all replicas
        document.querySelectorAll('.replica-card').forEach(card => {
            card.classList.remove('replica-selected');
        });
        
        // Add selected class to current replica
        if (this.selectedReplica) {
            const selectedCard = document.querySelector(`[data-replica-url="${this.selectedReplica}"]`);
            if (selectedCard) {
                selectedCard.classList.add('replica-selected');
            }
        }
    }

    async refreshReplicaStatus() {
        const refreshBtn = document.getElementById('refreshReplicasBtn');
        const originalText = refreshBtn.innerHTML;
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
        refreshBtn.disabled = true;
        
        try {
            const response = await fetch('/selfstudyuserlab/api/?action=get_replica_status');
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            this.updateReplicaGrid(data);
            this.showToast('Success', 'Replica status updated', 'success');
            
        } catch (error) {
            console.error('Error refreshing replica status:', error);
            this.showToast('Error', error.message, 'error');
        } finally {
            refreshBtn.innerHTML = originalText;
            refreshBtn.disabled = false;
        }
    }

    updateReplicaGrid(replicas) {
        const replicaGrid = document.getElementById('replicaGrid');
        replicaGrid.innerHTML = replicas.map(replica => `
            <div class="replica-card ${replica.status === 'healthy' ? 'replica-healthy' : 'replica-unhealthy'} ${this.selectedReplica === replica.url ? 'replica-selected' : ''}" 
                 data-replica-url="${replica.url}">
                <div class="replica-status">
                    <div class="status-indicator ${replica.status === 'healthy' ? 'status-healthy' : 'status-unhealthy'}"></div>
                    <span class="status-text">${replica.status.charAt(0).toUpperCase() + replica.status.slice(1)}</span>
                </div>
                <div class="replica-url">${replica.url}</div>
                <div class="replica-actions">
                    <button class="btn btn-sm btn-select-replica" 
                            ${replica.status !== 'healthy' ? 'disabled' : ''}>
                        <i class="fas fa-check"></i> Select
                    </button>
                </div>
            </div>
        `).join('');
        
        // Update replica count
        const healthyCount = replicas.filter(r => r.status === 'healthy').length;
        document.getElementById('replicaCount').textContent = healthyCount;
        
        // Re-initialize event listeners
        this.initializeReplicaSelection();
    }

    async loadInitialData() {
        this.showLoadingState();
        
        try {
            await Promise.all([
                this.loadStudents(),
                this.loadStudentCount()
            ]);
        } catch (error) {
            this.showErrorState('Failed to load initial data');
        }
    }

    async loadStudents() {
        try {
            // Build URL with selected replica parameter if set
            let url = '/selfstudyuserlab/api/?action=get_students';
            if (this.selectedReplica) {
                url += `&replica_url=${encodeURIComponent(this.selectedReplica)}`;
            }
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            this.students = Array.isArray(data) ? data : [];
            this.filteredStudents = [...this.students];
            this.renderStudentsTable();
            this.updatePagination();
            
        } catch (error) {
            console.error('Error loading students:', error);
            this.showErrorState(error.message);
        }
    }

    async loadStudentCount() {
        try {
            // Build URL with selected replica parameter if set
            let url = '/selfstudyuserlab/api/?action=get_student_count';
            if (this.selectedReplica) {
                url += `&replica_url=${encodeURIComponent(this.selectedReplica)}`;
            }
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            document.getElementById('studentCount').textContent = data.student_count || 0;
            
        } catch (error) {
            console.error('Error loading student count:', error);
        }
    }

    renderStudentsTable() {
        const tableBody = document.getElementById('studentsTableBody');
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const currentStudents = this.filteredStudents.slice(startIndex, endIndex);
        
        if (currentStudents.length === 0) {
            this.showEmptyState();
            return;
        }
        
        tableBody.innerHTML = currentStudents.map(student => `
            <tr>
                <td>
                    <div class="student-username">
                        <strong>${this.escapeHtml(student.username)}</strong>
                    </div>
                </td>
                <td>
                    <code class="uuid-code">${student.uuid_credentials}</code>
                </td>
                <td>${this.formatDate(student.created_at)}</td>
                <td>${this.formatDate(student.expire_date)}</td>
                <td>
                    <span class="status-badge ${this.getStatusClass(student.expire_date)}">
                        ${this.getStatusText(student.expire_date)}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn btn-edit" onclick="labManager.editStudent(${student.id})" 
                                title="Edit Student">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn btn-delete" onclick="labManager.deleteStudent(${student.id})" 
                                title="Delete Student">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
        
        this.hideAllStates();
        document.getElementById('studentsTable').style.display = 'table';
        document.getElementById('paginationContainer').style.display = 'flex';
    }

    openStudentModal(student = null) {
        const modal = document.getElementById('studentModal');
        const title = document.getElementById('modalTitle');
        const form = document.getElementById('studentForm');
        
        // Update the current operation replica info
        const currentOpReplica = document.getElementById('currentOperationReplica');
        if (this.selectedReplica) {
            currentOpReplica.textContent = this.selectedReplica;
            currentOpReplica.style.color = 'var(--success-600)';
        } else {
            currentOpReplica.textContent = 'Auto-selected (Random)';
            currentOpReplica.style.color = 'var(--text-secondary)';
        }
        
        if (student) {
            // Edit mode
            title.textContent = 'Edit Student';
            this.currentStudentId = student.id;
            
            // Populate form fields
            document.getElementById('username').value = student.username;
            document.getElementById('createdAt').value = this.formatDateForInput(student.created_at);
            document.getElementById('expireDate').value = this.formatDateForInput(student.expire_date);
            document.getElementById('uuidCredentials').value = student.uuid_credentials;
            
            // Make username editable in edit mode
            document.getElementById('username').readOnly = false;
        } else {
            // Create mode
            title.textContent = 'Add New Student';
            this.currentStudentId = null;
            form.reset();
            
            // Set default expire date to 30 days from now
            const defaultExpireDate = new Date();
            defaultExpireDate.setDate(defaultExpireDate.getDate() + 30);
            document.getElementById('expireDate').value = this.formatDateForInput(defaultExpireDate.toISOString());
            
            // Generate placeholder UUID
            document.getElementById('uuidCredentials').value = 'Auto-generated on save';
            
            // Username should be editable in create mode
            document.getElementById('username').readOnly = false;
        }
        
        modal.style.display = 'flex';
        document.getElementById('username').focus();
    }


    closeStudentModal() {
        document.getElementById('studentModal').style.display = 'none';
        document.getElementById('studentForm').reset();
        this.currentStudentId = null;
    }

    async saveStudent() {
        const form = document.getElementById('studentForm');
        const formData = new FormData(form);
        const studentData = {
            username: formData.get('username'),
            expire_date: formData.get('expire_date')
        };
        
        // REMOVED: No replica selection from modal - use current selected replica
        
        // Validation
        if (!studentData.username) {
            this.showToast('Error', 'Username is required', 'error');
            return;
        }
        
        const saveButton = document.getElementById('saveStudentBtn');
        const originalText = saveButton.innerHTML;
        saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        saveButton.disabled = true;
        
        try {
            let response;
            const requestData = {
                student_data: studentData
            };
            
            // Use the currently selected replica for the operation
            // The backend will use the replica set via set_replica action
            // No need to pass selected_replica in the request
            
            if (this.currentStudentId) {
                // Update existing student
                requestData.action = 'update_student';
                requestData.student_id = this.currentStudentId;
            } else {
                // Create new student
                requestData.action = 'create_student';
            }
            
            response = await fetch('/selfstudyuserlab/api/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify(requestData)
            });
            
            const result = await response.json();
            
            if (result.error) {
                throw new Error(result.error);
            }
            
            this.showToast(
                'Success', 
                this.currentStudentId ? 'Student updated successfully' : 'Student created successfully', 
                'success'
            );
            
            this.closeStudentModal();
            await this.refreshData();
            
        } catch (error) {
            console.error('Error saving student:', error);
            this.showToast('Error', error.message, 'error');
        } finally {
            saveButton.innerHTML = originalText;
            saveButton.disabled = false;
        }
    }

    editStudent(studentId) {
        const student = this.students.find(s => s.id === studentId);
        if (student) {
            this.openStudentModal(student);
        }
    }

    deleteStudent(studentId) {
        const student = this.students.find(s => s.id === studentId);
        if (student) {
            this.currentStudentId = studentId;
            
            // Update the delete operation replica info
            const deleteOpReplica = document.getElementById('deleteOperationReplica');
            if (this.selectedReplica) {
                deleteOpReplica.textContent = this.selectedReplica;
                deleteOpReplica.style.color = 'var(--success-600)';
            } else {
                deleteOpReplica.textContent = 'Auto-selected (Random)';
                deleteOpReplica.style.color = 'var(--text-secondary)';
            }
            
            document.getElementById('studentToDelete').innerHTML = `
                <strong>${this.escapeHtml(student.username)}</strong>
                <div>UUID: ${student.uuid_credentials}</div>
            `;
            document.getElementById('deleteModal').style.display = 'flex';
        }
    }

    async confirmDelete() {
        // REMOVED: No replica selection from delete modal - use current selected replica
        
        const deleteButton = document.getElementById('confirmDeleteBtn');
        const originalText = deleteButton.innerHTML;
        deleteButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
        deleteButton.disabled = true;
        
        try {
            const requestData = {
                action: 'delete_student',
                student_id: this.currentStudentId
            };
            
            // Use the currently selected replica for the operation
            // The backend will use the replica set via set_replica action
            // No need to pass selected_replica in the request
            
            const response = await fetch('/selfstudyuserlab/api/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify(requestData)
            });
            
            const result = await response.json();
            
            if (result.error) {
                throw new Error(result.error);
            }
            
            this.showToast('Success', 'Student deleted successfully', 'success');
            this.closeDeleteModal();
            await this.refreshData();
            
        } catch (error) {
            console.error('Error deleting student:', error);
            this.showToast('Error', error.message, 'error');
        } finally {
            deleteButton.innerHTML = originalText;
            deleteButton.disabled = false;
        }
    }

    closeDeleteModal() {
        document.getElementById('deleteModal').style.display = 'none';
        this.currentStudentId = null;
    }



    async refreshData() {
        await this.loadStudents();
        await this.loadStudentCount();
        this.showToast('Refreshed', 'Data updated successfully', 'success');
    }

    handleSearch(searchTerm) {
        if (!searchTerm) {
            this.filteredStudents = [...this.students];
        } else {
            const term = searchTerm.toLowerCase();
            this.filteredStudents = this.students.filter(student =>
                student.username.toLowerCase().includes(term) ||
                student.uuid_credentials.toLowerCase().includes(term)
            );
        }
        
        this.currentPage = 1;
        this.renderStudentsTable();
        this.updatePagination();
    }

    handleFilter(status) {
        if (!status) {
            this.filteredStudents = [...this.students];
        } else {
            const now = new Date();
            this.filteredStudents = this.students.filter(student => {
                const expireDate = new Date(student.expire_date);
                if (status === 'active') {
                    return expireDate > now;
                } else {
                    return expireDate <= now;
                }
            });
        }
        
        this.currentPage = 1;
        this.renderStudentsTable();
        this.updatePagination();
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderStudentsTable();
            this.updatePagination();
        }
    }

    nextPage() {
        const totalPages = Math.ceil(this.filteredStudents.length / this.itemsPerPage);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.renderStudentsTable();
            this.updatePagination();
        }
    }

    updatePagination() {
        const totalPages = Math.ceil(this.filteredStudents.length / this.itemsPerPage);
        document.getElementById('currentPage').textContent = this.currentPage;
        document.getElementById('totalPages').textContent = totalPages;
        
        document.getElementById('prevPage').disabled = this.currentPage === 1;
        document.getElementById('nextPage').disabled = this.currentPage === totalPages;
    }

    // Utility methods
    showLoadingState() {
        this.hideAllStates();
        document.getElementById('loadingState').style.display = 'block';
    }

    showEmptyState() {
        this.hideAllStates();
        document.getElementById('studentsTable').style.display = 'none';
        document.getElementById('paginationContainer').style.display = 'none';
        document.getElementById('emptyState').style.display = 'block';
    }

    showErrorState(message) {
        this.hideAllStates();
        document.getElementById('studentsTable').style.display = 'none';
        document.getElementById('paginationContainer').style.display = 'none';
        document.getElementById('errorState').style.display = 'block';
        document.getElementById('errorMessage').textContent = message;
    }

    hideAllStates() {
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('emptyState').style.display = 'none';
        document.getElementById('errorState').style.display = 'none';
    }

    showToast(title, message, type = 'info') {
        const toastContainer = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas fa-${this.getToastIcon(type)}"></i>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        toastContainer.appendChild(toast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 5000);
    }

    getToastIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    getStatusClass(expireDate) {
        const now = new Date();
        const expire = new Date(expireDate);
        return expire > now ? 'status-active' : 'status-expired';
    }

    getStatusText(expireDate) {
        const now = new Date();
        const expire = new Date(expireDate);
        return expire > now ? 'Active' : 'Expired';
    }

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }

    formatDateForInput(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toISOString().slice(0, 16);
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
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
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.labManager = new SelfStudyUserLabManager();
});

// Handle escape key for modal closing
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        if (window.labManager) {
            window.labManager.closeStudentModal();
            window.labManager.closeDeleteModal();
        }
    }
});