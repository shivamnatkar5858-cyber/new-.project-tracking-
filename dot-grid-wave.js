// dot-grid-wave.js - Real-time WebGL Dot Grid Wave Background with Remix Playground
// Inspired by Dot Grid Wave (zero heavy video/GIF, crisp on retina, auto-pauses off-screen)

(function () {
    'use strict';

    // Default configuration (closely matched to user reference image)
    const DEFAULT_CONFIG = {
        theme: 'periwinkle',
        bgColor: '#090d18',
        colorCrest: '#a5b4fc',   // Glowing soft purple/periwinkle
        colorTrough: '#1e293b',  // Subtle deep slate blue
        speed: 1.0,
        frequency: 1.1,
        intensity: 1.0,
        minRadius: 1.2,
        maxRadius: 4.8,
        dotSpacing: 26,
        mouseReaction: true,
        mouseInfluence: 1.2,
        scope: 'hero' // 'hero' or 'fullpage'
    };

    const PRESETS = {
        periwinkle: {
            name: 'Cosmic Periwinkle (Original)',
            bgColor: '#090d18',
            colorCrest: '#a5b4fc',
            colorTrough: '#273449',
            minRadius: 1.2,
            maxRadius: 4.8,
            speed: 1.0,
            frequency: 1.1,
            intensity: 1.0
        },
        electricCyan: {
            name: 'Electric Cyan',
            bgColor: '#07131e',
            colorCrest: '#38bdf8',
            colorTrough: '#0f2942',
            minRadius: 1.0,
            maxRadius: 4.5,
            speed: 1.2,
            frequency: 1.3,
            intensity: 1.1
        },
        neonEmerald: {
            name: 'Neon Matrix Emerald',
            bgColor: '#05140d',
            colorCrest: '#34d399',
            colorTrough: '#0b3020',
            minRadius: 1.2,
            maxRadius: 4.6,
            speed: 0.9,
            frequency: 1.0,
            intensity: 1.2
        },
        sunsetRose: {
            name: 'Sunset Rose & Amber',
            bgColor: '#160b14',
            colorCrest: '#f43f5e',
            colorTrough: '#3b1227',
            minRadius: 1.2,
            maxRadius: 4.8,
            speed: 1.1,
            frequency: 1.2,
            intensity: 1.1
        },
        cyberpunkViolet: {
            name: 'Cyberpunk Violet',
            bgColor: '#0f0a1c',
            colorCrest: '#c084fc',
            colorTrough: '#2e1854',
            minRadius: 1.3,
            maxRadius: 5.0,
            speed: 1.3,
            frequency: 1.2,
            intensity: 1.3
        }
    };

    let config = { ...DEFAULT_CONFIG };
    let canvas = null;
    let gl = null;
    let program = null;
    let positionBuffer = null;
    let numDots = 0;
    let isRunning = true;
    let isIntersecting = true;
    let animFrameId = null;
    let startTime = performance.now();
    let lastFrameTime = performance.now();
    let frameCount = 0;
    let currentFps = 60;
    let lastFpsUpdate = performance.now();

    // Mouse tracking
    let mouse = { x: -1000, y: -1000, targetX: -1000, targetY: -1000, active: false };

    // Helper: Hex to RGB 0..1
    function hexToRgb(hex) {
        let clean = hex.replace('#', '');
        if (clean.length === 3) {
            clean = clean.split('').map(c => c + c).join('');
        }
        const num = parseInt(clean, 16);
        return [
            ((num >> 16) & 255) / 255,
            ((num >> 8) & 255) / 255,
            (num & 255) / 255
        ];
    }

    // Shaders
    const VS_SOURCE = `
        attribute vec2 a_gridPos;
        uniform vec2 u_resolution;
        uniform float u_time;
        uniform vec2 u_mouse;
        uniform float u_dotSpacing;
        uniform float u_minRadius;
        uniform float u_maxRadius;
        uniform float u_frequency;
        uniform float u_speed;
        uniform float u_intensity;
        uniform vec3 u_colorCrest;
        uniform vec3 u_colorTrough;
        uniform float u_dpr;

        varying vec4 v_color;

        void main() {
            vec2 pos = a_gridPos * u_dotSpacing;

            // Two interfering diagonal wave vectors matching the reference image
            float diag1 = (pos.x * 0.7071 + pos.y * 0.7071) * (u_frequency * 0.006) + u_time * (u_speed * 1.35);
            float diag2 = (pos.x * 0.6 - pos.y * 0.8) * (u_frequency * 0.0045) - u_time * (u_speed * 0.95);
            
            // Wave amplitude: 0.0 to 1.0
            float wave = (sin(diag1) * 0.62 + cos(diag2) * 0.38 + 1.0) * 0.5;

            // Interactive mouse ripple
            if (u_mouse.x > 0.0) {
                float dist = distance(pos, u_mouse);
                float mouseRipple = exp(-dist * 0.0075) * sin(dist * 0.04 - u_time * 5.0);
                wave = clamp(wave + mouseRipple * u_intensity * 0.6, 0.0, 1.0);
            }

            // Nonlinear contrast for crisp crests like in the image
            float waveCurve = pow(wave, 1.75 * u_intensity);
            float radius = mix(u_minRadius, u_maxRadius, waveCurve);

            gl_PointSize = max(1.0, radius * 2.0 * u_dpr);

            // Color blending
            vec3 col = mix(u_colorTrough, u_colorCrest, waveCurve);
            float alpha = mix(0.18, 0.98, waveCurve);
            v_color = vec4(col, alpha);

            // Convert to clip space [-1, 1]
            vec2 zeroToOne = pos / u_resolution;
            vec2 zeroToTwo = zeroToOne * 2.0;
            vec2 clipSpace = zeroToTwo - 1.0;
            gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);
        }
    `;

    const FS_SOURCE = `
        precision mediump float;
        varying vec4 v_color;

        void main() {
            // Calculate distance from center of point sprite [0..1]
            vec2 coord = gl_PointCoord - vec2(0.5);
            float dist = length(coord);
            if (dist > 0.5) {
                discard;
            }
            // Smooth anti-aliased edge
            float alpha = 1.0 - smoothstep(0.40, 0.50, dist);
            gl_FragColor = vec4(v_color.rgb, v_color.a * alpha);
        }
    `;

    function initWebGL() {
        canvas = document.getElementById('dotGridCanvas');
        if (!canvas) return false;

        gl = canvas.getContext('webgl', { alpha: true, antialias: true, powerPreference: 'high-performance' }) ||
             canvas.getContext('experimental-webgl', { alpha: true });

        if (!gl) {
            console.warn('WebGL not supported, falling back to 2D Canvas');
            initCanvas2D();
            return false;
        }

        // Compile shaders
        const vs = createShader(gl, gl.VERTEX_SHADER, VS_SOURCE);
        const fs = createShader(gl, gl.FRAGMENT_SHADER, FS_SOURCE);
        program = createProgram(gl, vs, fs);

        if (!program) {
            initCanvas2D();
            return false;
        }

        gl.useProgram(program);

        // Enable alpha blending
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        setupGridBuffer();
        setupResize();
        setupMouse();
        setupIntersectionObserver();
        startRenderLoop();
        return true;
    }

    function createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    function createProgram(gl, vs, fs) {
        const p = gl.createProgram();
        gl.attachShader(p, vs);
        gl.attachShader(p, fs);
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(p));
            gl.deleteProgram(p);
            return null;
        }
        return p;
    }

    function setupGridBuffer() {
        if (!gl || !program) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;

        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        gl.viewport(0, 0, canvas.width, canvas.height);

        const spacing = config.dotSpacing;
        const cols = Math.ceil(width / spacing) + 2;
        const rows = Math.ceil(height / spacing) + 2;

        const positions = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                positions.push(c + 0.5, r + 0.5);
            }
        }

        numDots = positions.length / 2;

        if (!positionBuffer) {
            positionBuffer = gl.createBuffer();
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        const aGridPos = gl.getAttribLocation(program, 'a_gridPos');
        gl.enableVertexAttribArray(aGridPos);
        gl.vertexAttribPointer(aGridPos, 2, gl.FLOAT, false, 0, 0);

        // Update playground badge if available
        const dotCountEl = document.getElementById('pwDotCount');
        if (dotCountEl) dotCountEl.textContent = numDots.toLocaleString();
    }

    function setupResize() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                setupGridBuffer();
            }, 100);
        });
    }

    function setupMouse() {
        const heroSection = document.getElementById('home') || canvas;

        heroSection.addEventListener('mousemove', (e) => {
            if (!config.mouseReaction) return;
            const rect = canvas.getBoundingClientRect();
            mouse.targetX = e.clientX - rect.left;
            mouse.targetY = e.clientY - rect.top;
            mouse.active = true;
        });

        heroSection.addEventListener('mouseleave', () => {
            mouse.targetX = -1000;
            mouse.targetY = -1000;
            mouse.active = false;
        });

        // Touch support
        heroSection.addEventListener('touchmove', (e) => {
            if (!config.mouseReaction || !e.touches[0]) return;
            const rect = canvas.getBoundingClientRect();
            mouse.targetX = e.touches[0].clientX - rect.left;
            mouse.targetY = e.touches[0].clientY - rect.top;
            mouse.active = true;
        }, { passive: true });

        heroSection.addEventListener('touchend', () => {
            mouse.targetX = -1000;
            mouse.targetY = -1000;
            mouse.active = false;
        });
    }

    // Auto-pause when off-screen to keep pages fast
    function setupIntersectionObserver() {
        if (!('IntersectionObserver' in window)) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                isIntersecting = entry.isIntersecting;
                const statusBadge = document.getElementById('pwStatusBadge');
                if (statusBadge) {
                    if (isIntersecting && isRunning) {
                        statusBadge.innerHTML = '<span class="status-dot live"></span> Live 60 FPS (On-Screen)';
                    } else if (!isIntersecting) {
                        statusBadge.innerHTML = '<span class="status-dot paused"></span> Auto-Paused (Off-Screen)';
                    }
                }
                if (isIntersecting && isRunning && !animFrameId) {
                    lastFrameTime = performance.now();
                    startRenderLoop();
                }
            });
        }, { threshold: 0.05 });

        observer.observe(canvas.parentElement || canvas);
    }

    function render(currentTime) {
        if (!isIntersecting || !isRunning) {
            animFrameId = null;
            return;
        }

        // FPS calculation
        frameCount++;
        if (currentTime - lastFpsUpdate >= 500) {
            currentFps = Math.round((frameCount * 1000) / (currentTime - lastFpsUpdate));
            frameCount = 0;
            lastFpsUpdate = currentTime;
            const fpsEl = document.getElementById('pwFpsVal');
            if (fpsEl) fpsEl.textContent = currentFps;
        }

        // Smooth mouse dampening
        if (mouse.active) {
            mouse.x += (mouse.targetX - mouse.x) * 0.15;
            mouse.y += (mouse.targetY - mouse.y) * 0.15;
        } else {
            mouse.x = -1000;
            mouse.y = -1000;
        }

        const elapsedSec = (currentTime - startTime) * 0.001;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        // Clear background
        const bgRgb = hexToRgb(config.bgColor);
        gl.clearColor(bgRgb[0], bgRgb[1], bgRgb[2], 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(program);

        // Uniforms
        gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), canvas.clientWidth, canvas.clientHeight);
        gl.uniform1f(gl.getUniformLocation(program, 'u_time'), elapsedSec);
        gl.uniform2f(gl.getUniformLocation(program, 'u_mouse'), mouse.x, mouse.y);
        gl.uniform1f(gl.getUniformLocation(program, 'u_dotSpacing'), config.dotSpacing);
        gl.uniform1f(gl.getUniformLocation(program, 'u_minRadius'), config.minRadius);
        gl.uniform1f(gl.getUniformLocation(program, 'u_maxRadius'), config.maxRadius);
        gl.uniform1f(gl.getUniformLocation(program, 'u_frequency'), config.frequency);
        gl.uniform1f(gl.getUniformLocation(program, 'u_speed'), config.speed);
        gl.uniform1f(gl.getUniformLocation(program, 'u_intensity'), config.intensity);
        gl.uniform1f(gl.getUniformLocation(program, 'u_dpr'), dpr);

        const crestRgb = hexToRgb(config.colorCrest);
        const troughRgb = hexToRgb(config.colorTrough);
        gl.uniform3f(gl.getUniformLocation(program, 'u_colorCrest'), crestRgb[0], crestRgb[1], crestRgb[2]);
        gl.uniform3f(gl.getUniformLocation(program, 'u_colorTrough'), troughRgb[0], troughRgb[1], troughRgb[2]);

        // Draw points
        gl.drawArrays(gl.POINTS, 0, numDots);

        animFrameId = requestAnimationFrame(render);
    }

    function startRenderLoop() {
        if (!animFrameId && isIntersecting && isRunning) {
            animFrameId = requestAnimationFrame(render);
        }
    }

    // Canvas 2D Fallback if WebGL is unavailable
    function initCanvas2D() {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        function render2D(now) {
            if (!isIntersecting || !isRunning) {
                animFrameId = null;
                return;
            }

            const width = canvas.clientWidth;
            const height = canvas.clientHeight;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);

            if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
                canvas.width = width * dpr;
                canvas.height = height * dpr;
            }

            ctx.save();
            ctx.scale(dpr, dpr);
            ctx.fillStyle = config.bgColor;
            ctx.fillRect(0, 0, width, height);

            const spacing = config.dotSpacing;
            const cols = Math.ceil(width / spacing) + 1;
            const rows = Math.ceil(height / spacing) + 1;
            const time = (now - startTime) * 0.001;

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const x = (c + 0.5) * spacing;
                    const y = (r + 0.5) * spacing;

                    const diag1 = (x * 0.7071 + y * 0.7071) * (config.frequency * 0.006) + time * (config.speed * 1.35);
                    const diag2 = (x * 0.6 - y * 0.8) * (config.frequency * 0.0045) - time * (config.speed * 0.95);
                    let wave = (Math.sin(diag1) * 0.62 + Math.cos(diag2) * 0.38 + 1) * 0.5;

                    if (mouse.x > 0) {
                        const dist = Math.hypot(x - mouse.x, y - mouse.y);
                        const ripple = Math.exp(-dist * 0.0075) * Math.sin(dist * 0.04 - time * 5);
                        wave = Math.max(0, Math.min(1, wave + ripple * config.intensity * 0.6));
                    }

                    const waveCurve = Math.pow(wave, 1.75 * config.intensity);
                    const radius = config.minRadius + (config.maxRadius - config.minRadius) * waveCurve;

                    ctx.fillStyle = waveCurve > 0.4 ? config.colorCrest : config.colorTrough;
                    ctx.globalAlpha = 0.2 + waveCurve * 0.78;
                    ctx.beginPath();
                    ctx.arc(x, y, radius, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            ctx.restore();

            animFrameId = requestAnimationFrame(render2D);
        }

        setupResize();
        setupMouse();
        setupIntersectionObserver();
        animFrameId = requestAnimationFrame(render2D);
    }

    // Public API & Remix Playground Controller
    window.DotGridWave = {
        getConfig: () => ({ ...config }),
        setConfig: (newCfg) => {
            config = { ...config, ...newCfg };
            if (newCfg.dotSpacing && gl) {
                setupGridBuffer();
            }
            // Update container theme styling if needed
            const heroWrap = document.querySelector('.hero-wave-wrap');
            if (heroWrap) {
                heroWrap.style.backgroundColor = config.bgColor;
            }
        },
        applyPreset: (presetKey) => {
            if (PRESETS[presetKey]) {
                const preset = PRESETS[presetKey];
                config = { ...config, ...preset, theme: presetKey };
                if (gl) setupGridBuffer();
                syncPlaygroundInputs();
            }
        },
        togglePause: () => {
            isRunning = !isRunning;
            const btn = document.getElementById('pwPlayPauseBtn');
            const statusBadge = document.getElementById('pwStatusBadge');
            if (isRunning) {
                if (btn) btn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
                if (statusBadge) statusBadge.innerHTML = '<span class="status-dot live"></span> Live 60 FPS';
                startRenderLoop();
            } else {
                if (btn) btn.innerHTML = '<i class="fa-solid fa-play"></i> Play';
                if (statusBadge) statusBadge.innerHTML = '<span class="status-dot paused"></span> Paused';
            }
            return isRunning;
        },
        openPlayground: () => {
            const drawer = document.getElementById('dotWavePlayground');
            if (drawer) drawer.classList.add('active');
        },
        closePlayground: () => {
            const drawer = document.getElementById('dotWavePlayground');
            if (drawer) drawer.classList.remove('active');
        },
        resetDefaults: () => {
            config = { ...DEFAULT_CONFIG };
            if (gl) setupGridBuffer();
            syncPlaygroundInputs();
        }
    };

    function syncPlaygroundInputs() {
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };
        const setText = (id, txt) => {
            const el = document.getElementById(id);
            if (el) el.textContent = txt;
        };

        setVal('pwColorCrest', config.colorCrest);
        setVal('pwColorTrough', config.colorTrough);
        setVal('pwBgColor', config.bgColor);
        setVal('pwSpeed', config.speed);
        setText('pwSpeedVal', config.speed + 'x');
        setVal('pwFrequency', config.frequency);
        setText('pwFreqVal', config.frequency.toFixed(1));
        setVal('pwIntensity', config.intensity);
        setText('pwIntensityVal', config.intensity.toFixed(1));
        setVal('pwDotSpacing', config.dotSpacing);
        setText('pwSpacingVal', config.dotSpacing + 'px');
        setVal('pwMaxRadius', config.maxRadius);
        setText('pwMaxRadiusVal', config.maxRadius + 'px');

        const mouseCheck = document.getElementById('pwMouseReaction');
        if (mouseCheck) mouseCheck.checked = config.mouseReaction;

        // Highlight active preset chip
        document.querySelectorAll('.preset-chip').forEach(chip => {
            if (chip.dataset.preset === config.theme) {
                chip.classList.add('active');
            } else {
                chip.classList.remove('active');
            }
        });
    }

    // Attach UI handlers once DOM is loaded
    document.addEventListener('DOMContentLoaded', () => {
        initWebGL();

        // Wire up playground inputs
        const bindSlider = (id, valId, key, suffix = '', multiplier = 1) => {
            const el = document.getElementById(id);
            const valEl = document.getElementById(valId);
            if (el) {
                el.addEventListener('input', (e) => {
                    const num = parseFloat(e.target.value) * multiplier;
                    window.DotGridWave.setConfig({ [key]: num });
                    if (valEl) valEl.textContent = (multiplier === 1 ? num : num.toFixed(1)) + suffix;
                });
            }
        };

        bindSlider('pwSpeed', 'pwSpeedVal', 'speed', 'x');
        bindSlider('pwFrequency', 'pwFreqVal', 'frequency', '');
        bindSlider('pwIntensity', 'pwIntensityVal', 'intensity', '');
        bindSlider('pwDotSpacing', 'pwSpacingVal', 'dotSpacing', 'px');
        bindSlider('pwMaxRadius', 'pwMaxRadiusVal', 'maxRadius', 'px');

        const bindColor = (id, key) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', (e) => {
                    window.DotGridWave.setConfig({ [key]: e.target.value });
                });
            }
        };

        bindColor('pwColorCrest', 'colorCrest');
        bindColor('pwColorTrough', 'colorTrough');
        bindColor('pwBgColor', 'bgColor');

        const mouseCheck = document.getElementById('pwMouseReaction');
        if (mouseCheck) {
            mouseCheck.addEventListener('change', (e) => {
                window.DotGridWave.setConfig({ mouseReaction: e.target.checked });
            });
        }

        // Preset chips
        document.querySelectorAll('.preset-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const presetKey = chip.dataset.preset;
                window.DotGridWave.applyPreset(presetKey);
            });
        });

        // Copy settings
        const copyBtn = document.getElementById('pwCopySettingsBtn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const json = JSON.stringify(window.DotGridWave.getConfig(), null, 2);
                navigator.clipboard.writeText(json).then(() => {
                    const orig = copyBtn.innerHTML;
                    copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                    setTimeout(() => { copyBtn.innerHTML = orig; }, 2000);
                });
            });
        }

        syncPlaygroundInputs();
    });
})();
