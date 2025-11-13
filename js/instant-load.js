// ===== INSTANT LOAD: Apply cached settings synchronously BEFORE page renders =====
// This ensures no flash of unstyled content on first frame
(function() {
    'use strict';
    
    // Get cached settings from localStorage (synchronous, instant)
    let cachedSettings = null;
    try {
        const cached = localStorage.getItem('koiPondCachedSettings');
        if (cached) {
            cachedSettings = JSON.parse(cached);
        }
    } catch (e) {
        console.error('Failed to load cached settings:', e);
    }
    
    // Simplified color interpolation for instant load
    function lerpColor(color1, color2, t) {
        const r1 = parseInt(color1.slice(1, 3), 16);
        const g1 = parseInt(color1.slice(3, 5), 16);
        const b1 = parseInt(color1.slice(5, 7), 16);
        const r2 = parseInt(color2.slice(1, 3), 16);
        const g2 = parseInt(color2.slice(3, 5), 16);
        const b2 = parseInt(color2.slice(5, 7), 16);
        const r = Math.round(r1 + (r2 - r1) * t);
        const g = Math.round(g1 + (g2 - g1) * t);
        const b = Math.round(b1 + (b2 - b1) * t);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    
    // Mini keyframes for instant load
    const keyframes = [
        { hour: 0, color: '#1A1A2E' }, { hour: 5, color: '#1A1A2E' },
        { hour: 7, color: '#4A5568' }, { hour: 12, color: '#005A5A' },
        { hour: 18, color: '#5A3A5A' }, { hour: 22, color: '#1A1A2E' },
        { hour: 24, color: '#1A1A2E' }
    ];
    
    // Calculate current time-based color
    function getFluidColor(hour) {
        let k1 = keyframes[0], k2 = keyframes[1];
        for (let i = 0; i < keyframes.length - 1; i++) {
            if (hour >= keyframes[i].hour && hour < keyframes[i + 1].hour) {
                k1 = keyframes[i];
                k2 = keyframes[i + 1];
                break;
            }
        }
        const duration = k2.hour - k1.hour;
        const elapsed = hour - k1.hour;
        const t = duration > 0 ? elapsed / duration : 0;
        return lerpColor(k1.color, k2.color, t);
    }
    
    // Determine background color
    let bgColor;
    
    if (cachedSettings) {
        // Use custom water color if set
        if (cachedSettings.customWaterColor) {
            bgColor = cachedSettings.customWaterColor;
        } else if (cachedSettings.manualHour !== undefined) {
            // Use cached slider time
            bgColor = getFluidColor(cachedSettings.manualHour);
        } else {
            // No cached hour: default to noon
            bgColor = getFluidColor(12);
        }
    } else {
        // No cache: default to noon
        bgColor = getFluidColor(12);
    }
    
    // Apply background color immediately via CSS variable and directly to body
    document.documentElement.style.setProperty('--initial-bg-color', bgColor);
    // Apply directly to body to prevent any flash before .bg element renders
    document.body.style.backgroundColor = bgColor;
    
    // Start preloading background image immediately
    if (typeof Image !== 'undefined') {
        const bgUrl = 'https://www.photos-public-domain.com/wp-content/uploads/2011/12/white-paper-texture-with-flecks.jpg';
        const preloadImg = new Image();
        preloadImg.src = bgUrl;
    }
    
    // Apply widget positions and sizes from cache
    if (cachedSettings) {
        let styleRules = '';
        
        // Widget positions
        if (cachedSettings.widgetPositions) {
            for (const [id, pos] of Object.entries(cachedSettings.widgetPositions)) {
                if (pos.leftPct !== undefined && pos.topPct !== undefined) {
                    styleRules += `#${id} { left: ${pos.leftPct * 100}vw !important; top: ${pos.topPct * 100}vh !important; transform: none !important; }\n`;
                }
            }
        }
        
        // Widget sizes
        if (cachedSettings.widgetSizes) {
            for (const [id, size] of Object.entries(cachedSettings.widgetSizes)) {
                if (size.width && size.height) {
                    styleRules += `#${id} { width: ${size.width} !important; height: ${size.height} !important; }\n`;
                }
            }
        }
        
        // Widget visibility
        if (cachedSettings.widgetVisibility) {
            for (const [id, visible] of Object.entries(cachedSettings.widgetVisibility)) {
                if (!visible) {
                    styleRules += `#${id} { display: none !important; }\n`;
                }
            }
        }
        
        // Inject styles immediately (minified for performance)
        if (styleRules) {
            const style = document.createElement('style');
            style.id = 'cached-settings-style';
            style.textContent = styleRules.replace(/\s+/g, ' ').trim();
            document.head.appendChild(style);
        }
    }
})();
