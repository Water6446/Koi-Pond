// --- js/Dragonfly.js ---

export class Dragonfly {
    constructor(canvasWidth, canvasHeight) {
        // Pick a random edge to start from: 0=top, 1=right, 2=bottom, 3=left
        const startEdge = Math.floor(Math.random() * 4);
        
        // Set starting position based on edge
        switch (startEdge) {
            case 0: // Top
                this.x = Math.random() * canvasWidth;
                this.y = -50;
                break;
            case 1: // Right
                this.x = canvasWidth + 50;
                this.y = Math.random() * canvasHeight;
                break;
            case 2: // Bottom
                this.x = Math.random() * canvasWidth;
                this.y = canvasHeight + 50;
                break;
            case 3: // Left
                this.x = -50;
                this.y = Math.random() * canvasHeight;
                break;
        }
        
        // Pick a random edge to fly to (different from start)
        let targetEdge;
        do {
            targetEdge = Math.floor(Math.random() * 4);
        } while (targetEdge === startEdge);
        
        // Set target position based on edge
        switch (targetEdge) {
            case 0: // Top
                this.targetX = Math.random() * canvasWidth;
                this.targetY = -50;
                break;
            case 1: // Right
                this.targetX = canvasWidth + 50;
                this.targetY = Math.random() * canvasHeight;
                break;
            case 2: // Bottom
                this.targetX = Math.random() * canvasWidth;
                this.targetY = canvasHeight + 50;
                break;
            case 3: // Left
                this.targetX = -50;
                this.targetY = Math.random() * canvasHeight;
                break;
        }
        
        this.speed = 1.5 + Math.random() * 1.0;
        this.size = 12 + Math.random() * 8;
        this.wingBeat = 0;
        this.wingSpeed = 0.3;
        this.hue = 180 + Math.random() * 60; // Blue-green range
        
        // Calculate direction
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        this.vx = (dx / dist) * this.speed;
        this.vy = (dy / dist) * this.speed;
        
        // Fluttering motion
        this.flutterOffset = 0;
        this.flutterSpeed = 0.05;
        this.flutterAmount = 15;
    }

    update(deltaTime) {
        const dt = deltaTime * 60; // Normalize to 60fps
        
        // Move toward target
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        
        // Add flutter
        this.flutterOffset += this.flutterSpeed * dt;
        const flutter = Math.sin(this.flutterOffset) * this.flutterAmount;
        this.y += flutter * deltaTime;
        
        // Wing beat animation
        this.wingBeat += this.wingSpeed * dt;
    }

    // OPTIMIZED draw method - simplified rendering
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        const angle = Math.atan2(this.vy, this.vx);
        ctx.rotate(angle);
        
        const wingAngle = Math.sin(this.wingBeat) * 0.4; // Reduced from 0.5
        
        // Body
        ctx.fillStyle = `hsl(${this.hue}, 65%, 40%)`;
        ctx.beginPath();
        ctx.ellipse(0, 0, this.size * 0.7, this.size * 0.13, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Head
        ctx.beginPath();
        ctx.arc(this.size * 0.6, 0, this.size * 0.18, 0, Math.PI * 2);
        ctx.fill();
        
        // Simplified wings (no stroke for performance)
        ctx.fillStyle = `hsla(${this.hue}, 45%, 75%, 0.35)`;
        
        // Top wings (simplified - no nested transforms)
        ctx.beginPath();
        ctx.ellipse(this.size * 0.2, -this.size * 0.3 + wingAngle * 10, this.size * 0.5, this.size * 0.2, -0.3, 0, Math.PI * 2);
        ctx.fill();
        
        // Bottom wings (simplified - no nested transforms)
        ctx.beginPath();
        ctx.ellipse(this.size * 0.2, this.size * 0.3 - wingAngle * 10, this.size * 0.5, this.size * 0.2, 0.3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }

    isOffScreen(canvasWidth, canvasHeight) {
        return (
            this.x < -100 || this.x > canvasWidth + 100 ||
            this.y < -100 || this.y > canvasHeight + 100
        );
    }
}
