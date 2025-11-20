// --- js/widgets/Weather.js ---

// Module-level state
let weatherSettings = {}; 
let saveSettingsCallback = () => {}; 
let weatherElement = null; // The display div
let currentDisplayedTemp = null;
let currentDisplayedCode = null;

// UI Elements - Declare here, assign in init()
let unitToggleC = null;
let unitToggleF = null;
let locationInput = null;

/**
 * Initializes the weather widget with saved settings.
 */
export function initWeather(settings, saveCallback) {
    // === FIX: Assign elements *inside* init() ===
    weatherElement = document.getElementById('weather-display');
    unitToggleC = document.getElementById('weatherUnitC');
    unitToggleF = document.getElementById('weatherUnitF');
    locationInput = document.getElementById('locationInput');

    // Check that all elements were found
    if (!weatherElement || !unitToggleC || !unitToggleF || !locationInput) {
        console.error("Critical: Weather widget DOM elements not found. Check HTML IDs.");
        return;
    }
    // === End of fix ===

    // Store settings and callback
    weatherSettings = settings;
    saveSettingsCallback = saveCallback;

    // 1. Set up the settings panel
    if (settings.units === 'F') {
        unitToggleF.checked = true;
    } else {
        unitToggleC.checked = true;
    }
    locationInput.value = settings.manualLocation || '';
    
    // 2. Add listeners for the settings panel (autosave)
    unitToggleC.addEventListener('change', onSaveWeatherSettings);
    unitToggleF.addEventListener('change', onSaveWeatherSettings);
    // Save when the user leaves the location input or presses Enter
    locationInput.addEventListener('blur', onSaveWeatherSettings);
    locationInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            onSaveWeatherSettings();
            locationInput.blur();
        }
    });

    // 3. Load initial weather (cached first)
    // FIX: Check cache age before fetching to prevent rate limiting
    loadCachedWeather().then((isFresh) => {
        if (isFresh) {
            console.log("Weather loaded from cache.");
        } else {
            // Only auto-fetch if we have a manual location set
            // This prevents the intrusive "Know your location" prompt on first install
            if (weatherSettings.manualLocation) {
                startWeatherFetch();
            } else {
                // If no manual location and no fresh cache, just wait or show placeholder
                // Note: We don't auto-trigger geolocation anymore for UX/Privacy reasons
                // unless user specifically interacts (which we can add later)
                if (weatherElement.textContent === "Weather unavailable") {
                    weatherElement.textContent = "Set Location";
                }
            }
        }
    });
}

/**
 * Grabs weather data from storage and displays it immediately.
 * Returns a Promise that resolves to true if data is fresh (< 60 mins), false otherwise.
 */
function loadCachedWeather() {
    return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get('cachedWeather', (result) => {
                if (result.cachedWeather && result.cachedWeather.temp !== null) {
                    displayWeather(result.cachedWeather.temp, result.cachedWeather.code);
                    
                    // Check timestamp (1 hour expiration)
                    const now = Date.now();
                    const cacheTime = result.cachedWeather.timestamp || 0;
                    const isFresh = (now - cacheTime) < (60 * 60 * 1000); 
                    
                    resolve(isFresh);
                } else {
                    weatherElement.textContent = "Weather unavailable";
                    resolve(false);
                }
            });
        } else {
            weatherElement.textContent = "Weather unavailable";
            resolve(false);
        }
    });
}

/**
 * Starts the process of fetching new weather data.
 */
function startWeatherFetch() {
    weatherElement.textContent = "Loading...";

    if (weatherSettings.manualLocation) {
        fetchGeocoding(weatherSettings.manualLocation);
    } else {
        // We only reach here if explicitly requested or allowed.
        // For now, we rely on manual location or previous permission.
        navigator.geolocation.getCurrentPosition(fetchWeather, handleLocationError);
    }
}

/**
 * Step 1 (Manual): Get coordinates for a city name.
 */
async function fetchGeocoding(locationName) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationName)}&count=1&format=json`;
    
    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Geocoding API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        if (!data.results || data.results.length === 0) {
            throw new Error(`Location not found: ${locationName}`);
        }
        
        const pos = {
            coords: {
                latitude: data.results[0].latitude,
                longitude: data.results[0].longitude
            }
        };
        fetchWeather(pos);

    } catch (error) {
        console.error("Geocoding error:", error);
        // Fallback to XMLHttpRequest
        try {
            const data = await xhrRequest(url);
            if (!data.results || data.results.length === 0) {
                throw new Error(`Location not found: ${locationName}`);
            }
            
            const pos = {
                coords: {
                    latitude: data.results[0].latitude,
                    longitude: data.results[0].longitude
                }
            };
            fetchWeather(pos);
        } catch (xhrError) {
            console.error("XHR fallback also failed:", xhrError);
            weatherElement.textContent = "Loc not found";
            // Don't save bad state, let user retry
        }
    }
}

/**
 * Step 2: Get weather data from coordinates.
 */
async function fetchWeather(position) {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    const unitParam = weatherSettings.units === 'F' ? 'fahrenheit' : 'celsius';
    
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=${unitParam}`;
    
    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Weather API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.current_weather) {
            throw new Error('Invalid weather data received');
        }
        
        const newTemp = Math.round(data.current_weather.temperature);
        const newCode = data.current_weather.weathercode;

        // Always display and save if we fetched successfully
        displayWeather(newTemp, newCode);
        saveWeather(newTemp, newCode);

    } catch (error) {
        console.error("Error fetching weather:", error);
        // Fallback to XMLHttpRequest
        try {
            const data = await xhrRequest(url);
            if (!data.current_weather) throw new Error('Invalid weather data');
            
            const newTemp = Math.round(data.current_weather.temperature);
            const newCode = data.current_weather.weathercode;

            displayWeather(newTemp, newCode);
            saveWeather(newTemp, newCode);
        } catch (xhrError) {
            console.error("XHR fallback failed:", xhrError);
            // Only show error if we don't have old data displayed
            if (currentDisplayedTemp === null) {
                weatherElement.textContent = "Error";
            }
        }
    }
}

/**
 * Updates the widget's HTML and sets the module-level state.
 */
function displayWeather(temp, code) {
    if (temp === null || code === null) {
        weatherElement.textContent = "Set Location";
        return;
    }

    currentDisplayedTemp = temp;
    currentDisplayedCode = code;
    const unitLabel = weatherSettings.units === 'F' ? '°F' : '°C';
    
    weatherElement.innerHTML = `
        <div class="weather-icon">${getWeatherIcon(code)}</div>
        <div class="weather-temp">${temp}${unitLabel}</div>
    `;
}

/**
 * Saves the latest weather data to Chrome storage with a timestamp.
 */
function saveWeather(temp, code) {
    const cachedWeather = { 
        temp, 
        code,
        timestamp: Date.now() // FIX: Save timestamp for rate limiting
    };
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ cachedWeather });
    }
}

/**
 * Handles errors from geolocation.
 */
function handleLocationError(error) {
    console.warn("Geolocation error:", error.message);
    if (currentDisplayedTemp === null) {
        weatherElement.textContent = "Set Location";
    }
}

/**
 * Called when the "Save" button in the weather settings is clicked.
 */
function onSaveWeatherSettings() {
    // 1. Get new values
    const newUnit = unitToggleF.checked ? 'F' : 'C';
    const newLocation = locationInput.value.trim() || null; // null if empty

    // 2. Update local settings object
    weatherSettings.units = newUnit;
    weatherSettings.manualLocation = newLocation;

    // 3. Save to main storage via callback
    saveSettingsCallback({ weatherSettings: weatherSettings });

    // 4. Force a refresh immediately (bypass cache since user changed settings)
    currentDisplayedTemp = null; 
    startWeatherFetch(); 
}

/**
 * Helper function to map weather codes to icons.
 */
function getWeatherIcon(code) {
    if (code === 0) return '☀️';
    if (code >= 1 && code <= 3) return '🌤️';
    if (code >= 45 && code <= 48) return '🌫️';
    if (code >= 51 && code <= 57) return '🌧️';
    if (code >= 61 && code <= 67) return '🌧️';
    if (code >= 71 && code <= 77) return '❄️';
    if (code >= 80 && code <= 82) return '🌦️';
    if (code >= 85 && code <= 86) return '🌨️';
    if (code >= 95 && code <= 99) return '⛈️';
    return '☁️';
}

/**
 * XMLHttpRequest fallback for when fetch fails
 */
function xhrRequest(url) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
                try { resolve(JSON.parse(xhr.responseText)); } 
                catch (e) { reject(new Error('Failed to parse JSON')); }
            } else { reject(new Error(`XHR failed: ${xhr.status}`)); }
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.ontimeout = () => reject(new Error('Timeout'));
        xhr.timeout = 10000;
        xhr.send();
    });
}