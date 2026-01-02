class RunbookManager {
    constructor(authToken) {
        this.domains = [];
        this.currentDomain = null;
        this.selectedRunbook = null;
        this.selectedSection = null;
        this.dragMode = false;
        this.draggingSection = null;
        this.authToken = authToken;
        this.deletePending = null;
        
        // Initialize
        this.init();
    }

    init() {
        this.loadDomains();
        this.setupEventListeners();
        this.updateStatus();
    }

    loadDomains() {
        const domainsData = document.getElementById('domainsData')?.value;
        if (domainsData) {
            this.domains = domainsData.split(',').filter(d => d.trim());
            this.selectRandomDomain();
        }
        
        document.getElementById('domainCount').textContent = this.domains.length;
    }

    selectRandomDomain() {
        if (this.domains.length > 0) {
            this.currentDomain = this.domains[Math.floor(Math.random() * this.domains.length)];
            document.getElementById('currentDomain').textContent = 
                this.currentDomain.replace('https://', '');
            // Load runbooks after domain is selected
            this.loadRunbooks();
        }
    }

    updateStatus() {
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        
        if (this.domains.length > 0 && this.currentDomain) {
            statusDot.className = 'status-dot connected';
            statusText.textContent = `Connected to ${this.currentDomain.replace('https://', '')}`;
        } else {
            statusDot.className = 'status-dot error';
            statusText.textContent = 'No domains available';
        }
    }

    async makeRequest(endpoint, method = 'GET', data = null) {
        if (!this.currentDomain || !this.authToken) {
            this.showToast('No domain or authentication available', 'error');
            return null;
        }

        const url = `${this.currentDomain}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Token ${this.authToken}`
        };

        try {
            this.showLoading('Processing request...');
            
            const options = {
                method: method,
                headers: headers,
                credentials: 'omit'
            };

            if (data && method !== 'GET' && method !== 'DELETE') {
                options.body = JSON.stringify(data);
            }

            const response = await fetch(url, options);
            this.hideLoading();

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Authentication failed. Check AUTH_TOKEN configuration.');
                } else if (response.status === 404) {
                    throw new Error('Resource not found.');
                } else {
                    const errorText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }
            }

            // Check if response has content
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else if (response.status === 204) {
                return { success: true }; // No content response for DELETE
            } else {
                return {};
            }
        } catch (error) {
            this.hideLoading();
            console.error('Request failed:', error);
            this.showToast(`Request failed: ${error.message}`, 'error');
            return null;
        }
    }

    async loadRunbooks() {
        const response = await this.makeRequest('/runbooks/');
        
        if (response && Array.isArray(response)) {
            this.renderRunbooks(response);
        } else {
            document.getElementById('runbooksList').innerHTML = `
                <div class="empty-state">
                    <i class="icon-document"></i>
                    <p>${response ? 'No runbooks found' : 'Failed to load runbooks'}</p>
                    <button class="btn btn-small btn-secondary" onclick="runbookManager.refreshData()">
                        Retry
                    </button>
                </div>
            `;
        }
    }

    renderRunbooks(runbooks) {
        const container = document.getElementById('runbooksList');
        
        if (!runbooks || runbooks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="icon-document"></i>
                    <p>No runbooks found</p>
                    <button class="btn btn-small btn-primary" onclick="showCreateRunbookModal()">
                        Create First Runbook
                    </button>
                </div>
            `;
            return;
        }

        const html = runbooks.map(runbook => `
            <div class="runbook-item ${this.selectedRunbook?.id === runbook.id ? 'selected' : ''}" 
                 onclick="runbookManager.selectRunbook(${runbook.id})"
                 data-runbook-id="${runbook.id}"
                 data-runbook-sync-id="${runbook.sync_id || ''}">
                <div class="runbook-item-header">
                    <h3 class="runbook-item-title">${this.escapeHtml(runbook.title)}</h3>
                    <span class="runbook-item-sections">
                        ${runbook.sections ? runbook.sections.length : 0} sections
                    </span>
                </div>
                <div class="runbook-item-footer">
                    <span class="runbook-sync-id" title="Sync ID: ${runbook.sync_id || 'No sync ID'}">
                        ${runbook.sync_id ? runbook.sync_id.substring(0, 8) + '...' : 'No sync ID'}
                    </span>
                    <span>ID: ${runbook.id}</span>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    async selectRunbook(runbookId) {
        const response = await this.makeRequest(`/runbooks/${runbookId}/`);
        
        if (response) {
            this.selectedRunbook = response;
            this.updateSelectionInfo();
            this.renderSections(response.sections || []);
            
            // Enable section actions
            document.getElementById('addSectionBtn').disabled = false;
            document.getElementById('editRunbookBtn').disabled = false;
            document.getElementById('deleteRunbookBtn').disabled = false;
            
            // Update selected state
            document.querySelectorAll('.runbook-item').forEach(item => {
                item.classList.remove('selected');
            });
            const selectedItem = document.querySelector(`[data-runbook-id="${runbookId}"]`);
            if (selectedItem) {
                selectedItem.classList.add('selected');
            }
        }
    }

    renderSections(sections) {
        const container = document.getElementById('sectionsList');
        
        if (!sections || sections.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="icon-document"></i>
                    <p>No sections in this runbook</p>
                    <button class="btn btn-small btn-primary" onclick="showCreateSectionModal()">
                        Add First Section
                    </button>
                </div>
            `;
            return;
        }

        // Sort by position
        sections.sort((a, b) => a.position - b.position);

        const html = sections.map((section, index) => `
            <div class="section-item ${this.dragMode ? 'draggable' : ''}"
                 data-section-id="${section.id}"
                 data-section-sync-id="${section.sync_id || ''}"
                 data-section-index="${index}"
                 data-position="${section.position}"
                 draggable="${this.dragMode}"
                 ondragstart="runbookManager.onDragStart(event, ${section.id})"
                 ondragover="runbookManager.onDragOver(event)"
                 ondrop="runbookManager.onDrop(event, ${section.id})"
                 ondragend="runbookManager.onDragEnd(event)">
                <div class="section-item-header">
                    <div class="section-header-left">
                        ${this.dragMode ? '<div class="drag-handle" draggable="true">⋮⋮</div>' : ''}
                        <h4 class="section-item-title">
                            ${section.title || 'Untitled Section'}
                            <span class="section-sync-id" title="Sync ID: ${section.sync_id || 'No sync ID'}">
                                ${section.sync_id ? section.sync_id.substring(0, 8) + '...' : ''}
                            </span>
                        </h4>
                    </div>
                    ${section.is_code_block ? 
                        '<span class="section-item-badge code" title="Code Block">Code</span>' : ''}
                </div>
                <div class="section-item-content" style="
                    background-color: ${section.bg_color || '#ffffff'};
                    color: ${section.text_color || '#000000'};
                    padding: 8px;
                    border-radius: 4px;
                    margin: 8px 0;">
                    ${this.escapeHtml(section.content).substring(0, 150)}
                    ${section.content.length > 150 ? '...' : ''}
                </div>
                <div class="section-item-footer">
                    <div class="section-position">
                        <span>Position: ${section.position + 1}</span>
                    </div>
                    <div class="section-actions">
                        <button class="btn btn-small btn-secondary" 
                                onclick="runbookManager.editSection(${section.id})">
                            Edit
                        </button>
                        <button class="btn btn-small btn-danger" 
                                onclick="runbookManager.requestDeleteSection(${section.id})">
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    updateSelectionInfo() {
        if (this.selectedRunbook) {
            document.getElementById('selectedRunbookTitle').textContent = this.selectedRunbook.title;
            document.getElementById('selectionInfo').style.display = 'flex';
        }
    }

    // CRUD Operations with SYNC support
    async createRunbook(title) {
        const data = {
            title: title,
            sync_id: this.generateUUID()
        };

        const response = await this.makeRequest('/runbooks/', 'POST', data);
        
        if (response) {
            this.showToast('Runbook created successfully', 'success');
            this.loadRunbooks();
            this.closeModal('createRunbookModal');
        }
    }

    async updateRunbook(id, syncId, title) {
        const data = {
            title: title,
            sync_id: syncId  // IMPORTANT: Include sync_id for sync to work
        };

        const response = await this.makeRequest(`/runbooks/${id}/`, 'PUT', data);
        
        if (response) {
            this.showToast('Runbook updated successfully - Syncing to all replicas', 'success');
            this.loadRunbooks();
            this.closeModal('editRunbookModal');
            
            // Reload selected runbook if it was updated
            if (this.selectedRunbook?.id === id) {
                await this.selectRunbook(id);
            }
        }
    }

    async deleteRunbook(id) {
        const response = await this.makeRequest(`/runbooks/${id}/`, 'DELETE');
        
        if (response) {
            this.showToast('Runbook deleted successfully - Syncing to all replicas', 'success');
            this.selectedRunbook = null;
            this.loadRunbooks();
            this.clearSections();
            this.closeModal('deleteConfirmModal');
        }
    }

    async createSection(runbookId, data) {
        // Get runbook sync_id for the section
        const runbookElement = document.querySelector(`[data-runbook-id="${runbookId}"]`);
        const runbookSyncId = runbookElement?.dataset.runbookSyncId;
        
        if (!runbookSyncId) {
            this.showToast('Runbook sync ID not found', 'error');
            return;
        }

        const sectionData = {
            ...data,
            runbook: runbookId,  // Runbook ID (required by serializer)
            sync_id: this.generateUUID(),
            runbook_sync_id: runbookSyncId  // Important for section sync
        };

        console.log('Creating section with data:', sectionData);

        const response = await this.makeRequest('/sections/', 'POST', sectionData);
        
        if (response) {
            this.showToast('Section created successfully - Syncing to all replicas', 'success');
            await this.selectRunbook(runbookId);
            this.closeModal('createSectionModal');
        }
    }

    async updateSection(id, syncId, data) {
        // Get runbook sync_id for the section
        const runbookElement = document.querySelector(`[data-runbook-id="${this.selectedRunbook.id}"]`);
        const runbookSyncId = runbookElement?.dataset.runbookSyncId;
        
        const sectionData = {
            ...data,
            runbook: this.selectedRunbook.id,  // CRITICAL: Runbook ID (required by serializer)
            sync_id: syncId,  // IMPORTANT: Include sync_id for sync to work
            runbook_sync_id: runbookSyncId  // Important for section sync
        };

        console.log('Updating section with data:', sectionData);

        const response = await this.makeRequest(`/sections/${id}/`, 'PUT', sectionData);
        
        if (response) {
            this.showToast('Section updated successfully - Syncing to all replicas', 'success');
            await this.selectRunbook(this.selectedRunbook.id);
            this.closeModal('editSectionModal');
        }
    }

    async deleteSection(id) {
        const response = await this.makeRequest(`/sections/${id}/`, 'DELETE');
        
        if (response) {
            this.showToast('Section deleted successfully - Syncing to all replicas', 'success');
            await this.selectRunbook(this.selectedRunbook.id);
            this.closeModal('deleteConfirmModal');
        }
    }

    // Section Reordering
    async updateSectionPositions(updates) {
        // Get sync_ids for each section
        const sectionsData = [];
        
        updates.forEach(update => {
            const sectionElement = document.querySelector(`[data-section-id="${update.id}"]`);
            if (sectionElement) {
                sectionsData.push({
                    id: update.id,
                    sync_id: sectionElement.dataset.sectionSyncId,
                    position: update.position
                });
            }
        });

        const data = {
            runbook_id: this.selectedRunbook.id,
            updates: updates,
            sync_data: sectionsData
        };

        const response = await this.makeRequest('/update_section_positions/', 'POST', data);
        
        if (response && response.success) {
            this.showToast('Sections reordered successfully - Syncing to all replicas', 'success');
            return true;
        }
        return false;
    }

    // Drag & Drop Implementation
    onDragStart(event, sectionId) {
        this.draggingSection = sectionId;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', sectionId.toString());
        
        const element = event.target.closest('.section-item');
        if (element) {
            element.classList.add('dragging');
        }
    }

    onDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        
        const element = event.target.closest('.section-item');
        if (element && parseInt(element.dataset.sectionId) !== this.draggingSection) {
            element.classList.add('drag-over');
        }
    }

    onDragEnd(event) {
        document.querySelectorAll('.section-item').forEach(item => {
            item.classList.remove('dragging', 'drag-over');
        });
        this.draggingSection = null;
    }

    async onDrop(event, targetSectionId) {
        event.preventDefault();
        
        const sourceSectionId = this.draggingSection;
        if (!sourceSectionId || sourceSectionId === targetSectionId) {
            this.onDragEnd(event);
            return;
        }

        // Get all sections in current order
        const sections = Array.from(document.querySelectorAll('.section-item'));
        const sourceIndex = sections.findIndex(s => parseInt(s.dataset.sectionId) === sourceSectionId);
        const targetIndex = sections.findIndex(s => parseInt(s.dataset.sectionId) === targetSectionId);

        if (sourceIndex === -1 || targetIndex === -1) {
            this.onDragEnd(event);
            return;
        }

        // Move in DOM
        const container = document.getElementById('sectionsList');
        const sourceElement = sections[sourceIndex];
        const targetElement = sections[targetIndex];
        
        if (sourceIndex < targetIndex) {
            container.insertBefore(sourceElement, targetElement.nextSibling);
        } else {
            container.insertBefore(sourceElement, targetElement);
        }

        // Update positions in DOM
        const updatedSections = [];
        container.querySelectorAll('.section-item').forEach((item, index) => {
            const sectionId = parseInt(item.dataset.sectionId);
            item.dataset.position = index;
            
            // Update position display
            const positionSpan = item.querySelector('.section-position span');
            if (positionSpan) {
                positionSpan.textContent = `Position: ${index + 1}`;
            }
            
            updatedSections.push({
                id: sectionId,
                position: index
            });
        });

        // Update positions on server
        const success = await this.updateSectionPositions(updatedSections);
        if (!success) {
            // Revert if update failed
            this.renderSections(this.selectedRunbook.sections || []);
            this.showToast('Failed to save new positions', 'error');
        }

        this.onDragEnd(event);
    }

    // UI Helpers
    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type} show`;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    showLoading(message = 'Loading...') {
        const overlay = document.getElementById('loadingOverlay');
        const messageEl = document.getElementById('loadingMessage');
        messageEl.textContent = message;
        overlay.classList.add('show');
    }

    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        overlay.classList.remove('show');
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.remove('show');
        document.body.style.overflow = '';
        
        // Reset form
        const form = modal.querySelector('form');
        if (form) {
            form.reset();
        }
    }

    // Utility Methods
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    setupEventListeners() {
        // Close modals when clicking outside
        document.addEventListener('click', (event) => {
            if (event.target.classList.contains('modal')) {
                event.target.classList.remove('show');
                document.body.style.overflow = '';
            }
        });

        // Escape key to close modals
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                document.querySelectorAll('.modal.show').forEach(modal => {
                    modal.classList.remove('show');
                    document.body.style.overflow = '';
                });
            }
        });

        // Search functionality
        const searchInput = document.getElementById('searchRunbooks');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.filterRunbooks());
        }
    }

    filterRunbooks() {
        const searchTerm = document.getElementById('searchRunbooks').value.toLowerCase();
        const runbooks = document.querySelectorAll('.runbook-item');
        
        runbooks.forEach(runbook => {
            const title = runbook.querySelector('.runbook-item-title').textContent.toLowerCase();
            if (title.includes(searchTerm)) {
                runbook.style.display = 'block';
            } else {
                runbook.style.display = 'none';
            }
        });
    }

    // Public Methods for HTML onclick handlers
    refreshData() {
        this.loadRunbooks();
        if (this.selectedRunbook) {
            this.selectRunbook(this.selectedRunbook.id);
        }
        this.showToast('Data refreshed', 'success');
    }

    toggleDragMode() {
        this.dragMode = !this.dragMode;
        const sectionsSection = document.getElementById('sectionsSection');
        const dragModeBtn = document.getElementById('dragModeBtn');
        
        if (this.dragMode) {
            sectionsSection.classList.add('drag-mode');
            dragModeBtn.innerHTML = '<i class="icon-drag"></i> Done Reordering';
            dragModeBtn.classList.add('btn-primary');
            this.showToast('Drag sections to reorder', 'info');
        } else {
            sectionsSection.classList.remove('drag-mode');
            dragModeBtn.innerHTML = '<i class="icon-drag"></i> Reorder';
            dragModeBtn.classList.remove('btn-primary');
            this.showToast('Order saved', 'success');
        }
        
        this.renderSections(this.selectedRunbook?.sections || []);
    }

    clearSections() {
        document.getElementById('sectionsList').innerHTML = `
            <div class="empty-state">
                <i class="icon-document"></i>
                <p>Select a runbook to view its sections</p>
            </div>
        `;
        
        document.getElementById('selectedRunbookTitle').textContent = 'None';
        document.getElementById('selectionInfo').style.display = 'none';
        document.getElementById('addSectionBtn').disabled = true;
        document.getElementById('editRunbookBtn').disabled = true;
        document.getElementById('deleteRunbookBtn').disabled = true;
    }

    async editSection(sectionId) {
        // First, make sure we have the latest runbook data
        await this.selectRunbook(this.selectedRunbook.id);
        
        // Find the section in the selected runbook
        const section = this.selectedRunbook.sections?.find(s => s.id === sectionId);
        if (!section) {
            this.showToast('Section not found', 'error');
            return;
        }
        
        // Store section data
        this.selectedSection = section;
        
        // Fill form
        document.getElementById('editSectionId').value = section.id;
        document.getElementById('editSectionSyncId').value = section.sync_id || '';
        document.getElementById('editSectionTitle').value = section.title || '';
        document.getElementById('editSectionContent').value = section.content;
        document.getElementById('editSectionIsCodeBlock').checked = section.is_code_block || false;
        document.getElementById('editSectionBgColor').value = section.bg_color || '#ffffff';
        document.getElementById('editSectionTextColor').value = section.text_color || '#000000';
        
        this.showModal('editSectionModal');
    }

    requestDeleteRunbook() {
        if (!this.selectedRunbook) return;
        
        document.getElementById('deleteConfirmMessage').textContent = 
            `Are you sure you want to delete runbook "${this.selectedRunbook.title}"? This will also delete all sections and cannot be undone.`;
        
        this.deletePending = {
            type: 'runbook',
            id: this.selectedRunbook.id,
            sync_id: this.selectedRunbook.sync_id
        };
        
        this.showModal('deleteConfirmModal');
    }

    requestDeleteSection(sectionId) {
        if (!this.selectedRunbook) return;
        
        const sections = this.selectedRunbook.sections || [];
        const section = sections.find(s => s.id === sectionId);
        if (!section) return;
        
        const sectionElement = document.querySelector(`[data-section-id="${sectionId}"]`);
        const syncId = sectionElement?.dataset.sectionSyncId;
        
        const sectionTitle = section.title || 'Untitled Section';
        document.getElementById('deleteConfirmMessage').textContent = 
            `Are you sure you want to delete section "${sectionTitle}"? This action cannot be undone.`;
        
        this.deletePending = {
            type: 'section',
            id: sectionId,
            sync_id: syncId
        };
        
        this.showModal('deleteConfirmModal');
    }

    async confirmDelete() {
        if (!this.deletePending) {
            this.closeModal('deleteConfirmModal');
            return;
        }
        
        if (this.deletePending.type === 'runbook') {
            await this.deleteRunbook(this.deletePending.id);
        } else if (this.deletePending.type === 'section') {
            await this.deleteSection(this.deletePending.id);
        }
        
        this.deletePending = null;
    }
}

// Global functions for HTML onclick handlers
function showCreateRunbookModal() {
    document.getElementById('runbookTitle').value = '';
    runbookManager.showModal('createRunbookModal');
}

function showCreateSectionModal() {
    if (!runbookManager.selectedRunbook) return;
    
    document.getElementById('sectionRunbookId').value = runbookManager.selectedRunbook.id;
    document.getElementById('sectionTitle').value = '';
    document.getElementById('sectionContent').value = '';
    document.getElementById('sectionIsCodeBlock').checked = false;
    document.getElementById('sectionBgColor').value = '#ffffff';
    document.getElementById('sectionTextColor').value = '#000000';
    runbookManager.showModal('createSectionModal');
}

function editSelectedRunbook() {
    if (!runbookManager.selectedRunbook) return;
    
    // Get sync_id from DOM element
    const runbookElement = document.querySelector(`[data-runbook-id="${runbookManager.selectedRunbook.id}"]`);
    const syncId = runbookElement?.dataset.runbookSyncId;
    
    if (!syncId) {
        runbookManager.showToast('Runbook sync ID not found', 'error');
        return;
    }
    
    document.getElementById('editRunbookId').value = runbookManager.selectedRunbook.id;
    document.getElementById('editRunbookSyncId').value = syncId;
    document.getElementById('editRunbookTitle').value = runbookManager.selectedRunbook.title;
    runbookManager.showModal('editRunbookModal');
}

function deleteSelectedRunbook() {
    runbookManager.requestDeleteRunbook();
}

function createRunbook(event) {
    event.preventDefault();
    const title = document.getElementById('runbookTitle').value.trim();
    if (title) {
        runbookManager.createRunbook(title);
    }
}

function updateRunbook(event) {
    event.preventDefault();
    const id = document.getElementById('editRunbookId').value;
    const syncId = document.getElementById('editRunbookSyncId').value;
    const title = document.getElementById('editRunbookTitle').value.trim();
    
    if (title && id && syncId) {
        runbookManager.updateRunbook(id, syncId, title);
    } else {
        runbookManager.showToast('Title and sync ID are required', 'error');
    }
}

function createSection(event) {
    event.preventDefault();
    const runbookId = document.getElementById('sectionRunbookId').value;
    const title = document.getElementById('sectionTitle').value.trim();
    const content = document.getElementById('sectionContent').value.trim();
    const isCodeBlock = document.getElementById('sectionIsCodeBlock').checked;
    const bgColor = document.getElementById('sectionBgColor').value;
    const textColor = document.getElementById('sectionTextColor').value;
    
    if (content && runbookId) {
        runbookManager.createSection(runbookId, {
            title: title || '',
            content: content,
            is_code_block: isCodeBlock,
            bg_color: bgColor,
            text_color: textColor,
            position: runbookManager.selectedRunbook.sections?.length || 0
        });
    } else {
        runbookManager.showToast('Content is required', 'error');
    }
}

function updateSection(event) {
    event.preventDefault();
    const id = document.getElementById('editSectionId').value;
    const syncId = document.getElementById('editSectionSyncId').value;
    const title = document.getElementById('editSectionTitle').value.trim();
    const content = document.getElementById('editSectionContent').value.trim();
    const isCodeBlock = document.getElementById('editSectionIsCodeBlock').checked;
    const bgColor = document.getElementById('editSectionBgColor').value;
    const textColor = document.getElementById('editSectionTextColor').value;
    
    if (content && id && syncId && runbookManager.selectedRunbook) {
        // Get current position from the selected section
        const currentSection = runbookManager.selectedRunbook.sections?.find(s => s.id == id);
        const position = currentSection?.position || 0;
        
        runbookManager.updateSection(id, syncId, {
            title: title || '',
            content: content,
            is_code_block: isCodeBlock,
            bg_color: bgColor,
            text_color: textColor,
            position: position
        });
    } else {
        runbookManager.showToast('Content and sync ID are required', 'error');
    }
}

function confirmDelete() {
    runbookManager.confirmDelete();
}

function closeModal(modalId) {
    runbookManager.closeModal(modalId);
}

// Initialize when DOM is loaded
let runbookManager;

document.addEventListener('DOMContentLoaded', () => {
    // Get auth token from template
    const authToken = document.getElementById('authToken')?.value || '';
    if (!authToken) {
        console.error('No auth token found');
        document.getElementById('toast').textContent = 'Authentication token not configured';
        document.getElementById('toast').className = 'toast error show';
        return;
    }
    
    runbookManager = new RunbookManager(authToken);
});