export class ChewParticle {
    constructor(x, y) {
        this.x = x + (Math.random() - 0.5) * 8;
        this.y = y + (Math.random() - 0.5) * 8;
        this.vx = (Math.random() - 0.5) * 80;
        this.vy = -Math.random() * 40 - 10;
        this.life = 0.6 + Math.random() * 0.4;
        this.maxLife = this.life;
        this.size = 2 + Math.random() * 3;
        this.color = `rgba(255,${180 + Math.floor(Math.random()*50)},60,`;
    }

    update(deltaTime) {
        this.life -= deltaTime;
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
        // gravity
        this.vy += 120 * deltaTime;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        const t = this.life / this.maxLife;
        const alpha = Math.max(0, t);
        ctx.fillStyle = `${this.color}${alpha})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * (1 - t), 0, Math.PI * 2);
        ctx.fill();
    }
}
