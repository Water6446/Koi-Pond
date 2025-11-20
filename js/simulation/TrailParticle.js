// --- Trail Particle Class ---
export class TrailParticle {
    constructor(x, y, trailConfig) {
        this.config = trailConfig;
        this.x = x + (Math.random() - 0.5) * this.config.jitter;
        this.y = y + (Math.random() - 0.5) * this.config.jitter;
        this.startSize = Math.random() * (this.config.maxSize - this.config.minSize) + this.config.minSize;
        this.maxLife = Math.random() * (this.config.maxLifespan - this.config.minLifespan) + this.config.minLifespan;
        this.life = this.maxLife;
        this.vx = (Math.random() - 0.5) * this.config.drift;
        this.vy = (Math.random() - 0.5) * this.config.drift;
    }

    update(deltaTime) {
        this.life -= deltaTime;
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        const lifePercent = this.life / this.maxLife;
        const opacity = lifePercent * this.config.maxOpacity;
        const currentSize = this.startSize * lifePercent;
        
        ctx.fillStyle = `${this.config.color}${opacity})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, currentSize, 0, Math.PI * 2);
        ctx.fill();
    }
}