import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// --- CONFIGURATION ---
const CONFIG = {
    colors: {
        true: 0x00ff41,      // Matrix Green
        false: 0xff0033,     // Error Red
        cbTrue: 0x3388ff,    // Accessible Blue
        cbFalse: 0xffaa00,   // Accessible Orange
        quantum: 0x00ffff,   // Cyan
        quantumAlt: 0x9d00ff,// Purple
        bg: 0x050505,
        unstableBg: 0x1a002a // Dark Purple
    },
    glitchDuration: 600, // ms
    cardWidth: 6,
    cardHeight: 2.5,
    cardDepth: 6,
    timeLimit: 60,
    winScore: 800,
    hardModeSpeed: 1.0,
    hardModeRadius: 3.0,
    slowMotionDuration: 5.0,
    slowMotionFactor: 0.2
};

// --- DATA: THE STATEMENTS ---
const LEVEL_DATA = [
    { text: "2 + 2 = 4", hardText: "sqrt(16) == 4", type: "TRUE", pos: [-8, 4, 0] },
    { text: "The Earth is Flat", hardText: "Pi == 3.0", type: "FALSE", pos: [8, 4, 0] },
    { text: "This statement\nis false", hardText: "Undefined\nis function", type: "QUANTUM", pos: [0, 0, 4] },
    { text: "Schrodinger's\nCat is alive", hardText: "Heisenberg\nUncertainty", type: "QUANTUM", pos: [-10, -5, -3] },
    { text: "You are\nobserving this", hardText: "I think\ntherefore I am", type: "TRUE", pos: [10, -5, -3] },
    { text: "Reality is\na simulation", hardText: "Matrix\nHas You", type: "QUANTUM", pos: [0, 8, -5] },
    { text: "HTML is a\nprogramming language", hardText: "CSS is\nTuring Complete", type: "FALSE", pos: [-12, 3, -3] },
    { text: "0.1 + 0.2\n=== 0.3", hardText: "[] == ![]", type: "FALSE", pos: [12, 3, -3] },
    { text: "The cake\nis a lie", hardText: "There is\nno spoon", type: "TRUE", pos: [0, -9, 0] },
    { text: "Light is\na particle", hardText: "Wave-Particle\nDuality", type: "QUANTUM", pos: [-6, 10, -6] },
    { text: "Time is\nlinear", hardText: "Time is\na flat circle", type: "QUANTUM", pos: [6, 10, -6] },
    { text: "AI has\nconsciousness", hardText: "P == NP", type: "QUANTUM", pos: [0, 0, -10] },
    { text: "JavaScript\nis Java", hardText: "Java ==\nJavaScript", type: "FALSE", pos: [-14, 0, -5] },
    { text: "Water is\nwet", hardText: "Fire is\nhot", type: "TRUE", pos: [14, 0, -5] },
    { text: "Birds are\nreal", hardText: "Giraffes\nexist", type: "QUANTUM", pos: [-11, -9, 2] },
    { text: "Tabs >\nSpaces", hardText: "Vim >\nEmacs", type: "QUANTUM", pos: [11, -9, 2] },
    { text: "CSS is\nawesome", hardText: "Center\na div", type: "TRUE", pos: [-5, 12, -8] },
    { text: "You are\na robot", hardText: "Bot\ndetected", type: "QUANTUM", pos: [5, 12, -8] },
    { text: "The moon\nis cheese", hardText: "Sun is\ncold", type: "FALSE", pos: [-13, 8, 3] },
    { text: "42 is the\nanswer", hardText: "Entropy\nReverses", type: "TRUE", pos: [13, 8, 3] }
];

/**
 * Handles procedural audio generation using Web Audio API.
 */
class SoundManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.volume = 0.15;
        this.masterGain.gain.value = this.volume; // Keep volume reasonable
        this.masterGain.connect(this.ctx.destination);
        this.isMuted = false;
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        const targetVolume = this.isMuted ? 0 : this.volume;
        this.masterGain.gain.setTargetAtTime(targetVolume, this.ctx.currentTime, 0.1);
        return this.isMuted;
    }

    playGlitch() {
        // Resume context if suspended (browser policy)
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }

        const t = this.ctx.currentTime;

        // 1. Oscillator: Sawtooth drop (Sci-fi zap)
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400 + Math.random() * 200, t);
        osc.frequency.exponentialRampToValueAtTime(50, t + 0.15);
        
        gain.gain.setValueAtTime(1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start(t);
        osc.stop(t + 0.15);

        // 2. Noise burst (Static)
        const bufferSize = this.ctx.sampleRate * 0.1; // 0.1 seconds
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseGain = this.ctx.createGain();
        
        noiseGain.gain.setValueAtTime(0.5, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        
        noise.connect(noiseGain);
        noiseGain.connect(this.masterGain);
        noise.start(t);
    }
}

/**
 * Represents a floating text effect for combos.
 */
class FloatingText {
    constructor(text, position, scene, color = '#00ff41') {
        this.scene = scene;
        this.life = 1.5; // Seconds to live
        
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = color;
        ctx.font = 'bold 60px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.MeshBasicMaterial({ 
            map: texture, 
            transparent: true,
            side: THREE.DoubleSide
        });
        
        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), material);
        this.mesh.position.copy(position);
        this.mesh.position.y += 1.5;
        this.mesh.position.z += 0.5;
        
        this.scene.add(this.mesh);
    }
    
    update(delta, camera) {
        this.life -= delta;
        this.mesh.position.y += delta * 0.5;
        this.mesh.material.opacity = Math.max(0, this.life / 1.5);
        this.mesh.lookAt(camera.position);
        
        if (this.life <= 0) {
            this.dispose();
            return false; // Dead
        }
        return true; // Alive
    }
    
    dispose() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.map.dispose();
        this.mesh.material.dispose();
    }
}

/**
 * Manages high scores using localStorage.
 */
class LeaderboardManager {
    constructor() {
        this.key = 'truth_glitch_highscores';
        this.scores = JSON.parse(localStorage.getItem(this.key)) || [];
    }

    addScore(score) {
        const date = new Date().toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
        this.scores.push({ score, date });
        this.scores.sort((a, b) => b.score - a.score);
        this.scores = this.scores.slice(0, 5); // Keep top 5
        localStorage.setItem(this.key, JSON.stringify(this.scores));
        this.updateUI();
    }

    updateUI() {
        const list = document.getElementById('score-list');
        if (!list) return;
        list.innerHTML = this.scores
            .map(s => `<li>${s.score} <span>${s.date}</span></li>`)
            .join('');
        document.getElementById('leaderboard').style.display = 'block';
    }

    hide() {
        const el = document.getElementById('leaderboard');
        if (el) el.style.display = 'none';
    }
}

/**
 * Class representing a single Logic Card in 3D space.
 * Handles texture generation, state management, and glitch effects.
 */
class StatementCard {
    constructor(data, world) {
        this.data = data;
        this.world = world;
        this.scene = world.scene;
        this.isQuantum = data.type === "QUANTUM";
        this.isCollapsed = !this.isQuantum; // True/False start collapsed
        this.isGlitching = false;
        
        // Initial State
        this.currentState = this.isQuantum ? "QUANTUM" : data.type;
        this.encryptedText = this.generateEncryptedText(data.text);
        
        this.mesh = this.createMesh();
        this.scene.add(this.mesh);

        if (this.world.isNightmareMode) {
            this.drawText(this.encryptedText);
        }
        
        // Animation offsets
        this.basePosition = new THREE.Vector3(...data.pos);
        this.timeOffset = Math.random() * 100;
    }

    generateEncryptedText(text) {
        const chars = "░▒▓█<!@#$%^&*()_+?010101";
        return text.split('').map(c => {
            if (c === '\n') return '\n';
            if (c === ' ') return ' ';
            return chars[Math.floor(Math.random() * chars.length)];
        }).join('');
    }

    createMesh() {
        // 1. Create Texture via Canvas
        this.canvas = document.createElement('canvas');
        this.canvas.width = 512;
        this.canvas.height = this.canvas.width / (CONFIG.cardWidth / CONFIG.cardHeight);
        
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.drawText(this.data.text);
        
        // 2. Create Material
        this.textMaterial = new THREE.MeshStandardMaterial({ 
            map: this.texture,
            color: this.getColor(),
            transparent: true,
            opacity: 0.9,
            roughness: 0.4,
            metalness: 0.0,
            emissive: 0x000000
        });
        
        const materials = Array(6).fill(this.textMaterial);

        // 3. Create Geometry
        const geometry = new THREE.BoxGeometry(CONFIG.cardWidth, CONFIG.cardHeight, CONFIG.cardDepth);
        const mesh = new THREE.Mesh(geometry, materials);
        
        mesh.position.set(...this.data.pos);
        mesh.userData = { parent: this }; // Link mesh back to class for Raycasting
        
        return mesh;
    }

    drawText(text) {
        const ctx = this.canvas.getContext('2d');
        // Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Border
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 10;
        ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);

        // Text
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 40px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const lines = text.split('\n');
        lines.forEach((line, i) => {
            const yOffset = (i - (lines.length - 1) / 2) * 50;
            ctx.fillText(line, this.canvas.width / 2, this.canvas.height / 2 + yOffset);
        });
        
        this.texture.needsUpdate = true;
    }

    onHoverStart() {
        if (this.world.isNightmareMode) {
            this.drawText(this.data.text);
        }
    }

    onHoverEnd() {
        if (this.world.isNightmareMode) {
            this.drawText(this.encryptedText);
        }
    }

    getCurrentText() {
        return (this.world.isHardMode && this.data.hardText) ? this.data.hardText : this.data.text;
    }

    updateHardMode() {
        const text = this.getCurrentText();
        this.encryptedText = this.generateEncryptedText(text);
        this.updateTextMode();
    }

    updateTextMode() {
        const targetText = this.getCurrentText();
        if (this.world.isNightmareMode) {
            // If currently hovered, show real text, else encrypted
            if (this.world.hoveredCard === this) {
                this.drawText(targetText);
            } else {
                this.drawText(this.encryptedText);
            }
        } else {
            this.drawText(targetText);
        }
    }

    getColor() {
        if (this.currentState === "TRUE") return this.world.isColorblindMode ? CONFIG.colors.cbTrue : CONFIG.colors.true;
        if (this.currentState === "FALSE") return this.world.isColorblindMode ? CONFIG.colors.cbFalse : CONFIG.colors.false;
        return CONFIG.colors.quantum;
    }

    updateColor() {
        const color = this.getColor();
        this.textMaterial.color.setHex(color);
    }

    // Triggered by Raycaster
    observe() {
        if (this.isCollapsed || this.isGlitching) return;

        console.log(`Observing: ${this.data.text}`);
        this.startGlitch();
    }

    startGlitch() {
        this.isGlitching = true;
        document.getElementById('status').innerText = "System: WAVEFUNCTION COLLAPSING...";
        document.getElementById('status').style.color = "cyan";
        this.textMaterial.emissive.setHex(0x00ffff);

        // Glitch Audio (Optional placeholder)
        // new Audio('glitch.mp3').play();

        setTimeout(() => {
            this.collapse();
        }, CONFIG.glitchDuration);
    }

    collapse() {
        this.isGlitching = false;
        this.isCollapsed = true;
        this.world.soundManager.playGlitch();
        
        // Determine truth value (Random for this demo)
        const isTrue = Math.random() > 0.5;
        this.currentState = isTrue ? "TRUE" : "FALSE";
        
        this.updateColor();
        this.textMaterial.emissive.setHex(0x000000);
        
        // Reset visual transforms
        this.mesh.position.copy(this.basePosition);
        this.mesh.scale.set(1, 1, 1);
        this.mesh.rotation.set(0, 0, 0);
        
        document.getElementById('status').innerText = `System: Collapsed to ${this.currentState}`;
        document.getElementById('status').style.color = isTrue ? this.world.getModeColorCSS('true') : this.world.getModeColorCSS('false');

        // Handle Game Logic (Score & Combo)
        this.world.handleCollapse(isTrue, this.mesh.position);
    }

    update(time, movementTime) {
        // Idle Animation (Floating)
        if (!this.isGlitching) {
            let posX = this.basePosition.x;
            let posY = this.basePosition.y;

            if (this.world.isHardMode && !this.isCollapsed) {
                posX += Math.sin(movementTime * CONFIG.hardModeSpeed + this.timeOffset) * CONFIG.hardModeRadius;
                posY += Math.cos(movementTime * CONFIG.hardModeSpeed * 0.8 + this.timeOffset) * CONFIG.hardModeRadius;
            }

            this.mesh.position.x = posX;
            this.mesh.position.y = posY + Math.sin(time + this.timeOffset) * 0.1;
            
            // Quantum vibration if not collapsed
            if (!this.isCollapsed) {
                const color = Math.sin(time * 5) > 0 ? CONFIG.colors.quantum : CONFIG.colors.quantumAlt;
                this.textMaterial.color.setHex(color);
            }
        } 
        // Glitch Animation
        else {
            // Violent shaking
            this.mesh.position.x = this.basePosition.x + (Math.random() - 0.5) * 0.5;
            this.mesh.position.y = this.basePosition.y + (Math.random() - 0.5) * 0.5;
            this.mesh.position.z = this.basePosition.z + (Math.random() - 0.5) * 0.5;
            
            // Random rotation
            this.mesh.rotation.x = (Math.random() - 0.5) * 0.5;
            this.mesh.rotation.y = (Math.random() - 0.5) * 0.5;
            this.mesh.rotation.z = (Math.random() - 0.5) * 0.5;

            // Scale distortion
            this.mesh.scale.set(
                1 + (Math.random() - 0.5) * 0.2,
                1 + (Math.random() - 0.5) * 0.2,
                1
            );
            
            // Color flashing
            this.textMaterial.emissive.setHex(Math.random() > 0.5 ? 0xffffff : 0x000000);
        }
        
        // Always look at camera (Billboarding effect - optional, currently disabled to keep 3D feel)
        // this.mesh.lookAt(camera.position);
    }

    dispose() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        if (Array.isArray(this.mesh.material)) {
            this.mesh.material.forEach(m => {
                if (m.map) m.map.dispose();
                m.dispose();
            });
        } else {
            if (this.mesh.material.map) this.mesh.material.map.dispose();
            this.mesh.material.dispose();
        }
    }
}

/**
 * Main Game Engine
 */
class World {
    constructor() {
        this.container = document.body;
        this.cards = [];
        this.score = 0;
        this.soundManager = new SoundManager();
        this.clock = new THREE.Clock();
        this.timeLeft = CONFIG.timeLimit;
        this.isGameOver = false;
        this.won = false;
        this.isHardMode = false;
        this.isSuddenDeath = false;
        this.isNightmareMode = false;
        this.hoveredCard = null;
        this.comboCount = 0;
        this.floatingTexts = [];
        this.leaderboard = new LeaderboardManager();
        this.totalQuantum = 0;
        this.movementTime = 0;
        this.isSlowMotion = false;
        this.slowMotionTimer = 0;
        this.isPaused = false;
        this.isColorblindMode = false;
        
        this.initScene();
        this.initParticles();
        this.initPostProcessing();
        this.initInteraction();
        this.loadLevel();
        this.animate();
        
        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    initScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(CONFIG.colors.bg);
        this.scene.fog = new THREE.FogExp2(CONFIG.colors.bg, 0.03);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.z = 8;

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.renderer.domElement);

        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxDistance = 30;

        // Lighting (Minimal/Cyberpunk)
        const ambientLight = new THREE.AmbientLight(0x404040, 1);
        this.scene.add(ambientLight);

        // Camera Light (Flashlight effect)
        this.cameraLight = new THREE.PointLight(0xffffff, 2, 20);
        this.camera.add(this.cameraLight);
        this.scene.add(this.camera); // Add camera to scene so light works

        // Scene Light
        const dirLight = new THREE.DirectionalLight(0x00ffff, 1.5);
        dirLight.position.set(10, 10, 10);
        this.scene.add(dirLight);
    }

    initPostProcessing() {
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));

        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            1.5, // Strength
            0.4, // Radius
            0.1  // Threshold
        );
        this.composer.addPass(bloomPass);
    }

    initParticles() {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        for (let i = 0; i < 1500; i++) {
            vertices.push((Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60);
        }
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        const material = new THREE.PointsMaterial({ color: 0xaaaaaa, size: 0.05, transparent: true, opacity: 0.4 });
        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }

    initInteraction() {
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // We trigger observation on mouse move (hover)
        window.addEventListener('mousemove', (event) => {
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        });

        window.addEventListener('keydown', (event) => {
            if (event.key.toLowerCase() === 'r') {
                this.resetLevel();
            }
            if (event.key.toLowerCase() === 'h') {
                this.toggleHardMode();
            }
            if (event.key.toLowerCase() === 's') {
                this.toggleSuddenDeath();
            }
            if (event.key.toLowerCase() === 'n') {
                this.toggleNightmareMode();
            }
            if (event.key.toLowerCase() === 'm') {
                this.activateSlowMotion();
            }
            if (event.key.toLowerCase() === 'p') {
                this.togglePause();
            }
            if (event.key.toLowerCase() === 'u') {
                this.toggleMute();
            }
            if (event.key.toLowerCase() === 'c') {
                this.toggleColorblindMode();
            }
        });

        // Unlock AudioContext on first interaction (browser requirement)
        window.addEventListener('click', () => {
            if (this.soundManager.ctx.state === 'suspended') {
                this.soundManager.ctx.resume();
            }
        });
    }

    loadLevel() {
        this.totalQuantum = 0;
        LEVEL_DATA.forEach(data => {
            const card = new StatementCard(data, this);
            this.cards.push(card);
            if (card.isQuantum) this.totalQuantum++;
        });
    }

    toggleHardMode() {
        this.isHardMode = !this.isHardMode;
        this.cards.forEach(card => card.updateHardMode());
        this.updateStatusDisplay();
    }

    toggleSuddenDeath() {
        this.isSuddenDeath = !this.isSuddenDeath;
        this.updateStatusDisplay();
    }

    toggleNightmareMode() {
        this.isNightmareMode = !this.isNightmareMode;
        this.cards.forEach(card => card.updateTextMode());
        this.updateStatusDisplay();
    }

    activateSlowMotion() {
        if (this.isSlowMotion) return;
        this.isSlowMotion = true;
        this.slowMotionTimer = CONFIG.slowMotionDuration;
        document.getElementById('status').innerText = "System: SLOW MOTION ENGAGED";
        document.getElementById('status').style.color = "#00ffff";
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        if (this.isPaused) {
            this.clock.stop();
        } else {
            this.clock.start();
        }
        this.updateStatusDisplay();
    }

    toggleMute() {
        this.soundManager.toggleMute();
        this.updateStatusDisplay();
    }

    toggleColorblindMode() {
        this.isColorblindMode = !this.isColorblindMode;
        this.cards.forEach(card => card.updateColor());
        this.updateUIColors();
        
        // Update particles if won
        if (this.won && this.particles) {
            this.particles.material.color.setHex(this.isColorblindMode ? CONFIG.colors.cbTrue : CONFIG.colors.true);
        }
    }

    getModeColorCSS(type) {
        if (type === 'true') return this.isColorblindMode ? "#3388ff" : "#00ff41";
        if (type === 'false') return this.isColorblindMode ? "#ffaa00" : "#ff0033";
        return "#ffffff";
    }

    updateUIColors() {
        const trueColor = this.getModeColorCSS('true');
        document.getElementById('score').style.color = trueColor;
        document.getElementById('score').style.textShadow = `0 0 5px ${trueColor}`;
        
        const timerColor = (this.isGameOver && !this.won) ? this.getModeColorCSS('false') : trueColor;
        document.getElementById('timer').style.color = timerColor;
        document.getElementById('timer').style.textShadow = `0 0 5px ${timerColor}`;

        // Leaderboard styling would ideally be handled here too if it wasn't hidden/dynamic
    }

    updateStatusDisplay() {
        const statusEl = document.getElementById('status');
        if (this.isPaused) {
            statusEl.innerText = "System: PAUSED";
            statusEl.style.color = "yellow";
        } else if (this.isNightmareMode) {
            statusEl.innerText = "System: NIGHTMARE MODE";
            statusEl.style.color = "#9d00ff";
        } else if (this.isSuddenDeath) {
            statusEl.innerText = "System: SUDDEN DEATH ACTIVE";
            statusEl.style.color = this.getModeColorCSS('false');
        } else if (this.isHardMode) {
            statusEl.innerText = "System: HARD MODE ENGAGED";
            statusEl.style.color = this.getModeColorCSS('false');
        } else {
            statusEl.innerText = "System: Stable";
            statusEl.style.color = "";
        }

        if (this.soundManager.isMuted) {
            statusEl.innerText += " [MUTED]";
        }
    }

    resetLevel() {
        this.cards.forEach(card => card.dispose());
        this.cards = [];
        this.loadLevel();
        this.hoveredCard = null;
        this.updateStatusDisplay();
        this.score = 0;
        this.updateScore(0);
        this.timeLeft = CONFIG.timeLimit;
        this.isGameOver = false;
        this.won = false;
        this.comboCount = 0;
        this.floatingTexts.forEach(ft => ft.dispose());
        this.floatingTexts = [];
        this.leaderboard.hide();
        this.isSlowMotion = false;
        this.slowMotionTimer = 0;
        if (this.isPaused) {
            this.isPaused = false;
            this.clock.start();
        }
        
        this.updateUIColors();

        if (this.composer && this.composer.passes[1]) {
            this.composer.passes[1].strength = 1.5;
            this.composer.passes[1].radius = 0.4;
        }
        if (this.particles) {
            this.particles.material.color.setHex(0xaaaaaa);
            this.particles.material.opacity = 0.4;
        }
    }

    crashSystem(message) {
        if (this.isGameOver) return;
        this.isGameOver = true;
        this.leaderboard.addScore(this.score);
        document.getElementById('status').innerText = message || "SYSTEM FAILURE: TIMEOUT";
        document.getElementById('status').style.color = this.getModeColorCSS('false');
        document.getElementById('timer').style.color = this.getModeColorCSS('false');
        
        // Visual crash intensity
        if (this.composer.passes[1]) {
            this.composer.passes[1].strength = 3.0;
            this.composer.passes[1].radius = 1.0;
        }
    }

    triggerWin() {
        if (this.isGameOver) return;
        this.isGameOver = true;
        this.leaderboard.addScore(this.score);
        this.won = true;
        
        document.getElementById('status').innerText = "SYSTEM: REALITY STABILIZED";
        document.getElementById('status').style.color = this.getModeColorCSS('true');
        document.getElementById('timer').style.color = this.getModeColorCSS('true');

        if (this.particles) {
            this.particles.material.color.setHex(this.isColorblindMode ? CONFIG.colors.cbTrue : CONFIG.colors.true);
            this.particles.material.opacity = 0.8;
        }
    }

    handleCollapse(isTrue, position) {
        if (isTrue) {
            this.comboCount++;
            const points = 100 + (this.comboCount > 1 ? (this.comboCount * 20) : 0);
            this.updateScore(points);
            
            if (this.comboCount > 1) {
                this.spawnFloatingText(`${this.comboCount}x COMBO`, position);
            }
        } else {
            if (this.isSuddenDeath) {
                this.crashSystem("SYSTEM FAILURE: SUDDEN DEATH");
                return;
            }
            this.comboCount = 0;
            this.updateScore(-50);
        }
    }

    spawnFloatingText(text, position) {
        const color = this.getModeColorCSS('true');
        const ft = new FloatingText(text, position, this.scene, color);
        this.floatingTexts.push(ft);
    }

    updateScore(points) {
        if (this.isGameOver) return;
        this.score += points;
        document.getElementById('score').innerText = `Score: ${this.score}`;
        
        if (this.score >= CONFIG.winScore) {
            this.triggerWin();
        }
    }

    checkInteractions() {
        if (this.isGameOver) return;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Get meshes from card objects
        const meshes = this.cards.map(c => c.mesh);
        const intersects = this.raycaster.intersectObjects(meshes);

        if (intersects.length > 0) {
            const hitObject = intersects[0].object;
            if (hitObject.userData.parent) {
                const card = hitObject.userData.parent;
                
                if (this.hoveredCard !== card) {
                    if (this.hoveredCard) this.hoveredCard.onHoverEnd();
                    this.hoveredCard = card;
                    this.hoveredCard.onHoverStart();
                }

                card.observe();
                document.body.style.cursor = 'pointer';
            }
        } else {
            if (this.hoveredCard) {
                this.hoveredCard.onHoverEnd();
                this.hoveredCard = null;
            }
            document.body.style.cursor = 'default';
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.composer.setSize(window.innerWidth, window.innerHeight);
    }

    updateBackground() {
        if (this.isGameOver) return;

        const currentQuantum = this.cards.reduce((acc, card) => acc + (card.isQuantum && !card.isCollapsed ? 1 : 0), 0);
        const instability = this.totalQuantum > 0 ? currentQuantum / this.totalQuantum : 0;

        const targetColor = new THREE.Color(CONFIG.colors.bg);
        const unstableColor = new THREE.Color(CONFIG.colors.unstableBg);
        
        targetColor.lerp(unstableColor, instability);
        this.scene.background.lerp(targetColor, 0.05);
        this.scene.fog.color.copy(this.scene.background);
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        
        if (this.isPaused) {
            this.composer.render();
            return;
        }

        const delta = this.clock.getDelta();
        const time = this.clock.getElapsedTime();
        
        // Slow Motion Logic
        let speed = 1.0;
        if (this.isSlowMotion) {
            this.slowMotionTimer -= delta;
            speed = CONFIG.slowMotionFactor;
            if (this.slowMotionTimer <= 0) {
                this.isSlowMotion = false;
                this.updateStatusDisplay();
            }
        }
        this.movementTime += delta * speed;

        if (!this.isGameOver) {
            this.timeLeft -= delta;
            if (this.timeLeft <= 0) {
                this.timeLeft = 0;
                this.crashSystem();
            }
            const timerEl = document.getElementById('timer');
            timerEl.innerText = `Time: ${this.timeLeft.toFixed(2)}`;
            if (this.timeLeft < 10 && this.timeLeft > 0) timerEl.style.color = "#ffaa00";
        }
        
        this.controls.update();
        this.checkInteractions();
        this.updateBackground();
        
        this.cards.forEach(card => card.update(time, this.movementTime));

        if (this.particles) {
            if (this.won) {
                this.particles.rotation.y = time * 0.5; // Spin faster on win
            } else {
                this.particles.rotation.y = time * 0.05;
            }
        }
        
        // Update floating texts
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const alive = this.floatingTexts[i].update(delta, this.camera);
            if (!alive) {
                this.floatingTexts.splice(i, 1);
            }
        }

        this.composer.render();
    }
}

// Start the simulation
new World();