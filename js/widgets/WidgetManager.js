// --- js/WidgetManager.js ---
// Manages all widget-related functionality: drag, resize, positioning, styling, and interactions

const GRID_SIZE = 40;
let draggedElement = null;
let dragOffset = { x: 0, y: 0 };
let originalRect = { width: 0, height: 0 };
let gridOverlay = null;

// References to user settings (will be set externally)
let userSettings = {};
let saveSettingsCallback = null;

/**
 * Initialize the widget manager with settings and callbacks
 * @param {Object} settings - The user settings object
 * @param {Function} saveCallback - Callback function to save settings
 * @param {HTMLElement} overlay - The grid overlay element
 */
export function initWidgetManager(settings, saveCallback, overlay) {
    userSettings = settings;
    saveSettingsCallback = saveCallback;
    gridOverlay = overlay;
}

/**
 * Apply a widget style variant to all widgets
 * @param {string} style - Style name ('lilypad', 'glass', 'leaf', 'none')
 */
export function applyWidgetStyle(style) {
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
 * Reposition widgets based on stored percentage coordinates so they stay in relative place
 * when screen size or monitor changes. Snaps to grid.
 */
export function repositionWidgetsFromPercent() {
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

/**
 * Initializes all widgets: dragging, resizing, toggles, and settings panels
 */
export function initWidgetInteractions() {
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
 * Handles 'mousedown' on a widget. Starts either dragging or resizing
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
    if (gridOverlay) {
        gridOverlay.style.display = 'block';
    }

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
 * Handles 'mousemove' for both dragging and resizing
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
 * Handles 'mouseup' to end dragging or resizing
 */
function onDocumentMouseUp() {
    if (!draggedElement) return;

    if (gridOverlay) {
        gridOverlay.style.display = 'none';
    }
    draggedElement.classList.remove('dragging');

    // Save the new state
    if (draggedElement.dataset.mode === 'resize') {
        userSettings.widgetSizes[draggedElement.id] = {
            width: draggedElement.style.width,
            height: draggedElement.style.height
        };
        if (saveSettingsCallback) {
            saveSettingsCallback({ widgetSizes: userSettings.widgetSizes });
        }

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
        if (saveSettingsCallback) {
            saveSettingsCallback({ widgetPositions: userSettings.widgetPositions });
        }
    }

    draggedElement.dataset.mode = '';
    draggedElement = null;
    document.removeEventListener('mousemove', onDocumentMouseMove);
    document.removeEventListener('mouseup', onDocumentMouseUp);
}

/**
 * Handles 'change' on the main control toggles
 */
function onWidgetToggleChange(e) {
    const toggle = e.currentTarget;
    const widgetId = toggle.dataset.widgetId;
    const widget = document.getElementById(widgetId);
    const isVisible = toggle.checked;

    if (widget) {
        widget.style.display = isVisible ? 'block' : 'none';
        userSettings.widgetVisibility[widgetId] = isVisible;
        if (saveSettingsCallback) {
            saveSettingsCallback({ widgetVisibility: userSettings.widgetVisibility });
        }
    }
}

/**
 * Handles clicks on "Settings" buttons in the controls
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
 * Handles clicks on "Done" buttons in the settings panels
 */
function onSettingsDoneClick(e) {
    const panelId = e.currentTarget.dataset.panelId;
    const panel = document.getElementById(panelId);
    if (panel) {
        panel.style.display = 'none';
    }
}

/**
 * Applies all loaded settings to the DOM elements
 * @param {Object} defaultSettings - The default settings object
 */
export function applyAllWidgetSettings(defaultSettings) {
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

        // 2. Apply Size - SNAP TO GRID
        const size = userSettings.widgetSizes[id];
        if (size && size.width && size.height) {
            // Parse the size values and snap to grid
            const widthPx = parseFloat(size.width);
            const heightPx = parseFloat(size.height);
            const snappedWidth = Math.round(widthPx / GRID_SIZE) * GRID_SIZE;
            const snappedHeight = Math.round(heightPx / GRID_SIZE) * GRID_SIZE;
            
            widget.style.width = `${snappedWidth}px`;
            widget.style.height = `${snappedHeight}px`;
            // Apply height to CSS var for font scaling
            widget.style.setProperty('--widget-height-px', `${snappedHeight}px`);
        } else {
            // Apply default size and snap to grid
            const defaultSize = defaultSettings.widgetSizes[id];
            if (defaultSize) {
                const widthPx = parseFloat(defaultSize.width);
                const heightPx = parseFloat(defaultSize.height);
                const snappedWidth = Math.round(widthPx / GRID_SIZE) * GRID_SIZE;
                const snappedHeight = Math.round(heightPx / GRID_SIZE) * GRID_SIZE;
                
                widget.style.width = `${snappedWidth}px`;
                widget.style.height = `${snappedHeight}px`;
                widget.style.setProperty('--widget-height-px', `${snappedHeight}px`);
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
}

/**
 * Setup widget style radio buttons
 * @param {Object} defaultSettings - The default settings object
 */
export function setupWidgetStyleControls(defaultSettings) {
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
                if (saveSettingsCallback) {
                    saveSettingsCallback({ widgetStyle: style });
                }
                applyWidgetStyle(style);
            }
        });
    });
}

/**
 * Setup Search widget functionality using Chrome Search API
 * Respects user's default search engine settings
 */
export function setupGoogleSearchWidget() {
    const searchForm = document.getElementById('google-search-form');
    const searchInput = document.getElementById('google-search-input');
    if (searchForm && searchInput) {
        searchForm.addEventListener('submit', (ev) => {
            ev.preventDefault();
            const query = searchInput.value.trim();
            if (!query) return;
            
            // Use Chrome Search API - respects user's default search engine
            if (typeof chrome !== 'undefined' && chrome.search && chrome.search.query) {
                chrome.search.query({
                    text: query,
                    disposition: 'NEW_TAB' // Opens in new tab, keeping pond visible
                }, () => {
                    // Clear input after search
                    searchInput.value = '';
                });
            } else {
                // Fallback for testing outside Chrome extension context
                console.warn('Chrome Search API not available');
            }
        });
        // Prevent mousedown on the input or button from bubbling up to the widget drag handler
        searchInput.addEventListener('mousedown', (ev) => ev.stopPropagation());
        searchInput.addEventListener('click', (ev) => ev.stopPropagation());
    }
}

/**
 * Setup click-outside listener to close settings panels
 */
export function setupSettingsPanelClickOutside() {
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
}

/**
 * Draws a cute lily pad backdrop for a widget - OPTIMIZED (simplified rendering)
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {DOMRect} rect - Widget bounding rectangle
 * @param {Object} options - Drawing options (padScale, hasFlower, isWidgetPad)
 */
export function drawWidgetLilyPad(ctx, rect, options = {}) {
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
