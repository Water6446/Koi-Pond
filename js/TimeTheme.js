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
 * Updated with more accurate and beautiful time-of-day colors
 */
const colorKeyframes = [
    { hour: 0, bgColor: '#0D1B2A', waterTint: 'rgba(15, 25, 45, 0.3)', leafColors: { primary: '#2C3E50', secondary: '#34495E', ternary: '#415A77' } }, // Midnight - Deep blue night
    { hour: 4, bgColor: '#1B263B', waterTint: 'rgba(25, 35, 60, 0.28)', leafColors: { primary: '#34495E', secondary: '#415A77', ternary: '#4A6FA5' } }, // Deep night
    { hour: 5, bgColor: '#151C33', waterTint: 'rgba(21, 28, 51, 0.26)', leafColors: { primary: '#2B374F', secondary: '#33405A', ternary: '#3C4A66' } }, // Pre-dawn deep navy
    { hour: 6, bgColor: '#3D2B47', waterTint: 'rgba(61, 43, 71, 0.24)', leafColors: { primary: '#4A3850', secondary: '#544058', ternary: '#5E4860' } }, // Early dawn dark violet
    { hour: 7, bgColor: '#5B4A55', waterTint: 'rgba(91, 74, 85, 0.22)', leafColors: { primary: '#6B5A64', secondary: '#75646D', ternary: '#7F6E76' } }, // Sunrise dark dusty purple-gray
    { hour: 8, bgColor: '#735E52', waterTint: 'rgba(115, 94, 82, 0.2)', leafColors: { primary: '#826D5F', secondary: '#8C7768', ternary: '#968171' } }, // Warm dull taupe
    { hour: 9, bgColor: '#5D6F7A', waterTint: 'rgba(93, 111, 122, 0.16)', leafColors: { primary: '#6E8667', secondary: '#789170', ternary: '#829C79' } }, // Blue-gray transition to day
    { hour: 10, bgColor: '#3A7CA5', waterTint: 'rgba(140, 190, 230, 0.08)', leafColors: { primary: '#7AAA44', secondary: '#88BB33', ternary: '#95CC22' } }, // Mid-morning - clear blue
    { hour: 12, bgColor: '#2E6A8F', waterTint: 'rgba(120, 180, 225, 0.08)', leafColors: { primary: '#88BB33', secondary: '#95CC22', ternary: '#A0DD11' } }, // Noon - deep clear blue
    { hour: 14, bgColor: '#2E6A8F', waterTint: 'rgba(120, 180, 225, 0.08)', leafColors: { primary: '#88BB33', secondary: '#95CC22', ternary: '#A0DD11' } }, // Afternoon - same as noon
    { hour: 16, bgColor: '#2F4E6B', waterTint: 'rgba(47, 78, 107, 0.12)', leafColors: { primary: '#5A6F42', secondary: '#647A4C', ternary: '#6E8556' } }, // Late afternoon - darker muted blue
    { hour: 17, bgColor: '#3E4F66', waterTint: 'rgba(62, 79, 102, 0.14)', leafColors: { primary: '#766646', secondary: '#807050', ternary: '#8A7A5A' } }, // Golden hour dark blue-gray
    { hour: 18, bgColor: '#7A5559', waterTint: 'rgba(122, 85, 89, 0.18)', leafColors: { primary: '#836165', secondary: '#8D6B6E', ternary: '#977578' } }, // Sunset dark dusty rose
    { hour: 19, bgColor: '#6B4856', waterTint: 'rgba(107, 72, 86, 0.2)', leafColors: { primary: '#785462', secondary: '#82606C', ternary: '#8C6C76' } }, // Sunset dark muted mauve
    { hour: 20, bgColor: '#33274E', waterTint: 'rgba(51, 39, 78, 0.26)', leafColors: { primary: '#5A4B76', secondary: '#685784', ternary: '#766392' } }, // Evening darker indigo
    { hour: 21, bgColor: '#252035', waterTint: 'rgba(60, 50, 80, 0.28)', leafColors: { primary: '#445566', secondary: '#556677', ternary: '#667788' } }, // Late evening
    { hour: 23, bgColor: '#15192B', waterTint: 'rgba(20, 30, 50, 0.3)', leafColors: { primary: '#334455', secondary: '#445566', ternary: '#556677' } }, // Late night
    { hour: 24, bgColor: '#0D1B2A', waterTint: 'rgba(15, 25, 45, 0.3)', leafColors: { primary: '#2C3E50', secondary: '#34495E', ternary: '#415A77' } }  // Midnight (wrap)
];

/**
 * Old discrete color schemes - kept for backward compatibility
 */
const timeThemes = {
    dawn: {
        bgColor: '#5B4A55',
        waterTint: 'rgba(91, 74, 85, 0.22)',
        leafColors: { primary: '#6B5A64', secondary: '#75646D', ternary: '#7F6E76' }
    },
    day: {
        bgColor: '#005A5A',
        waterTint: 'rgba(135, 206, 235, 0.1)',
        leafColors: { primary: '#88AA11', secondary: '#77AA22', ternary: '#66AA33' }
    },
    dusk: {
        bgColor: '#6B4856',
        waterTint: 'rgba(107, 72, 86, 0.2)',
        leafColors: { primary: '#785462', secondary: '#82606C', ternary: '#8C6C76' }
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
