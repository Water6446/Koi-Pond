// --- js/Clock.js ---

let clockSettings = {
    format: '24', // '12' or '24'
    timezone: 'local' // timezone identifier
};

function formatTime(date, format) {
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    let period = '';

    if (format === '12') {
        //period = hours >= 12 ? ' PM' : ' AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // convert 0 to 12
    }

    hours = hours.toString().padStart(2, '0');
    return `${hours}:${minutes}${period}`;
}

function getTimeInTimezone(timezone) {
    if (timezone === 'local') {
        return new Date();
    }
    
    const date = new Date();
    return new Date(date.toLocaleString('en-US', { timeZone: timezone }));
}

export function initClock() {
    const clockElement = document.getElementById('clock-display');
    const formatRadios = document.getElementsByName('timeFormat');
    const timezoneSelect = document.getElementById('timezoneSelect');

    if (!clockElement) {
        console.error("Clock element not found!");
        return;
    }

    // Update time display immediately with current settings
    function updateTime() {
        const now = getTimeInTimezone(clockSettings.timezone);
        const timeString = formatTime(now, clockSettings.format);
        clockElement.textContent = timeString;
    }

    // Call updateTime immediately, don't wait for storage
    updateTime();

    // Load saved settings (but clock is already showing with defaults)
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['clockSettings'], (result) => {
            if (result.clockSettings) {
                clockSettings = result.clockSettings;
                // Update UI to match saved settings
                const formatElement = document.getElementById(`format${clockSettings.format}h`);
                if (formatElement) {
                    formatElement.checked = true;
                }
                if (timezoneSelect) {
                    timezoneSelect.value = clockSettings.timezone;
                }
                // Update time with loaded settings
                updateTime();
            }
        });
    }

    // Save settings
    function saveSettings() {
        const formatRadio = document.querySelector('input[name="timeFormat"]:checked');
        const newSettings = {
            format: formatRadio ? formatRadio.value : clockSettings.format,
            timezone: timezoneSelect ? timezoneSelect.value : clockSettings.timezone
        };

        clockSettings = newSettings;

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ clockSettings: newSettings });
        }
    }

    // Event listeners (autosave): save whenever user changes format or timezone
    if (formatRadios && formatRadios.length > 0) {
        const radiosArray = formatRadios.forEach ? formatRadios : Array.from(formatRadios);
        (radiosArray.forEach ? radiosArray : Array.from(radiosArray)).forEach(r => {
            r.addEventListener('change', () => { 
                saveSettings(); 
                updateTime(); 
            });
        });
    }
    
    if (timezoneSelect) {
        timezoneSelect.addEventListener('change', () => { 
            saveSettings(); 
            updateTime(); 
        });
    }

    updateTime(); // Run once immediately
    setInterval(updateTime, 1000); // Update every second
}