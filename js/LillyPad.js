import { gaussianRandom } from './utils.js';
import { config } from './config.js';
import { TrailParticle } from './TrailParticle.js';
import { shadowState } from './TimeTheme.js'; // Import the shared shadow state

// --- LillyPad Class (REFACTORED) ---
export class LillyPad {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        let rawSize = gaussianRandom(config.lillypad.meanSize, config.lillypad.stdDevSize);
        this.size = Math.max(config.lillypad.minSize, rawSize);
        this.radius = this.size / 2; // Base radius for drawing
        
        this.isDragging = false;
        this.trailTimer = 0;
        this.lastX = x;
        this.lastY = y;
        this.rotation = Math.random() * Math.PI * 2; // Use radians for canvas

        // --- NEW: Determine pad type ---
        this.type = 'pad'; // Default
        this.color = config.lillypad.colorBody;
        this.altColor = config.lillypad.colorBodyAlt;

        const typeRoll = Math.random();
        const flowerChance = config.lillypad.spawnChanceFlower;
        const semiPadChance = config.lillypad.spawnChanceSemiPad;

        if (typeRoll < flowerChance) {
            this.type = 'flower';
        } else if (typeRoll < flowerChance + semiPadChance) {
            this.type = 'semi-pad';
        } else {
            // Normal pad, check for alt color
            if (Math.random() < 0.3) {
                this.type = 'pad-alt';
                this.color = this.altColor;
            }
        }
    }

    update(deltaTime, particles) {
        // Trail logic is unchanged
        if (this.isDragging) {
            const dx = this.x - this.lastX;
            const dy = this.y - this.lastY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            this.trailTimer -= deltaTime;
            if (this.trailTimer <= 0 && dist > 1) { 
                particles.push(new TrailParticle(this.x, this.y, config.lillyTrail));
                this.trailTimer = config.lillyTrail.spawnRate;
            }
        }
        this.lastX = this.x;
        this.lastY = this.y;
    }
    
    // --- OPTIMIZED draw method - with dynamic shadows ---
    draw(ctx, flowerImage) {
        const r = this.radius;

        // --- 1. SHADOW PASS (Dynamic Time-Based) ---
        // Draw shadow first with global offset (sun rotation) and no blur
        ctx.save();
        ctx.translate(this.x + shadowState.x, this.y + shadowState.y); 
        ctx.rotate(this.rotation);
        
        // Since all pad types in this code form a circular footprint,
        // we draw a simple circle shadow.
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = shadowState.color; // Dynamic color/opacity
        ctx.fill();
        ctx.restore();

        // --- 2. MAIN DRAW PASS ---
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // Draw based on type
        switch (this.type) {
            case 'semi-pad':
                // Left half
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(0, 0, r, Math.PI / 2, -Math.PI / 2, false);
                ctx.closePath();
                ctx.fill();
                
                // Right half
                ctx.fillStyle = this.altColor;
                ctx.beginPath();
                ctx.arc(0, 0, r, Math.PI / 2, -Math.PI / 2, true);
                ctx.closePath();
                ctx.fill();
                break;

            case 'flower':
                // Base pad
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(0, 0, r, 0, Math.PI * 2);
                ctx.fill();
                
                // Draw the loaded SVG image
                if (flowerImage) {
                    const flowerSize = r * 1.4; // Slightly smaller for performance
                    ctx.drawImage(
                        flowerImage, 
                        -flowerSize / 2,
                        -flowerSize / 2,
                        flowerSize,
                        flowerSize
                    );
                } else {
                    // Simplified fallback flower
                    ctx.fillStyle = '#f7b7da';
                    ctx.beginPath();
                    ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#ff8976';
                    ctx.beginPath();
                    ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
                
            case 'pad-alt':
                ctx.fillStyle = this.altColor;
                ctx.beginPath();
                ctx.arc(0, 0, r, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'pad':
            default:
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(0, 0, r, 0, Math.PI * 2);
                ctx.fill();
                break;
        }

        ctx.restore();
    }
}