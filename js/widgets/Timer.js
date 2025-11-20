// --- js/Timer.js ---

let timerInterval = null;
let remainingSeconds = 0;
let totalSeconds = 0;
let isRunning = false;
let isPaused = false;

/**
 * Initialize the timer widget
 */
export function initTimer() {
    const timerDisplay = document.getElementById('timer-time');
    const timerWidget = document.getElementById('timer-widget');
    const startButton = document.getElementById('timer-start');
    const pauseButton = document.getElementById('timer-pause');
    const resetButton = document.getElementById('timer-reset');
    const setButton = document.getElementById('timerSetButton');
    const hoursInput = document.getElementById('timerHours');
    const minutesInput = document.getElementById('timerMinutes');
    const secondsInput = document.getElementById('timerSeconds');

    if (!timerDisplay || !startButton || !pauseButton || !resetButton) {
        console.error("Timer elements not found!");
        return;
    }

    // Set up dynamic font scaling based on widget size
    if (timerWidget) {
        const observer = new ResizeObserver(() => {
            scaleTimerText();
        });
        observer.observe(timerWidget);
        
        // Initial scale
        scaleTimerText();
    }

    // Load saved timer state
    loadTimerState();

    // Set timer button handler
    if (setButton && hoursInput && minutesInput && secondsInput) {
        setButton.addEventListener('click', () => {
            const hours = parseInt(hoursInput.value) || 0;
            const minutes = parseInt(minutesInput.value) || 0;
            const seconds = parseInt(secondsInput.value) || 0;
            
            totalSeconds = hours * 3600 + minutes * 60 + seconds;
            remainingSeconds = totalSeconds;
            
            if (totalSeconds > 0) {
                updateDisplay();
                saveTimerState();
                
                // Visual feedback
                setButton.textContent = '✓ Set!';
                setTimeout(() => {
                    setButton.textContent = 'Set Timer';
                }, 1000);
            }
        });
    }

    // Start button handler
    startButton.addEventListener('click', () => {
        if (remainingSeconds <= 0) {
            // If timer is at zero, use the input values
            const hours = parseInt(hoursInput?.value || 0);
            const minutes = parseInt(minutesInput?.value || 0);
            const seconds = parseInt(secondsInput?.value || 0);
            totalSeconds = hours * 3600 + minutes * 60 + seconds;
            remainingSeconds = totalSeconds;
        }

        if (remainingSeconds > 0) {
            startTimer();
        }
    });

    // Pause button handler
    pauseButton.addEventListener('click', () => {
        pauseTimer();
    });

    // Reset button handler
    resetButton.addEventListener('click', () => {
        resetTimer();
    });

    // Update display initially
    updateDisplay();
}

/**
 * Start the countdown timer
 */
function startTimer() {
    if (isRunning) return;

    isRunning = true;
    isPaused = false;

    const startButton = document.getElementById('timer-start');
    const pauseButton = document.getElementById('timer-pause');

    startButton.style.display = 'none';
    pauseButton.style.display = 'inline-block';

    timerInterval = setInterval(() => {
        remainingSeconds--;

        if (remainingSeconds <= 0) {
            remainingSeconds = 0;
            completeTimer();
        }

        updateDisplay();
        saveTimerState();
    }, 1000);

    saveTimerState();
}

/**
 * Pause the timer
 */
function pauseTimer() {
    if (!isRunning) return;

    clearInterval(timerInterval);
    isRunning = false;
    isPaused = true;

    const startButton = document.getElementById('timer-start');
    const pauseButton = document.getElementById('timer-pause');

    startButton.style.display = 'inline-block';
    pauseButton.style.display = 'none';
    startButton.textContent = 'Resume';

    saveTimerState();
}

/**
 * Reset the timer
 */
function resetTimer() {
    clearInterval(timerInterval);
    isRunning = false;
    isPaused = false;
    remainingSeconds = totalSeconds;

    const startButton = document.getElementById('timer-start');
    const pauseButton = document.getElementById('timer-pause');

    startButton.style.display = 'inline-block';
    pauseButton.style.display = 'none';
    startButton.textContent = 'Start';

    updateDisplay();
    saveTimerState();
}

/**
 * Complete timer - play notification
 */
function completeTimer() {
    clearInterval(timerInterval);
    isRunning = false;
    isPaused = false;

    const startButton = document.getElementById('timer-start');
    const pauseButton = document.getElementById('timer-pause');
    const timerDisplay = document.getElementById('timer-time');

    startButton.style.display = 'inline-block';
    pauseButton.style.display = 'none';
    startButton.textContent = 'Start';

    // Visual notification
    if (timerDisplay) {
        timerDisplay.style.color = '#4CAF50';
        timerDisplay.style.animation = 'pulse 0.5s ease-in-out 3';
        
        setTimeout(() => {
            timerDisplay.style.color = '';
            timerDisplay.style.animation = '';
        }, 2000);
    }

    // Try to play a notification sound (browser notification API)
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('⏱️ Timer Complete!', {
            body: 'Your countdown timer has finished.',
            icon: 'icons/Fish48.png'
        });
    }

    saveTimerState();
}

/**
 * Scale timer text based on widget size
 */
function scaleTimerText() {
    const timerWidget = document.getElementById('timer-widget');
    const timerTime = document.getElementById('timer-time');
    const timerButtons = document.querySelectorAll('.timer-button');
    
    if (!timerWidget || !timerTime) return;
    
    const widgetWidth = timerWidget.offsetWidth;
    const widgetHeight = timerWidget.offsetHeight;
    
    // Scale font size based on widget dimensions (relative to default 280x140)
    const scale = Math.min(widgetWidth / 280, widgetHeight / 140);
    const baseFontSize = 2.5; // rem
    const baseButtonSize = 0.9; // rem
    
    const newFontSize = baseFontSize * scale;
    const newButtonSize = baseButtonSize * scale;
    
    timerTime.style.fontSize = `${newFontSize}rem`;
    
    timerButtons.forEach(button => {
        button.style.fontSize = `${newButtonSize}rem`;
    });
}

/**
 * Update the timer display
 */
function updateDisplay() {
    const timerDisplay = document.getElementById('timer-time');
    if (!timerDisplay) return;

    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = remainingSeconds % 60;

    timerDisplay.textContent = 
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Save timer state to storage
 */
function saveTimerState() {
    const timerState = {
        remainingSeconds,
        totalSeconds,
        isRunning,
        isPaused,
        lastSaved: Date.now()
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ timerState });
    }
}

/**
 * Load timer state from storage
 */
function loadTimerState() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['timerState'], (result) => {
            if (result.timerState) {
                const state = result.timerState;
                remainingSeconds = state.remainingSeconds || 0;
                totalSeconds = state.totalSeconds || 300; // Default 5 minutes
                
                // If timer was running, adjust for elapsed time
                if (state.isRunning && state.lastSaved) {
                    const elapsedSeconds = Math.floor((Date.now() - state.lastSaved) / 1000);
                    remainingSeconds = Math.max(0, remainingSeconds - elapsedSeconds);
                    
                    if (remainingSeconds > 0) {
                        startTimer();
                    }
                }
                
                updateDisplay();
            } else {
                // Default: 5 minute timer
                totalSeconds = 300;
                remainingSeconds = 300;
                updateDisplay();
            }
        });
    } else {
        // Default: 5 minute timer
        totalSeconds = 300;
        remainingSeconds = 300;
        updateDisplay();
    }
}
