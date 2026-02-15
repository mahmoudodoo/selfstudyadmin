// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
    // --- Setup Scene, Camera, Renderer ---
    const container = document.getElementById('bg-canvas-container');
    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1e); // dark space blue
    
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 5);
    camera.lookAt(0, 2, 10);
    
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    
    // --- Lights ---
    const ambientLight = new THREE.AmbientLight(0x404060);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(1, 2, 1);
    scene.add(dirLight);
    
    const pointLight = new THREE.PointLight(0xffffff, 0.5);
    pointLight.position.set(0, 5, 5);
    scene.add(pointLight);
    
    // --- Helper to create a round point texture (soft circle) ---
    function createRoundTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 32, 32);
        // Draw a radial gradient for soft glow
        const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.5, 'rgba(255,255,255,0.8)');
        gradient.addColorStop(0.8, 'rgba(255,255,255,0.2)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 32, 32);
        return new THREE.CanvasTexture(canvas);
    }
    const roundTexture = createRoundTexture();
    
    // --- Stars (particle system with round points) ---
    const starsGeometry = new THREE.BufferGeometry();
    const starsCount = 2000;
    const starsPositions = new Float32Array(starsCount * 3);
    for (let i = 0; i < starsCount * 3; i += 3) {
        const r = 50 + Math.random() * 50;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        starsPositions[i] = Math.sin(phi) * Math.cos(theta) * r;
        starsPositions[i+1] = Math.sin(phi) * Math.sin(theta) * r;
        starsPositions[i+2] = Math.cos(phi) * r;
    }
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starsPositions, 3));
    
    const starsMaterial = new THREE.PointsMaterial({ 
        color: 0xffffff, 
        map: roundTexture,
        size: 0.3, 
        transparent: true,
        blending: THREE.AdditiveBlending, // gives a nice glow
        depthWrite: false
    });
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);
    
    // --- Milky Way (spiral disc with round points) ---
    const milkyWayGeometry = new THREE.BufferGeometry();
    const milkyWayCount = 4000;
    const milkyWayPositions = new Float32Array(milkyWayCount * 3);
    const milkyWayColors = new Float32Array(milkyWayCount * 3);
    
    for (let i = 0; i < milkyWayCount; i++) {
        const r = Math.random() * 40 + 10;
        const angle = Math.random() * Math.PI * 2;
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        const y = (Math.random() - 0.5) * 5;
        
        milkyWayPositions[i*3] = x;
        milkyWayPositions[i*3+1] = y;
        milkyWayPositions[i*3+2] = z;
        
        const color = new THREE.Color().setHSL(0.6 + Math.random()*0.2, 0.8, 0.5 + Math.random()*0.3);
        milkyWayColors[i*3] = color.r;
        milkyWayColors[i*3+1] = color.g;
        milkyWayColors[i*3+2] = color.b;
    }
    milkyWayGeometry.setAttribute('position', new THREE.BufferAttribute(milkyWayPositions, 3));
    milkyWayGeometry.setAttribute('color', new THREE.BufferAttribute(milkyWayColors, 3));
    
    const milkyWayMaterial = new THREE.PointsMaterial({ 
        map: roundTexture,
        size: 0.4, 
        vertexColors: true, 
        transparent: true, 
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const milkyWay = new THREE.Points(milkyWayGeometry, milkyWayMaterial);
    scene.add(milkyWay);
    
    // --- Sun (far away, bright) ---
    const sunGeometry = new THREE.SphereGeometry(3, 64, 64);
    const sunMaterial = new THREE.MeshStandardMaterial({
        color: 0xffaa00,
        emissive: 0xff5500,
        roughness: 0.2
    });
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    sun.position.set(-50, 20, -80);
    scene.add(sun);
    
    const sunLight = new THREE.PointLight(0xffaa66, 2, 0, 0);
    sunLight.position.copy(sun.position);
    scene.add(sunLight);
    
    // --- Moon (far away, cool gray) ---
    const moonGeometry = new THREE.SphereGeometry(2, 32, 32);
    const moonMaterial = new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        emissive: 0x111111,
        roughness: 0.8
    });
    const moon = new THREE.Mesh(moonGeometry, moonMaterial);
    moon.position.set(60, 10, -100);
    scene.add(moon);
    
    // --- Planets with embedded labels (no squares) ---
    const topics = [
        'Python', 'Java', 'CSS', 'Computer Science', 'Math', 'Self Study',
        'Django', 'Flask', 'IONIC', 'HTML', 'JavaScript', 'Docker',
        'Kubernetes', 'Virtualization', 'AWS Cloud', 'Azure Cloud', 'Google Cloud', 'Web Scraping'
    ];
    
    const colors = [
        0x3776ab, 0xb07219, 0x264de4, 0x2c3e50, 0x2ecc71, 0xf39c12,
        0x092e20, 0x000000, 0x488aff, 0xe34c26, 0xf7df1e, 0x2496ed,
        0x326ce5, 0x00a98b, 0xff9900, 0x0089d6, 0x4285f4, 0x8e44ad
    ];
    
    const planets = [];
    
    // Helper to create a text sprite with glow and no background
    function createLabel(text, textColor = '#ffffff') {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 128;
        // Transparent background
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        // Text style with glow
        context.font = 'Bold 36px "Segoe UI", Arial, sans-serif';
        context.fillStyle = textColor;
        context.shadowColor = 'rgba(0,0,0,0.9)';
        context.shadowBlur = 15;
        context.shadowOffsetX = 3;
        context.shadowOffsetY = 3;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width/2, canvas.height/2);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ 
            map: texture, 
            depthTest: false,   // always appear on top of planet
            transparent: true,
            blending: THREE.NormalBlending
        });
        const sprite = new THREE.Sprite(material);
        // Scale the sprite to fit nicely inside the planet (planet radius ~0.8-1.2)
        sprite.scale.set(1.5, 0.75, 1);
        return sprite;
    }
    
    topics.forEach((topic, index) => {
        const radius = 0.8 + Math.random() * 0.4;
        const geometry = new THREE.SphereGeometry(radius, 32, 32);
        const material = new THREE.MeshStandardMaterial({ 
            color: colors[index % colors.length],
            emissive: 0x222222,
            roughness: 0.4,
            metalness: 0.1
        });
        const sphere = new THREE.Mesh(geometry, material);
        
        const x = (Math.random() - 0.5) * 30;
        const y = (Math.random() - 0.5) * 15 + 2;
        const z = 40 + Math.random() * 60;
        sphere.position.set(x, y, z);
        
        // Add label as a sprite child, centered (appears inside the planet)
        const label = createLabel(topic, '#ffffff');
        sphere.add(label);
        
        scene.add(sphere);
        
        planets.push({
            mesh: sphere,
            speed: 0.1 + Math.random() * 0.15,
            resetZ: -10,
            startZ: 100,
            xRange: 30,
            yRange: 15
        });
    });
    
    // --- Person (simple stick figure with walk cycle) ---
    const personGroup = new THREE.Group();
    
    const bodyGeo = new THREE.CylinderGeometry(0.3, 0.3, 1.2, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3498db });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.6;
    personGroup.add(body);
    
    const headGeo = new THREE.SphereGeometry(0.3, 16);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xf1c40f });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.5;
    personGroup.add(head);
    
    const armGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.8);
    const armMat = new THREE.MeshStandardMaterial({ color: 0xe67e22 });
    
    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-0.5, 1.2, 0);
    leftArm.rotation.z = 0.3;
    personGroup.add(leftArm);
    
    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(0.5, 1.2, 0);
    rightArm.rotation.z = -0.3;
    personGroup.add(rightArm);
    
    const legGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.8);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50 });
    
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.2, 0.1, 0);
    leftLeg.rotation.z = 0.2;
    personGroup.add(leftLeg);
    
    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.2, 0.1, 0);
    rightLeg.rotation.z = -0.2;
    personGroup.add(rightLeg);
    
    personGroup.position.set(0, -0.5, 2);
    scene.add(personGroup);
    
    const limbs = { leftArm, rightArm, leftLeg, rightLeg };
    
    // --- Animation loop ---
    let clock = new THREE.Clock();
    
    function animate() {
        requestAnimationFrame(animate);
        
        const delta = clock.getDelta();
        const elapsedTime = performance.now() / 1000;
        
        // Move planets towards camera
        planets.forEach(planet => {
            planet.mesh.position.z -= planet.speed * 0.5;
            planet.mesh.rotation.y += 0.01;
            
            if (planet.mesh.position.z < planet.resetZ) {
                planet.mesh.position.x = (Math.random() - 0.5) * planet.xRange;
                planet.mesh.position.y = (Math.random() - 0.5) * planet.yRange + 2;
                planet.mesh.position.z = planet.startZ;
            }
        });
        
        milkyWay.rotation.y += 0.0002;
        stars.rotation.y += 0.0001;
        sun.rotation.y += 0.001;
        moon.rotation.y += 0.0005;
        
        const speed = 2;
        const angle = Math.sin(elapsedTime * speed) * 0.5;
        limbs.leftArm.rotation.x = angle;
        limbs.rightArm.rotation.x = -angle;
        limbs.leftLeg.rotation.x = -angle * 0.8;
        limbs.rightLeg.rotation.x = angle * 0.8;
        
        personGroup.position.y = -0.5 + Math.sin(elapsedTime * speed * 2) * 0.05;
        
        renderer.render(scene, camera);
    }
    
    animate();
    
    // --- Handle window resize ---
    window.addEventListener('resize', onWindowResize, false);
    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
});