// admin_dashboard.js - Modern Monitoring Dashboard 2026

document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const appSelect = document.getElementById('app-select');
    const replicaSelect = document.getElementById('replica-select');
    const refreshBtn = document.getElementById('refresh-btn');
    const dashboardGrid = document.getElementById('dashboard-grid');
    const loading = document.getElementById('loading');

    // State
    let appsData = [];
    let selectedAppId = null;
    let selectedReplicaUrl = null;
    let charts = {}; // to store Chart instances

    // Load apps on page load
    loadApps();

    // Event listeners
    appSelect.addEventListener('change', handleAppChange);
    replicaSelect.addEventListener('change', handleReplicaChange);
    refreshBtn.addEventListener('click', loadMetrics);

    // ------------------------------------------------------------
    // Fetch apps from our backend (which proxies the domain registry)
    async function loadApps() {
        showLoading(true);
        try {
            const response = await fetch('/api/dashboard/apps/');
            if (!response.ok) throw new Error('Failed to fetch apps');
            appsData = await response.json();
            populateAppSelect(appsData);
        } catch (error) {
            console.error('Error loading apps:', error);
            appSelect.innerHTML = '<option value="">Error loading apps</option>';
        } finally {
            showLoading(false);
        }
    }

    function populateAppSelect(apps) {
        appSelect.innerHTML = '<option value="">-- Select an App --</option>';
        apps.forEach(app => {
            const option = document.createElement('option');
            option.value = app.id;
            option.textContent = app.app_name;
            appSelect.appendChild(option);
        });
        appSelect.disabled = false;
    }

    function handleAppChange() {
        const appId = appSelect.value;
        selectedAppId = appId;
        if (!appId) {
            replicaSelect.innerHTML = '<option value="">-- All Replicas --</option>';
            replicaSelect.disabled = true;
            refreshBtn.disabled = true;
            dashboardGrid.innerHTML = ''; // clear cards
            return;
        }

        // Find selected app
        const app = appsData.find(a => a.id == appId);
        if (!app) return;

        // Populate replica dropdown
        replicaSelect.innerHTML = '<option value="">-- All Replicas --</option>';
        app.replicas.forEach(replica => {
            const option = document.createElement('option');
            option.value = replica.replica_url;
            option.textContent = replica.replica_url;
            replicaSelect.appendChild(option);
        });
        replicaSelect.disabled = false;
        refreshBtn.disabled = false;
    }

    function handleReplicaChange() {
        selectedReplicaUrl = replicaSelect.value || null;
    }

    // ------------------------------------------------------------
    // Load metrics for selected app/replica
    async function loadMetrics() {
        if (!selectedAppId) return;

        showLoading(true);
        dashboardGrid.innerHTML = ''; // clear previous cards

        const app = appsData.find(a => a.id == selectedAppId);
        if (!app) return;

        let replicas = app.replicas;
        if (selectedReplicaUrl) {
            replicas = replicas.filter(r => r.replica_url === selectedReplicaUrl);
        }

        // Fetch metrics for each replica in parallel
        const promises = replicas.map(async (replica) => {
            try {
                const metrics = await fetchReplicaMetrics(replica.replica_url);
                return { replica, metrics, status: 'up' };
            } catch (error) {
                console.error(`Error fetching metrics for ${replica.replica_url}:`, error);
                return { replica, metrics: null, status: 'down', error: error.message };
            }
        });

        const results = await Promise.all(promises);
        showLoading(false);

        // Render cards
        results.forEach(result => {
            const card = createReplicaCard(result);
            dashboardGrid.appendChild(card);
        });
    }

    async function fetchReplicaMetrics(replicaUrl) {
        const url = `/api/dashboard/metrics/?url=${encodeURIComponent(replicaUrl)}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid metrics response');
        }
        return data;
    }

    function createReplicaCard(result) {
        const { replica, metrics, status, error } = result;
        const card = document.createElement('div');
        card.className = 'replica-card';
        card.dataset.replica = replica.replica_url;

        // Header with URL and status
        const header = document.createElement('div');
        header.className = 'card-header';
        header.innerHTML = `
            <h3 title="${replica.replica_url}">${replica.replica_url}</h3>
            <span class="status-badge ${status}">${status.toUpperCase()}</span>
        `;
        card.appendChild(header);

        if (status === 'down' || !metrics) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = error || 'Replica unreachable or invalid metrics';
            card.appendChild(errorDiv);
            return card;
        }

        // Safely extract values with defaults
        const cpuPercent = metrics.cpu?.cpu_percent ?? 0;
        const memPercent = metrics.memory?.memory_percent_used ?? 0;
        const diskPercent = metrics.disk?.disk_percent_used ?? 0;

        // Metrics summary (numeric display)
        const metricsGrid = document.createElement('div');
        metricsGrid.className = 'metrics-grid';
        metricsGrid.innerHTML = `
            <div class="metric-item">
                <div class="metric-label">CPU</div>
                <div class="metric-value">${cpuPercent.toFixed(1)}<span class="metric-unit">%</span></div>
            </div>
            <div class="metric-item">
                <div class="metric-label">Memory</div>
                <div class="metric-value">${memPercent.toFixed(1)}<span class="metric-unit">%</span></div>
            </div>
            <div class="metric-item">
                <div class="metric-label">Disk</div>
                <div class="metric-value">${diskPercent.toFixed(1)}<span class="metric-unit">%</span></div>
            </div>
        `;
        card.appendChild(metricsGrid);

        // Chart container – three doughnut charts with labels
        const chartsRow = document.createElement('div');
        chartsRow.className = 'charts-row';

        // Helper to create a chart item
        function createChartItem(metric, percent, color, label) {
            const item = document.createElement('div');
            item.className = 'chart-item';

            const canvas = document.createElement('canvas');
            canvas.id = `chart-${label.toLowerCase()}-${replica.replica_url.replace(/[^a-zA-Z0-9]/g, '-')}`;
            canvas.width = 80;
            canvas.height = 80;

            const labelDiv = document.createElement('div');
            labelDiv.className = 'chart-label';
            labelDiv.textContent = label;

            item.appendChild(canvas);
            item.appendChild(labelDiv);

            return { item, canvasId: canvas.id, percent, color };
        }

        const cpuItem = createChartItem('cpu', cpuPercent, '#ef4444', 'CPU');
        const memItem = createChartItem('mem', memPercent, '#f59e0b', 'MEM');
        const diskItem = createChartItem('disk', diskPercent, '#3b82f6', 'DISK');

        chartsRow.appendChild(cpuItem.item);
        chartsRow.appendChild(memItem.item);
        chartsRow.appendChild(diskItem.item);
        card.appendChild(chartsRow);

        // Create charts after DOM insertion
        setTimeout(() => {
            createDoughnutChart(cpuItem.canvasId, cpuItem.percent, cpuItem.color);
            createDoughnutChart(memItem.canvasId, memItem.percent, memItem.color);
            createDoughnutChart(diskItem.canvasId, diskItem.percent, diskItem.color);
        }, 50);

        return card;
    }

    function createDoughnutChart(canvasId, percent, color) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        // Destroy existing chart if any
        if (charts[canvasId]) {
            charts[canvasId].destroy();
        }

        const ctx = canvas.getContext('2d');
        charts[canvasId] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [percent, 100 - percent],
                    backgroundColor: [color, '#2d3748'],
                    borderWidth: 0
                }]
            },
            options: {
                cutout: '70%',
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (ctx) => `${ctx.raw.toFixed(1)}%` } }
                }
            }
        });
    }

    function showLoading(visible) {
        loading.style.display = visible ? 'flex' : 'none';
        refreshBtn.disabled = visible;
    }
});