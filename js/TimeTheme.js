// --- js/TimeTheme.js ---

/**
 * Gets the current season based on date
 */
export function getCurrentSeason() {
    const now = new Date();
    const month = now.getMonth(); // 0-11
    
    if (month >= 2 && month <= 4) return 'spring'; // Mar-May
    if (month >= 5 && month <= 7) return 'summer'; // Jun-Aug
    if (month >= 8 && month <= 10) return 'fall'; // Sep-Nov
    return 'winter'; // Dec-Feb
}

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
 * Get blended theme colors based on current time
 */
function getBlendedTimeTheme() {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const timeDecimal = hour + minute / 60; // 0-24 with decimals
    
    // Define time periods with their hour ranges
    const periods = [
        { name: 'night', start: 0, end: 5 },      // 00:00 - 05:00
        { name: 'dawn', start: 5, end: 8 },       // 05:00 - 08:00
        { name: 'day', start: 8, end: 17 },       // 08:00 - 17:00
        { name: 'dusk', start: 17, end: 20 },     // 17:00 - 20:00
        { name: 'night', start: 20, end: 24 }     // 20:00 - 24:00
    ];
    
    // Find current and next period
    let currentPeriod, nextPeriod, blendFactor;
    
    for (let i = 0; i < periods.length; i++) {
        const period = periods[i];
        if (timeDecimal >= period.start && timeDecimal < period.end) {
            currentPeriod = period.name;
            
            // Get next period
            const nextIndex = (i + 1) % periods.length;
            nextPeriod = periods[nextIndex].name;
            
            // Calculate blend factor (0 = fully current, 1 = fully next)
            const periodDuration = period.end - period.start;
            const timeInPeriod = timeDecimal - period.start;
            blendFactor = timeInPeriod / periodDuration;
            
            break;
        }
    }
    
    // Fallback
    if (!currentPeriod) {
        currentPeriod = 'night';
        nextPeriod = 'dawn';
        blendFactor = 0;
    }
    
    const theme1 = timeThemes[currentPeriod];
    const theme2 = timeThemes[nextPeriod];
    
    // Blend colors
    return {
        bgColor: lerpColor(theme1.bgColor, theme2.bgColor, blendFactor),
        waterTint: lerpRGBA(theme1.waterTint, theme2.waterTint, blendFactor),
        leafColors: {
            primary: lerpColor(theme1.leafColors.primary, theme2.leafColors.primary, blendFactor),
            secondary: lerpColor(theme1.leafColors.secondary, theme2.leafColors.secondary, blendFactor),
            ternary: lerpColor(theme1.leafColors.ternary, theme2.leafColors.ternary, blendFactor)
        }
    };
}

/**
 * Color schemes for different times of day
 */
const timeThemes = {
    dawn: {
        bgColor: '#4A5568', // Cool blue-gray
        waterTint: 'rgba(255, 200, 150, 0.15)', // Warm sunrise
        leafColors: { primary: '#7B8A97', secondary: '#8B9AA7', ternary: '#9BAAB7' }
    },
    day: {
        bgColor: '#005A5A', // Default teal
        waterTint: 'rgba(135, 206, 235, 0.1)', // Bright sky blue
        leafColors: { primary: '#88AA11', secondary: '#77AA22', ternary: '#66AA33' }
    },
    dusk: {
        bgColor: '#5A3A5A', // Purple-ish
        waterTint: 'rgba(255, 140, 100, 0.2)', // Orange sunset
        leafColors: { primary: '#AA8811', secondary: '#AA7722', ternary: '#AA6633' }
    },
    night: {
        bgColor: '#1A1A2E', // Dark blue
        waterTint: 'rgba(100, 100, 150, 0.15)', // Moonlight blue
        leafColors: { primary: '#445566', secondary: '#556677', ternary: '#667788' }
    }
};

/**
 * Color schemes for different seasons
 */
const seasonThemes = {
    spring: {
        leafColors: { primary: '#88CC44', secondary: '#77DD55', ternary: '#99EE66' },
        dropColors: ['#FFCCEE', '#FFDDFF', '#EECCFF'], // Pink petals
        hasPetals: true
    },
    summer: {
        leafColors: { primary: '#55AA22', secondary: '#66BB33', ternary: '#77CC44' },
        dropColors: ['rgba(200, 230, 255, 0.6)', 'rgba(180, 220, 255, 0.5)'],
        hasPetals: false
    },
    fall: {
        leafColors: { primary: '#DD7722', secondary: '#CC6611', ternary: '#BB5500' },
        dropColors: ['#DD8833', '#CC7722', '#BB6611'], // Falling leaves
        hasPetals: false
    },
    winter: {
        leafColors: { primary: '#667788', secondary: '#778899', ternary: '#8899AA' },
        dropColors: ['rgba(255, 255, 255, 0.8)', 'rgba(240, 248, 255, 0.7)'], // Snowflakes
        hasPetals: false
    }
};

/**
 * Apply time-based theme to the background
 * @param {string|null} manualTimeOfDay - Override time of day ('dawn', 'day', 'dusk', 'night', or null for auto)
 * @param {string|null} customWaterColor - Custom water color (hex string or null)
 */
export function applyTimeTheme(manualTimeOfDay = null, customWaterColor = null) {
    try {
        const timeOfDay = manualTimeOfDay || getTimeOfDay();
        const season = getCurrentSeason();
        
        const theme = timeThemes[timeOfDay];
        const seasonTheme = seasonThemes[season];
        
        if (!theme || !seasonTheme) {
            console.error('Invalid theme or season theme');
            return;
        }
        
        const bg = document.querySelector('.bg');
        if (bg) {
            // Use custom water color if provided, otherwise use theme color
            bg.style.backgroundColor = customWaterColor || theme.bgColor;
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
                transition: background-color 2s ease;
            `;
            document.body.insertBefore(tintOverlay, document.body.firstChild);
        }
        tintOverlay.style.backgroundColor = theme.waterTint;
        
        // Apply seasonal leaf colors
        applySeasonalLeafColors(seasonTheme.leafColors);
        
        // Apply seasonal drop colors (water drops or petals/snow)
        applySeasonalDrops(seasonTheme.dropColors, season);
        
        // Store current theme in body dataset
        document.body.dataset.timeOfDay = timeOfDay;
        document.body.dataset.season = season;
    } catch (e) {
        console.error('Error in applyTimeTheme:', e);
    }
}

/**
 * Apply seasonal colors to leaf elements
 */
function applySeasonalLeafColors(colors) {
    if (!colors) return;
    try {
        document.documentElement.style.setProperty('--primary', colors.primary);
        document.documentElement.style.setProperty('--secondary', colors.secondary);
        document.documentElement.style.setProperty('--ternary', colors.ternary);
    } catch (e) {
        console.error('Error applying seasonal leaf colors:', e);
    }
}

/**
 * Apply seasonal styling to drops (water/petals/snow)
 */
function applySeasonalDrops(colors, season) {
    if (!colors || !Array.isArray(colors)) return;
    try {
        const drops = document.querySelectorAll('.drop');
        drops.forEach((drop, index) => {
            const color = colors[index % colors.length];
            drop.style.background = color;
            
            // Adjust animation for snow (slower fall)
            if (season === 'winter') {
                drop.style.animationDuration = `${15 + Math.random() * 10}s`;
            } else {
                drop.style.animationDuration = `${7 + Math.random() * 5}s`;
            }
        });
    } catch (e) {
        console.error('Error applying seasonal drops:', e);
    }
}

/**
 * Initialize time-based theming with periodic updates
 * @param {Object} settings - User settings object
 */
export function initTimeTheme(settings = {}) {
    try {
        const manualTimeOfDay = settings.manualTimeOfDay === 'auto' || !settings.manualTimeOfDay ? null : settings.manualTimeOfDay;
        const customWaterColor = settings.customWaterColor || null;
        
        // Apply theme immediately
        applyTimeTheme(manualTimeOfDay, customWaterColor);
        
        // Update every 5 minutes to catch time transitions (only if on auto mode)
        setInterval(() => {
            try {
                if (!settings.manualTimeOfDay || settings.manualTimeOfDay === 'auto') {
                    applyTimeTheme(null, customWaterColor);
                }
            } catch (e) {
                console.error('Error in time theme interval:', e);
            }
        }, 5 * 60 * 1000);
    } catch (e) {
        console.error('Error initializing time theme:', e);
    }
}
