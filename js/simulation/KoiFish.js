import { gaussianRandom } from '../utils.js';
import { config, foodConfig } from '../config.js';
import { TrailParticle } from './TrailParticle.js';
import { ChewParticle } from './ChewParticle.js';
import { shadowState } from '../TimeTheme.js'; // Import the shared shadow state

// --- Koi Fish Class (MODIFIED) ---
export class KoiFish {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        let rawSize = gaussianRandom(config.koi.meanSize, config.koi.stdDevSize);
        this.length = Math.max(config.koi.minSize, rawSize);
        this.width = this.length / 2.5; 
        
        this.speed = Math.random() * (config.koi.maxSpeed - config.koi.minSpeed) + config.koi.minSpeed;
        this.angle = Math.random() * Math.PI * 2;
        this.targetAngle = this.angle;
        this.turnSpeed = config.koi.turnSpeed;
        
        // Track if we're currently in wall-avoidance mode to prevent recalculating every frame
        this.wasNearWall = false;

        // --- NEW: Rare Koi Check ---
        this.isRare = Math.random() < config.koi.rareKoiChance;
        
        // --- NEW: Koi Pattern Generation ---
        // 1. Assign Base and Pattern Colors
        if (this.isRare) {
            // Rare koi have special colors
            this.baseColor = ['#FFD700', '#E6E6FA', '#87CEEB'][Math.floor(Math.random() * 3)]; // Gold, lavender, sky blue
            this.patternColor1 = ['#FF1493', '#9370DB', '#20B2AA'][Math.floor(Math.random() * 3)]; // Hot pink, purple, turquoise
            this.patternColor2 = '#FFFFFF'; // White spots for rare koi
        } else {
            this.baseColor = ['#ffffff', '#f0f0f0', '#ffedd9'][Math.floor(Math.random() * 3)];
            this.patternColor1 = ['#e15759', '#f28e2b', '#d9cd5fff'][Math.floor(Math.random() * 3)];
            this.patternColor2 = Math.random() < 0.5 ? '#556672ff' : null; // 50% chance of black spots
        }

        // 2. Generate spots - REDUCED for performance
        this.spots = [];
        let spotCount = Math.floor(Math.random() * 4) + 2; // 2-6 spots per fish (reduced from 2-5)
        for (let i = 0; i < spotCount; i++) {
            // Pick a color for this spot
            let spotColor = this.patternColor1;
            if (this.patternColor2 && Math.random() < 0.3) {
                spotColor = this.patternColor2;
            }
            
            this.spots.push({
                // x/y relative to fish center
                x: (Math.random() - 0.5) * this.length * 0.85,
                y: (Math.random() - 0.5) * this.width * 0.9,
                // rX/rY for ellipse shape - slightly larger to compensate for fewer spots
                rX: Math.random() * (this.length / 4) + (this.length / 8),
                rY: Math.random() * (this.width / 3) + (this.width / 6),
                color: spotColor
            });
        }
        // --- End of Pattern Generation ---

        // Wiggle/Animation properties
        this.wiggleOffset = Math.random() * Math.PI * 2;
        this.wiggleSpeed = config.koi.wiggleSpeed;
        this.wiggleAmount = config.koi.wiggleAmount;

        // NEW: Fin animation properties
        this.finWiggleSpeed = Math.random() * 0.1 + 0.15;
        this.finWiggleOffset = Math.random() * Math.PI * 2;
        
        this.roamTimer = Math.random() * (config.physics.maxRoamTime - config.physics.minRoamTime) + config.physics.minRoamTime;
        this.trailTimer = 0;
        this.eatTimer = 0; // seconds remaining for bite animation
    }

    // --- pickNewTarget is UNCHANGED ---
    pickNewTarget(canvas) {
        const margin = config.physics.wallMargin;
        let nearWall = false;
        let targetAngleOffset = Math.PI / 4; 

        // Check corners first
        if (this.x < margin && this.y < margin) { // Top-left
            this.targetAngle = gaussianRandom(Math.PI / 4, targetAngleOffset); // Down-right
            nearWall = true;
        } else if (this.x < margin && this.y > canvas.height - margin) { // Bottom-left
            this.targetAngle = gaussianRandom(-Math.PI / 4, targetAngleOffset); // Up-right
            nearWall = true;
        } else if (this.x > canvas.width - margin && this.y < margin) { // Top-right
            this.targetAngle = gaussianRandom(3 * Math.PI / 4, targetAngleOffset); // Down-left
            nearWall = true;
        } else if (this.x > canvas.width - margin && this.y > canvas.height - margin) { // Bottom-right
            this.targetAngle = gaussianRandom(-3 * Math.PI / 4, targetAngleOffset); // Up-left
            nearWall = true;
        }
        // Check single walls
        else if (this.x < margin) {
            this.targetAngle = gaussianRandom(0, targetAngleOffset); // Point right
            nearWall = true;
        } else if (this.x > canvas.width - margin) {
            this.targetAngle = gaussianRandom(Math.PI, targetAngleOffset); // Point left
            nearWall = true;
        } else if (this.y < margin) {
            this.targetAngle = gaussianRandom(Math.PI / 2, targetAngleOffset); // Point down
            nearWall = true;
        } else if (this.y > canvas.height - margin) {
            this.targetAngle = gaussianRandom(-Math.PI / 2, targetAngleOffset); // Point up
            nearWall = true;
        }

        if (!nearWall) {
            const maxTurn = Math.PI / 3; 
            const angleOffset = (Math.random() - 0.5) * 2 * maxTurn;
            this.targetAngle += angleOffset; 
        }

        let minTime = config.physics.minRoamTime;
        let maxTime = config.physics.maxRoamTime;
        
        if(nearWall) {
            minTime /= 2;
            maxTime /= 2;
        }
        
        this.roamTimer = Math.random() * (maxTime - minTime) + minTime;
    }

    // --- update is MODIFIED (to update fins) ---
    update(canvas, others, deltaTime, mouse, particles, foods) {
        // update eat animation timer
        this.eatTimer = Math.max(0, (this.eatTimer || 0) - deltaTime);

        this.roamTimer -= deltaTime;
        if (this.roamTimer <= 0) {
            this.pickNewTarget(canvas);
        }
        let currentFrameSpeed = this.speed;

        // --- 2. Calculate Steering Vectors ---
        let roamDX = Math.cos(this.targetAngle) * config.physics.roamingForce;
        let roamDY = Math.sin(this.targetAngle) * config.physics.roamingForce;

        let wallDX = 0, wallDY = 0;
        const margin = config.physics.wallMargin;
        const wallForce = config.physics.wallForce;
        let isNearWall = false; 
        if (this.x < margin) { wallDX = Math.pow((margin - this.x) / margin, 2); isNearWall = true; }
        if (this.x > canvas.width - margin) { wallDX = -Math.pow((this.x - (canvas.width - margin)) / margin, 2); isNearWall = true; }
        if (this.y < margin) { wallDY = Math.pow((margin - this.y) / margin, 2); isNearWall = true; }
        if (this.y > canvas.height - margin) { wallDY = -Math.pow((this.y - (canvas.height - margin)) / margin, 2); isNearWall = true; }
        
        let avoidDX = 0, avoidDY = 0;
        let schoolDX = 0, schoolDY = 0;
        const avoidanceRadiusSq = Math.pow(this.length * config.physics.avoidanceRadiusMultiplier, 2);
        const schoolingRadiusSq = Math.pow(config.physics.schoolingRadius, 2);
        
        // Cache sqrt calculations for forces
        const avoidanceRadius = Math.sqrt(avoidanceRadiusSq);
        const schoolingRadius = Math.sqrt(schoolingRadiusSq);

        // OPTIMIZATION: Pre-calculate distances and sort to check nearest neighbors first
        const maxChecks = 8; // Limit collision checks to nearest 8 fish max
        const nearbyFish = [];
        
        // Quick distance check and collect nearby fish
        for (let i = 0; i < others.length; i++) {
            const other = others[i];
            if (other === this) continue;
            
            const dx = other.x - this.x;
            const dy = other.y - this.y;
            const distSq = dx * dx + dy * dy;
            
            // Only consider fish within schooling radius
            if (distSq <= schoolingRadiusSq) {
                nearbyFish.push({ other, dx, dy, distSq });
                // Early exit if we have enough fish
                if (nearbyFish.length >= maxChecks) break;
            }
        }
        
        // Process nearby fish (already sorted by discovery order, closest first)
        for (let i = 0; i < nearbyFish.length; i++) {
            const { dx, dy, distSq } = nearbyFish[i];
            
            if (distSq < avoidanceRadiusSq && distSq > 0.001) {
                const d = Math.sqrt(distSq);
                const force = Math.pow((avoidanceRadiusSq - distSq) / avoidanceRadiusSq, 2);
                avoidDX -= (dx / d) * force;
                avoidDY -= (dy / d) * force;
            }
            else if (distSq < schoolingRadiusSq && distSq > 0.001) {
                const d = Math.sqrt(distSq);
                const force = (d - avoidanceRadius) / (schoolingRadius - avoidanceRadius);
                schoolDX += (dx / d) * force;
                schoolDY += (dy / d) * force;
            }
        }

        let mouseAvoidDX = 0, mouseAvoidDY = 0;
        const mouseAvoidRadiusSq = config.physics.mouseAvoidanceRadius * config.physics.mouseAvoidanceRadius;
        const mdx = mouse.x - this.x;
        const mdy = mouse.y - this.y;
        const mouseDistSq = mdx * mdx + mdy * mdy;

        // --- MODIFIED: Removed nested if-block ---
        if (mouseDistSq < mouseAvoidRadiusSq && mouseDistSq > 0.001) {
            const d = Math.sqrt(mouseDistSq);
            // 'force' is a value from 0.0 to 1.0 based on proximity
            const force = Math.pow((mouseAvoidRadiusSq - mouseDistSq) / mouseAvoidRadiusSq, 2); 
            mouseAvoidDX -= (mdx / d) * force;
            mouseAvoidDY -= (mdy / d) * force;

            // Increase speed based on proximity
            const maxBoost = this.speed * config.physics.mouseFleeSpeedMultiplier;
            currentFrameSpeed = this.speed + (maxBoost * force);
        }
        // --- End of modification ---

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        let normDX = (centerX - this.x) / centerX;
        let normDY = (centerY - this.y) / centerY;
        let centerDX = normDX * normDX * normDX; 
        let centerDY = normDY * normDY * normDY;

    // Food attraction: fish are drawn to nearby food pellets
        let foodDX = 0, foodDY = 0;
        let nearestFood = null;
        let nearestFoodDistSq = Infinity;
        if (foods && foods.length) {
            const attractRadiusSq = Math.pow(foodConfig.attractRadius, 2);
            for (let f of foods) {
                const dx = f.x - this.x;
                const dy = f.y - this.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < nearestFoodDistSq) {
                    nearestFoodDistSq = distSq;
                    nearestFood = f;
                }
                if (distSq < attractRadiusSq && distSq > 0.001) {
                    const d = Math.sqrt(distSq);
                    const strength = 1 - (d / foodConfig.attractRadius);
                    foodDX += (dx / d) * strength;
                    foodDY += (dy / d) * strength;
                }
            }
        }

        // If there's a food pellet present, the fish will prioritize it and
        // temporarily ignore wall avoidance so it can chase the pellet even
        // if that means moving near the edge; once pellets are gone, normal
        // wall avoidance resumes.
        const isChasingFood = !!nearestFood;

        // --- 3. Combine All Vectors ---
        let finalDX, finalDY;
        
        if (isNearWall && !isChasingFood) {
            // When fish first enters wall zone, nudge targetAngle away from wall
            // This only happens once per wall encounter, not every frame
            if (!this.wasNearWall) {
                // Calculate the angle away from wall
                const wallRepelAngle = Math.atan2(wallDY, wallDX);
                
                // Instead of setting target directly to wall angle, blend it with current target
                // This prevents ping-ponging by keeping some of the original direction
                let angleDiff = wallRepelAngle - this.targetAngle;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                
                // Only adjust by 30-60 degrees toward the safe direction
                const adjustAmount = 0.5; // 50% blend
                this.targetAngle += angleDiff * adjustAmount;
                
                this.roamTimer = Math.random() * 3 + 2; // Give fish 2-5 seconds with this direction
                this.wasNearWall = true;
            }
            
            // Use wall force to steer
            finalDX = wallDX * wallForce + 
                      roamDX + // Still include roaming to the adjusted target
                      avoidDX * config.physics.avoidanceForce +
                      mouseAvoidDX * config.physics.mouseAvoidanceForce;
            finalDY = wallDY * wallForce + 
                      roamDY + // Still include roaming to the adjusted target
                      avoidDY * config.physics.avoidanceForce +
                      mouseAvoidDY * config.physics.mouseAvoidanceForce;
        } else {
            // Reset the wall flag when fish leaves the wall zone
            this.wasNearWall = false;
            // Either not near a wall, or we are chasing food: allow food attraction
            // to override wall avoidance. Other avoidance (other fish) still applies.
            finalDX = roamDX + 
                      avoidDX * config.physics.avoidanceForce + 
                      schoolDX * config.physics.schoolingForce +
                      centerDX * config.physics.centeringForce +
                      mouseAvoidDX * config.physics.mouseAvoidanceForce +
                      (foodDX * foodConfig.attractForce);
            finalDY = roamDY + 
                      avoidDY * config.physics.avoidanceForce + 
                      schoolDY * config.physics.schoolingForce +
                      centerDY * config.physics.centeringForce +
                      mouseAvoidDX * config.physics.mouseAvoidanceForce +
                      (foodDY * foodConfig.attractForce);
        }

        // --- 4. Update Angle ---
        if (Math.abs(finalDX) > 0.01 || Math.abs(finalDY) > 0.01) {
            let desiredAngle = Math.atan2(finalDY, finalDX);
            let angleDiff = desiredAngle - this.angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            this.angle += angleDiff * this.turnSpeed;
        }
        
        // --- 5. Update Position & Animation ---
        this.wiggleOffset += this.wiggleSpeed;
        this.finWiggleOffset += this.finWiggleSpeed; // NEW: Update fin animation
        this.x += Math.cos(this.angle) * currentFrameSpeed;
        this.y += Math.sin(this.angle) * currentFrameSpeed;

        // Failsafe
        if (this.x < 0) { this.x = 0; this.targetAngle = 0; }
        if (this.x > canvas.width) { this.x = canvas.width; this.targetAngle = Math.PI; }
        if (this.y < 0) { this.y = 0; this.targetAngle = Math.PI / 2; }
        if (this.y > canvas.height) { this.y = canvas.height; this.targetAngle = -Math.PI / 2; }

        // --- 6. Spawn Trail Particles ---
        this.trailTimer -= deltaTime;
        if (this.trailTimer <= 0) {
            const bodyBend = Math.sin(this.wiggleOffset) * this.wiggleAmount * this.width;
            const tailBaseX = -this.length / 2;
            const rotatedTailX = Math.cos(this.angle) * tailBaseX - Math.sin(this.angle) * bodyBend;
            const rotatedTailY = Math.sin(this.angle) * tailBaseX + Math.cos(this.angle) * bodyBend;
            particles.push(new TrailParticle(this.x + rotatedTailX, this.y + rotatedTailY, config.koiTrail));
            this.trailTimer = config.koiTrail.spawnRate;
        }

        // Eating logic: if fish is near a food pellet, consume it
        if (nearestFood && nearestFoodDistSq <= Math.pow(foodConfig.eatDistance, 2)) {
            // Reduce nutrition based on time; faster at close range
            const eatAmount = 60 * deltaTime; // nutrition per second equivalent
            nearestFood.nutrition -= eatAmount;
            // trigger bite animation
            this.eatTimer = Math.max(this.eatTimer, 0.35);
            if (nearestFood.nutrition <= 0) {
                const idx = foods.indexOf(nearestFood);
                if (idx >= 0) foods.splice(idx, 1);
                
                // spawn some trail particles and chew particles to indicate eating
                for (let i = 0; i < 4; i++) {
                    particles.push(new TrailParticle(this.x, this.y, config.koiTrail));
                }
                for (let i = 0; i < 6; i++) {
                    particles.push(new ChewParticle(this.x, this.y));
                }
            }
        }
    }

    // --- draw method - MODIFIED FOR DYNAMIC TIME SHADOWS ---
    draw(ctx, performanceMode = false, timestamp = 0) {
        // Body wiggle calculations (cache these for reuse)
        const bodyBend = Math.sin(this.wiggleOffset) * this.wiggleAmount * this.width;
        const tailBend = Math.sin(this.wiggleOffset - 0.8) * this.wiggleAmount * config.koi.tailAmplitude * this.width;

        const headX = this.length / 2;
        const tailBaseX = -this.length / 2;
        const tailBaseY = bodyBend;

        // --- 0. DRAW SHADOW PASS (Dynamic Time-Based) ---
        // Instead of a fixed offset, we use the shared shadowState
        if (!performanceMode) {
            ctx.save();
            
            // Apply dynamic global offset (sun rotation)
            ctx.translate(this.x + shadowState.x, this.y + shadowState.y);
            ctx.rotate(this.angle); 

            // Draw Body Silhouette
            ctx.beginPath();
            ctx.moveTo(headX, 0);
            ctx.quadraticCurveTo(0, this.width, tailBaseX, tailBaseY);
            ctx.quadraticCurveTo(0, -this.width, headX, 0);
            
            // Draw Tail Silhouette
            const tailEndX = tailBaseX - this.length * 0.4;
            const tailWidth = this.width * 1.5;
            ctx.moveTo(tailBaseX, tailBaseY);
            ctx.quadraticCurveTo(
                tailBaseX - this.length * 0.2, tailBaseY + tailWidth * 0.5, 
                tailEndX, tailBaseY + tailBend
            );
            ctx.quadraticCurveTo(
                tailBaseX - this.length * 0.2, tailBaseY - tailWidth * 0.5,
                tailBaseX, tailBaseY
            );
            
            // Fill Shadow with dynamic color/opacity
            ctx.fillStyle = shadowState.color; 
            
            ctx.fill();
            ctx.restore();
        }

        // --- MAIN FISH DRAWING ---
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        // FAKE GLOW for Rare Fish (Only in normal mode)
        if (!performanceMode && this.isRare) {
            const sparkleTime = timestamp * 0.003;
            const sparkleIntensity = (Math.sin(sparkleTime) + 1) * 0.5;
            
            // Inner brighter glow
            ctx.fillStyle = this.patternColor1;
            ctx.globalAlpha = 0.15 + sparkleIntensity * 0.15;
            ctx.beginPath();
            ctx.ellipse(0, 0, this.length * 0.5, this.width * 0.95, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }
        
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1;

        // Eating mouth indicator
        if (this.eatTimer > 0) {
            const animT = Math.max(0, Math.min(1, this.eatTimer / 0.35));
            const mouthFactor = Math.sin((1 - animT) * Math.PI) * 1.2;
            const mouthRx = Math.max(1, mouthFactor * (this.width * 0.25));
            const mouthRy = mouthRx * 0.6;
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.beginPath();
            ctx.ellipse(headX + 2, 0, mouthRx, mouthRy, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // --- 1. Define Body Shape (for clipping) ---
        ctx.beginPath();
        ctx.moveTo(headX, 0);
        ctx.quadraticCurveTo(0, this.width, tailBaseX, tailBaseY);
        ctx.quadraticCurveTo(0, -this.width, headX, 0);
        
        // --- 2. Draw Body Shape (Base Color) ---
        ctx.fillStyle = this.baseColor;
        ctx.fill();
        ctx.stroke();

        // --- 3. Draw Patterns (Clipped) ---
        ctx.save();
        ctx.clip();
        
        const wiggleBase = this.wiggleAmount * this.width;
        
        this.spots.forEach(spot => {
            // Calculate the spot's bent position
            let spinePercent = (spot.x + this.length / 2) / this.length;
            // Apply the same sine wave bending, scaled by its position
            let bentY = spot.y + Math.sin(this.wiggleOffset + (spinePercent * 2 - 1)) * wiggleBase;

            ctx.fillStyle = spot.color;
            ctx.beginPath();
            ctx.ellipse(spot.x, bentY, spot.rX, spot.rY, 0, 0, Math.PI * 2);
            ctx.fill();
        });
        
        ctx.restore();

        // --- 4. Draw Tail Fin ---
        ctx.fillStyle = this.patternColor1;
        ctx.beginPath();
        const tailEndX = tailBaseX - this.length * 0.4;
        const tailWidth = this.width * 1.5;
        ctx.moveTo(tailBaseX, tailBaseY);
        ctx.quadraticCurveTo(
            tailBaseX - this.length * 0.2, tailBaseY + tailWidth * 0.5, 
            tailEndX, tailBaseY + tailBend
        );
        ctx.quadraticCurveTo(
            tailBaseX - this.length * 0.2, tailBaseY - tailWidth * 0.5,
            tailBaseX, tailBaseY
        );
        ctx.fill();
        ctx.stroke();
        
        // --- 5. Draw Pectoral Fins (Animated) ---
        const finFlap = Math.sin(this.finWiggleOffset) * 0.3 + 0.9;
        ctx.fillStyle = this.patternColor1;
        ctx.globalAlpha = 0.7;
        
        // Top fin
        ctx.beginPath();
        ctx.ellipse(0, this.width * 0.8, this.length * 0.15, this.width * 0.3, Math.PI * 0.2 * finFlap, 0, Math.PI * 2);
        ctx.fill();
        
        // Bottom fin
        ctx.beginPath();
        ctx.ellipse(0, -this.width * 0.8, this.length * 0.15, this.width * 0.3, -Math.PI * 0.2 * finFlap, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.globalAlpha = 1.0;

        // --- 6. Draw Eyes ---
        ctx.fillStyle = '#111';
        // Top eye
        ctx.beginPath();
        ctx.arc(headX * 0.7, this.width * 0.1, this.width * 0.08, 0, Math.PI * 2); 
        ctx.fill();
        // Bottom eye
        ctx.beginPath();
        ctx.arc(headX * 0.7, -this.width * 0.1, this.width * 0.08, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
}
