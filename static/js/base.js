document.addEventListener('DOMContentLoaded', function() {
    // Toggle sidebar collapse
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const mainContent = document.querySelector('.main-content');
    
    // Check localStorage for sidebar state
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (isCollapsed) {
        sidebar.classList.add('collapsed');
        mainContent.style.marginLeft = '80px';
    }
    
    // Toggle sidebar
    sidebarToggle.addEventListener('click', function() {
        sidebar.classList.toggle('collapsed');
        
        // Update margin of main content
        if (sidebar.classList.contains('collapsed')) {
            mainContent.style.marginLeft = '80px';
            localStorage.setItem('sidebarCollapsed', 'true');
        } else {
            mainContent.style.marginLeft = '280px';
            localStorage.setItem('sidebarCollapsed', 'false');
        }
    });
    
    // Mobile sidebar toggle
    const mobileSidebarToggle = document.createElement('div');
    mobileSidebarToggle.className = 'mobile-sidebar-toggle';
    mobileSidebarToggle.innerHTML = '<i class="fas fa-bars"></i>';
    document.body.appendChild(mobileSidebarToggle);
    
    mobileSidebarToggle.addEventListener('click', function() {
        sidebar.classList.toggle('active');
    });
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', function(e) {
        if (window.innerWidth <= 992 && !sidebar.contains(e.target) && e.target !== mobileSidebarToggle && !mobileSidebarToggle.contains(e.target)) {
            sidebar.classList.remove('active');
        }
    });
    
    // Active nav item
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            navItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            
            // Close sidebar on mobile after selection
            if (window.innerWidth <= 992) {
                sidebar.classList.remove('active');
            }
        });
    });
    
    // Dynamic network background
    const networkBg = document.querySelector('.network-bg');
    
    function createNode() {
        const node = document.createElement('div');
        node.className = 'node';
        
        const size = Math.random() * 100 + 50;
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        const opacity = Math.random() * 0.1 + 0.05;
        const color = `rgba(${Math.floor(Math.random() * 100 + 155)}, ${Math.floor(Math.random() * 100 + 155)}, ${Math.floor(Math.random() * 100 + 155)}, ${opacity})`;
        
        node.style.width = `${size}px`;
        node.style.height = `${size}px`;
        node.style.left = `${x}%`;
        node.style.top = `${y}%`;
        node.style.background = color;
        
        networkBg.appendChild(node);
        
        // Animate node
        animateNode(node);
    }
    
    function animateNode(node) {
        const duration = Math.random() * 20000 + 10000;
        const xMovement = (Math.random() - 0.5) * 10;
        const yMovement = (Math.random() - 0.5) * 10;
        
        node.animate(
            [
                { transform: 'translate(0, 0)' },
                { transform: `translate(${xMovement}px, ${yMovement}px)` },
                { transform: 'translate(0, 0)' }
            ],
            {
                duration: duration,
                iterations: Infinity
            }
        );
    }
    
    // Create initial nodes
    for (let i = 0; i < 5; i++) {
        createNode();
    }
    
    // Add more nodes periodically
    setInterval(createNode, 5000);
    
    // Responsive adjustments
    function handleResize() {
        if (window.innerWidth <= 992) {
            sidebar.classList.remove('collapsed');
            mainContent.style.marginLeft = '0';
        } else {
            if (sidebar.classList.contains('collapsed')) {
                mainContent.style.marginLeft = '80px';
            } else {
                mainContent.style.marginLeft = '280px';
            }
        }
    }
    
    window.addEventListener('resize', handleResize);
    handleResize();
});