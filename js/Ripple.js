// --- js/Ripple.js - OPTIMIZED ---

export class Ripple {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 0;
        this.maxRadius = 120; // Reduced from 150
        this.opacity = 1;
        this.speed = 2.2; // Slightly faster
        this.lineWidth = 2; // Thinner line
    }

    update(deltaTime) {
        this.radius += this.speed * (deltaTime * 60);
        this.opacity = Math.max(0, 1 - (this.radius / this.maxRadius));
    }

    draw(ctx) {
        if (this.opacity <= 0) return;

        ctx.save();
        // Single ripple only (removed second inner ripple for performance)
        ctx.strokeStyle = `rgba(200, 220, 240, ${this.opacity * 0.5})`;
        ctx.lineWidth = this.lineWidth;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    isFinished() {
        return this.radius >= this.maxRadius;
    }
}
