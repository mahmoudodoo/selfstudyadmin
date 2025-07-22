document.addEventListener('DOMContentLoaded', function() {
    // Only run on user profiles page
    if (!document.querySelector('.profiles-container')) return;

    // Generate UUID for new users if the field exists
    const userIdField = document.getElementById('user_id');
    if (userIdField && !userIdField.value) {
        try {
            userIdField.value = crypto.randomUUID();
        } catch (e) {
            console.error('UUID generation failed:', e);
            userIdField.value = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }
    }

    // Initialize Bootstrap tooltips
    if (typeof bootstrap !== 'undefined') {
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.forEach(function (tooltipTriggerEl) {
            new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }

    // Function to ensure only one backdrop exists
    function ensureSingleBackdrop() {
        const backdrops = document.querySelectorAll('.modal-backdrop');
        if (backdrops.length > 1) {
            // Remove all but the first backdrop
            for (let i = 1; i < backdrops.length; i++) {
                backdrops[i].remove();
            }
        }
    }

    // Edit buttons
    document.querySelectorAll('.edit').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const userId = this.getAttribute('data-id');
            const domain = this.getAttribute('data-domain');
            
            if (!userId || userId === 'None' || !domain || domain === 'None') {
                console.error('Missing user ID or domain');
                return;
            }

            const editModalEl = document.getElementById('editUserModal');
            if (!editModalEl) return;
            
            // Create new modal instance each time
            const editModal = new bootstrap.Modal(editModalEl);
            
            // Event listener for when modal is shown
            editModalEl.addEventListener('shown.bs.modal', function() {
                ensureSingleBackdrop();
            });
            
            editModal.show();

            // Fetch user data
            fetch(`/users/details/?user_id=${encodeURIComponent(userId)}&domain=${encodeURIComponent(domain)}`)
                .then(response => {
                    if (!response.ok) throw new Error('Failed to fetch user');
                    return response.json();
                })
                .then(user => {
                    // Populate form
                    const setValue = (id, value) => {
                        const el = document.getElementById(id);
                        if (el) el.value = value || '';
                    };
                    
                    setValue('edit_username', user.username);
                    setValue('edit_email', user.email);
                    setValue('edit_first_name', user.first_name);
                    setValue('edit_last_name', user.last_name);
                    setValue('edit_gender', user.gender);
                    setValue('edit_image_url', user.image_url);
                    setValue('edit_lab_url', user.lab_url);
                    setValue('edit_notification_url', user.notification_url);
                    
                    const verifiedCheck = document.getElementById('edit_is_email_verified');
                    if (verifiedCheck) verifiedCheck.checked = user.is_email_verified || false;
                    
                    const domainInput = document.getElementById('edit_domain');
                    if (domainInput) domainInput.value = domain;
                    
                    const form = document.getElementById('editUserForm');
                    if (form) form.action = `/users/update/${userId}/`;
                })
                .catch(error => {
                    console.error('Error:', error);
                    editModal.hide();
                    alert('Failed to load user data');
                });
        });
    });

    // Delete buttons
    document.querySelectorAll('.delete').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const userId = this.getAttribute('data-id');
            const domain = this.getAttribute('data-domain');
            
            if (!userId || userId === 'None' || !domain || domain === 'None') {
                console.error('Missing user ID or domain');
                return;
            }

            const deleteModalEl = document.getElementById('deleteUserModal');
            if (!deleteModalEl) return;
            
            const domainInput = document.getElementById('delete_domain');
            if (domainInput) domainInput.value = domain;
            
            const form = document.getElementById('deleteUserForm');
            if (form) form.action = `/users/delete/${userId}/`;
            
            // Create new modal instance each time
            const deleteModal = new bootstrap.Modal(deleteModalEl);
            
            // Event listener for when modal is shown
            deleteModalEl.addEventListener('shown.bs.modal', function() {
                ensureSingleBackdrop();
            });
            
            deleteModal.show();
        });
    });

    // Add User Modal - ensure single backdrop
    const addUserModalEl = document.getElementById('addUserModal');
    if (addUserModalEl) {
        addUserModalEl.addEventListener('shown.bs.modal', function() {
            ensureSingleBackdrop();
        });
    }

    // Auto-generate avatar URL
    const usernameInput = document.getElementById('username');
    const imageUrlField = document.getElementById('image_url');
    if (usernameInput && imageUrlField) {
        usernameInput.addEventListener('input', function() {
            const username = this.value.trim();
            if (username) {
                imageUrlField.value = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random`;
            }
        });
    }

    // Auto-generate notification URL
    const emailInput = document.getElementById('email');
    const notificationUrlField = document.getElementById('notification_url');
    if (emailInput && notificationUrlField) {
        emailInput.addEventListener('input', function() {
            const email = this.value.trim();
            if (email) {
                const domain = email.split('@')[1] || 'example.com';
                notificationUrlField.value = `https://${domain}/notifications/`;
            }
        });
    }
});