// --- js/Quote.js ---
import { localQuotes } from './localQuotes.js';

// Module-level state
let quoteSettings = {};
let saveSettingsCallback = () => {};

// UI Elements - Declare here, assign in init()
let quoteDisplay = null;
let quoteElement = null;
let authorElement = null;
let showAuthorToggle = null;
let customQuoteInput = null;
let customAuthorInput = null;

/**
 * Initializes the quote widget with saved settings.
 * @param {object} settings - The userSettings.quoteSettings object
 * @param {function} saveCallback - Function to save settings to main.js
 */
export function initQuote(settings, saveCallback) {
    // === FIX: Assign elements *inside* init() ===
    quoteDisplay = document.getElementById('quote-display');
    quoteElement = document.getElementById('quote-widget-text');
    authorElement = document.getElementById('quote-widget-author');
    showAuthorToggle = document.getElementById('showAuthorToggle');
    customQuoteInput = document.getElementById('customQuoteInput');
    customAuthorInput = document.getElementById('customAuthorInput');

    // Check that all elements were found
    if (!quoteElement || !authorElement || !showAuthorToggle || !customQuoteInput || !customAuthorInput) {
        console.error("Critical: Quote widget DOM elements not found. Check HTML IDs.");
        return;
    }
    // === End of fix ===

    // Store settings and callback
    quoteSettings = settings;
    saveSettingsCallback = saveCallback;

    // 1. Set up the settings panel
    showAuthorToggle.checked = settings.showAuthor;
    customQuoteInput.value = settings.customQuote || '';
    customAuthorInput.value = settings.customAuthor || '';

    // 2. Add listeners for the settings panel
    // Autosave: save whenever a relevant input changes
    showAuthorToggle.addEventListener('change', onSaveQuoteSettings);
    customQuoteInput.addEventListener('input', onSaveQuoteSettings);
    customAuthorInput.addEventListener('input', onSaveQuoteSettings);

    // 3. Display the initial quote
    displayQuote();
}

/**
 * Displays a quote based on the current settings.
 */
function displayQuote() {
    // Check for custom quote first
    if (quoteSettings.customQuote) {
        quoteElement.textContent = `"${quoteSettings.customQuote}"`;
        // Show custom author if configured; otherwise respect general showAuthor
        if (quoteSettings.showCustomAuthor && quoteSettings.customAuthor) {
            authorElement.textContent = `– ${quoteSettings.customAuthor}`;
            authorElement.style.display = 'block';
        } else if (quoteSettings.showAuthor) {
            // Fallback label for a custom quote when no custom author provided
            authorElement.textContent = "– You";
            authorElement.style.display = 'block';
        } else {
            authorElement.textContent = "";
            authorElement.style.display = 'none';
        }
    } else {
        // No custom quote, pick a random one
        try {
            if (!localQuotes || localQuotes.length === 0) {
                throw new Error("No local quotes found.");
            }
            const randomQuote = localQuotes[Math.floor(Math.random() * localQuotes.length)];
            
            quoteElement.textContent = `"${randomQuote.text}"`;
            authorElement.textContent = `– ${randomQuote.author}`;
            authorElement.style.display = quoteSettings.showAuthor ? 'block' : 'none';

        } catch (error) {
            console.error("Error loading local quote:", error);
            quoteElement.textContent = "Error: Could not load local quotes.";
            authorElement.textContent = "";
        }
    }
}

/**
 * Called when the "Save" button in the quote settings is clicked.
 */
function onSaveQuoteSettings() {
    // 1. Get new values from the UI
    const newShowAuthor = showAuthorToggle.checked;
    const newCustomQuote = customQuoteInput.value.trim() || null; // Store null if empty
    const newCustomAuthor = customAuthorInput.value.trim() || null;
    const newShowCustomAuthor = !!newCustomAuthor; // If a custom author is provided, consider it active

    // 2. Update the local settings object
    quoteSettings.showAuthor = newShowAuthor;
    quoteSettings.customQuote = newCustomQuote;
    quoteSettings.showCustomAuthor = newShowCustomAuthor;
    quoteSettings.customAuthor = newCustomAuthor;

    // 3. Refresh the display
    displayQuote();

    // 4. Save to main storage via callback
    saveSettingsCallback({ quoteSettings: quoteSettings });
}