// --- js/Weather.js ---

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

    // 3. Load initial weather (cached first, then fetch)
    loadCachedWeather();
    startWeatherFetch();
}

/**
 * Grabs weather data from storage and displays it immediately.
 */
function loadCachedWeather() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get('cachedWeather', (result) => {
            if (result.cachedWeather && result.cachedWeather.temp !== null) {
                displayWeather(result.cachedWeather.temp, result.cachedWeather.code);
            } else {
                weatherElement.textContent = "Loading weather...";
            }
        });
    } else {
        weatherElement.textContent = "Weather unavailable";
    }
}

/**
 * Starts the process of fetching new weather data.
 */
function startWeatherFetch() {
    if (weatherSettings.manualLocation) {
        fetchGeocoding(weatherSettings.manualLocation);
    } else {
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
        console.error("Attempting XMLHttpRequest fallback...");
        
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
            weatherElement.textContent = "Location not found";
            saveWeather(null, null);
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

        if (newTemp !== currentDisplayedTemp || newCode !== currentDisplayedCode) {
            displayWeather(newTemp, newCode);
            saveWeather(newTemp, newCode);
        }

    } catch (error) {
        console.error("Error fetching weather:", error);
        console.error("Error details:", {
            message: error.message,
            type: error.name,
            stack: error.stack
        });
        console.error("Attempting XMLHttpRequest fallback...");
        
        // Fallback to XMLHttpRequest
        try {
            const data = await xhrRequest(url);
            
            if (!data.current_weather) {
                throw new Error('Invalid weather data received');
            }
            
            const newTemp = Math.round(data.current_weather.temperature);
            const newCode = data.current_weather.weathercode;

            if (newTemp !== currentDisplayedTemp || newCode !== currentDisplayedCode) {
                displayWeather(newTemp, newCode);
                saveWeather(newTemp, newCode);
            }
        } catch (xhrError) {
            console.error("XHR fallback also failed:", xhrError);
            if (currentDisplayedTemp === null) {
                weatherElement.textContent = "Weather unavailable";
            }
        }
    }
}

/**
 * Updates the widget's HTML and sets the module-level state.
 */
function displayWeather(temp, code) {
    if (temp === null || code === null) {
        weatherElement.textContent = "Weather unavailable";
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
 * Saves the latest weather data to Chrome storage.
 */
function saveWeather(temp, code) {
    const cachedWeather = { temp, code };
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set({ cachedWeather });
    }
}

/**
 * Handles errors from geolocation.
 */
function handleLocationError(error) {
    console.warn("Geolocation error:", error.message);
    if (currentDisplayedTemp === null) {
        if (error.code === error.PERMISSION_DENIED) {
            weatherElement.textContent = "Enable location for weather.";
        } else {
            weatherElement.textContent = "Weather unavailable";
        }
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

    // 4. Force a refresh
    weatherElement.textContent = "Loading weather..."; // Show loading
    currentDisplayedTemp = null; // Force display update
    startWeatherFetch(); // Fetch new data
}

/**
 * Helper function to map weather codes to icons. (Unchanged)
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
                try {
                    const data = JSON.parse(xhr.responseText);
                    resolve(data);
                } catch (e) {
                    reject(new Error('Failed to parse JSON response'));
                }
            } else {
                reject(new Error(`XHR request failed with status ${xhr.status}`));
            }
        };
        
        xhr.onerror = function() {
            reject(new Error('XHR request failed - network error'));
        };
        
        xhr.ontimeout = function() {
            reject(new Error('XHR request timed out'));
        };
        
        xhr.timeout = 10000; // 10 second timeout
        xhr.send();
    });
}