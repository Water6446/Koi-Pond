import { config } from './config.js';
import { KoiFish } from './KoiFish.js';
import { LillyPad } from './LillyPad.js';
import { initClock } from './Clock.js';
import { initQuote } from './Quote.js';
import { initWeather } from './Weather.js';
import { initFeeder, foods as feederFoods, updateFoods, drawFoods } from './Feeder.js';
import { Ripple } from './Ripple.js';
import { Dragonfly } from './Dragonfly.js';
import { initTimeTheme, applyTimeTheme } from './TimeTheme.js';

const GRID_SIZE = 40; 
let flowerImage = null;
let kois = [];
let particles = [];
let lillypads = [];
let ripples = [];
let dragonflies = [];
let mouse = { x: -1000, y: -1000 };
let draggedLilly = null;
let gridOverlay = null;
let draggedElement = null; 
let dragOffset = { x: 0, y: 0 };
let originalRect = { width: 0, height: 0 };
let isMouseOverControls = false;
let performanceMode = false;
let dragonflySpawnTimer = 0;

// Debug Mode
let debugMode = false;
let debugShowVectors = true;
let debugShowHitboxes = false;
let debugShowGrid = false;
let fpsHistory = [];
let lastFrameTime = 0;
let minFPS = Infinity;
let maxFPS = 0;
let drawCallCount = 0;
let updatesSkipped = 0;

// Settings State
let userSettings = {};
const defaultSettings = {
    widgetPositions: {},
    widgetSizes: {
        "clock-widget": { width: "320px", height: "120px" },
        "weather-widget": { width: "240px", height: "120px" },
            "quote-widget": { width: "700px", height: "120px" },
            "google-search-widget": { width: "420px", height: "64px" }
    },
    widgetVisibility: {
        "clock-widget": true,
        "weather-widget": true,
            "quote-widget": true,
            "google-search-widget": true
    },
    weatherSettings: {
        units: "C",
        manualLocation: null
    },
    quoteSettings: {
        showAuthor: true,
        customQuote: null,
        showCustomAuthor: true,
        customAuthor: null
    },
    widgetStyle: 'lilypad',
    fishSpeed: 1.0,
    performanceMode: false,
    debugMode: false,
    customBackground: null,
    manualTimeOfDay: 'auto',
    customWaterColor: null
};

/** Apply a widget style variant to all widgets. */
function applyWidgetStyle(style) {
    document.querySelectorAll('.widget').forEach(w => {
        // Remove known style classes and add the requested one
        w.classList.remove('lilypad', 'glass', 'leaf', 'none');
        if (style === 'lilypad') w.classList.add('lilypad');
        else if (style === 'glass') w.classList.add('glass');
        else if (style === 'leaf') w.classList.add('leaf');
        else if (style === 'none') w.classList.add('none');
    });
    // reflect on body for possible global selectors
    document.body.dataset.widgetStyle = style;
}

/**
 * Deep merge two objects. Used to safely combine default and saved settings.
 */
function mergeSettings(saved, defaults) {
    let newSettings = { ...defaults };
    for (let key in saved) {
        if (saved.hasOwnProperty(key)) {
            if (typeof newSettings[key] === 'object' && newSettings[key] !== null && !Array.isArray(newSettings[key]) &&
                typeof saved[key] === 'object' && saved[key] !== null && !Array.isArray(saved[key])) {
                newSettings[key] = { ...defaults[key], ...saved[key] };
            } else {
                newSettings[key] = saved[key];
            }
        }
    }
    return newSettings;
}

/**
 * Saves the specified settings object to chrome.storage.
 * This merges the new settings with the existing ones.
 */
function saveSettings(newSettings) {
    // Merge new settings into the current state
    userSettings = mergeSettings(newSettings, userSettings);
    
    // Cache critical settings to localStorage for instant loading
    try {
        const cacheData = {
            manualTimeOfDay: userSettings.manualTimeOfDay,
            customWaterColor: userSettings.customWaterColor,
            widgetPositions: userSettings.widgetPositions,
            widgetSizes: userSettings.widgetSizes,
            widgetVisibility: userSettings.widgetVisibility
        };
        localStorage.setItem('koiPondCachedSettings', JSON.stringify(cacheData));
    } catch (e) {
        console.warn('Failed to cache settings to localStorage:', e);
    }
    
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set({ userSettings: userSettings });
    } else {
        console.warn("Storage API not available. Settings not saved.");
    }
}


/**
 * Loads the flower SVG image. (Unchanged)
 */
function loadFlowerImage(callback) {
    const flowerSymbol = document.getElementById('flower');
    if (!flowerSymbol) {
        console.error("CRITICAL: Flower SVG symbol not found!");
        return;
    }
    const viewBox = flowerSymbol.getAttribute('viewBox') || '0 0 161 161';
    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="161" height="161" viewBox="${viewBox}">${flowerSymbol.innerHTML}</svg>`;
    const img = new Image();
    const dataUrl = `data:image/svg+xml;base64,${btoa(svgString)}`;
    img.onload = () => {
        flowerImage = img;
        callback();
    };
    img.onerror = (e) => {
        console.error("Failed to load flower image as data URL:", e);
        callback();
    };
    img.src = dataUrl;
}


document.addEventListener('DOMContentLoaded', () => {

    const canvas = document.getElementById('koiCanvas');
    const ctx = canvas.getContext('2d');
    const controls = document.querySelector('.controls');
    gridOverlay = document.getElementById('drag-grid-overlay');

    // --- Randomize Leaf Positions ---
    function randomizeLeaves() {
        const leafGroups = document.querySelectorAll('.leaf__group');
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        
        leafGroups.forEach((group, groupIndex) => {
            // Randomly choose which edge: 0=left, 1=right, 2=top, 3=bottom
            const edge = Math.floor(Math.random() * 4);
            
            // Reset all positioning
            group.style.left = 'auto';
            group.style.right = 'auto';
            group.style.top = 'auto';
            group.style.bottom = 'auto';
            
            if (edge === 0) {
                // Left edge - leaves point inward from off-screen
                group.style.left = '-175px';
                group.style.top = `${Math.random() * (screenHeight - 250)}px`;
                group.style.transform = 'rotate(90deg)';
            } else if (edge === 1) {
                // Right edge - leaves point inward from off-screen
                group.style.right = '-175px';
                group.style.top = `${Math.random() * (screenHeight - 250)}px`;
                group.style.transform = 'rotate(-90deg)';
            } else if (edge === 2) {
                // Top edge - leaves hang down from off-screen
                group.style.top = '-175px';
                group.style.left = `${Math.random() * (screenWidth - 250)}px`;
                group.style.transform = 'rotate(180deg)';
            } else {
                // Bottom edge - leaves grow up from off-screen
                group.style.bottom = '-175px';
                group.style.left = `${Math.random() * (screenWidth - 250)}px`;
                group.style.transform = 'rotate(0deg)';
            }
            
            // Randomize individual leaves within the group
            const leaves = group.querySelectorAll('.leaf');
            const colors = ['#0a8f6f', '#087a5d', '#06654c', '#0ba47a', '#05584a'];
            
            leaves.forEach((leaf, leafIndex) => {
                const randomOffset1 = Math.random() * 120; // 0 to 120
                const randomOffset2 = Math.random() * 120; // 0 to 120
                const randomScale = 0.6 + Math.random() * 1.0; // 0.6 to 1.6
                const randomRotate = Math.random() * 40 - 20; // -20 to 20 degrees
                const randomColor = colors[Math.floor(Math.random() * colors.length)];
                const randomOpacity = 0.6 + Math.random() * 0.3; // 0.6 to 0.9
                
                leaf.style.left = `${randomOffset1}px`;
                leaf.style.bottom = `${randomOffset2}px`;
                leaf.style.transform = `scale(${randomScale}) rotate(${randomRotate}deg)`;
                leaf.style.opacity = randomOpacity;
                
                // Set random color on SVG
                const svg = leaf.querySelector('svg use');
                if (svg) {
                    leaf.querySelector('svg').style.fill = randomColor;
                }
            });
            
            // Mark group as initialized to fade it in
            group.classList.add('initialized');
        });
    }
    
    // Call randomize on load
    randomizeLeaves();

    // --- Simulation Setup (Unchanged) ---
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    /**
     * Reposition widgets based on stored percentage coordinates so they stay in relative place
     * when screen size or monitor changes. Snaps to grid.
     */
    function repositionWidgetsFromPercent() {
        const widgets = document.querySelectorAll('.widget');
        widgets.forEach(widget => {
            const id = widget.id;
            const pos = userSettings.widgetPositions && userSettings.widgetPositions[id];
            if (!pos) return;

            // Prefer percentage coordinates if available
            if (pos.leftPct !== undefined && pos.topPct !== undefined) {
                const leftPx = Math.round((pos.leftPct || 0) * window.innerWidth / GRID_SIZE) * GRID_SIZE;
                const topPx = Math.round((pos.topPct || 0) * window.innerHeight / GRID_SIZE) * GRID_SIZE;
                widget.style.left = `${leftPx}px`;
                widget.style.top = `${topPx}px`;
                widget.style.transform = 'none';
            }
        });
    }

    function updateKoisSize(newSize) {
        const currentSize = kois.length;
        if (newSize > currentSize) {
            for (let i = 0; i < newSize - currentSize; i++) {
                kois.push(new KoiFish(Math.random() * canvas.width, Math.random() * canvas.height));
            }
        } else if (newSize < currentSize) {
            kois.length = newSize;
        }
    }
    
    function updateLillypadsSize(newSize) {
        const currentSize = lillypads.length;
        if (newSize > currentSize) {
            for (let i = 0; i < newSize - currentSize; i++) {
                lillypads.push(new LillyPad(Math.random() * canvas.width, Math.random() * canvas.height));
            }
        } else if (newSize < currentSize) {
            lillypads.length = newSize;
        }
    }



    // --- Simulation Event Listeners (Sliders, Mouse, etc.) ---
    document.getElementById('koiSlider').addEventListener('input', (e) => {
        const count = parseInt(e.target.value);
        document.getElementById('koiCount').textContent = count;
        updateKoisSize(count);
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.set({ koiCount: count });
        }
    });
    
    document.getElementById('lillySlider').addEventListener('input', (e) => {
        const count = parseInt(e.target.value);
        document.getElementById('lillyCount').textContent = count;
        updateLillypadsSize(count);
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.set({ lillyCount: count });
        }
    });

    // Performance mode toggle
    document.getElementById('performanceModeToggle').addEventListener('change', (e) => {
        performanceMode = e.target.checked;
        userSettings.performanceMode = performanceMode;
        saveSettings({ performanceMode: performanceMode });
    });

    // Debug mode - Triple click detection on lily pads in top-right area
    const debugOverlay = document.getElementById('debug-overlay');
    let clickCount = 0;
    let clickTimer = null;
    const TOP_RIGHT_X = window.innerWidth - 300; // Top-right 300px from right edge
    const TOP_RIGHT_Y = 300; // Top 300px from top
    
    function toggleDebugMode(enable) {
        debugMode = enable;
        if (debugMode) {
            debugOverlay.classList.add('active');
            // Reset stats
            fpsHistory = [];
            minFPS = Infinity;
            maxFPS = 0;
            drawCallCount = 0;
            updatesSkipped = 0;
        } else {
            debugOverlay.classList.remove('active');
        }
        userSettings.debugMode = debugMode;
        saveSettings({ debugMode: debugMode });
    }
    
    // Debug close button
    document.getElementById('debug-close').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDebugMode(false);
    });

    // Debug options toggles
    document.getElementById('debug-vectors').addEventListener('change', (e) => {
        debugShowVectors = e.target.checked;
    });

    document.getElementById('debug-hitboxes').addEventListener('change', (e) => {
        debugShowHitboxes = e.target.checked;
    });

    document.getElementById('debug-grid').addEventListener('change', (e) => {
        debugShowGrid = e.target.checked;
    });

    // Helper function for custom background
    function applyCustomBackground(dataUrl) {
        const bgImage = document.querySelector('.bg-image');
        if (dataUrl) {
            bgImage.style.backgroundImage = `url(${dataUrl})`;
        } else {
            bgImage.style.backgroundImage = 'var(--bg-img)';
        }
    }

    // Customize panel button - wrapped in safety check
    try {
        const customizeBtn = document.getElementById('customizeButton');
        if (customizeBtn) {
            customizeBtn.addEventListener('click', () => {
                const panel = document.getElementById('customize-settings-panel');
                if (panel) {
                    // Close all other panels
                    document.querySelectorAll('.controls-settings-panel').forEach(p => {
                        if (p.id !== 'customize-settings-panel') p.style.display = 'none';
                    });
                    panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
                }
            });
        }

        // Time of Day radio buttons
        const timeRadios = document.querySelectorAll('input[name="timeOfDay"]');
        if (timeRadios.length > 0) {
            timeRadios.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    const value = e.target.value;
                    userSettings.manualTimeOfDay = value;
                    saveSettings({ manualTimeOfDay: value });
                    applyTimeTheme(
                        value === 'auto' ? null : value,
                        userSettings.customWaterColor
                    );
                });
            });
        }

        // Upload background in customize panel
        const uploadBgBtn = document.getElementById('uploadBgButton');
        const uploadBgInput = document.getElementById('uploadBgInput');
        if (uploadBgBtn && uploadBgInput) {
            uploadBgBtn.addEventListener('click', () => {
                uploadBgInput.click();
            });

            uploadBgInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const dataUrl = event.target.result;
                        userSettings.customBackground = dataUrl;
                        saveSettings({ customBackground: dataUrl });
                        applyCustomBackground(dataUrl);
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        const clearBgBtn = document.getElementById('clearBgButton');
        if (clearBgBtn) {
            clearBgBtn.addEventListener('click', () => {
                userSettings.customBackground = null;
                saveSettings({ customBackground: null });
                applyCustomBackground(null);
            });
        }

        // Water color picker
        const waterColorPicker = document.getElementById('waterColorPicker');
        const resetWaterColor = document.getElementById('resetWaterColor');
        
        if (waterColorPicker) {
            waterColorPicker.addEventListener('change', (e) => {
                const color = e.target.value;
                userSettings.customWaterColor = color;
                saveSettings({ customWaterColor: color });
                applyTimeTheme(
                    userSettings.manualTimeOfDay === 'auto' ? null : userSettings.manualTimeOfDay,
                    color
                );
            });
        }

        if (resetWaterColor) {
            resetWaterColor.addEventListener('click', () => {
                userSettings.customWaterColor = null;
                saveSettings({ customWaterColor: null });
                if (waterColorPicker) {
                    waterColorPicker.value = '#005A5A';
                }
                applyTimeTheme(
                    userSettings.manualTimeOfDay === 'auto' ? null : userSettings.manualTimeOfDay,
                    null
                );
            });
        }
    } catch (e) {
        console.error('Error setting up customize panel:', e);
    }

    const hotCornerWidth = 450;
    const hotCornerHeight = 150;
    const isInHotCorner = () => (mouse.x < hotCornerWidth && mouse.y > window.innerHeight - hotCornerHeight);
    const updateControlsVisibility = () => {
        if (isInHotCorner() || isMouseOverControls) {
            controls.style.opacity = '1';
            controls.style.pointerEvents = 'auto';
        } else {
            controls.style.opacity = '0';
            controls.style.pointerEvents = 'none';
        }
    };

    // Feeder bag visibility (bottom-right corner)
    const feederCornerWidth = 200;
    const feederCornerHeight = 200;
    let isMouseOverFeeder = false;
    const isInFeederCorner = () => (mouse.x > window.innerWidth - feederCornerWidth && mouse.y > window.innerHeight - feederCornerHeight);
    const updateFeederVisibility = () => {
        const feederBag = document.getElementById('feeder-bag');
        if (feederBag) {
            if (isInFeederCorner() || isMouseOverFeeder) {
                feederBag.classList.add('visible');
            } else {
                feederBag.classList.remove('visible');
            }
        }
    };

    document.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        updateControlsVisibility();
        updateFeederVisibility();
        if (draggedLilly) {
            draggedLilly.x = mouse.x;
            draggedLilly.y = mouse.y;
        }
    });

    controls.addEventListener('mouseenter', () => {
        isMouseOverControls = true;
        updateControlsVisibility();
    });

    controls.addEventListener('mouseleave', () => {
        isMouseOverControls = false;
        updateControlsVisibility();
    });


    document.addEventListener('mousedown', (e) => {
        if (e.target.closest('.controls') || e.target.closest('.widget')) return;
        
        // Create ripple effect on click
        ripples.push(new Ripple(e.clientX, e.clientY));
        
        // Check if clicking on a lily pad
        let clickedLilly = null;
        for (let i = lillypads.length - 1; i >= 0; i--) {
            const lilly = lillypads[i];
            const dx = e.clientX - lilly.x;
            const dy = e.clientY - lilly.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < lilly.radius * lilly.radius) {
                clickedLilly = lilly;
                lilly.isDragging = true;
                draggedLilly = lilly;
                break;
            }
        }
        
        // Triple-click detection for debug mode (top-right area or on any flower lily pad)
        const isTopRight = e.clientX > TOP_RIGHT_X && e.clientY < TOP_RIGHT_Y;
        const isFlowerLilly = clickedLilly && clickedLilly.hasFlower;
        
        if (isTopRight || isFlowerLilly) {
            clickCount++;
            
            // Clear existing timer
            if (clickTimer) {
                clearTimeout(clickTimer);
            }
            
            // Set timer to reset click count after 500ms
            clickTimer = setTimeout(() => {
                clickCount = 0;
            }, 500);
            
            // Triple click detected!
            if (clickCount >= 3) {
                clickCount = 0;
                clearTimeout(clickTimer);
                toggleDebugMode(!debugMode);
            }
        }
    });

    document.addEventListener('mouseup', () => {
        if (draggedLilly) {
            draggedLilly.isDragging = false;
            draggedLilly = null;
        }
    });
    
    /**
     * Draws a cute lily pad backdrop for a widget - OPTIMIZED (simplified rendering)
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {DOMRect} rect - Widget bounding rectangle
     * @param {Object} options - Drawing options (padScale, hasFlower, isWidgetPad)
     */
    function drawWidgetLilyPad(ctx, rect, options = {}) {
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const padRadius = Math.max(rect.width, rect.height) * (options.padScale || 0.6);

        // Simplified shadow - no blur (expensive operation)
        ctx.save();
        ctx.fillStyle = 'rgba(27, 94, 32, 0.2)';
        ctx.beginPath();
        ctx.arc(x + padRadius * 0.06, y + padRadius * 0.08, padRadius * 0.98, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Main pad - simpler gradient (fewer color stops)
        ctx.save();
        const gradient = ctx.createRadialGradient(
            x - padRadius * 0.2, y - padRadius * 0.2, padRadius * 0.1,
            x, y, padRadius
        );
        gradient.addColorStop(0, '#6ec947');  // Lighter center
        gradient.addColorStop(1, '#4a9d44');   // Darker edge
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, padRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Optional simple flower (reduced detail)
        if (options.hasFlower) {
            ctx.save();
            const flowerX = x + padRadius * 0.45;
            const flowerY = y + padRadius * 0.45;
            
            // Pink petals - reduced from 5 to 4
            ctx.fillStyle = '#e91e63';
            const petalClusterRadius = padRadius * 0.12;
            const petalRadius = petalClusterRadius * 1.0;
            for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI * 2;
                ctx.beginPath();
                ctx.arc(
                    flowerX + Math.cos(angle) * petalClusterRadius,
                    flowerY + Math.sin(angle) * petalClusterRadius,
                    petalRadius,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
            }
            // Yellow center
            ctx.fillStyle = '#ffeb39';
            ctx.beginPath();
            ctx.arc(flowerX, flowerY, padRadius * 0.1, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    let lastTime = 0;
    let frameCount = 0;
    function animate(timestamp) {
        const deltaTime = (timestamp - lastTime) / 1000 || 0;
        lastTime = timestamp;
        frameCount++;

        // Reset draw call counter
        drawCallCount = 0;

        // Clear and setup context
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Update game state (skip some updates on alternate frames for performance)
        const skipFrame = frameCount % 2 === 0;
        if (skipFrame && debugMode) {
            updatesSkipped++;
        }
        
        if (!skipFrame) {
            lillypads.forEach(lilly => lilly.update(deltaTime * 2, performanceMode ? [] : particles));
        }
        updateFoods(deltaTime);
        kois.forEach(koi => koi.update(canvas, kois, deltaTime, mouse, performanceMode ? [] : particles, feederFoods));
        
        // Update ripples (less frequently)
        if (!skipFrame) {
            ripples = ripples.filter(ripple => {
                ripple.update(deltaTime * 2);
                return !ripple.isFinished();
            });
        }
        
        // Update dragonflies less frequently
        if (!skipFrame && !performanceMode) {
            dragonflies = dragonflies.filter(dragonfly => {
                dragonfly.update(deltaTime * 2);
                return !dragonfly.isOffScreen(canvas.width, canvas.height);
            });
            
            // Spawn dragonflies more frequently (every 15-30 seconds)
            dragonflySpawnTimer += deltaTime * 2;
            if (dragonflySpawnTimer > 15 + Math.random() * 15) {
                dragonflySpawnTimer = 0;
                if (dragonflies.length < 4) { // Max 4 dragonflies at a time
                    dragonflies.push(new Dragonfly(canvas.width, canvas.height));
                }
            }
        }

        // LAYER 1 (Bottom): Draw ripples behind fish (skip some frames)
        if (!skipFrame) {
            ctx.globalCompositeOperation = 'source-over';
            ripples.forEach(ripple => {
                ripple.draw(ctx);
                if (debugMode) drawCallCount++;
            });
        }

        // LAYER 2: Draw particles with light blend
        if (!performanceMode) {
            ctx.globalCompositeOperation = 'lighter';
            particles = particles.filter(p => {
                p.update(deltaTime * 2);
                p.draw(ctx);
                if (debugMode) drawCallCount++;
                return p.life > 0;
            });
            ctx.globalCompositeOperation = 'source-over';
        } else {
            particles = []; // Clear particles in performance mode
        }

        // LAYER 3: Draw fish (always render for smooth movement)
        kois.forEach(koi => {
            koi.draw(ctx, performanceMode, timestamp);
            if (debugMode) drawCallCount++;
        });

        // LAYER 4: Draw dragonflies (ALWAYS - no frame skipping to prevent flashing)
        if (!performanceMode) {
            dragonflies.forEach(dragonfly => {
                dragonfly.draw(ctx);
                if (debugMode) drawCallCount++;
            });
        }

        // LAYER 5: Draw lily pads on top
        lillypads.forEach(lilly => {
            lilly.draw(ctx, flowerImage);
            if (debugMode) drawCallCount++;
        });

        // LAYER 6: Draw widget lily pad backdrops if style is lilypad (ALWAYS - no frame skipping to prevent flashing)
        if (userSettings.widgetStyle === 'lilypad') {
            const widgetElements = [
                { el: document.getElementById('clock-widget'), hasFlower: false },
                { el: document.getElementById('weather-widget'), hasFlower: true },
                { el: document.getElementById('quote-widget'), hasFlower: true },
                { el: document.getElementById('google-search-widget'), hasFlower: false }
            ];
            
            widgetElements.forEach(({ el, hasFlower }) => {
                if (el && el.style.display !== 'none' && el.style.visibility !== 'hidden') {
                    const rect = el.getBoundingClientRect();
                    drawWidgetLilyPad(ctx, rect, {
                        padScale: 0.65,
                        isWidgetPad: true,
                        hasFlower: hasFlower
                    });
                }
            });
        }

        // LAYER 7: Draw food pellets
        drawFoods(ctx);

        // LAYER 8: Debug rendering
        if (debugMode) {
            drawDebugInfo(ctx, deltaTime);
        }

        // Update debug stats
        updateDebugStats(deltaTime);

        requestAnimationFrame(animate);
    }

    /**
     * Draw debug visualizations on canvas
     */
    function drawDebugInfo(ctx, deltaTime) {
        // Draw navigation vectors for fish
        if (debugShowVectors) {
            ctx.save();
            kois.forEach(koi => {
                // Draw velocity vector (current movement direction)
                const vecLength = 50;
                const endX = koi.x + Math.cos(koi.angle) * vecLength;
                const endY = koi.y + Math.sin(koi.angle) * vecLength;
                
                ctx.strokeStyle = '#00ff00';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(koi.x, koi.y);
                ctx.lineTo(endX, endY);
                ctx.stroke();
                
                // Arrow head
                const arrowSize = 8;
                const arrowAngle = 0.5;
                ctx.beginPath();
                ctx.moveTo(endX, endY);
                ctx.lineTo(
                    endX - arrowSize * Math.cos(koi.angle - arrowAngle),
                    endY - arrowSize * Math.sin(koi.angle - arrowAngle)
                );
                ctx.moveTo(endX, endY);
                ctx.lineTo(
                    endX - arrowSize * Math.cos(koi.angle + arrowAngle),
                    endY - arrowSize * Math.sin(koi.angle + arrowAngle)
                );
                ctx.stroke();
                
                // Draw target angle vector (where fish wants to go)
                const targetEndX = koi.x + Math.cos(koi.targetAngle) * vecLength * 0.7;
                const targetEndY = koi.y + Math.sin(koi.targetAngle) * vecLength * 0.7;
                
                ctx.strokeStyle = '#ffff00';
                ctx.lineWidth = 1;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(koi.x, koi.y);
                ctx.lineTo(targetEndX, targetEndY);
                ctx.stroke();
                ctx.setLineDash([]);
            });
            ctx.restore();
        }

        // Draw hitboxes
        if (debugShowHitboxes) {
            ctx.save();
            ctx.strokeStyle = '#ff00ff';
            ctx.lineWidth = 1;
            
            // Fish hitboxes
            kois.forEach(koi => {
                ctx.beginPath();
                ctx.arc(koi.x, koi.y, koi.length / 2, 0, Math.PI * 2);
                ctx.stroke();
            });
            
            // Lily pad hitboxes
            lillypads.forEach(lilly => {
                ctx.beginPath();
                ctx.arc(lilly.x, lilly.y, lilly.radius, 0, Math.PI * 2);
                ctx.stroke();
            });
            
            // Food hitboxes
            feederFoods.forEach(food => {
                ctx.beginPath();
                ctx.arc(food.x, food.y, 8, 0, Math.PI * 2);
                ctx.stroke();
            });
            
            ctx.restore();
        }

        // Draw grid overlay
        if (debugShowGrid) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 1;
            
            // Vertical lines
            for (let x = 0; x < canvas.width; x += 50) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvas.height);
                ctx.stroke();
            }
            
            // Horizontal lines
            for (let y = 0; y < canvas.height; y += 50) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.width, y);
                ctx.stroke();
            }
            
            ctx.restore();
        }
    }

    /**
     * Update debug statistics display
     */
    function updateDebugStats(deltaTime) {
        if (!debugMode) return;
        
        // Calculate FPS
        const currentFrameTime = deltaTime * 1000; // Convert to ms
        fpsHistory.push(currentFrameTime);
        if (fpsHistory.length > 60) fpsHistory.shift(); // Keep last 60 frames
        
        const avgFrameTime = fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length;
        const fps = Math.round(1000 / avgFrameTime);
        
        // Track min/max FPS
        if (fps > 0 && fps < 1000) { // Sanity check
            minFPS = Math.min(minFPS, fps);
            maxFPS = Math.max(maxFPS, fps);
        }
        
        // Get memory usage if available
        let memoryText = 'N/A';
        if (performance.memory) {
            const usedMB = (performance.memory.usedJSHeapSize / 1048576).toFixed(1);
            const totalMB = (performance.memory.totalJSHeapSize / 1048576).toFixed(1);
            memoryText = `${usedMB} / ${totalMB} MB`;
        }
        
        // Update DOM elements
        const debugFps = document.getElementById('debug-fps');
        const debugFrameTime = document.getElementById('debug-frame-time');
        const debugMinFps = document.getElementById('debug-min-fps');
        const debugMaxFps = document.getElementById('debug-max-fps');
        const debugMemory = document.getElementById('debug-memory');
        const debugEntities = document.getElementById('debug-entities');
        const debugDrawCalls = document.getElementById('debug-draw-calls');
        const debugUpdatesSkipped = document.getElementById('debug-updates-skipped');
        const debugKoiCount = document.getElementById('debug-koi-count');
        const debugLilyCount = document.getElementById('debug-lily-count');
        const debugParticleCount = document.getElementById('debug-particle-count');
        const debugFoodCount = document.getElementById('debug-food-count');
        const debugDragonflyCount = document.getElementById('debug-dragonfly-count');
        const debugRippleCount = document.getElementById('debug-ripple-count');
        
        // Performance stats
        if (debugFps) debugFps.textContent = `FPS: ${fps}`;
        if (debugFrameTime) debugFrameTime.textContent = `Frame Time: ${avgFrameTime.toFixed(2)}ms`;
        if (debugMinFps) debugMinFps.textContent = `Min FPS: ${minFPS === Infinity ? '--' : minFPS}`;
        if (debugMaxFps) debugMaxFps.textContent = `Max FPS: ${maxFPS === 0 ? '--' : maxFPS}`;
        if (debugMemory) debugMemory.textContent = `Memory: ${memoryText}`;
        
        // Render stats
        const totalEntities = kois.length + lillypads.length + particles.length + feederFoods.length + dragonflies.length + ripples.length;
        if (debugEntities) debugEntities.textContent = `Total Entities: ${totalEntities}`;
        if (debugDrawCalls) debugDrawCalls.textContent = `Draw Calls/Frame: ${drawCallCount}`;
        if (debugUpdatesSkipped) debugUpdatesSkipped.textContent = `Updates Skipped: ${updatesSkipped}`;
        
        // Simulation stats
        if (debugKoiCount) debugKoiCount.textContent = `Koi: ${kois.length}`;
        if (debugLilyCount) debugLilyCount.textContent = `Lily Pads: ${lillypads.length}`;
        if (debugParticleCount) debugParticleCount.textContent = `Particles: ${particles.length}`;
        if (debugFoodCount) debugFoodCount.textContent = `Food Pellets: ${feederFoods.length}`;
        if (debugDragonflyCount) debugDragonflyCount.textContent = `Dragonflies: ${dragonflies.length}`;
        if (debugRippleCount) debugRippleCount.textContent = `Ripples: ${ripples.length}`;
    }
    
    // --- Widget Drag & Resize & Settings Logic ---

    /**
     * Initializes all widgets: dragging, resizing, toggles, and settings panels.
     */
    function initWidgetInteractions() {
        // 1. Widget Drag/Resize
        document.querySelectorAll('.widget').forEach(widget => {
            widget.addEventListener('mousedown', onWidgetMouseDown);
        });

        // 2. Control Panel Toggles
        document.querySelectorAll('.widget-toggle').forEach(toggle => {
            toggle.addEventListener('change', onWidgetToggleChange);
        });

        // 3. Control Panel Settings Buttons
        document.querySelectorAll('.settings-trigger').forEach(button => {
            button.addEventListener('click', onSettingsTriggerClick);
        });

        // 4. Settings Panel "Done" Buttons
        document.querySelectorAll('.settings-done-button').forEach(button => {
            button.addEventListener('click', onSettingsDoneClick);
        });

        // 5. Prevent settings panels from triggering a drag
        document.querySelectorAll('.controls-settings-panel').forEach(panel => {
            panel.addEventListener('mousedown', (e) => e.stopPropagation());
        });
    }

    /**
     * Handles 'mousedown' on a widget. Starts either dragging or resizing.
     */
    function onWidgetMouseDown(e) {
        const widget = e.currentTarget;

        // If the user clicked an interactive control inside the widget (input, textarea, select, button, link,
        // or the search form), don't start dragging/resizing — let the control handle the event.
        const interactiveSelector = 'input, textarea, select, button, a, label, .google-search-form, .settings-trigger';
        if (e.target.closest && e.target.closest(interactiveSelector)) {
            return; // allow normal interaction
        }

    // --- Check for invisible resize corner ---
    const rect = widget.getBoundingClientRect();
    const resizeHandleSize = 20; // Size of the invisible bottom-right corner
    // Prefer an explicit hit on the resize handle element if present (more reliable across styles)
    const clickedResizeHandle = e.target.closest && e.target.closest('.resize-handle');
    const isResizeClick = clickedResizeHandle || (e.clientX > rect.right - resizeHandleSize && 
                   e.clientY > rect.bottom - resizeHandleSize);
        
        e.preventDefault();
        draggedElement = widget; 
        gridOverlay.style.display = 'block';

        if (isResizeClick) {
            // --- Start RESIZING ---
            draggedElement.dataset.mode = 'resize'; 
            originalRect.width = rect.width;
            originalRect.height = rect.height;
            dragOffset.x = e.clientX - rect.width;
            dragOffset.y = e.clientY - rect.height;

        } else {
            // --- Start DRAGGING ---
            draggedElement.dataset.mode = 'drag'; 
            
            // Get the current rendered position BEFORE clearing transform
            // (rect already accounts for any transforms)
            const currentLeft = rect.left;
            const currentTop = rect.top;
            
            // Clear any transforms (translateX, rotate, etc.)
            widget.style.transform = 'none';
            
            // Set position to where it was visually rendered
            widget.style.left = `${currentLeft}px`;
            widget.style.top = `${currentTop}px`;
            
            // Now calculate offset for dragging from current mouse position
            dragOffset.x = e.clientX - currentLeft;
            dragOffset.y = e.clientY - currentTop;
        }
        
        widget.classList.add('dragging');
        document.addEventListener('mousemove', onDocumentMouseMove);
        document.addEventListener('mouseup', onDocumentMouseUp);
    }

    /**
     * Handles 'mousemove' for both dragging and resizing.
     */
    const snapToGrid = value => Math.round(value / GRID_SIZE) * GRID_SIZE;
    
    function onDocumentMouseMove(e) {
        if (!draggedElement) return;

        if (draggedElement.dataset.mode === 'resize') {
            const newWidth = e.clientX - dragOffset.x;
            const newHeight = e.clientY - dragOffset.y;
            const snappedWidth = Math.max(GRID_SIZE * 4, snapToGrid(newWidth));
            const snappedHeight = Math.max(GRID_SIZE * 2, snapToGrid(newHeight));

            draggedElement.style.width = `${snappedWidth}px`;
            draggedElement.style.height = `${snappedHeight}px`;
            draggedElement.style.setProperty('--widget-height-px', `${snappedHeight}px`);

        } else if (draggedElement.dataset.mode === 'drag') {
            const newLeft = e.clientX - dragOffset.x;
            const newTop = e.clientY - dragOffset.y;
            draggedElement.style.left = `${snapToGrid(newLeft)}px`;
            draggedElement.style.top = `${snapToGrid(newTop)}px`;
        }
    }

    /**
     * Handles 'mouseup' to end dragging or resizing.
     */
    function onDocumentMouseUp() {
        if (!draggedElement) return;

        gridOverlay.style.display = 'none';
        draggedElement.classList.remove('dragging');

        // Save the new state
        if (draggedElement.dataset.mode === 'resize') {
            userSettings.widgetSizes[draggedElement.id] = {
                width: draggedElement.style.width,
                height: draggedElement.style.height
            };
            saveSettings({ widgetSizes: userSettings.widgetSizes });

        } else if (draggedElement.dataset.mode === 'drag') {
            // Save both pixel and percentage positions so we can reposition across monitors
            const id = draggedElement.id;
            const leftPx = parseFloat(draggedElement.style.left) || 0;
            const topPx = parseFloat(draggedElement.style.top) || 0;
            const leftPct = window.innerWidth > 0 ? leftPx / window.innerWidth : 0;
            const topPct = window.innerHeight > 0 ? topPx / window.innerHeight : 0;

            userSettings.widgetPositions[id] = {
                top: `${topPx}px`,
                left: `${leftPx}px`,
                leftPct: leftPct,
                topPct: topPct
            };
            saveSettings({ widgetPositions: userSettings.widgetPositions });
        }

        draggedElement.dataset.mode = '';
        draggedElement = null;
        document.removeEventListener('mousemove', onDocumentMouseMove);
        document.removeEventListener('mouseup', onDocumentMouseUp);
    }

    /**
     * Handles 'change' on the main control toggles.
     */
    function onWidgetToggleChange(e) {
        const toggle = e.currentTarget;
        const widgetId = toggle.dataset.widgetId;
        const widget = document.getElementById(widgetId);
        const isVisible = toggle.checked;

        if (widget) {
            widget.style.display = isVisible ? 'block' : 'none';
            userSettings.widgetVisibility[widgetId] = isVisible;
            saveSettings({ widgetVisibility: userSettings.widgetVisibility });
        }
    }

    /**
     * Handles clicks on "Settings" buttons in the controls.
     */
    function onSettingsTriggerClick(e) {
        const panelId = e.currentTarget.dataset.panelId;
        const clickedPanel = document.getElementById(panelId);
        
        // Close all other panels first
        document.querySelectorAll('.controls-settings-panel').forEach(panel => {
            if (panel.id !== panelId) {
                panel.style.display = 'none';
            }
        });

        // Toggle the clicked panel
        if (clickedPanel) {
            clickedPanel.style.display = clickedPanel.style.display === 'block' ? 'none' : 'block';
        }
    }

    /**
     * Handles clicks on "Done" buttons in the settings panels.
     */
    function onSettingsDoneClick(e) {
        const panelId = e.currentTarget.dataset.panelId;
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.style.display = 'none';
        }
    }


    // --- Initialization ---
    
    /**
     * Sets up the simulation with saved counts and starts the animation.
     * OPTIMIZED: Reduced default counts and frame-skipping implemented for better performance
     */
    function initializeSimulation(koi, lilly) {
        document.getElementById('koiSlider').value = koi;
        document.getElementById('koiCount').textContent = koi;
        document.getElementById('lillySlider').value = lilly;
        document.getElementById('lillyCount').textContent = lilly;
        
        updateKoisSize(koi);
        updateLillypadsSize(lilly);
        
        animate(0); 

    // Init widgets with their saved settings
    initClock(); // Clock has no settings
    initQuote(userSettings.quoteSettings, saveSettings);
    initWeather(userSettings.weatherSettings, saveSettings);
    initFeeder();

    // Set up feeder bag hover visibility
    const feederBag = document.getElementById('feeder-bag');
    if (feederBag) {
        feederBag.addEventListener('mouseenter', () => {
            isMouseOverFeeder = true;
            updateFeederVisibility();
        });
        feederBag.addEventListener('mouseleave', () => {
            isMouseOverFeeder = false;
            updateFeederVisibility();
        });
    }

    // Initialize time-based theming with user settings (no season)
    initTimeTheme(userSettings);

    // Set up all user interactions
    initWidgetInteractions();

    // Apply widget style from settings
    const currentStyle = userSettings.widgetStyle || defaultSettings.widgetStyle;
    applyWidgetStyle(currentStyle);
    
    // Set the checked state for the widget style radio buttons
    const styleRadios = document.querySelectorAll('input[name="widgetStyle"]');
    styleRadios.forEach(radio => {
        if (radio.value === currentStyle) {
            radio.checked = true;
        }
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                const style = e.target.value;
                userSettings.widgetStyle = style;
                saveSettings({ widgetStyle: style });
                applyWidgetStyle(style);
            }
        });
    });

    // Google Search widget: wire up form submit to open Google results in a new tab
    const searchForm = document.getElementById('google-search-form');
    const searchInput = document.getElementById('google-search-input');
    if (searchForm && searchInput) {
        searchForm.addEventListener('submit', (ev) => {
            ev.preventDefault();
            const q = searchInput.value.trim();
            if (!q) return;
            const url = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
            // Open results in the same tab (user requested behavior)
            window.location.href = url;
        });
        // Prevent mousedown on the input or button from bubbling up to the widget drag handler
        searchInput.addEventListener('mousedown', (ev) => ev.stopPropagation());
        searchInput.addEventListener('click', (ev) => ev.stopPropagation());
        // No submit button present (search opens on Enter), only block mousedown on the input
    }
    }

    /**
     * Loads ALL settings from storage, then starts the simulation.
     */
    function loadAllSettingsAndStart() {
        let initialKoiCount = parseInt(document.getElementById('koiSlider').value) || 6;
        let initialLillyCount = parseInt(document.getElementById('lillySlider').value) || 8;

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.get(['koiCount', 'lillyCount', 'userSettings'], (result) => {
                initialKoiCount = result.koiCount !== undefined ? result.koiCount : initialKoiCount;
                initialLillyCount = result.lillyCount !== undefined ? result.lillyCount : initialLillyCount;

                userSettings = mergeSettings(result.userSettings, defaultSettings);

                // Cache settings to localStorage for instant next load
                try {
                    const cacheData = {
                        manualTimeOfDay: userSettings.manualTimeOfDay,
                        customWaterColor: userSettings.customWaterColor,
                        widgetPositions: userSettings.widgetPositions,
                        widgetSizes: userSettings.widgetSizes,
                        widgetVisibility: userSettings.widgetVisibility
                    };
                    localStorage.setItem('koiPondCachedSettings', JSON.stringify(cacheData));
                } catch (e) {
                    console.warn('Failed to cache settings:', e);
                }

                applyAllSettings();
                initializeSimulation(initialKoiCount, initialLillyCount);
            });
        } else {
            userSettings = defaultSettings;
            applyAllSettings();
            initializeSimulation(initialKoiCount, initialLillyCount);
        }
    }

    /**
     * Applies all loaded settings to the DOM elements.
     */
    function applyAllSettings() {
        document.querySelectorAll('.widget').forEach(widget => {
            const id = widget.id;

            // 1. Apply Position
            const pos = userSettings.widgetPositions[id];
            if (pos) {
                // If percentage values are stored, compute pixel positions using current window size and snap to grid
                if (pos.leftPct !== undefined && pos.topPct !== undefined) {
                    const leftPx = Math.round((pos.leftPct || 0) * window.innerWidth / GRID_SIZE) * GRID_SIZE;
                    const topPx = Math.round((pos.topPct || 0) * window.innerHeight / GRID_SIZE) * GRID_SIZE;
                    widget.style.left = `${leftPx}px`;
                    widget.style.top = `${topPx}px`;
                    widget.style.transform = 'none';
                } else if (pos.top && pos.left) {
                    widget.style.top = pos.top;
                    widget.style.left = pos.left;
                    widget.style.transform = 'none';
                }
            }

            // 2. Apply Size
            const size = userSettings.widgetSizes[id];
            if (size && size.width && size.height) {
                widget.style.width = size.width;
                widget.style.height = size.height;
                // Apply height to CSS var for font scaling
                widget.style.setProperty('--widget-height-px', `${parseFloat(size.height)}px`);
            } else {
                // Apply default if not set
                const defaultSize = defaultSettings.widgetSizes[id];
                 if (defaultSize) {
                    widget.style.setProperty('--widget-height-px', `${parseFloat(defaultSize.height)}px`);
                 }
            }

            // 3. Apply Visibility
            const isVisible = userSettings.widgetVisibility[id];
            const toggle = document.querySelector(`.widget-toggle[data-widget-id="${id}"]`);
            
            if (isVisible) {
                widget.style.display = 'block';
                if (toggle) toggle.checked = true;
            } else {
                widget.style.display = 'none';
                if (toggle) toggle.checked = false;
            }
        });
        // Apply style (in case settings were loaded)
        applyWidgetStyle(userSettings.widgetStyle || defaultSettings.widgetStyle);
        
        // Apply performance mode
        performanceMode = userSettings.performanceMode || false;
        document.getElementById('performanceModeToggle').checked = performanceMode;
        
        // Apply debug mode (from saved settings, but user can toggle with triple-click)
        debugMode = userSettings.debugMode || false;
        if (debugMode) {
            document.getElementById('debug-overlay').classList.add('active');
        }
        
        // Apply custom background
        if (userSettings.customBackground) {
            applyCustomBackground(userSettings.customBackground);
        }
        
        // Apply customize panel settings
        const timeOfDayValue = userSettings.manualTimeOfDay || 'auto';
        const waterColor = userSettings.customWaterColor;
        
        // Set time of day radio button
        const timeRadioId = timeOfDayValue === 'auto' ? 'timeAuto' : 
                           timeOfDayValue === 'dawn' ? 'timeDawn' :
                           timeOfDayValue === 'day' ? 'timeDay' :
                           timeOfDayValue === 'dusk' ? 'timeDusk' : 'timeNight';
        const timeRadio = document.getElementById(timeRadioId);
        if (timeRadio) timeRadio.checked = true;
        
        // Set water color picker
        const colorPicker = document.getElementById('waterColorPicker');
        if (colorPicker && waterColor) {
            colorPicker.value = waterColor;
        }
        
        // Apply theme with saved settings
        applyTimeTheme(
            timeOfDayValue === 'auto' ? null : timeOfDayValue,
            waterColor
        );
    }

    // Close settings panels when clicking outside
    document.addEventListener('click', (e) => {
        // If click is not inside a settings panel, settings trigger, or customize button
        if (!e.target.closest('.controls-settings-panel') && 
            !e.target.closest('.settings-trigger') &&
            !e.target.closest('#customizeButton')) {
            document.querySelectorAll('.controls-settings-panel').forEach(panel => {
                panel.style.display = 'none';
            });
        }
    });

    // --- LOADING SEQUENCE ---
    
    /**
     * Professional loading sequence:
     * 1. Black overlay covers everything initially
     * 2. Wait for background image to load
     * 3. Fade in background
     * 4. Initialize JS and prepare widgets
     * 5. Fade in widgets with stagger
     * 6. Remove loading overlay
     */
    async function professionalLoadSequence() {
        const loadingOverlay = document.getElementById('loading-overlay');
        const bgImage = document.querySelector('.bg-image');
        
        // Step 1: Preload the background image
        await new Promise((resolve) => {
            const bgUrl = getComputedStyle(document.documentElement)
                .getPropertyValue('--bg-img')
                .replace(/url\(['"]?([^'"]+)['"]?\)/, '$1');
            
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => resolve(); // Continue even if image fails
            img.src = bgUrl;
            
            // Timeout fallback after 1 second
            setTimeout(resolve, 1000);
        });
        
        // Step 2: Fade in background
        bgImage.classList.add('loaded');
        
        // Step 3: Initialize the simulation (but widgets stay hidden)
        loadFlowerImage(loadAllSettingsAndStart);
        
        // Step 4: Wait a moment for JS to settle, then reveal widgets with stagger
        await new Promise(resolve => setTimeout(resolve));
        
        const widgets = document.querySelectorAll('.widget');
        widgets.forEach((widget, index) => {
            setTimeout(() => {
                widget.classList.add('ready');
            }, index); 
        });
        
        // Also reveal controls and feeder bag
        const controls = document.querySelector('.controls');
        const feederBag = document.getElementById('feeder-bag');
        if (controls) {
            setTimeout(() => controls.classList.add('ready'), widgets.length * 100);
        }
        if (feederBag) {
            setTimeout(() => feederBag.classList.add('ready'), widgets.length * 100 + 50);
        }
        
        // Step 5: Fade out loading overlay
        await new Promise(resolve => setTimeout(resolve, 50));
        loadingOverlay.classList.add('fade-out');
        
        // Step 6: Remove overlay from DOM after fade completes
        setTimeout(() => {
            loadingOverlay.remove();
        },);
    }
    
    // --- STARTING POINT ---
    professionalLoadSequence();
});