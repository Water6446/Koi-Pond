import { config } from './config.js';
import { KoiFish } from './KoiFish.js';
import { LillyPad } from './LillyPad.js';
import { initClock } from './Clock.js';
import { initQuote } from './Quote.js';
import { initWeather } from './Weather.js';
import { initFeeder, foods as feederFoods, updateFoods, drawFoods } from './Feeder.js';
import { Ripple } from './Ripple.js';
import { Dragonfly } from './Dragonfly.js';
import { initTimeTheme, applyTimeTheme, getCurrentHourDecimal } from './TimeTheme.js';
import {
    initWidgetManager,
    applyWidgetStyle,
    repositionWidgetsFromPercent,
    initWidgetInteractions,
    applyAllWidgetSettings,
    setupWidgetStyleControls,
    setupGoogleSearchWidget,
    setupSettingsPanelClickOutside,
    drawWidgetLilyPad
} from './WidgetManager.js';

const GRID_SIZE = 40;
let autoTimeUpdateInterval = null; // Track the auto-update interval 
let flowerImage = null;
let kois = [];
let particles = [];
let lillypads = [];
let ripples = [];
let dragonflies = [];
let mouse = { x: -1000, y: -1000 };
let draggedLilly = null;
let gridOverlay = null;
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
    widgetStyle: 'glass',
    fishSpeed: 1.0,
    performanceMode: false,
    debugMode: false,
    customBackground: null,
    customWaterColor: null,
    manualHour: 12,
    autoFollowTime: false // Track if time should auto-update
};

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

// Debounce timer for settings saves
let saveSettingsTimer = null;

/**
 * Saves the specified settings object to chrome.storage.
 * This merges the new settings with the existing ones.
 * Uses debouncing to prevent excessive writes.
 */
function saveSettings(newSettings) {
    // Merge new settings into the current state
    userSettings = mergeSettings(newSettings, userSettings);
    
    // Cache critical settings to localStorage for instant loading
    try {
        const cacheData = {
            manualHour: userSettings.manualHour,
            customWaterColor: userSettings.customWaterColor,
            widgetPositions: userSettings.widgetPositions,
            widgetSizes: userSettings.widgetSizes,
            widgetVisibility: userSettings.widgetVisibility
        };
        localStorage.setItem('koiPondCachedSettings', JSON.stringify(cacheData));
    } catch (e) {
        console.warn('Failed to cache settings to localStorage:', e);
    }
    
    // Debounce: only save after 500ms of no new changes
    if (saveSettingsTimer) {
        clearTimeout(saveSettingsTimer);
    }
    
    saveSettingsTimer = setTimeout(() => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ userSettings: userSettings });
        } else {
            console.warn("Storage API not available. Settings not saved.");
        }
    }, 500);
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
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ koiCount: count });
        }
    });
    
    document.getElementById('lillySlider').addEventListener('input', (e) => {
        const count = parseInt(e.target.value);
        document.getElementById('lillyCount').textContent = count;
        updateLillypadsSize(count);
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ lillyCount: count });
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

    // Helper function to format hour decimal as HH:MM
    function formatTimeFromHour(hourDecimal) {
        const hours = Math.floor(hourDecimal);
        const minutes = Math.round((hourDecimal - hours) * 60); // Use Math.round to handle floating point precision
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
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

        // Time Slider (always visible) - with arc-based sun movement
        const timeSlider = document.getElementById('timeSlider');
        const timeDisplay = document.getElementById('timeDisplay');
        const syncButton = document.getElementById('syncToCurrentTime');
        const timeArcPath = document.getElementById('timeArcPath');

        // Draw the arc path that the sun follows
        function drawTimeArc() {
            if (!timeArcPath || !timeSlider) return;
            
            // Use SVG viewBox coordinates (0-400 width, 0-100 height)
            const viewBoxWidth = 400;
            const viewBoxHeight = 100;
            const padding = 20; // Horizontal padding
            const width = viewBoxWidth - padding * 2;
            
            // Build SVG path following a semi-circular arc (like a rainbow)
            let pathData = '';
            const numPoints = 100;
            const arcHeight = 35; // Height of the arc in viewBox units
            const arcBottom = 75; // Y position of arc bottom
            
            for (let i = 0; i <= numPoints; i++) {
                const progress = i / numPoints; // 0 to 1
                const x = padding + progress * width;
                
                // Semi-circular arc: use only 0 to π (top half of sine wave)
                // At progress 0 (midnight): arc is at bottom (y = arcBottom)
                // At progress 0.5 (noon): arc is at top (y = arcBottom - arcHeight)
                // At progress 1 (midnight): arc is at bottom again (y = arcBottom)
                const arcProgress = progress * Math.PI; // 0 to π (only top half)
                const y = arcBottom - Math.sin(arcProgress) * arcHeight;
                
                if (i === 0) {
                    pathData = `M ${x} ${y}`;
                } else {
                    pathData += ` L ${x} ${y}`;
                }
            }
            
            timeArcPath.setAttribute('d', pathData);
            
            // Also apply to border
            const timeArcBorder = document.getElementById('timeArcBorder');
            if (timeArcBorder) {
                timeArcBorder.setAttribute('d', pathData);
            }
        }

        // Position sun thumb along arc path based on slider value
        // Make it a window function so it's accessible from applyAllSettings
        window.updateSunPosition = function() {
            if (!timeSlider) return;
            
            const hour = parseFloat(timeSlider.value);
            const progress = hour / 24; // 0 to 1
            
            // Calculate Y offset to create semi-circular arc effect
            // At midnight (0 or 24): sun is at bottom (offset = 0)
            // At noon (12): sun is at top (offset = -35px)
            const arcProgress = progress * Math.PI; // 0 to π (only top half)
            const arcHeight = 35; // Match drawTimeArc (in pixels for CSS)
            const verticalOffset = -Math.sin(arcProgress) * arcHeight;
            
            // Apply vertical offset via CSS custom property
            timeSlider.style.setProperty('--sun-y-offset', `${verticalOffset}px`);
        };

        // Initialize arc on load and on window resize
        if (timeArcPath) {
            drawTimeArc();
            window.addEventListener('resize', drawTimeArc);
        }

        if (timeSlider && timeDisplay) {
            // Update display, background, and sun position as slider moves
            timeSlider.addEventListener('input', (e) => {
                const hour = parseFloat(e.target.value);
                timeDisplay.textContent = formatTimeFromHour(hour);
                window.updateSunPosition();
                
                // Always update background in real-time
                applyTimeTheme(null, userSettings.customWaterColor, hour);
            });

            // When slider is released, disable auto-follow and save manual time
            timeSlider.addEventListener('change', (e) => {
                const hour = parseFloat(e.target.value);
                
                // Stop auto-following time
                if (autoTimeUpdateInterval) {
                    clearInterval(autoTimeUpdateInterval);
                    autoTimeUpdateInterval = null;
                }
                
                userSettings.manualHour = hour;
                userSettings.autoFollowTime = false;
                saveSettings({ manualHour: hour, autoFollowTime: false });
            });
            
            // Initialize sun position
            window.updateSunPosition();
        }

        // Sync to current system time button - enables auto-follow mode
        if (syncButton && timeSlider) {
            syncButton.addEventListener('click', () => {
                // Enable auto-follow mode
                userSettings.autoFollowTime = true;
                saveSettings({ autoFollowTime: true });
                
                // Update immediately
                updateToCurrentTime();
                
                // Start auto-update interval (update every second for smooth transitions)
                if (autoTimeUpdateInterval) {
                    clearInterval(autoTimeUpdateInterval);
                }
                autoTimeUpdateInterval = setInterval(() => {
                    if (userSettings.autoFollowTime) {
                        updateToCurrentTime();
                    }
                }, 1000); // Update every second
                
                // Visual feedback
                syncButton.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    syncButton.style.transform = '';
                }, 150);
            });
        }
        
        // Helper function to update to current system time
        function updateToCurrentTime() {
            const currentHour = getCurrentHourDecimal();
            
            timeSlider.value = currentHour;
            timeDisplay.textContent = formatTimeFromHour(currentHour);
            window.updateSunPosition();
            
            // Update background
            applyTimeTheme(null, userSettings.customWaterColor, currentHour);
            
            // Save current hour
            userSettings.manualHour = currentHour;
        }
        
        // Make time display clickable for manual time input
        if (timeDisplay && timeSlider) {
            timeDisplay.addEventListener('click', () => {
                // Prevent multiple inputs from being created
                if (timeDisplay.querySelector('input')) {
                    return;
                }
                
                // Create input element
                const input = document.createElement('input');
                input.type = 'text';
                input.value = timeDisplay.textContent;
                input.style.cssText = 'background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 215, 0, 0.4); color: rgba(255, 255, 255, 0.95); font-size: 20px; font-weight: 600; letter-spacing: 1.5px; font-family: "Courier New", monospace; padding: 6px 12px; border-radius: 6px; width: 100px; text-align: center; outline: none;';
                
                // Replace display with input
                const originalText = timeDisplay.textContent;
                timeDisplay.textContent = '';
                timeDisplay.appendChild(input);
                input.focus();
                input.select();
                
                // Function to parse time input (supports formats like "14:30", "2:30 PM", "14.5")
                const parseTimeInput = (str) => {
                    str = str.trim().toUpperCase();
                    
                    // Check for AM/PM format (e.g., "2:30 PM")
                    const ampmMatch = str.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)/);
                    if (ampmMatch) {
                        let hours = parseInt(ampmMatch[1]);
                        const minutes = parseInt(ampmMatch[2] || '0');
                        const period = ampmMatch[3];
                        
                        if (period === 'PM' && hours !== 12) hours += 12;
                        if (period === 'AM' && hours === 12) hours = 0;
                        
                        return hours + minutes / 60;
                    }
                    
                    // Check for 24-hour format (e.g., "14:30")
                    const colonMatch = str.match(/(\d{1,2}):(\d{2})/);
                    if (colonMatch) {
                        const hours = parseInt(colonMatch[1]);
                        const minutes = parseInt(colonMatch[2]);
                        return hours + minutes / 60;
                    }
                    
                    // Check for decimal format (e.g., "14.5")
                    const decimal = parseFloat(str);
                    if (!isNaN(decimal)) {
                        return decimal;
                    }
                    
                    return null;
                };
                
                // Function to apply the new time
                const applyTime = () => {
                    const newHour = parseTimeInput(input.value);
                    
                    if (newHour !== null && newHour >= 0 && newHour <= 24) {
                        // Stop auto-follow mode
                        if (autoTimeUpdateInterval) {
                            clearInterval(autoTimeUpdateInterval);
                            autoTimeUpdateInterval = null;
                        }
                        
                        // Update slider and display
                        timeSlider.value = newHour;
                        timeDisplay.textContent = formatTimeFromHour(newHour);
                        window.updateSunPosition();
                        
                        // Update background
                        applyTimeTheme(null, userSettings.customWaterColor, newHour);
                        
                        // Save settings
                        userSettings.manualHour = newHour;
                        userSettings.autoFollowTime = false;
                        saveSettings({ manualHour: newHour, autoFollowTime: false });
                    } else {
                        // Invalid input - restore original
                        timeDisplay.textContent = originalText;
                    }
                    
                    // Remove input if it still exists
                    if (input.parentNode === timeDisplay) {
                        timeDisplay.removeChild(input);
                    }
                };
                
                // Handle Enter key
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        applyTime();
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        timeDisplay.textContent = originalText;
                        if (input.parentNode === timeDisplay) {
                            timeDisplay.removeChild(input);
                        }
                    }
                });
                
                // Handle blur (clicking away)
                input.addEventListener('blur', () => {
                    setTimeout(() => {
                        applyTime();
                    }, 100);
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

    let lastTime = 0;
    let frameCount = 0;
    let animationId = null;
    
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

        animationId = requestAnimationFrame(animate);
    }
    
    // Handle page visibility changes to maintain smooth animation
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // Page is hidden, cancel animation
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
        } else {
            // Page is visible again, reset timing and restart
            lastTime = performance.now();
            frameCount = 0;
            animationId = requestAnimationFrame(animate);
        }
    });

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

    // Initialize time-based theming with user settings
    initTimeTheme(userSettings);
    
    // If auto-follow mode was enabled, start the update interval
    if (userSettings.autoFollowTime) {
        const timeSlider = document.getElementById('timeSlider');
        const timeDisplay = document.getElementById('timeDisplay');
        
        if (timeSlider && timeDisplay) {
            // Update immediately
            const updateToCurrentTime = () => {
                const currentHour = getCurrentHourDecimal();
                timeSlider.value = currentHour;
                timeDisplay.textContent = formatTimeFromHour(currentHour);
                if (typeof window.updateSunPosition === 'function') {
                    window.updateSunPosition();
                }
                applyTimeTheme(null, userSettings.customWaterColor, currentHour);
                userSettings.manualHour = currentHour;
            };
            
            updateToCurrentTime();
            
            // Start interval
            if (autoTimeUpdateInterval) {
                clearInterval(autoTimeUpdateInterval);
            }
            autoTimeUpdateInterval = setInterval(() => {
                if (userSettings.autoFollowTime) {
                    updateToCurrentTime();
                }
            }, 1000);
        }
    }

    // Set up all user interactions
    initWidgetInteractions();

    // Apply widget style from settings and set up controls
    setupWidgetStyleControls(defaultSettings);

    // Google Search widget setup
    setupGoogleSearchWidget();
    }

    /**
     * Loads ALL settings from storage, then starts the simulation.
     */
    function loadAllSettingsAndStart() {
        let initialKoiCount = parseInt(document.getElementById('koiSlider').value) || 6;
        let initialLillyCount = parseInt(document.getElementById('lillySlider').value) || 8;

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['koiCount', 'lillyCount', 'userSettings'], (result) => {
                initialKoiCount = result.koiCount !== undefined ? result.koiCount : initialKoiCount;
                initialLillyCount = result.lillyCount !== undefined ? result.lillyCount : initialLillyCount;

                userSettings = mergeSettings(result.userSettings, defaultSettings);

                // Cache settings to localStorage for instant next load
                try {
                    const cacheData = {
                        manualHour: userSettings.manualHour,
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
        // Initialize the widget manager first with settings
        initWidgetManager(userSettings, saveSettings, gridOverlay);
        
        // Apply widget settings using the widget manager
        applyAllWidgetSettings(defaultSettings);
        
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
        const manualHour = userSettings.manualHour || 12;
        const waterColor = userSettings.customWaterColor;
        
        // Set slider value and display (slider is always visible now)
        const timeSlider = document.getElementById('timeSlider');
        const timeDisplay = document.getElementById('timeDisplay');
        if (timeSlider && timeDisplay) {
            timeSlider.value = manualHour;
            timeDisplay.textContent = formatTimeFromHour(manualHour);
            // Update sun position on load
            if (typeof window.updateSunPosition === 'function') {
                window.updateSunPosition();
            }
        }
        
        // Set water color picker
        const colorPicker = document.getElementById('waterColorPicker');
        if (colorPicker && waterColor) {
            colorPicker.value = waterColor;
        }
        
        // Apply theme with saved slider position
        applyTimeTheme(null, waterColor, manualHour);
    }

    // Helper function to format hour decimal as HH:MM (defined earlier, but ensure it's accessible)
    function formatTimeFromHour(hourDecimal) {
        // Wrap hour to 0-23.999 range to prevent 24:00 display
        let wrappedHour = hourDecimal;
        while (wrappedHour >= 24) wrappedHour -= 24;
        while (wrappedHour < 0) wrappedHour += 24;
        
        const hours = Math.floor(wrappedHour);
        const minutes = Math.round((wrappedHour - hours) * 60); // Use Math.round to handle floating point precision
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    // Close settings panels when clicking outside (using WidgetManager)
    setupSettingsPanelClickOutside();

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