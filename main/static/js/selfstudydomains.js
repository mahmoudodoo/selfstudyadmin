document.addEventListener('DOMContentLoaded', function() {
    // DOM elements and constants
    const DOMAINS = [
        "https://sfsdomains1.pythonanywhere.com",
        "https://sfsdomains2.pythonanywhere.com"
    ];

    // Modal elements
    const modals = {
        sync: {
            btn: document.getElementById('syncBtn'),
            modal: document.getElementById('syncModal'),
            confirm: document.getElementById('confirmSync'),
            cancel: document.getElementById('cancelSync'),
            sourceSelect: document.getElementById('sourceDomain'),
            details: document.getElementById('syncDetails')
        },
        addApp: {
            btn: document.getElementById('addAppBtn'),
            modal: document.getElementById('addAppModal'),
            confirm: document.getElementById('confirmAddApp'),
            cancel: document.getElementById('cancelAddApp'),
            form: document.getElementById('appForm')
        },
        editApp: {
            modal: document.getElementById('editAppModal'),
            confirm: document.getElementById('confirmEditApp'),
            cancel: document.getElementById('cancelEditApp'),
            form: document.getElementById('editAppForm'),
            id: document.getElementById('editAppId'),
            name: document.getElementById('editAppName'),
            description: document.getElementById('editAppDescription'),
            githubLink: document.getElementById('editAppGithubLink')
        },
        addReplica: {
            btn: document.getElementById('addReplicaBtn'),
            modal: document.getElementById('addReplicaModal'),
            confirm: document.getElementById('confirmAddReplica'),
            cancel: document.getElementById('cancelAddReplica'),
            form: document.getElementById('replicaForm')
        },
        editReplica: {
            modal: document.getElementById('editReplicaModal'),
            confirm: document.getElementById('confirmEditReplica'),
            cancel: document.getElementById('cancelEditReplica'),
            form: document.getElementById('editReplicaForm'),
            id: document.getElementById('editReplicaId'),
            app: document.getElementById('editReplicaApp'),
            url: document.getElementById('editReplicaUrl'),
            username: document.getElementById('editReplicaUsername'),
            password: document.getElementById('editReplicaPassword'),
            adminUsername: document.getElementById('editAdminUsername'),
            adminPassword: document.getElementById('editAdminPassword'),
            dbHost: document.getElementById('editDbHost'),
            dbName: document.getElementById('editDbName'),
            dbUsername: document.getElementById('editDbUsername'),
            dbPassword: document.getElementById('editDbPassword')
        },    
        filterApps: {
            btn: document.getElementById('filterAppsBtn'),
            modal: document.getElementById('filterAppsModal'),
            apply: document.getElementById('applyAppFilters'),
            clear: document.getElementById('clearAppFilters'),
            form: document.getElementById('filterAppsForm'),
            name: document.getElementById('filterAppName'),
            description: document.getElementById('filterAppDescription'),
            githubLink: document.getElementById('filterAppGithubLink')
        },
        filterReplicas: {
            btn: document.getElementById('filterReplicasBtn'),
            modal: document.getElementById('filterReplicasModal'),
            apply: document.getElementById('applyReplicaFilters'),
            clear: document.getElementById('clearReplicaFilters'),
            form: document.getElementById('filterReplicasForm'),
            app: document.getElementById('filterReplicaApp'),
            url: document.getElementById('filterReplicaUrl'),
            username: document.getElementById('filterReplicaUsername')
        }
    };

    // Initialize filter modals
    if (modals.filterApps.btn) {
        modals.filterApps.btn.addEventListener('click', () => toggleModal(modals.filterApps.modal, true));
        modals.filterApps.clear.addEventListener('click', clearAppFilters);
        modals.filterApps.apply.addEventListener('click', applyAppFilters);
    }

    if (modals.filterReplicas.btn) {
        modals.filterReplicas.btn.addEventListener('click', () => toggleModal(modals.filterReplicas.modal, true));
        modals.filterReplicas.clear.addEventListener('click', clearReplicaFilters);
        modals.filterReplicas.apply.addEventListener('click', applyReplicaFilters);
    }

    // Filter functions
    function applyAppFilters() {
        const filters = {
            name: modals.filterApps.name.value.toLowerCase(),
            description: modals.filterApps.description.value.toLowerCase(),
            githubLink: modals.filterApps.githubLink.value.toLowerCase()
        };
        
        const rows = document.querySelectorAll('#appsTable tbody tr');
        
        rows.forEach(row => {
            const name = row.cells[1].textContent.toLowerCase();
            const description = row.cells[2].textContent.toLowerCase();
            const githubLink = row.cells[3].querySelector('a')?.textContent.toLowerCase() || '';
            
            const nameMatch = filters.name ? name.includes(filters.name) : true;
            const descMatch = filters.description ? description.includes(filters.description) : true;
            const linkMatch = filters.githubLink ? githubLink.includes(filters.githubLink) : true;
            
            row.style.display = (nameMatch && descMatch && linkMatch) ? '' : 'none';
        });
        
        toggleModal(modals.filterApps.modal, false);
    }

    function clearAppFilters() {
        modals.filterApps.form.reset();
        document.querySelectorAll('#appsTable tbody tr').forEach(row => {
            row.style.display = '';
        });
        toggleModal(modals.filterApps.modal, false);
    }

    function applyReplicaFilters() {
        const filters = {
            app: modals.filterReplicas.app.value,
            url: modals.filterReplicas.url.value.toLowerCase(),
            username: modals.filterReplicas.username.value.toLowerCase()
        };
        
        const rows = document.querySelectorAll('#replicasTable tbody tr');
        
        rows.forEach(row => {
            const appId = modals.filterReplicas.app.value;
            const appName = row.cells[1].textContent.toLowerCase();
            const url = row.cells[2].querySelector('a')?.textContent.toLowerCase() || '';
            const username = row.cells[3].querySelector('div:first-child')?.textContent.toLowerCase().replace('user:', '').trim() || '';
            
            const appMatch = filters.app ? row.cells[1].textContent === document.querySelector(`#filterReplicaApp option[value="${filters.app}"]`).textContent : true;
            const urlMatch = filters.url ? url.includes(filters.url) : true;
            const userMatch = filters.username ? username.includes(filters.username) : true;
            
            row.style.display = (appMatch && urlMatch && userMatch) ? '' : 'none';
        });
        
        toggleModal(modals.filterReplicas.modal, false);
    }

    function clearReplicaFilters() {
        modals.filterReplicas.form.reset();
        document.querySelectorAll('#replicasTable tbody tr').forEach(row => {
            row.style.display = '';
        });
        toggleModal(modals.filterReplicas.modal, false);
    }

    // Search functionality
    const searchApps = document.getElementById('searchApps');
    const searchReplicas = document.getElementById('searchReplicas');

    if (searchApps) {
        searchApps.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const rows = document.querySelectorAll('#appsTable tbody tr');
            
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(searchTerm) ? '' : 'none';
            });
        });
    }

    if (searchReplicas) {
        searchReplicas.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const rows = document.querySelectorAll('#replicasTable tbody tr');
            
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(searchTerm) ? '' : 'none';
            });
        });
    }

    // Initialize modals
    Object.values(modals).forEach(modal => {
        if (modal.btn) modal.btn.addEventListener('click', () => toggleModal(modal.modal, true));
        if (modal.cancel) modal.cancel.addEventListener('click', () => toggleModal(modal.modal, false));
    });

    // Close modals when clicking outside
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                toggleModal(modal, false);
            }
        });
    });

    // Close modals with escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach(modal => {
                toggleModal(modal, false);
            });
        }
    });

    // Helper functions
    function toggleModal(modal, show) {
        if (show) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        } else {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    function getCookie(name) {
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

    // Sync functionality
    if (modals.sync.confirm) {
        modals.sync.confirm.addEventListener('click', function() {
            const sourceDomain = modals.sync.sourceSelect.value;
            
            fetch('/sync-data/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify({
                    source_domain: sourceDomain
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    alert('Data synchronized successfully!');
                    window.location.reload();
                } else {
                    alert('Error: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('An error occurred during synchronization');
            })
            .finally(() => {
                toggleModal(modals.sync.modal, false);
            });
        });
    }

    // Add App functionality
    if (modals.addApp.confirm) {
        modals.addApp.confirm.addEventListener('click', function() {
            const appData = {
                app_name: document.getElementById('appName').value,
                description: document.getElementById('appDescription').value,
                github_link: document.getElementById('appGithubLink').value
            };
            
            fetch('/add-app/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify(appData)
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    alert('App added successfully!');
                    window.location.reload();
                } else {
                    alert('Error: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('An error occurred while adding the app');
            })
            .finally(() => {
                toggleModal(modals.addApp.modal, false);
                modals.addApp.form.reset();
            });
        });
    }

    // Edit App functionality
    if (modals.editApp.confirm) {
        modals.editApp.confirm.addEventListener('click', function() {
            const appData = {
                app_name: modals.editApp.name.value,
                description: modals.editApp.description.value,
                github_link: modals.editApp.githubLink.value
            };
            
            fetch(`/update-app/${modals.editApp.id.value}/`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify(appData)
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    alert('App updated successfully!');
                    window.location.reload();
                } else {
                    alert('Error: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('An error occurred while updating the app');
            })
            .finally(() => {
                toggleModal(modals.editApp.modal, false);
            });
        });
    }

    // Add Replica functionality
    if (modals.addReplica.confirm) {
        modals.addReplica.confirm.addEventListener('click', function() {
            const replicaData = {
                app_id: document.getElementById('replicaApp').value,
                replica_url: document.getElementById('replicaUrl').value,
                replica_username: document.getElementById('replicaUsername').value,
                replica_password: document.getElementById('replicaPassword').value,
                admin_username: document.getElementById('adminUsername').value,
                admin_password: document.getElementById('adminPassword').value,
                db_host: document.getElementById('dbHost').value,
                db_name: document.getElementById('dbName').value,
                db_username: document.getElementById('dbUsername').value,
                db_password: document.getElementById('dbPassword').value
            };
            
            fetch('/add-replica/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify(replicaData)
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    alert('Replica added successfully!');
                    window.location.reload();
                } else {
                    alert('Error: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('An error occurred while adding the replica');
            })
            .finally(() => {
                toggleModal(modals.addReplica.modal, false);
                modals.addReplica.form.reset();
            });
        });
    }

    // Edit Replica functionality
    if (modals.editReplica.confirm) {
        modals.editReplica.confirm.addEventListener('click', function() {
            const replicaData = {
                app_id: modals.editReplica.app.value,
                replica_url: modals.editReplica.url.value,
                replica_username: modals.editReplica.username.value,
                replica_password: modals.editReplica.password.value,
                admin_username: modals.editReplica.adminUsername.value,
                admin_password: modals.editReplica.adminPassword.value,
                db_host: modals.editReplica.dbHost.value,
                db_name: modals.editReplica.dbName.value,
                db_username: modals.editReplica.dbUsername.value,
                db_password: modals.editReplica.dbPassword.value
            };
            
            fetch(`/update-replica/${modals.editReplica.id.value}/`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify(replicaData)
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    alert('Replica updated successfully!');
                    window.location.reload();
                } else {
                    alert('Error: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('An error occurred while updating the replica');
            })
            .finally(() => {
                toggleModal(modals.editReplica.modal, false);
            });
        });
    }

    // Handle edit buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.dataset.id;
            const type = this.dataset.type;
            
            if (type === 'app') {
                fetch(`/get-app/${id}/`)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Network response was not ok');
                        }
                        return response.json();
                    })
                    .then(app => {
                        modals.editApp.id.value = app.id;
                        modals.editApp.name.value = app.app_name;
                        modals.editApp.description.value = app.description;
                        modals.editApp.githubLink.value = app.github_link;
                        toggleModal(modals.editApp.modal, true);
                    })
                    .catch(error => {
                        console.error('Error fetching app:', error);
                        alert('Error loading app data');
                    });
            } else if (type === 'replica') {
                fetch(`/get-replica/${id}/`)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Network response was not ok');
                        }
                        return response.json();
                    })
                    .then(replica => {
                        modals.editReplica.id.value = replica.id;
                        modals.editReplica.app.value = replica.app;
                        modals.editReplica.url.value = replica.replica_url;
                        modals.editReplica.username.value = replica.replica_username;
                        modals.editReplica.password.value = replica.replica_password;
                        modals.editReplica.adminUsername.value = replica.admin_username;
                        modals.editReplica.adminPassword.value = replica.admin_password;
                        modals.editReplica.dbHost.value = replica.db_host;
                        modals.editReplica.dbName.value = replica.db_name;
                        modals.editReplica.dbUsername.value = replica.db_username;
                        modals.editReplica.dbPassword.value = replica.db_password;
                        toggleModal(modals.editReplica.modal, true);
                    })
                    .catch(error => {
                        console.error('Error fetching replica:', error);
                        alert('Error loading replica data');
                    });
            }
        });
    });

    // Handle delete buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.dataset.id;
            const type = this.dataset.type;
            
            if (confirm(`Are you sure you want to delete this ${type}?`)) {
                const endpoint = type === 'app' ? `/delete-app/${id}/` : `/delete-replica/${id}/`;
                
                fetch(endpoint, {
                    method: 'DELETE',
                    headers: {
                        'X-CSRFToken': getCookie('csrftoken')
                    }
                })
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        alert(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully!`);
                        window.location.reload();
                    } else {
                        alert('Error: ' + data.message);
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    alert('An error occurred during deletion');
                });
            }
        });
    });

    function fetchSyncStatus() {
        fetch('/self-study-domains/')
        .then(response => response.json())
        .then(data => {
            if (data.sync_status.out_of_sync) {
                let detailsHtml = '<h3>Out of Sync Details</h3><ul>';
                
                for (const [domain, diff] of Object.entries(data.sync_status.details)) {
                    detailsHtml += `<li><strong>${domain}</strong>: `;
                    detailsHtml += `Apps difference: ${diff.apps_diff}, `;
                    detailsHtml += `Replicas difference: ${diff.replicas_diff}</li>`;
                }
                
                detailsHtml += '</ul>';
                modals.sync.details.innerHTML = detailsHtml;
                
                modals.sync.sourceSelect.innerHTML = '';
                data.domains.forEach(domain => {
                    const option = document.createElement('option');
                    option.value = domain.url;
                    option.textContent = domain.url;
                    modals.sync.sourceSelect.appendChild(option);
                });
            }
        })
        .catch(error => {
            console.error('Error fetching sync status:', error);
        });
    }
});