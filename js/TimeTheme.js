// --- js/TimeTheme.js ---

/**
 * Gets the current time of day
 */
export function getTimeOfDay() {
    const hour = new Date().getHours();
    
    if (hour >= 5 && hour < 8) return 'dawn';
    if (hour >= 8 && hour < 17) return 'day';
    if (hour >= 17 && hour < 20) return 'dusk';
    return 'night';
}

/**
 * Linear interpolation between two values
 */
function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * Interpolate between two hex colors
 */
function lerpColor(color1, color2, t) {
    // Parse hex colors
    const r1 = parseInt(color1.slice(1, 3), 16);
    const g1 = parseInt(color1.slice(3, 5), 16);
    const b1 = parseInt(color1.slice(5, 7), 16);
    
    const r2 = parseInt(color2.slice(1, 3), 16);
    const g2 = parseInt(color2.slice(3, 5), 16);
    const b2 = parseInt(color2.slice(5, 7), 16);
    
    // Interpolate
    const r = Math.round(lerp(r1, r2, t));
    const g = Math.round(lerp(g1, g2, t));
    const b = Math.round(lerp(b1, b2, t));
    
    // Convert back to hex
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Interpolate between two rgba strings
 */
function lerpRGBA(rgba1, rgba2, t) {
    // Parse rgba strings
    const match1 = rgba1.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    const match2 = rgba2.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    
    if (!match1 || !match2) return rgba1;
    
    const r = Math.round(lerp(parseInt(match1[1]), parseInt(match2[1]), t));
    const g = Math.round(lerp(parseInt(match1[2]), parseInt(match2[2]), t));
    const b = Math.round(lerp(parseInt(match1[3]), parseInt(match2[3]), t));
    const a = lerp(parseFloat(match1[4] || 1), parseFloat(match2[4] || 1), t);
    
    return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
}

/**
 * Get fluid blended theme colors based on time (system or manual)
 * Uses keyframe-based interpolation for perfectly smooth 24-hour transitions
 * @param {number|null} manualHour - Optional manual hour override (0-24 decimal)
 * @returns {Object} Interpolated theme colors
 */
function getFluidBlendedTheme(manualHour = null) {
    // Get current time in decimal hours (e.g., 14.5 = 2:30 PM)
    let timeDecimal;
    if (manualHour !== null) {
        timeDecimal = manualHour;
    } else {
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();
        const second = now.getSeconds();
        // Include seconds for ultra-smooth transitions
        timeDecimal = hour + minute / 60 + second / 3600;
    }
    
    // Wrap to 0-24 range
    while (timeDecimal < 0) timeDecimal += 24;
    while (timeDecimal >= 24) timeDecimal -= 24;
    
    // Find the two nearest keyframes
    let keyframe1 = colorKeyframes[0];
    let keyframe2 = colorKeyframes[1];
    
    for (let i = 0; i < colorKeyframes.length - 1; i++) {
        if (timeDecimal >= colorKeyframes[i].hour && timeDecimal < colorKeyframes[i + 1].hour) {
            keyframe1 = colorKeyframes[i];
            keyframe2 = colorKeyframes[i + 1];
            break;
        }
    }
    
    // Calculate interpolation factor between the two keyframes
    const duration = keyframe2.hour - keyframe1.hour;
    const elapsed = timeDecimal - keyframe1.hour;
    const t = duration > 0 ? elapsed / duration : 0;
    
    // Apply easing for even smoother transitions (optional - can remove for pure linear)
    const easedT = t; // Linear - can use easeInOutSine(t) for smoother feel
    
    // Interpolate all color properties
    return {
        bgColor: lerpColor(keyframe1.bgColor, keyframe2.bgColor, easedT),
        waterTint: lerpRGBA(keyframe1.waterTint, keyframe2.waterTint, easedT),
        leafColors: {
            primary: lerpColor(keyframe1.leafColors.primary, keyframe2.leafColors.primary, easedT),
            secondary: lerpColor(keyframe1.leafColors.secondary, keyframe2.leafColors.secondary, easedT),
            ternary: lerpColor(keyframe1.leafColors.ternary, keyframe2.leafColors.ternary, easedT)
        }
    };
}

/**
 * Optional easing function for even smoother transitions
 */
function easeInOutSine(t) {
    return -(Math.cos(Math.PI * t) - 1) / 2;
}

/**
 * Color keyframes for 24-hour gradient (hour-based)
 * Each keyframe has an hour (0-24) and theme colors
 * Colors blend smoothly between these keyframes
 */
const colorKeyframes = [
    { hour: 0, bgColor: '#1A1A2E', waterTint: 'rgba(100, 100, 150, 0.15)', leafColors: { primary: '#445566', secondary: '#556677', ternary: '#667788' } }, // Midnight
    { hour: 5, bgColor: '#1A1A2E', waterTint: 'rgba(100, 100, 150, 0.15)', leafColors: { primary: '#445566', secondary: '#556677', ternary: '#667788' } }, // Pre-dawn
    { hour: 6, bgColor: '#2C3E50', waterTint: 'rgba(150, 120, 150, 0.15)', leafColors: { primary: '#5B6A77', secondary: '#6B7A87', ternary: '#7B8A97' } }, // Early dawn
    { hour: 7, bgColor: '#4A5568', waterTint: 'rgba(255, 200, 150, 0.15)', leafColors: { primary: '#7B8A97', secondary: '#8B9AA7', ternary: '#9BAAB7' } }, // Dawn
    { hour: 9, bgColor: '#2A5A5A', waterTint: 'rgba(160, 220, 245, 0.1)', leafColors: { primary: '#77AA22', secondary: '#77AA22', ternary: '#66AA33' } }, // Morning
    { hour: 12, bgColor: '#005A5A', waterTint: 'rgba(135, 206, 235, 0.1)', leafColors: { primary: '#88AA11', secondary: '#77AA22', ternary: '#66AA33' } }, // Noon
    { hour: 15, bgColor: '#005A5A', waterTint: 'rgba(135, 206, 235, 0.1)', leafColors: { primary: '#88AA11', secondary: '#77AA22', ternary: '#66AA33' } }, // Afternoon
    { hour: 17, bgColor: '#3A4A5A', waterTint: 'rgba(200, 170, 130, 0.15)', leafColors: { primary: '#99AA22', secondary: '#88AA33', ternary: '#77AA44' } }, // Late afternoon
    { hour: 18, bgColor: '#5A3A5A', waterTint: 'rgba(255, 140, 100, 0.2)', leafColors: { primary: '#AA8811', secondary: '#AA7722', ternary: '#AA6633' } }, // Dusk
    { hour: 20, bgColor: '#3A2A4A', waterTint: 'rgba(150, 100, 120, 0.18)', leafColors: { primary: '#776688', secondary: '#887799', ternary: '#9988AA' } }, // Evening
    { hour: 22, bgColor: '#1A1A2E', waterTint: 'rgba(100, 100, 150, 0.15)', leafColors: { primary: '#445566', secondary: '#556677', ternary: '#667788' } }, // Night
    { hour: 24, bgColor: '#1A1A2E', waterTint: 'rgba(100, 100, 150, 0.15)', leafColors: { primary: '#445566', secondary: '#556677', ternary: '#667788' } }  // Midnight (wrap)
];

/**
 * Old discrete color schemes - kept for backward compatibility
 */
const timeThemes = {
    dawn: {
        bgColor: '#4A5568',
        waterTint: 'rgba(255, 200, 150, 0.15)',
        leafColors: { primary: '#7B8A97', secondary: '#8B9AA7', ternary: '#9BAAB7' }
    },
    day: {
        bgColor: '#005A5A',
        waterTint: 'rgba(135, 206, 235, 0.1)',
        leafColors: { primary: '#88AA11', secondary: '#77AA22', ternary: '#66AA33' }
    },
    dusk: {
        bgColor: '#f80202ff',
        waterTint: 'rgba(255, 140, 100, 0.2)',
        leafColors: { primary: '#AA8811', secondary: '#AA7722', ternary: '#AA6633' }
    },
    night: {
        bgColor: '#1A1A2E',
        waterTint: 'rgba(100, 100, 150, 0.15)',
        leafColors: { primary: '#445566', secondary: '#556677', ternary: '#667788' }
    }
};

/**
 * Apply time-based theme to the background with fluid color blending
 * @param {string|null} manualTimeOfDay - OLD PARAM: Override time of day ('dawn', 'day', 'dusk', 'night', or null for auto) - DEPRECATED in favor of manualHour
 * @param {string|null} customWaterColor - Custom water color (hex string or null)
 * @param {number|null} manualHour - NEW PARAM: Manual hour override for slider (0-24 decimal, or null for system time)
 */
export function applyTimeTheme(manualTimeOfDay = null, customWaterColor = null, manualHour = null) {
    try {
        // Get fluid blended colors based on current or manual time
        let theme;
        if (manualHour !== null) {
            // Manual mode: use slider hour for fluid interpolation
            theme = getFluidBlendedTheme(manualHour);
        } else if (manualTimeOfDay && manualTimeOfDay !== 'auto') {
            // Legacy discrete mode support (backward compatibility)
            const legacyTheme = timeThemes[manualTimeOfDay];
            if (legacyTheme) {
                theme = legacyTheme;
            } else {
                theme = getFluidBlendedTheme(null);
            }
        } else {
            // Auto mode: use system time for fluid interpolation
            theme = getFluidBlendedTheme(null);
        }
        
        const bg = document.querySelector('.bg');
        if (bg) {
            // Use custom water color if provided, otherwise use interpolated theme color
            const targetColor = customWaterColor || theme.bgColor;
            bg.style.backgroundColor = targetColor;
        }
        
        // Apply water tint overlay
        let tintOverlay = document.getElementById('water-tint-overlay');
        if (!tintOverlay) {
            tintOverlay = document.createElement('div');
            tintOverlay.id = 'water-tint-overlay';
            tintOverlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 1;
                pointer-events: none;
                transition: background-color 1s ease;
            `;
            document.body.insertBefore(tintOverlay, document.body.firstChild);
        }
        tintOverlay.style.backgroundColor = theme.waterTint;
        
        // Apply interpolated leaf colors
        applyLeafColors(theme.leafColors);
        
        // Store current mode in body dataset
        const timeOfDay = manualTimeOfDay || (manualHour !== null ? 'manual' : 'auto');
        document.body.dataset.timeOfDay = timeOfDay;
    } catch (e) {
        console.error('Error in applyTimeTheme:', e);
    }
}

/**
 * Apply leaf colors to leaf elements
 */
function applyLeafColors(colors) {
    if (!colors) return;
    try {
        document.documentElement.style.setProperty('--primary', colors.primary);
        document.documentElement.style.setProperty('--secondary', colors.secondary);
        document.documentElement.style.setProperty('--ternary', colors.ternary);
    } catch (e) {
        console.error('Error applying leaf colors:', e);
    }
}

/**
 * Initialize time-based theming
 * @param {Object} settings - User settings object
 * @param {Function} updateCallback - Optional callback to trigger updates
 */
export function initTimeTheme(settings = {}, updateCallback = null) {
    try {
        // Apply theme immediately with slider's current hour
        const manualHour = settings.manualHour || 12;
        const customWaterColor = settings.customWaterColor || null;
        
        applyTimeTheme(null, customWaterColor, manualHour);
        
        // Note: No auto-updating interval needed since user controls time via slider
        // Background only updates when slider moves or "Current Time" button is clicked
    } catch (e) {
        console.error('Error initializing time theme:', e);
    }
}

/**
 * Get the current hour as a decimal (for slider position)
 */
export function getCurrentHourDecimal() {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const second = now.getSeconds();
    return hour + minute / 60 + second / 3600;
}
