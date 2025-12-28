// Optimized SelfStudy Chat Management JavaScript
class ChatManager {
    constructor() {
        this.currentRoomId = null;
        this.currentReplicaUrl = null;
        this.blockedIPs = new Set();
        this.isLoading = false;
        this.debounceTimer = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.setupAutoRefresh();
        // Load initial data with slight delay to let page render
        setTimeout(() => this.loadChatRooms(), 100);
    }

    bindEvents() {
        // Replica selector
        document.getElementById('replica-select').addEventListener('change', (e) => {
            this.loadChatRooms();
        });

        // Refresh button
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.loadChatRooms(true);
        });

        // Search form with debounce
        const searchInputs = [
            'room-id-filter', 'ip-filter', 'country-filter', 'message-filter'
        ];
        
        searchInputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('input', () => {
                    this.debouncedSearch();
                });
            }
        });

        document.getElementById('search-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.loadChatRooms();
        });

        // Clear filters
        document.getElementById('clear-filters').addEventListener('click', () => {
            this.clearFilters();
        });

        // Table actions with event delegation
        document.getElementById('chat-rooms-body').addEventListener('click', (e) => {
            if (this.isLoading) return;
            
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
        document.querySelectorAll('.modal-close').forEach(closeBtn => {
            closeBtn.addEventListener('click', () => {
                this.closeModal(closeBtn.closest('.modal'));
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

        // Confirm modal OK button
        document.getElementById('confirm-ok').addEventListener('click', () => {
            this.executeConfirmedAction();
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

    debouncedSearch() {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.loadChatRooms();
        }, 300);
    }

    async loadChatRooms(forceRefresh = false) {
        if (this.isLoading) return;
        
        const tableBody = document.getElementById('chat-rooms-body');
        const loadingIndicator = document.getElementById('loading-indicator');
        const refreshBtn = document.getElementById('refresh-btn');
        const refreshText = document.getElementById('refresh-text');
        
        try {
            this.isLoading = true;
            
            // Show loading state
            if (forceRefresh || tableBody.children.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="7" class="loading-cell"><div class="loading-spinner"></div> Loading...</td></tr>';
            }
            
            loadingIndicator.style.display = 'flex';
            refreshBtn.classList.add('loading');
            refreshText.textContent = 'Loading...';
            
            // Get filters
            const filters = {
                replica: document.getElementById('replica-select').value,
                room_id: document.getElementById('room-id-filter').value,
                ip: document.getElementById('ip-filter').value,
                country: document.getElementById('country-filter').value,
                message: document.getElementById('message-filter').value
            };
            
            // Build query string
            const queryParams = new URLSearchParams();
            Object.entries(filters).forEach(([key, value]) => {
                if (value) queryParams.set(key, value);
            });
            
            // Add cache busting for force refresh
            if (forceRefresh) {
                queryParams.set('_', Date.now());
            }
            
            // Make API request
            const response = await fetch(`/selfstudychat/api/rooms/?${queryParams}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.renderChatRooms(data.chat_rooms);
                this.updateCounts(data.total_count);
                this.loadBlockedIPs(data.chat_rooms);
            } else {
                throw new Error(data.error || 'Failed to load chat rooms');
            }
        } catch (error) {
            console.error('Error loading chat rooms:', error);
            this.showError('Failed to load chat rooms: ' + error.message);
            
            // Show error in table
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="error-message">
                        Failed to load chat rooms. 
                        <button onclick="window.chatManager.loadChatRooms(true)" class="btn-outline" style="margin-left: 10px;">
                            Retry
                        </button>
                    </td>
                </tr>
            `;
        } finally {
            this.isLoading = false;
            loadingIndicator.style.display = 'none';
            refreshBtn.classList.remove('loading');
            refreshText.textContent = 'Refresh';
        }
    }

    renderChatRooms(rooms) {
        const tableBody = document.getElementById('chat-rooms-body');
        
        if (rooms.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="no-data">No chat rooms found. Try adjusting your filters.</td></tr>';
            return;
        }
        
        // Use DocumentFragment for better performance
        const fragment = document.createDocumentFragment();
        
        rooms.forEach(room => {
            const isBlocked = this.blockedIPs.has(room.anonymous_user_ip);
            const unreadCount = room.unseen_count || 0;
            const lastActive = room.last_active ? this.formatTimestamp(room.last_active) : '-';
            
            const row = document.createElement('tr');
            row.dataset.roomId = room.id;
            row.dataset.replica = room.replica_url;
            row.dataset.ip = room.anonymous_user_ip;
            
            row.innerHTML = `
                <td>${room.id}</td>
                <td>
                    <div class="ip-display">
                        <span class="ip-value">${room.anonymous_user_ip}</span>
                        ${isBlocked ? '<span class="badge badge-danger">Blocked</span>' : ''}
                    </div>
                </td>
                <td>
                    <div class="country-display">
                        ${room.flag_url ? `<img src="${room.flag_url}" alt="${room.country_name}" class="flag-icon" onerror="this.style.display='none'">` : ''}
                        <span>${room.country_name || 'Unknown'}</span>
                    </div>
                </td>
                <td>
                    <span class="replica-badge" title="${room.replica_url}">
                        ${this.truncateText(room.replica_url, 20)}
                    </span>
                </td>
                <td>
                    <span class="timestamp" title="${room.last_active}">
                        ${lastActive}
                    </span>
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
            `;
            
            fragment.appendChild(row);
        });
        
        tableBody.innerHTML = '';
        tableBody.appendChild(fragment);
    }

    async showMessages(roomId, replicaUrl) {
        this.currentRoomId = roomId;
        this.currentReplicaUrl = replicaUrl;
        
        try {
            // Show modal and loading
            document.getElementById('modal-title').textContent = `Chat Room ${roomId}`;
            this.openModal('messages-modal');
            
            const messagesContainer = document.getElementById('messages-container');
            messagesContainer.innerHTML = '<div class="loading-messages"><div class="loading-spinner"></div> Loading messages...</div>';
            
            // Load messages
            const response = await fetch(`/selfstudychat/api/rooms/${roomId}/messages/?replica_url=${encodeURIComponent(replicaUrl)}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.renderMessages(data.messages);
            } else {
                throw new Error(data.error || 'Failed to load messages');
            }
        } catch (error) {
            console.error('Error loading messages:', error);
            document.getElementById('messages-container').innerHTML = 
                '<div class="error-message">Failed to load messages: ' + error.message + '</div>';
        }
    }

    renderMessages(messages) {
        const container = document.getElementById('messages-container');
        
        if (messages.length === 0) {
            container.innerHTML = '<div class="no-messages">No messages yet</div>';
            return;
        }
        
        // Use DocumentFragment for better performance
        const fragment = document.createDocumentFragment();
        
        messages.forEach(msg => {
            const senderClass = `sender-${msg.sender}`;
            const time = this.formatTimestamp(msg.timestamp);
            const isUnseen = msg.is_seen === false;
            
            const messageDiv = document.createElement('div');
            messageDiv.className = `message-item ${isUnseen ? 'unseen' : ''}`;
            messageDiv.innerHTML = `
                <div class="message-bubble ${senderClass}">
                    <div class="message-header">
                        <span class="message-sender">${this.capitalize(msg.sender)}</span>
                        <span class="message-time">${time}</span>
                    </div>
                    <div class="message-text">${this.escapeHtml(msg.message)}</div>
                </div>
            `;
            
            fragment.appendChild(messageDiv);
        });
        
        container.innerHTML = '';
        container.appendChild(fragment);
        
        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    }

    async toggleBlockIP(roomId, replicaUrl, ip, row, button) {
        const isCurrentlyBlocked = button.classList.contains('blocked');
        const action = isCurrentlyBlocked ? 'unblock-ip' : 'block-ip';
        const confirmMessage = isCurrentlyBlocked 
            ? `Unblock IP ${ip}?`
            : `Block IP ${ip}? This will prevent this IP from sending messages.`;
        
        this.showConfirmModal(
            isCurrentlyBlocked ? 'Unblock IP' : 'Block IP',
            confirmMessage,
            async () => {
                try {
                    const response = await fetch(`/selfstudychat/api/${action}/`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': this.getCsrfToken()
                        },
                        body: JSON.stringify({
                            room_id: roomId,
                            replica_url: replicaUrl
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        // Update UI
                        if (isCurrentlyBlocked) {
                            button.classList.remove('blocked');
                            button.title = 'Block IP';
                            button.textContent = '🚫';
                            this.blockedIPs.delete(ip);
                            row.querySelector('.badge-danger')?.remove();
                        } else {
                            button.classList.add('blocked');
                            button.title = 'Unblock IP';
                            button.textContent = '✅';
                            this.blockedIPs.add(ip);
                            const ipDisplay = row.querySelector('.ip-display');
                            if (!ipDisplay.querySelector('.badge-danger')) {
                                ipDisplay.innerHTML += '<span class="badge badge-danger">Blocked</span>';
                            }
                        }
                        
                        this.showNotification(data.message || 'Operation successful', 'success');
                        
                        // Refresh blocked IPs for all rows with same IP
                        this.updateAllRowsForIP(ip, !isCurrentlyBlocked);
                    } else {
                        throw new Error(data.error || 'Operation failed');
                    }
                } catch (error) {
                    console.error('Error toggling block status:', error);
                    this.showNotification('Failed to update block status', 'error');
                }
            }
        );
    }

    updateAllRowsForIP(ip, isBlocked) {
        // Update all rows with the same IP
        document.querySelectorAll(`tr[data-ip="${ip}"]`).forEach(row => {
            const button = row.querySelector('.block-ip');
            const badge = row.querySelector('.badge-danger');
            
            if (isBlocked) {
                button?.classList.add('blocked');
                button.title = 'Unblock IP';
                button.textContent = '✅';
                if (!badge) {
                    row.querySelector('.ip-display').innerHTML += '<span class="badge badge-danger">Blocked</span>';
                }
            } else {
                button?.classList.remove('blocked');
                button.title = 'Block IP';
                button.textContent = '🚫';
                badge?.remove();
            }
        });
    }

    async deleteRoom(roomId, replicaUrl) {
        this.showConfirmModal(
            'Delete Chat Room',
            `Are you sure you want to delete room ${roomId}? This action cannot be undone.`,
            async () => {
                try {
                    const response = await fetch(`/selfstudychat/api/delete-room/`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': this.getCsrfToken()
                        },
                        body: JSON.stringify({
                            room_id: roomId,
                            replica_url: replicaUrl
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        // Remove row from table
                        const row = document.querySelector(`tr[data-room-id="${roomId}"][data-replica="${replicaUrl}"]`);
                        if (row) row.remove();
                        
                        this.showNotification(data.message || 'Room deleted successfully', 'success');
                        this.updateCounts();
                    } else {
                        throw new Error(data.error || 'Delete failed');
                    }
                } catch (error) {
                    console.error('Error deleting room:', error);
                    this.showNotification('Failed to delete room', 'error');
                }
            }
        );
    }

    async sendMessage() {
        const messageInput = document.getElementById('message-input');
        const message = messageInput.value.trim();
        
        if (!message || !this.currentRoomId || !this.currentReplicaUrl) {
            return;
        }
        
        try {
            const response = await fetch(`/selfstudychat/api/send-message/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify({
                    room_id: this.currentRoomId,
                    replica_url: this.currentReplicaUrl,
                    message: message
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Clear input and reload messages
                messageInput.value = '';
                this.showMessages(this.currentRoomId, this.currentReplicaUrl);
                this.showNotification('Message sent successfully', 'success');
            } else {
                throw new Error(data.error || 'Failed to send message');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            this.showNotification('Failed to send message', 'error');
        }
    }

    async markMessagesAsSeen() {
        if (!this.currentRoomId || !this.currentReplicaUrl) {
            return;
        }
        
        try {
            const response = await fetch(`/selfstudychat/api/mark-seen/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify({
                    room_id: this.currentRoomId,
                    replica_url: this.currentReplicaUrl
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showMessages(this.currentRoomId, this.currentReplicaUrl);
                this.showNotification(data.message || 'Messages marked as seen', 'success');
            } else {
                throw new Error(data.error || 'Failed to mark messages');
            }
        } catch (error) {
            console.error('Error marking messages:', error);
            this.showNotification('Failed to mark messages', 'error');
        }
    }

    loadBlockedIPs(rooms) {
        this.blockedIPs.clear();
        // Extract blocked IPs from badges
        document.querySelectorAll('.badge-danger').forEach(badge => {
            const ip = badge.closest('.ip-display').querySelector('.ip-value').textContent;
            this.blockedIPs.add(ip);
        });
    }

    clearFilters() {
        document.getElementById('room-id-filter').value = '';
        document.getElementById('ip-filter').value = '';
        document.getElementById('country-filter').value = '';
        document.getElementById('message-filter').value = '';
        this.loadChatRooms();
    }

    updateCounts(total = null) {
        const tableBody = document.getElementById('chat-rooms-body');
        const rows = tableBody.querySelectorAll('tr:not(.loading-cell):not(.no-data):not(.error-message)');
        
        document.getElementById('showing-count').textContent = rows.length;
        
        if (total !== null) {
            document.getElementById('total-count').textContent = total;
            document.getElementById('total-rooms').textContent = total;
        }
        
        // Update blocked count
        document.getElementById('blocked-count').textContent = this.blockedIPs.size;
    }

    setupAutoRefresh() {
        // Auto-refresh every 60 seconds when tab is visible
        setInterval(() => {
            if (!document.hidden && !this.isLoading) {
                this.loadChatRooms();
            }
        }, 60000);
    }

    // Utility Methods
    formatTimestamp(timestamp) {
        if (!timestamp) return '-';
        try {
            const date = new Date(timestamp);
            return date.toLocaleString();
        } catch (e) {
            return timestamp;
        }
    }

    truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }

    capitalize(text) {
        if (!text) return '';
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

    executeConfirmedAction() {
        if (this.pendingAction) {
            this.pendingAction();
            this.pendingAction = null;
        }
        this.closeModal(document.getElementById('confirm-modal'));
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        document.querySelectorAll('.notification').forEach(n => n.remove());
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span class="notification-icon">${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}</span>
            <span class="notification-text">${message}</span>
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

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chatManager = new ChatManager();
});