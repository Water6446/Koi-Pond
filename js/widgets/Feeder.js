import { config, foodConfig } from '../config.js';

// Public food array (simple objects: {x, y, nutrition, radius, life})
export const foods = [];

let bagElem = null;
let ghostElem = null;
let isDragging = false;
let pelletCount = 10;
let counterElem = null;
const MAX_PELLETS = 10;
const REFILL_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes 
let refillIntervalId = null;
let lastRefillTimestamp = null;

export function initFeeder() {
    // Create feeder bag UI
    bagElem = document.createElement('div');
    bagElem.id = 'feeder-bag';
    // structure: top flap + cute face element (removed squiggle icon)
    bagElem.innerHTML = '<div class="bag-top"></div><div class="bag-face"><div class="smile"></div></div>';
    document.body.appendChild(bagElem);

    // pellet counter badge
    counterElem = document.createElement('div');
    counterElem.id = 'feeder-count';
    counterElem.innerHTML = `${pelletCount}<span class="count-emoji">♥</span>`;
    bagElem.appendChild(counterElem);

    bagElem.addEventListener('pointerdown', onPointerDown);
    // load saved pellet state then start refill timer
    loadPelletState().then(() => {
        scheduleRefill();
    });
}

function onPointerDown(e) {
    e.preventDefault();
    isDragging = true;

    ghostElem = document.createElement('div');
    ghostElem.id = 'feeder-ghost';
    ghostElem.textContent = '•';
    document.body.appendChild(ghostElem);
    moveGhost(e.clientX, e.clientY);

    // Try to capture the pointer so we receive pointerup even if the pointer
    // moves outside the bag element.
    try { bagElem.setPointerCapture && bagElem.setPointerCapture(e.pointerId); } catch (err) {}

    // show opening animation
    bagElem.classList.add('opening');

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
    window.addEventListener('pointercancel', onPointerCancel);
}

function onPointerMove(e) {
    moveGhost(e.clientX, e.clientY);
}

function onPointerUp(e) {
    isDragging = false;
    // Remove move listener first to avoid races
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointercancel', onPointerCancel);

    // hide opening animation
    bagElem.classList.remove('opening');

    // Remove the ghost immediately so the UI doesn't get stuck if an error occurs
    if (ghostElem) {
        ghostElem.remove();
        ghostElem = null;
    }

    // Spawn pellet at release point if we have any
    try {
        const ok = spawnFoodAt(e.clientX, e.clientY);
        if (!ok) {
            // flash bag to indicate empty
            bagElem.classList.add('empty-flash');
            setTimeout(() => bagElem.classList.remove('empty-flash'), 300);
        }
    } catch (err) {
        console.error('Failed to spawn food pellet:', err);
    }

    // Release pointer capture if set
    try { bagElem.releasePointerCapture && bagElem.releasePointerCapture(e.pointerId); } catch (err) {}
}

function onPointerCancel(e) {
    // Treat cancel like an abort: remove ghost and cleanup
    isDragging = false;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerCancel);
    if (ghostElem) {
        ghostElem.remove();
        ghostElem = null;
    }
    try { bagElem.releasePointerCapture && bagElem.releasePointerCapture(e.pointerId); } catch (err) {}
}

function moveGhost(x, y) {
    if (!ghostElem) return;
    ghostElem.style.left = `${x - 8}px`;
    ghostElem.style.top = `${y - 8}px`;
}

export function spawnFoodAt(clientX, clientY) {
    // Convert client coordinates to canvas coordinates - in our app canvas covers full screen
    const x = clientX;
    const y = clientY;
    // Don't spawn if no pellets left
    if (typeof pelletCount === 'number' && pelletCount <= 0) return false;

    const pellet = {
        x,
        y,
        nutrition: (foodConfig && foodConfig.nutritionPerPellet) || 100,
        radius: (foodConfig && foodConfig.pelletRadius) || 6,
        life: (foodConfig && foodConfig.decayTime) || 30
    };
    foods.push(pellet);

    // decrement counter and update UI
    if (typeof pelletCount === 'number') {
        pelletCount = Math.max(0, pelletCount - 1);
        if (counterElem) {
            counterElem.innerHTML = `${pelletCount}<span class="count-emoji">♥</span>`;
            // animate the little pop on change
            counterElem.classList.remove('counter-pop');
            // force reflow to restart animation
            void counterElem.offsetWidth;
            counterElem.classList.add('counter-pop');
            setTimeout(() => counterElem.classList.remove('counter-pop'), 420);
        }
        if (pelletCount === 0) bagElem.classList.add('empty');
        // persist the new pellet count immediately
        savePelletState();
    }
    return true;
}

export function updateFoods(deltaTime) {
    for (let i = foods.length - 1; i >= 0; i--) {
        const f = foods[i];
        if (f.life !== undefined) {
            f.life -= deltaTime;
            if (f.life <= 0) {
                foods.splice(i, 1);
            }
        }
    }
}

// OPTIMIZED drawFoods - simplified gradients
export function drawFoods(ctx) {
    if (!ctx) return;
    foods.forEach(f => {
        // Simplified gradient (fewer color stops)
        const grd = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.radius * 1.8);
        grd.addColorStop(0, 'rgba(255,200,50,0.9)');
        grd.addColorStop(1, 'rgba(200,120,20,0.7)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
        ctx.fill();

        // Simplified outline
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
    });
}

// ----- Persistence & Refill Logic -----
function scheduleRefill() {
    // Run immediately to process missed refills
    tryRefill();
    // Then schedule periodic checks (every ~1 minute)
    if (refillIntervalId) clearInterval(refillIntervalId);
    refillIntervalId = setInterval(tryRefill, Math.max(60 * 1000, REFILL_INTERVAL_MS / 6));
}

function tryRefill() {
    const now = Date.now();
    let last = lastRefillTimestamp || now;
    const elapsed = Math.max(0, now - last);
    const adds = Math.floor(elapsed / REFILL_INTERVAL_MS);
    if (adds > 0) {
        pelletCount = Math.min(MAX_PELLETS, pelletCount + adds);
        lastRefillTimestamp = last + adds * REFILL_INTERVAL_MS;
        if (counterElem) counterElem.innerHTML = `${pelletCount}<span class="count-emoji">♥</span>`;
        if (pelletCount > 0) bagElem && bagElem.classList.remove('empty');
        savePelletState();
    }
}

function savePelletState() {
    const state = { pelletCount, lastRefill: lastRefillTimestamp || Date.now() };
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        try { chrome.storage.local.set({ feederState: state }); } catch (err) {}
    } else {
        try { localStorage.setItem('feederState', JSON.stringify(state)); } catch (err) {}
    }
}

function loadPelletState() {
    return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            try {
                chrome.storage.local.get(['feederState'], (res) => {
                    if (res && res.feederState) {
                        const s = res.feederState;
                        if (typeof s.pelletCount === 'number') pelletCount = Math.min(MAX_PELLETS, Math.max(0, s.pelletCount));
                        if (s.lastRefill) lastRefillTimestamp = s.lastRefill;
                    }
                    if (counterElem) counterElem.innerHTML = `${pelletCount}<span class="count-emoji">♥</span>`;
                    if (pelletCount === 0) bagElem && bagElem.classList.add('empty');
                    resolve();
                });
            } catch (err) { resolve(); }
        } else {
            try {
                const raw = localStorage.getItem('feederState');
                if (raw) {
                    const s = JSON.parse(raw);
                    if (typeof s.pelletCount === 'number') pelletCount = Math.min(MAX_PELLETS, Math.max(0, s.pelletCount));
                    if (s.lastRefill) lastRefillTimestamp = s.lastRefill;
                }
            } catch (err) {}
            if (counterElem) counterElem.innerHTML = `${pelletCount}<span class="count-emoji">♥</span>`;
            if (pelletCount === 0) bagElem && bagElem.classList.add('empty');
            resolve();
        }
    });
}

