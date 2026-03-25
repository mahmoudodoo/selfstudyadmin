// SelfStudy Chat Management - With Pagination (9 per page)
class ChatManager {
    constructor() {
        this.currentRoomId = null;
        this.currentReplicaUrl = null;
        this.blockedIPs = new Set();
        this.currentRooms = [];       // Stores all rooms (filtered)
        this.currentPage = 1;
        this.pageSize = 9;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadChatRooms();
        this.setupAutoRefresh();
    }

    bindEvents() {
        // Replica selector
        document.getElementById('replica-select').addEventListener('change', () => {
            this.loadChatRooms();
        });

        // Refresh button
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.loadChatRooms(true);
        });

        // Search filters
        ['room-id-filter', 'ip-filter', 'country-filter', 'message-filter'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('input', () => {
                    clearTimeout(this.searchTimer);
                    this.searchTimer = setTimeout(() => {
                        this.loadChatRooms();
                    }, 500);
                });
            }
        });

        // Search form
        document.getElementById('search-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.loadChatRooms();
        });

        // Clear filters
        document.getElementById('clear-filters').addEventListener('click', () => {
            this.clearFilters();
        });

        // Table actions
        document.getElementById('chat-rooms-body').addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button) return;
            
            const row = e.target.closest('tr');
            if (!row) return;

            const roomId = row.dataset.roomId;
            const replicaUrl = row.dataset.replica;
            const ip = row.dataset.ip;

            if (button.classList.contains('view-messages')) {
                this.showMessages(roomId, replicaUrl);
            } else if (button.classList.contains('block-ip')) {
                this.toggleBlockIP(roomId, replicaUrl, ip, row, button);
            } else if (button.classList.contains('delete-room')) {
                this.deleteRoom(roomId, replicaUrl);
            }
        });

        // Modal events
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeModal(btn.closest('.modal'));
            });
        });

        // Confirm modal
        document.getElementById('confirm-cancel').addEventListener('click', () => {
            this.closeModal(document.getElementById('confirm-modal'));
        });

        // Message events
        document.getElementById('send-message-btn').addEventListener('click', () => {
            this.sendMessage();
        });

        document.getElementById('mark-seen-btn').addEventListener('click', () => {
            this.markMessagesAsSeen();
        });

        document.getElementById('message-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Confirm OK
        document.getElementById('confirm-ok').addEventListener('click', () => {
            if (this.pendingAction) {
                this.pendingAction();
                this.pendingAction = null;
            }
            this.closeModal(document.getElementById('confirm-modal'));
        });

        // Close modal on overlay click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal);
                }
            });
        });
    }

    async loadChatRooms(forceRefresh = false) {
        const tableBody = document.getElementById('chat-rooms-body');
        const loadingIndicator = document.getElementById('loading-indicator');
        const refreshBtn = document.getElementById('refresh-btn');
        
        try {
            // Show loading
            if (tableBody.children.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="7">Loading...</td></tr>';
            }
            loadingIndicator.style.display = 'flex';
            refreshBtn.disabled = true;
            
            // Get filters
            const filters = {
                replica: document.getElementById('replica-select').value,
                room_id: document.getElementById('room-id-filter').value,
                ip: document.getElementById('ip-filter').value,
                country: document.getElementById('country-filter').value,
            };
            
            // Build query
            const params = new URLSearchParams();
            Object.entries(filters).forEach(([key, value]) => {
                if (value) params.set(key, value);
            });
            
            // Fetch rooms
            const response = await fetch(`/selfstudychat/api/rooms/?${params}`);
            const data = await response.json();
            
            if (data.success) {
                this.currentRooms = data.rooms;
                this.currentPage = 1;
                this.renderCurrentPage();
                this.updateCounts(data.total);
                
                // Update blocked IPs
                this.blockedIPs.clear();
                data.blocked_ips.forEach(ip => this.blockedIPs.add(ip));
                
                // Update blocked count
                document.getElementById('blocked-count').textContent = data.blocked_ips.length;
            } else {
                throw new Error(data.error || 'Failed to load');
            }
        } catch (error) {
            console.error('Error loading rooms:', error);
            this.showError('Failed to load chat rooms');
        } finally {
            loadingIndicator.style.display = 'none';
            refreshBtn.disabled = false;
        }
    }

    renderCurrentPage() {
        const total = this.currentRooms.length;
        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        const pageRooms = this.currentRooms.slice(start, end);
        this.renderChatRooms(pageRooms);
        this.renderPagination(total);
        this.updateShowingCount(pageRooms.length, total);
    }

    renderChatRooms(rooms) {
        const tableBody = document.getElementById('chat-rooms-body');
        
        if (rooms.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="no-data">No chat rooms found</td></tr>';
            return;
        }
        
        let html = '';
        rooms.forEach(room => {
            const isBlocked = this.blockedIPs.has(room.anonymous_user_ip);
            const unreadCount = room.unseen_count || 0;
            const lastActive = this.formatTime(room.last_active);
            
            html += `
                <tr data-room-id="${room.id}" data-replica="${room.replica_url}" data-ip="${room.anonymous_user_ip}">
                    <td>${room.id}</td>
                    <td>
                        <div class="ip-display">
                            <span class="ip-value">${room.anonymous_user_ip}</span>
                            ${isBlocked ? '<span class="badge badge-danger">Blocked</span>' : ''}
                        </div>
                    </td>
                    <td>
                        <div class="country-display">
                            ${room.flag_url ? `<img src="${room.flag_url}" alt="${room.country_name}" class="flag-icon">` : ''}
                            <span>${room.country_name || 'Unknown'}</span>
                        </div>
                    </td>
                    <td>
                        <span class="replica-badge" title="${room.replica_url}">
                            ${this.truncate(room.replica_url, 20)}
                        </span>
                    </td>
                    <td>
                        <span class="timestamp">${lastActive}</span>
                    </td>
                    <td>
                        <span class="unread-count ${unreadCount > 0 ? 'has-unread' : ''}">
                            ${unreadCount}
                        </span>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-icon view-messages" title="View Messages">
                                👁️
                            </button>
                            <button class="btn-icon block-ip ${isBlocked ? 'blocked' : ''}" 
                                    title="${isBlocked ? 'Unblock IP' : 'Block IP'}">
                                ${isBlocked ? '✅' : '🚫'}
                            </button>
                            <button class="btn-icon delete-room" title="Delete Room">
                                🗑️
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        tableBody.innerHTML = html;
    }

    renderPagination(total) {
        const totalPages = Math.ceil(total / this.pageSize);
        const container = document.getElementById('chat-pagination');
        if (!container) return;

        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let currentPage = this.currentPage;
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;
        this.currentPage = currentPage;

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

        // Attach event listeners
        container.querySelectorAll('.pagination-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = btn.dataset.page;
                if (page === 'prev') {
                    this.changePage(currentPage - 1);
                } else if (page === 'next') {
                    this.changePage(currentPage + 1);
                } else {
                    this.changePage(parseInt(page, 10));
                }
            });
        });
    }

    changePage(page) {
        const totalPages = Math.ceil(this.currentRooms.length / this.pageSize);
        if (page < 1 || page > totalPages) return;
        this.currentPage = page;
        this.renderCurrentPage();
    }

    updateShowingCount(showing, total) {
        const showingSpan = document.getElementById('showing-count');
        const totalSpan = document.getElementById('total-count');
        if (showingSpan) showingSpan.textContent = showing;
        if (totalSpan) totalSpan.textContent = total;
    }

    updateCounts(total = null) {
        if (total !== null) {
            document.getElementById('total-count').textContent = total;
            document.getElementById('total-rooms').textContent = total;
        }
    }

    async showMessages(roomId, replicaUrl) {
        this.currentRoomId = roomId;
        this.currentReplicaUrl = replicaUrl;
        
        try {
            this.openModal('messages-modal');
            document.getElementById('modal-title').textContent = `Chat Room ${roomId}`;
            
            const container = document.getElementById('messages-container');
            container.innerHTML = '<div class="loading">Loading messages...</div>';
            
            // Fetch messages
            const response = await fetch('/selfstudychat/api/rooms/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify({
                    action: 'get-messages',
                    replica_url: replicaUrl,
                    room_id: roomId
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.renderMessages(data.messages);
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Error loading messages:', error);
            document.getElementById('messages-container').innerHTML = 
                '<div class="error">Failed to load messages</div>';
        }
    }

    renderMessages(messages) {
        const container = document.getElementById('messages-container');
        
        if (!messages || messages.length === 0) {
            container.innerHTML = '<div class="no-messages">No messages</div>';
            return;
        }
        
        let html = '';
        messages.forEach(msg => {
            const time = this.formatTime(msg.timestamp);
            html += `
                <div class="message-item">
                    <div class="message-bubble sender-${msg.sender}">
                        <div class="message-header">
                            <span class="message-sender">${this.capitalize(msg.sender)}</span>
                            <span class="message-time">${time}</span>
                        </div>
                        <div class="message-text">${this.escapeHtml(msg.message)}</div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        container.scrollTop = container.scrollHeight;
    }

    async toggleBlockIP(roomId, replicaUrl, ip, row, button) {
        const isBlocked = button.classList.contains('blocked');
        const action = isBlocked ? 'unblock-ip' : 'block-ip';
        const actionText = isBlocked ? 'unblock' : 'block';
        
        this.showConfirmModal(
            `${isBlocked ? 'Unblock' : 'Block'} IP`,
            `Are you sure you want to ${actionText} IP ${ip}?`,
            async () => {
                try {
                    const response = await fetch('/selfstudychat/api/rooms/', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': this.getCsrfToken()
                        },
                        body: JSON.stringify({
                            action: action,
                            replica_url: replicaUrl,
                            room_id: roomId,
                            ip_address: ip
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        // Update UI
                        if (isBlocked) {
                            button.classList.remove('blocked');
                            button.title = 'Block IP';
                            button.innerHTML = '🚫';
                            this.blockedIPs.delete(ip);
                            row.querySelector('.badge-danger')?.remove();
                        } else {
                            button.classList.add('blocked');
                            button.title = 'Unblock IP';
                            button.innerHTML = '✅';
                            this.blockedIPs.add(ip);
                            const ipDisplay = row.querySelector('.ip-display');
                            if (!ipDisplay.querySelector('.badge-danger')) {
                                ipDisplay.innerHTML += '<span class="badge badge-danger">Blocked</span>';
                            }
                        }
                        
                        // Update other rows with same IP
                        this.updateAllRowsForIP(ip, !isBlocked);
                        
                        // Update blocked count
                        document.getElementById('blocked-count').textContent = this.blockedIPs.size;
                        
                        this.showNotification(data.message, 'success');
                    } else {
                        throw new Error(data.error);
                    }
                } catch (error) {
                    console.error('Error toggling block:', error);
                    this.showNotification('Failed to update block status', 'error');
                }
            }
        );
    }

    updateAllRowsForIP(ip, isBlocked) {
        document.querySelectorAll(`tr[data-ip="${ip}"]`).forEach(row => {
            const button = row.querySelector('.block-ip');
            const badge = row.querySelector('.badge-danger');
            
            if (isBlocked) {
                button?.classList.add('blocked');
                button.title = 'Unblock IP';
                button.innerHTML = '✅';
                if (!badge) {
                    row.querySelector('.ip-display').innerHTML += '<span class="badge badge-danger">Blocked</span>';
                }
            } else {
                button?.classList.remove('blocked');
                button.title = 'Block IP';
                button.innerHTML = '🚫';
                badge?.remove();
            }
        });
    }

    async deleteRoom(roomId, replicaUrl) {
        this.showConfirmModal(
            'Delete Chat Room',
            `Delete room ${roomId}? This cannot be undone.`,
            async () => {
                try {
                    const response = await fetch('/selfstudychat/api/rooms/', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': this.getCsrfToken()
                        },
                        body: JSON.stringify({
                            action: 'delete-room',
                            replica_url: replicaUrl,
                            room_id: roomId
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        // Remove row from DOM
                        const row = document.querySelector(`tr[data-room-id="${roomId}"][data-replica="${replicaUrl}"]`);
                        if (row) row.remove();
                        // Refresh data to update counts and pagination
                        this.loadChatRooms();
                        this.showNotification(data.message, 'success');
                    } else {
                        throw new Error(data.error);
                    }
                } catch (error) {
                    console.error('Error deleting room:', error);
                    this.showNotification('Failed to delete room', 'error');
                }
            }
        );
    }

    async sendMessage() {
        const input = document.getElementById('message-input');
        const message = input.value.trim();
        
        if (!message || !this.currentRoomId || !this.currentReplicaUrl) {
            this.showNotification('Please enter a message', 'error');
            return;
        }
        
        try {
            const response = await fetch('/selfstudychat/api/rooms/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify({
                    action: 'send-message',
                    replica_url: this.currentReplicaUrl,
                    room_id: this.currentRoomId,
                    message: message
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                input.value = '';
                this.showMessages(this.currentRoomId, this.currentReplicaUrl);
                this.showNotification('Message sent', 'success');
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Error sending message:', error);
            this.showNotification('Failed to send message', 'error');
        }
    }

    async markMessagesAsSeen() {
        if (!this.currentRoomId || !this.currentReplicaUrl) return;
        
        try {
            const response = await fetch('/selfstudychat/api/rooms/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify({
                    action: 'mark-seen',
                    replica_url: this.currentReplicaUrl,
                    room_id: this.currentRoomId
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showMessages(this.currentRoomId, this.currentReplicaUrl);
                this.showNotification(data.message, 'success');
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Error marking messages:', error);
            this.showNotification('Failed to mark messages', 'error');
        }
    }

    clearFilters() {
        document.getElementById('room-id-filter').value = '';
        document.getElementById('ip-filter').value = '';
        document.getElementById('country-filter').value = '';
        document.getElementById('message-filter').value = '';
        document.getElementById('replica-select').value = 'all';
        this.loadChatRooms();
    }

    setupAutoRefresh() {
        setInterval(() => {
            if (!document.hidden) {
                this.loadChatRooms();
            }
        }, 30000);
    }

    // Utility Methods
    formatTime(timestamp) {
        if (!timestamp) return '-';
        try {
            const date = new Date(timestamp);
            return date.toLocaleString();
        } catch {
            return timestamp;
        }
    }

    truncate(text, max) {
        return text.length > max ? text.substring(0, max - 3) + '...' : text;
    }

    capitalize(text) {
        return text.charAt(0).toUpperCase() + text.slice(1);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getCsrfToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';
    }

    // Modal Methods
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeModal(modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    showConfirmModal(title, message, callback) {
        this.pendingAction = callback;
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;
        this.openModal('confirm-modal');
    }

    showNotification(message, type) {
        // Remove existing
        document.querySelectorAll('.notification').forEach(n => n.remove());
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span class="notification-icon">${type === 'success' ? '✓' : '✗'}</span>
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        `;
        
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    showError(message) {
        this.showNotification(message, 'error');
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.chatManager = new ChatManager();
});