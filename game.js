// Kelmans Tanks vs Zombies - Main Game File

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State
const GameState = {
    MENU: 'menu',
    DIFFICULTY: 'difficulty',
    PLAYING: 'playing',
    UPGRADE: 'upgrade',
    GAMEOVER: 'gameover'
};

let currentState = GameState.MENU;
let animationId;
let lastTime = 0;
let selectedDifficulty = 'medium';

// Screen Elements
const startScreen = document.getElementById('startScreen');
const difficultyScreen = document.getElementById('difficultyScreen');
const upgradeScreen = document.getElementById('upgradeScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const hud = document.getElementById('hud');
const mobileControls = document.getElementById('mobileControls');

// Check if mobile
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 800;

// Canvas sizing
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ==================== AUDIO SYSTEM ====================

class SoundManager {
    constructor() {
        this.ctx = null;
        this.initialized = false;
        this.sounds = {};
    }

    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
        } catch (e) {
            console.log('Audio not supported');
        }
    }

    playTone(freq, duration, type = 'square', volume = 0.1) {
        if (!this.initialized || !this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + duration);
    }

    // Pew pew pew sound!
    shoot() {
        // Rapid descending tones for "pew" effect
        this.playTone(1200, 0.05, 'sawtooth', 0.06);
        setTimeout(() => this.playTone(900, 0.06, 'sawtooth', 0.05), 30);
        setTimeout(() => this.playTone(600, 0.08, 'sawtooth', 0.04), 60);
    }

    explosion() {
        this.playTone(150, 0.3, 'sawtooth', 0.15);
        setTimeout(() => this.playTone(100, 0.4, 'sawtooth', 0.1), 50);
    }

    laser() {
        this.playTone(600, 0.1, 'sine', 0.08);
        setTimeout(() => this.playTone(800, 0.1, 'sine', 0.08), 50);
        setTimeout(() => this.playTone(1000, 0.1, 'sine', 0.08), 100);
    }

    hit() {
        this.playTone(200, 0.1, 'square', 0.08);
    }

    zombieDeath() {
        this.playTone(100, 0.15, 'sawtooth', 0.06);
    }

    upgrade() {
        this.playTone(523, 0.1, 'sine', 0.1);
        setTimeout(() => this.playTone(659, 0.1, 'sine', 0.1), 100);
        setTimeout(() => this.playTone(784, 0.2, 'sine', 0.1), 200);
    }

    bossHit() {
        this.playTone(80, 0.2, 'sawtooth', 0.12);
    }

    // Celebration music after boss defeat
    celebration() {
        const notes = [523, 659, 784, 1047, 784, 1047];
        const durations = [0.15, 0.15, 0.15, 0.3, 0.15, 0.4];
        let delay = 0;
        notes.forEach((note, i) => {
            setTimeout(() => this.playTone(note, durations[i], 'sine', 0.12), delay);
            delay += durations[i] * 1000;
        });
    }

    gameOver() {
        this.playTone(400, 0.3, 'sawtooth', 0.1);
        setTimeout(() => this.playTone(300, 0.3, 'sawtooth', 0.1), 300);
        setTimeout(() => this.playTone(200, 0.5, 'sawtooth', 0.1), 600);
    }

    coin() {
        this.playTone(1200, 0.05, 'sine', 0.08);
        setTimeout(() => this.playTone(1600, 0.1, 'sine', 0.08), 50);
    }
}

const soundManager = new SoundManager();

// ==================== INPUT HANDLING ====================
const keys = {};
const mouse = { x: 0, y: 0, down: false };

// Keyboard
window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) {
        e.preventDefault();
    }

    if (currentState === GameState.PLAYING) {
        if (e.key.toLowerCase() === 'b') game.useBomb();
        if (e.key.toLowerCase() === 'l') game.useLaser();
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

// Mouse
window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

window.addEventListener('mousedown', () => {
    mouse.down = true;
    soundManager.init();
});

window.addEventListener('mouseup', () => {
    mouse.down = false;
});

// Mobile Joysticks
const moveJoystick = { active: false, x: 0, y: 0, dx: 0, dy: 0 };
const aimJoystick = { active: false, x: 0, y: 0, dx: 0, dy: 0 };

function setupJoystick(elementId, joystickObj, isLeft) {
    const el = document.getElementById(elementId);
    const knob = el.querySelector('.knob');

    const handleStart = (e) => {
        e.preventDefault();
        soundManager.init();
        const touch = e.touches[0];
        const rect = el.getBoundingClientRect();
        joystickObj.active = true;
        joystickObj.x = rect.left + rect.width / 2;
        joystickObj.y = rect.top + rect.height / 2;
    };

    const handleMove = (e) => {
        if (!joystickObj.active) return;
        e.preventDefault();
        const touch = e.touches[0];
        const maxDist = 35;
        let dx = touch.clientX - joystickObj.x;
        let dy = touch.clientY - joystickObj.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > maxDist) {
            dx = (dx / dist) * maxDist;
            dy = (dy / dist) * maxDist;
        }

        joystickObj.dx = dx / maxDist;
        joystickObj.dy = dy / maxDist;

        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    };

    const handleEnd = (e) => {
        e.preventDefault();
        joystickObj.active = false;
        joystickObj.dx = 0;
        joystickObj.dy = 0;
        knob.style.transform = 'translate(-50%, -50%)';
    };

    el.addEventListener('touchstart', handleStart, { passive: false });
    el.addEventListener('touchmove', handleMove, { passive: false });
    el.addEventListener('touchend', handleEnd, { passive: false });
}

if (isMobile) {
    setupJoystick('moveJoystick', moveJoystick, true);
    setupJoystick('aimJoystick', aimJoystick, false);

    document.getElementById('bombBtn').addEventListener('touchstart', (e) => {
        e.preventDefault();
        soundManager.init();
        game.useBomb();
    });

    document.getElementById('laserBtn').addEventListener('touchstart', (e) => {
        e.preventDefault();
        soundManager.init();
        game.useLaser();
    });
}

// ==================== GAME CLASSES ====================

class Vector2 {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    add(v) { return new Vector2(this.x + v.x, this.y + v.y); }
    sub(v) { return new Vector2(this.x - v.x, this.y - v.y); }
    mult(s) { return new Vector2(this.x * s, this.y * s); }
    mag() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    normalize() {
        const m = this.mag();
        return m === 0 ? new Vector2(0, 0) : new Vector2(this.x / m, this.y / m);
    }
    dist(v) { return Math.sqrt((this.x - v.x) ** 2 + (this.y - v.y) ** 2); }
}

class Particle {
    constructor(x, y, color, speed, life) {
        this.pos = new Vector2(x, y);
        const angle = Math.random() * Math.PI * 2;
        this.vel = new Vector2(Math.cos(angle) * speed, Math.sin(angle) * speed);
        this.color = color;
        this.life = life;
        this.maxLife = life;
        this.size = Math.random() * 4 + 2;
    }

    update(dt) {
        this.pos = this.pos.add(this.vel.mult(dt * 60));
        this.life -= dt;
        this.size *= 0.98;
    }

    draw(ctx) {
        const alpha = this.life / this.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

class FloatingText {
    constructor(x, y, text, color) {
        this.pos = new Vector2(x, y);
        this.text = text;
        this.color = color;
        this.life = 1.0;
        this.maxLife = 1.0;
        this.velY = -1.5;
    }

    update(dt) {
        this.pos.y += this.velY * dt * 60;
        this.life -= dt;
    }

    draw(ctx) {
        const alpha = this.life / this.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.text, this.pos.x, this.pos.y);
        ctx.globalAlpha = 1;
    }
}

// Bullet that bounces off screen edges
class Bullet {
    constructor(x, y, angle, damage, speed) {
        this.pos = new Vector2(x, y);
        this.vel = new Vector2(Math.cos(angle) * speed, Math.sin(angle) * speed);
        this.damage = damage;
        this.radius = 4;
        this.life = 3;
        this.bounces = 0;
        this.maxBounces = 2;
    }

    update(dt) {
        this.pos = this.pos.add(this.vel.mult(dt * 60));
        this.life -= dt;

        // Bounce off screen edges
        if (this.pos.x - this.radius < 0) {
            this.pos.x = this.radius;
            this.vel.x = Math.abs(this.vel.x);
            this.bounces++;
        } else if (this.pos.x + this.radius > canvas.width) {
            this.pos.x = canvas.width - this.radius;
            this.vel.x = -Math.abs(this.vel.x);
            this.bounces++;
        }

        if (this.pos.y - this.radius < 0) {
            this.pos.y = this.radius;
            this.vel.y = Math.abs(this.vel.y);
            this.bounces++;
        } else if (this.pos.y + this.radius > canvas.height) {
            this.pos.y = canvas.height - this.radius;
            this.vel.y = -Math.abs(this.vel.y);
            this.bounces++;
        }

        // Die after max bounces
        if (this.bounces > this.maxBounces) {
            this.life = 0;
        }
    }

    draw(ctx) {
        ctx.fillStyle = '#ffd700';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff69b4';
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

// Instant dramatic bomb with upgradeable radius
class Bomb {
    constructor(x, y, explosionRadius) {
        this.pos = new Vector2(x, y);
        this.explosionRadius = explosionRadius || 150;
        this.exploded = false;
        this.explosionCurrentRadius = 0;
        this.life = 0.6; // Short life for explosion animation
        this.shakeAmount = 15;

        // Explode immediately!
        this.explode();
    }

    explode() {
        this.exploded = true;
        game.addExplosion(this.pos.x, this.pos.y, this.explosionRadius, '#ff4500');
        game.addExplosion(this.pos.x, this.pos.y, this.explosionRadius * 0.7, '#ff8800');
        game.shakeAmount = this.shakeAmount;
        soundManager.explosion();

        // Extra particles for drama
        for (let i = 0; i < 40; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 8 + 3;
            game.particles.push(new Particle(
                this.pos.x, this.pos.y,
                Math.random() > 0.5 ? '#ff4500' : '#ff8800',
                speed, Math.random() * 0.8 + 0.3
            ));
        }
    }

    update(dt) {
        if (this.exploded) {
            this.explosionCurrentRadius += dt * 500;
            this.life -= dt;
        }
    }

    draw(ctx) {
        if (this.exploded && this.life > 0) {
            // Outer explosion ring
            ctx.globalAlpha = Math.max(0, this.life / 0.6) * 0.5;
            ctx.fillStyle = '#ff4500';
            ctx.beginPath();
            ctx.arc(this.pos.x, this.pos.y, this.explosionCurrentRadius, 0, Math.PI * 2);
            ctx.fill();

            // Inner bright core
            ctx.globalAlpha = Math.max(0, this.life / 0.6) * 0.8;
            ctx.fillStyle = '#ff8800';
            ctx.beginPath();
            ctx.arc(this.pos.x, this.pos.y, this.explosionCurrentRadius * 0.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = 1;
        }
    }
}

// Laser that follows the turret
class Laser {
    constructor(player, duration) {
        this.player = player;
        this.duration = duration;
        this.life = duration;
        this.length = 2000;
        this.width = 8;
    }

    update(dt) {
        this.life -= dt;
    }

    draw(ctx) {
        const alpha = this.life / this.duration;
        const startX = this.player.pos.x + Math.cos(this.player.angle) * 35;
        const startY = this.player.pos.y + Math.sin(this.player.angle) * 35;
        const endX = startX + Math.cos(this.player.angle) * this.length;
        const endY = startY + Math.sin(this.player.angle) * this.length;

        ctx.globalAlpha = alpha * 0.8;
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = this.width;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#00ff00';
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = this.width / 2;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }

    getLine() {
        const startX = this.player.pos.x + Math.cos(this.player.angle) * 35;
        const startY = this.player.pos.y + Math.sin(this.player.angle) * 35;
        return {
            x1: startX,
            y1: startY,
            x2: startX + Math.cos(this.player.angle) * this.length,
            y2: startY + Math.sin(this.player.angle) * this.length
        };
    }
}

class Coin {
    constructor(x, y, value) {
        this.pos = new Vector2(x, y);
        this.value = value;
        this.radius = 6;
        this.life = 8;
        this.bobOffset = Math.random() * Math.PI * 2;
    }

    update(dt) {
        this.life -= dt;
        // Move toward player if close
        if (game.player) {
            const dist = this.pos.dist(game.player.pos);
            if (dist < 100) {
                const dir = game.player.pos.sub(this.pos).normalize();
                this.pos = this.pos.add(dir.mult(3 * dt * 60));
            }
        }
    }

    draw(ctx) {
        const bob = Math.sin(Date.now() / 200 + this.bobOffset) * 3;
        ctx.fillStyle = '#ffd700';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ffd700';
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y + bob, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Dollar sign
        ctx.fillStyle = '#b8860b';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('$', this.pos.x, this.pos.y + bob + 3);
    }
}

class Zombie {
    constructor(x, y, type, wave, difficultyMultiplier) {
        this.pos = new Vector2(x, y);
        this.type = type;
        this.wave = wave;

        const difficulty = 1 + (wave - 1) * 0.3;

        switch(type) {
            case 'fast':
                this.speed = 2.5 * difficulty * difficultyMultiplier;
                this.hp = 30 * difficulty;
                this.maxHp = this.hp;
                this.radius = 15;
                this.color = '#ff1493';
                this.score = 20;
                this.money = 5;
                break;
            case 'tank':
                this.speed = 0.8 * difficulty * difficultyMultiplier;
                this.hp = 100 * difficulty;
                this.maxHp = this.hp;
                this.radius = 25;
                this.color = '#8b008b';
                this.score = 50;
                this.money = 15;
                break;
            default: // normal
                this.speed = 1.5 * difficulty * difficultyMultiplier;
                this.hp = 50 * difficulty;
                this.maxHp = this.hp;
                this.radius = 18;
                this.color = '#da70d6';
                this.score = 10;
                this.money = 10;
        }

        this.damage = 4 * difficulty * difficultyMultiplier;
        this.attackCooldown = 0;
    }

    update(dt, playerPos) {
        const dir = playerPos.sub(this.pos).normalize();
        this.pos = this.pos.add(dir.mult(this.speed * dt * 60));

        if (this.attackCooldown > 0) this.attackCooldown -= dt;
    }

    draw(ctx) {
        // Body
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Eyes
        ctx.fillStyle = '#00ff00';
        const angle = Math.atan2(game.player.pos.y - this.pos.y, game.player.pos.x - this.pos.x);
        ctx.beginPath();
        ctx.arc(this.pos.x + Math.cos(angle - 0.3) * this.radius * 0.5,
                this.pos.y + Math.sin(angle - 0.3) * this.radius * 0.5, 3, 0, Math.PI * 2);
        ctx.arc(this.pos.x + Math.cos(angle + 0.3) * this.radius * 0.5,
                this.pos.y + Math.sin(angle + 0.3) * this.radius * 0.5, 3, 0, Math.PI * 2);
        ctx.fill();

        // Health bar
        if (this.hp < this.maxHp) {
            const barWidth = this.radius * 2;
            const barHeight = 4;
            ctx.fillStyle = '#333';
            ctx.fillRect(this.pos.x - barWidth/2, this.pos.y - this.radius - 8, barWidth, barHeight);
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(this.pos.x - barWidth/2, this.pos.y - this.radius - 8, barWidth * (this.hp / this.maxHp), barHeight);
        }
    }

    takeDamage(damage) {
        this.hp -= damage;
        return this.hp <= 0;
    }
}

class Boss {
    constructor(wave, difficultyMultiplier) {
        const side = Math.floor(Math.random() * 4);
        switch(side) {
            case 0: this.pos = new Vector2(Math.random() * canvas.width, -50); break;
            case 1: this.pos = new Vector2(canvas.width + 50, Math.random() * canvas.height); break;
            case 2: this.pos = new Vector2(Math.random() * canvas.width, canvas.height + 50); break;
            case 3: this.pos = new Vector2(-50, Math.random() * canvas.height); break;
        }

        const difficulty = 1 + (wave - 1) * 0.4;
        // Boss has much more HP now - tougher to kill
        this.hp = 1200 * difficulty;
        this.maxHp = this.hp;
        this.speed = 1.8 * difficulty * difficultyMultiplier;
        this.radius = 40;
        this.damage = 25 * difficulty * difficultyMultiplier;
        this.score = 500;
        this.money = 100;
        this.attackCooldown = 0;
        this.phase = 0;

        // Erratic movement properties
        this.moveTimer = 0;
        this.moveChangeInterval = 0.8;
        this.dashCooldown = 0;
        this.isDashing = false;
        this.dashTimer = 0;
        this.dashDirection = new Vector2(0, 0);
        this.erraticOffset = new Vector2(0, 0);
    }

    update(dt, playerPos) {
        this.moveTimer += dt;
        this.dashCooldown -= dt;

        // Erratic movement - change direction frequently
        if (this.moveTimer >= this.moveChangeInterval) {
            this.moveTimer = 0;
            // Random erratic offset
            this.erraticOffset = new Vector2(
                (Math.random() - 0.5) * 200,
                (Math.random() - 0.5) * 200
            );
        }

        // Calculate target with erratic offset
        const targetPos = playerPos.add(this.erraticOffset);
        let dir = targetPos.sub(this.pos).normalize();

        // Dash mechanic - boss occasionally dashes toward player
        if (this.dashCooldown <= 0 && !this.isDashing && Math.random() < 0.02) {
            this.isDashing = true;
            this.dashTimer = 0.3;
            this.dashDirection = playerPos.sub(this.pos).normalize();
            this.dashCooldown = 3;
        }

        if (this.isDashing) {
            // Fast dash!
            this.pos = this.pos.add(this.dashDirection.mult(this.speed * 4 * dt * 60));
            this.dashTimer -= dt;
            if (this.dashTimer <= 0) {
                this.isDashing = false;
            }
        } else {
            // Normal erratic movement
            this.pos = this.pos.add(dir.mult(this.speed * dt * 60));
        }

        if (this.attackCooldown > 0) this.attackCooldown -= dt;

        // Phase changes based on health
        const healthPercent = this.hp / this.maxHp;
        if (healthPercent < 0.3) {
            this.phase = 2;
            this.moveChangeInterval = 0.4; // Even more erratic at low health
        } else if (healthPercent < 0.6) {
            this.phase = 1;
            this.moveChangeInterval = 0.6;
        }

        // Keep boss on screen
        this.pos.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.pos.x));
        this.pos.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.pos.y));
    }

    draw(ctx) {
        // Boss body
        const colors = ['#ff0000', '#ff4500', '#ff1493'];
        ctx.fillStyle = colors[this.phase];
        ctx.shadowBlur = 20;
        ctx.shadowColor = colors[this.phase];

        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Spikes
        for (let i = 0; i < 8; i++) {
            const angle = (Date.now() / 500) + (i * Math.PI / 4);
            ctx.beginPath();
            ctx.moveTo(this.pos.x + Math.cos(angle) * this.radius,
                      this.pos.y + Math.sin(angle) * this.radius);
            ctx.lineTo(this.pos.x + Math.cos(angle) * (this.radius + 15),
                      this.pos.y + Math.sin(angle) * (this.radius + 15));
            ctx.lineWidth = 4;
            ctx.strokeStyle = colors[this.phase];
            ctx.stroke();
        }

        ctx.shadowBlur = 0;

        // Eyes
        ctx.fillStyle = '#ffff00';
        const angle = Math.atan2(game.player.pos.y - this.pos.y, game.player.pos.x - this.pos.x);
        ctx.beginPath();
        ctx.arc(this.pos.x + Math.cos(angle - 0.4) * 15,
                this.pos.y + Math.sin(angle - 0.4) * 15, 6, 0, Math.PI * 2);
        ctx.arc(this.pos.x + Math.cos(angle + 0.4) * 15,
                this.pos.y + Math.sin(angle + 0.4) * 15, 6, 0, Math.PI * 2);
        ctx.fill();

        // Health bar
        const barWidth = this.radius * 2.5;
        const barHeight = 8;
        ctx.fillStyle = '#333';
        ctx.fillRect(this.pos.x - barWidth/2, this.pos.y - this.radius - 15, barWidth, barHeight);
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(this.pos.x - barWidth/2, this.pos.y - this.radius - 15, barWidth * (this.hp / this.maxHp), barHeight);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.pos.x - barWidth/2, this.pos.y - this.radius - 15, barWidth, barHeight);
    }

    takeDamage(damage) {
        this.hp -= damage;
        return this.hp <= 0;
    }
}

class Player {
    constructor() {
        this.pos = new Vector2(canvas.width / 2, canvas.height / 2);
        this.angle = 0;
        this.radius = 28;
        this.speed = 3;

        // Stats
        this.maxHp = 150;
        this.hp = 150;
        this.maxShield = 0;
        this.shield = 0;
        this.invincible = 0;

        // Weapons
        this.bulletDamage = 25;
        this.bulletSpeed = 8;
        this.fireRate = 0.2;
        this.fireCooldown = 0;
        this.barrelCount = 1; // Multi-shot upgrade

        this.bombCount = 3;
        this.maxBombs = 3;
        this.bombRadius = 150; // Upgradeable bomb radius

        this.laserCount = 2;
        this.maxLasers = 2;
        this.laserDuration = 1;
        this.laserCooldown = 0;
        this.laserRechargeTime = 15;

        // Money
        this.money = 0;

        // Upgrades
        this.upgrades = {
            bullet: 0,
            bomb: 0,
            laser: 0,
            health: 0,
            shield: 0,
            speed: 0,
            multishot: 0
        };
    }

    update(dt) {
        // Update invincibility
        if (this.invincible > 0) this.invincible -= dt;

        // Movement
        let moveX = 0;
        let moveY = 0;

        if (isMobile) {
            moveX = moveJoystick.dx;
            moveY = moveJoystick.dy;
        } else {
            if (keys['arrowleft'] || keys['a']) moveX -= 1;
            if (keys['arrowright'] || keys['d']) moveX += 1;
            if (keys['arrowup'] || keys['w']) moveY -= 1;
            if (keys['arrowdown'] || keys['s']) moveY += 1;
        }

        if (moveX !== 0 || moveY !== 0) {
            const moveVec = new Vector2(moveX, moveY).normalize();
            this.pos = this.pos.add(moveVec.mult(this.speed * dt * 60));
        }

        // Clamp to screen
        this.pos.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.pos.x));
        this.pos.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.pos.y));

        // Aiming
        if (isMobile) {
            if (aimJoystick.active && (aimJoystick.dx !== 0 || aimJoystick.dy !== 0)) {
                this.angle = Math.atan2(aimJoystick.dy, aimJoystick.dx);
            }
        } else {
            this.angle = Math.atan2(mouse.y - this.pos.y, mouse.x - this.pos.x);
        }

        // Shooting
        if (this.fireCooldown > 0) this.fireCooldown -= dt;

        const shouldShoot = isMobile ? aimJoystick.active : mouse.down;
        if (shouldShoot && this.fireCooldown <= 0) {
            this.fireBullets();
            this.fireCooldown = this.fireRate;
            soundManager.shoot();
        }

        // Laser cooldown
        if (this.laserCooldown > 0) this.laserCooldown -= dt;
    }

    fireBullets() {
        const barrelOffset = 8;
        const spreadAngle = 0.12;

        if (this.barrelCount === 1) {
            // Single barrel
            game.bullets.push(new Bullet(
                this.pos.x + Math.cos(this.angle) * 35,
                this.pos.y + Math.sin(this.angle) * 35,
                this.angle,
                this.bulletDamage,
                this.bulletSpeed
            ));
        } else if (this.barrelCount === 2) {
            // Double barrel - two parallel shots
            const perpAngle = this.angle + Math.PI / 2;
            for (let i = -1; i <= 1; i += 2) {
                const offsetX = Math.cos(perpAngle) * barrelOffset * i;
                const offsetY = Math.sin(perpAngle) * barrelOffset * i;
                game.bullets.push(new Bullet(
                    this.pos.x + Math.cos(this.angle) * 35 + offsetX,
                    this.pos.y + Math.sin(this.angle) * 35 + offsetY,
                    this.angle,
                    this.bulletDamage,
                    this.bulletSpeed
                ));
            }
        } else if (this.barrelCount === 3) {
            // Triple barrel - spread shot
            for (let i = -1; i <= 1; i++) {
                const bulletAngle = this.angle + (i * spreadAngle);
                game.bullets.push(new Bullet(
                    this.pos.x + Math.cos(bulletAngle) * 35,
                    this.pos.y + Math.sin(bulletAngle) * 35,
                    bulletAngle,
                    this.bulletDamage,
                    this.bulletSpeed
                ));
            }
        } else if (this.barrelCount === 4) {
            // Quad barrel - 2x2 pattern
            const perpAngle = this.angle + Math.PI / 2;
            for (let i = -1; i <= 1; i += 2) {
                for (let j = -1; j <= 1; j += 2) {
                    const offsetX = Math.cos(perpAngle) * barrelOffset * i;
                    const offsetY = Math.sin(perpAngle) * barrelOffset * i;
                    const bulletAngle = this.angle + (j * spreadAngle * 0.7);
                    game.bullets.push(new Bullet(
                        this.pos.x + Math.cos(bulletAngle) * 35 + offsetX,
                        this.pos.y + Math.sin(bulletAngle) * 35 + offsetY,
                        bulletAngle,
                        this.bulletDamage,
                        this.bulletSpeed
                    ));
                }
            }
        } else {
            // Penta barrel - 5 shots in fan pattern
            for (let i = -2; i <= 2; i++) {
                const bulletAngle = this.angle + (i * spreadAngle);
                game.bullets.push(new Bullet(
                    this.pos.x + Math.cos(bulletAngle) * 35,
                    this.pos.y + Math.sin(bulletAngle) * 35,
                    bulletAngle,
                    this.bulletDamage,
                    this.bulletSpeed
                ));
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.angle);

        // Tank body - BIGGER
        ctx.fillStyle = '#ff1493';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff69b4';
        ctx.fillRect(-28, -22, 48, 44);

        // Tank tracks
        ctx.fillStyle = '#c71585';
        ctx.fillRect(-30, -26, 52, 8);
        ctx.fillRect(-30, 18, 52, 8);

        // Turret
        ctx.fillStyle = '#ff69b4';
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();

        // Draw barrels based on barrelCount
        ctx.fillStyle = '#ffd700';
        if (this.barrelCount === 1) {
            // Single barrel
            ctx.fillRect(8, -5, 32, 10);
        } else if (this.barrelCount === 2) {
            // Double barrel
            ctx.fillRect(8, -12, 30, 8);
            ctx.fillRect(8, 4, 30, 8);
        } else if (this.barrelCount === 3) {
            // Triple barrel
            ctx.fillRect(8, -14, 28, 7);
            ctx.fillRect(8, -3, 32, 6);
            ctx.fillRect(8, 7, 28, 7);
        } else if (this.barrelCount === 4) {
            // Quad barrel
            ctx.fillRect(8, -15, 28, 6);
            ctx.fillRect(8, -7, 30, 6);
            ctx.fillRect(8, 1, 30, 6);
            ctx.fillRect(8, 9, 28, 6);
        } else {
            // Penta barrel
            ctx.fillRect(8, -16, 26, 5);
            ctx.fillRect(8, -9, 28, 5);
            ctx.fillRect(8, -2, 32, 5);
            ctx.fillRect(8, 5, 28, 5);
            ctx.fillRect(8, 12, 26, 5);
        }

        ctx.shadowBlur = 0;
        ctx.restore();

        // Floating health bar above player
        const barWidth = 50;
        const barHeight = 6;
        const barY = this.pos.y - this.radius - 15;

        // Health bar background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.beginPath();
        ctx.roundRect(this.pos.x - barWidth/2 - 2, barY - 2, barWidth + 4, barHeight + 4, 3);
        ctx.fill();

        // Health fill
        const hpPercent = this.hp / this.maxHp;
        ctx.fillStyle = hpPercent > 0.5 ? '#00ff00' : hpPercent > 0.25 ? '#ffff00' : '#ff0000';
        ctx.beginPath();
        ctx.roundRect(this.pos.x - barWidth/2, barY, barWidth * hpPercent, barHeight, 3);
        ctx.fill();

        // Shield bar (if any)
        if (this.maxShield > 0) {
            const shieldY = barY - 8;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.beginPath();
            ctx.roundRect(this.pos.x - barWidth/2 - 2, shieldY - 2, barWidth + 4, 6, 3);
            ctx.fill();

            ctx.fillStyle = '#00bfff';
            ctx.beginPath();
            ctx.roundRect(this.pos.x - barWidth/2, shieldY, barWidth * (this.shield / this.maxShield), 4, 3);
            ctx.fill();
        }

        // Shield effect
        if (this.shield > 0) {
            ctx.strokeStyle = `rgba(0, 191, 255, ${0.3 + Math.sin(Date.now() / 200) * 0.2})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.pos.x, this.pos.y, this.radius + 10, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Invincibility flash
        if (this.invincible > 0 && Math.floor(Date.now() / 100) % 2 === 0) {
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(this.pos.x, this.pos.y, this.radius + 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    takeDamage(damage) {
        if (this.invincible > 0) return false;

        if (this.shield > 0) {
            const shieldAbsorb = Math.min(this.shield, damage);
            this.shield -= shieldAbsorb;
            damage -= shieldAbsorb;
        }

        this.hp -= damage;
        this.invincible = 0.5; // Half second invincibility

        if (this.hp <= 0) {
            this.hp = 0;
            return true;
        }
        return false;
    }

    heal(amount) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
    }

    rechargeShield(amount) {
        this.shield = Math.min(this.maxShield, this.shield + amount);
    }
}

// ==================== MAIN GAME CLASS ====================

class Game {
    constructor() {
        this.player = new Player();
        this.zombies = [];
        this.bullets = [];
        this.bombs = [];
        this.lasers = [];
        this.particles = [];
        this.explosions = [];
        this.coins = [];
        this.floatingTexts = [];

        this.score = 0;
        this.wave = 1;
        this.zombiesSpawned = 0;
        this.zombiesPerWave = 10;
        this.spawnTimer = 0;
        this.spawnInterval = 2;
        this.waveTimer = 0;
        this.bossSpawned = false;
        this.bossDefeated = false;
        this.waveComplete = false;
        this.difficultyMultiplier = 1;
        this.baseZombieCount = 10;

        this.shakeAmount = 0;
        this.screenShake = new Vector2(0, 0);
    }

    reset() {
        this.player = new Player();
        this.zombies = [];
        this.bullets = [];
        this.bombs = [];
        this.lasers = [];
        this.particles = [];
        this.explosions = [];
        this.coins = [];
        this.floatingTexts = [];
        this.score = 0;
        this.wave = 1;
        this.zombiesSpawned = 0;
        this.zombiesPerWave = this.baseZombieCount;
        this.spawnTimer = 0;
        this.spawnInterval = 2;
        this.waveTimer = 0;
        this.bossSpawned = false;
        this.bossDefeated = false;
        this.waveComplete = false;
        this.shakeAmount = 0;
    }

    useBomb() {
        if (this.player.bombCount > 0) {
            this.player.bombCount--;
            this.bombs.push(new Bomb(this.player.pos.x, this.player.pos.y, this.player.bombRadius));
        }
    }

    useLaser() {
        if (this.player.laserCount > 0 && this.player.laserCooldown <= 0) {
            this.player.laserCount--;
            this.player.laserCooldown = this.player.laserRechargeTime;
            this.lasers.push(new Laser(
                this.player,
                this.player.laserDuration
            ));
            soundManager.laser();
        }
    }

    addExplosion(x, y, radius, color) {
        this.explosions.push({ x, y, radius: 0, maxRadius: radius, color, life: 0.5 });

        for (let i = 0; i < 20; i++) {
            this.particles.push(new Particle(x, y, color, Math.random() * 5 + 2, Math.random() * 0.5 + 0.3));
        }
    }

    spawnZombie() {
        const side = Math.floor(Math.random() * 4);
        let x, y;
        const margin = 100;

        // Ensure zombies don't spawn too close to player
        let attempts = 0;
        do {
            switch(side) {
                case 0: x = Math.random() * canvas.width; y = -margin; break;
                case 1: x = canvas.width + margin; y = Math.random() * canvas.height; break;
                case 2: x = Math.random() * canvas.width; y = canvas.height + margin; break;
                case 3: x = -margin; y = Math.random() * canvas.height; break;
            }
            attempts++;
        } while (this.player && this.player.pos.dist(new Vector2(x, y)) < 250 && attempts < 10);

        const rand = Math.random();
        let type = 'normal';
        if (rand < 0.15) type = 'fast';
        else if (rand < 0.3) type = 'tank';

        this.zombies.push(new Zombie(x, y, type, this.wave, this.difficultyMultiplier));
    }

    spawnBoss() {
        this.zombies.push(new Boss(this.wave, this.difficultyMultiplier));
    }

    update(dt) {
        // Screen shake
        if (this.shakeAmount > 0) {
            this.screenShake.x = (Math.random() - 0.5) * this.shakeAmount;
            this.screenShake.y = (Math.random() - 0.5) * this.shakeAmount;
            this.shakeAmount *= 0.9;
            if (this.shakeAmount < 0.5) this.shakeAmount = 0;
        } else {
            this.screenShake.x = 0;
            this.screenShake.y = 0;
        }

        // Wave management
        if (!this.waveComplete) {
            this.waveTimer += dt;

            // Spawn zombies (after 2 second grace period at start of wave)
            if (this.waveTimer > 2 && this.zombiesSpawned < this.zombiesPerWave) {
                this.spawnTimer += dt;
                if (this.spawnTimer >= this.spawnInterval) {
                    this.spawnZombie();
                    this.zombiesSpawned++;
                    this.spawnTimer = 0;
                    this.spawnInterval = Math.max(0.5, 2.0 - (this.wave * 0.08));
                }
            }

            // Spawn boss after all zombies spawned and cleared
            if (this.zombiesSpawned >= this.zombiesPerWave && this.zombies.length === 0 && !this.bossSpawned) {
                this.spawnBoss();
                this.bossSpawned = true;
            }

            // Check wave complete - ONLY when boss is defeated
            if (this.bossSpawned && this.zombies.length === 0 && this.bossDefeated) {
                this.waveComplete = true;
                soundManager.celebration();
                this.showUpgradeScreen();
            }
        }

        // Update player
        this.player.update(dt);

        // Update coins
        this.coins = this.coins.filter(coin => {
            coin.update(dt);
            // Check collection
            if (this.player.pos.dist(coin.pos) < this.player.radius + coin.radius + 10) {
                this.player.money += coin.value;
                this.floatingTexts.push(new FloatingText(coin.pos.x, coin.pos.y, `+$${coin.value}`, '#ffd700'));
                soundManager.coin();
                return false;
            }
            return coin.life > 0;
        });

        // Update floating texts
        this.floatingTexts = this.floatingTexts.filter(ft => {
            ft.update(dt);
            return ft.life > 0;
        });

        // Update bullets
        this.bullets = this.bullets.filter(bullet => {
            bullet.update(dt);

            // Check collisions with zombies
            for (let i = this.zombies.length - 1; i >= 0; i--) {
                const zombie = this.zombies[i];
                if (bullet.pos.dist(zombie.pos) < zombie.radius + bullet.radius) {
                    // Headshot check
                    const isHeadshot = bullet.pos.dist(zombie.pos) < zombie.radius * 0.5;
                    const damage = isHeadshot ? bullet.damage * 2 : bullet.damage;

                    const isBoss = zombie instanceof Boss;
                    if (isBoss) {
                        soundManager.bossHit();
                    }

                    if (zombie.takeDamage(damage)) {
                        this.score += zombie.score;
                        this.addExplosion(zombie.pos.x, zombie.pos.y, 30, zombie.color);
                        soundManager.zombieDeath();

                        // Drop coins
                        for (let c = 0; c < Math.floor(zombie.money / 5); c++) {
                            this.coins.push(new Coin(
                                zombie.pos.x + (Math.random() - 0.5) * 30,
                                zombie.pos.y + (Math.random() - 0.5) * 30,
                                5
                            ));
                        }

                        // Mark boss as defeated
                        if (isBoss) {
                            this.bossDefeated = true;
                        }

                        this.zombies.splice(i, 1);
                    }

                    // Particles
                    for (let j = 0; j < 5; j++) {
                        this.particles.push(new Particle(
                            bullet.pos.x, bullet.pos.y, '#ffd700',
                            Math.random() * 3 + 1, Math.random() * 0.3 + 0.1
                        ));
                    }

                    return false;
                }
            }

            return bullet.life > 0;
        });

        // Update bombs
        this.bombs = this.bombs.filter(bomb => {
            bomb.update(dt);

            if (bomb.exploded) {
                // Damage zombies in explosion radius
                for (let i = this.zombies.length - 1; i >= 0; i--) {
                    const zombie = this.zombies[i];
                    if (bomb.pos.dist(zombie.pos) < bomb.explosionCurrentRadius + zombie.radius) {
                        if (zombie.takeDamage(200)) {
                            this.score += zombie.score;
                            this.addExplosion(zombie.pos.x, zombie.pos.y, 20, zombie.color);
                            soundManager.zombieDeath();

                            // Drop coins
                            const isBoss = zombie instanceof Boss;
                            for (let c = 0; c < Math.floor(zombie.money / 5); c++) {
                                this.coins.push(new Coin(
                                    zombie.pos.x + (Math.random() - 0.5) * 30,
                                    zombie.pos.y + (Math.random() - 0.5) * 30,
                                    5
                                ));
                            }

                            if (isBoss) {
                                this.bossDefeated = true;
                            }

                            this.zombies.splice(i, 1);
                        }
                    }
                }
            }

            return bomb.life > 0;
        });

        // Update lasers
        this.lasers = this.lasers.filter(laser => {
            laser.update(dt);

            // Damage zombies in laser path
            const line = laser.getLine();
            for (let i = this.zombies.length - 1; i >= 0; i--) {
                const zombie = this.zombies[i];
                const dist = this.pointToLineDistance(zombie.pos, line);

                if (dist < zombie.radius + laser.width / 2) {
                    if (zombie.takeDamage(5)) {
                        this.score += zombie.score;
                        this.addExplosion(zombie.pos.x, zombie.pos.y, 20, zombie.color);
                        soundManager.zombieDeath();

                        // Drop coins
                        const isBoss = zombie instanceof Boss;
                        for (let c = 0; c < Math.floor(zombie.money / 5); c++) {
                            this.coins.push(new Coin(
                                zombie.pos.x + (Math.random() - 0.5) * 30,
                                zombie.pos.y + (Math.random() - 0.5) * 30,
                                5
                            ));
                        }

                        if (isBoss) {
                            this.bossDefeated = true;
                        }

                        this.zombies.splice(i, 1);
                    }
                }
            }

            return laser.life > 0;
        });

        // Update zombies
        for (let i = this.zombies.length - 1; i >= 0; i--) {
            const zombie = this.zombies[i];
            zombie.update(dt, this.player.pos);

            // Check collision with player
            if (zombie.pos.dist(this.player.pos) < zombie.radius + this.player.radius) {
                if (zombie.attackCooldown <= 0) {
                    if (this.player.takeDamage(zombie.damage)) {
                        soundManager.gameOver();
                        this.gameOver();
                        return;
                    }
                    soundManager.hit();
                    zombie.attackCooldown = 1;

                    // Hit particles
                    for (let j = 0; j < 10; j++) {
                        this.particles.push(new Particle(
                            this.player.pos.x, this.player.pos.y, '#ff0000',
                            Math.random() * 4 + 2, Math.random() * 0.5 + 0.2
                        ));
                    }
                }
            }
        }

        // Update particles
        this.particles = this.particles.filter(p => {
            p.update(dt);
            return p.life > 0;
        });

        // Update explosions
        this.explosions = this.explosions.filter(e => {
            e.life -= dt;
            e.radius += dt * 200;
            return e.life > 0;
        });

        // Update UI
        this.updateUI();
    }

    pointToLineDistance(point, line) {
        const A = line.x2 - line.x1;
        const B = line.y1 - line.y2;
        const C = line.x1 * (line.y2 - line.y1) - line.y1 * (line.x2 - line.x1);
        return Math.abs(A * point.y + B * point.x + C) / Math.sqrt(A * A + B * B);
    }

    draw() {
        // Clear
        ctx.fillStyle = '#1a0a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Background pattern
        ctx.save();
        ctx.translate(this.screenShake.x, this.screenShake.y);

        // Grid pattern
        ctx.strokeStyle = 'rgba(255, 105, 180, 0.1)';
        ctx.lineWidth = 1;
        const gridSize = 50;
        for (let x = 0; x < canvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }

        // Draw explosions
        this.explosions.forEach(e => {
            ctx.globalAlpha = e.life / 0.5;
            ctx.fillStyle = e.color;
            ctx.beginPath();
            ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        // Draw particles
        this.particles.forEach(p => p.draw(ctx));

        // Draw coins
        this.coins.forEach(c => c.draw(ctx));

        // Draw bombs
        this.bombs.forEach(b => b.draw(ctx));

        // Draw lasers
        this.lasers.forEach(l => l.draw(ctx));

        // Draw bullets
        this.bullets.forEach(b => b.draw(ctx));

        // Draw zombies
        this.zombies.forEach(z => z.draw(ctx));

        // Draw player
        this.player.draw(ctx);

        // Draw floating texts
        this.floatingTexts.forEach(ft => ft.draw(ctx));

        ctx.restore();

        // Wave announcement
        if (this.waveTimer < 3) {
            ctx.fillStyle = `rgba(255, 20, 147, ${1 - this.waveTimer / 3})`;
            ctx.font = `bold ${Math.min(canvas.width / 8, 60)}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText(`WAVE ${this.wave}`, canvas.width / 2, canvas.height / 2);
        }

        // Boss warning
        if (this.bossSpawned && !this.bossDefeated && this.zombies.length > 0) {
            const boss = this.zombies.find(z => z instanceof Boss);
            if (boss) {
                ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
                ctx.font = 'bold 24px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('⚠️ BOSS BATTLE ⚠️', canvas.width / 2, 80);
            }
        }
    }

    updateUI() {
        const bombCount = document.getElementById('bombCount');
        const laserCount = document.getElementById('laserCount');
        const scoreEl = document.getElementById('score');
        const waveEl = document.getElementById('wave');
        const moneyEl = document.getElementById('money');

        if (bombCount) bombCount.textContent = `💣: ${this.player.bombCount}/${this.player.maxBombs}`;
        if (laserCount) laserCount.textContent = `⚡: ${this.player.laserCount}/${this.player.maxLasers}`;
        if (scoreEl) scoreEl.textContent = `Score: ${this.score}`;
        if (waveEl) waveEl.textContent = `Wave: ${this.wave}`;
        if (moneyEl) moneyEl.textContent = `💰 $${this.player.money}`;

        // Mobile buttons
        if (isMobile) {
            const bombBtn = document.getElementById('bombBtn');
            const laserBtn = document.getElementById('laserBtn');
            if (bombBtn) bombBtn.disabled = this.player.bombCount <= 0;
            if (laserBtn) laserBtn.disabled = this.player.laserCount <= 0 || this.player.laserCooldown > 0;
        }
    }

    showUpgradeScreen() {
        currentState = GameState.UPGRADE;
        document.getElementById('upgradeScore').textContent = `Score: ${this.score} | Money: $${this.player.money}`;
        upgradeScreen.classList.remove('hidden');
        hud.classList.add('hidden');

        // Update upgrade buttons with costs
        document.querySelectorAll('.upgrade-card').forEach(card => {
            const type = card.dataset.upgrade;
            const level = this.player.upgrades[type];
            const cost = this.getUpgradeCost(type, level);
            const btn = card.querySelector('.upgrade-btn');
            btn.textContent = `Upgrade $${cost} (Lv.${level})`;

            // Disable if can't afford
            if (this.player.money < cost) {
                btn.disabled = true;
                btn.style.opacity = '0.5';
            } else {
                btn.disabled = false;
                btn.style.opacity = '1';
            }
        });
    }

    getUpgradeCost(type, level) {
        const baseCosts = {
            bullet: 20,
            bomb: 30,
            laser: 35,
            health: 15,
            shield: 25,
            speed: 20,
            multishot: 50
        };
        return Math.floor(baseCosts[type] * (1 + level * 0.5));
    }

    applyUpgrade(type) {
        const level = this.player.upgrades[type];
        const cost = this.getUpgradeCost(type, level);

        if (this.player.money < cost) return;

        this.player.money -= cost;
        this.player.upgrades[type]++;
        soundManager.upgrade();

        switch(type) {
            case 'bullet':
                this.player.bulletDamage += 10;
                this.player.bulletSpeed += 1;
                this.player.fireRate = Math.max(0.05, this.player.fireRate - 0.02);
                break;
            case 'bomb':
                this.player.maxBombs++;
                this.player.bombRadius += 30; // Bigger explosion radius!
                break;
            case 'laser':
                this.player.laserDuration += 0.3;
                this.player.laserRechargeTime = Math.max(5, this.player.laserRechargeTime - 1);
                break;
            case 'health':
                this.player.maxHp += 25;
                this.player.hp = this.player.maxHp;
                break;
            case 'shield':
                this.player.maxShield += 25;
                this.player.shield = this.player.maxShield;
                break;
            case 'speed':
                this.player.speed += 0.5;
                break;
            case 'multishot':
                // Upgrade barrel count: 1 -> 2 -> 3 -> 4 -> 5
                if (this.player.barrelCount < 5) {
                    this.player.barrelCount++;
                }
                // Zombies get tougher with each multishot upgrade
                this.difficultyMultiplier += 0.15;
                break;
        }

        // Refresh UI
        this.showUpgradeScreen();
    }

    nextWave() {
        this.wave++;
        this.zombiesSpawned = 0;
        this.zombiesPerWave = this.baseZombieCount + (this.wave * 5);
        this.spawnTimer = 0;
        this.spawnInterval = 2;
        this.waveTimer = 0;
        this.bossSpawned = false;
        this.bossDefeated = false;
        this.waveComplete = false;

        // Replenish resources
        this.player.bombCount = this.player.maxBombs;
        this.player.laserCount = this.player.maxLasers;
        this.player.laserCooldown = 0;
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 20);
        this.player.shield = this.player.maxShield;

        currentState = GameState.PLAYING;
        upgradeScreen.classList.add('hidden');
        hud.classList.remove('hidden');
    }

    gameOver() {
        currentState = GameState.GAMEOVER;

        // Save high score
        highScoreManager.addScore(currentPlayerName, this.score, this.wave);

        document.getElementById('finalPlayerName').textContent = `Player: ${currentPlayerName}`;
        document.getElementById('finalScore').textContent = `Final Score: ${this.score}`;
        document.getElementById('finalWave').textContent = `You survived: ${this.wave} waves`;
        document.getElementById('finalMoney').textContent = `Money earned: $${this.player.money}`;

        // Render high scores on game over screen
        highScoreManager.renderScores('gameOverHighScoresList');

        gameOverScreen.classList.remove('hidden');
        hud.classList.add('hidden');
    }
}

// ==================== HIGH SCORE SYSTEM ====================

class HighScoreManager {
    constructor() {
        this.storageKey = 'kelmansTanksHighScores';
        this.scores = this.loadScores();
    }

    loadScores() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    }

    saveScores() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.scores));
        } catch (e) {
            console.log('Could not save high scores');
        }
    }

    addScore(name, score, wave) {
        const entry = {
            name: name || 'Anonymous',
            score: score,
            wave: wave,
            date: new Date().toLocaleDateString()
        };
        this.scores.push(entry);
        // Sort by score descending, keep top 10
        this.scores.sort((a, b) => b.score - a.score);
        this.scores = this.scores.slice(0, 10);
        this.saveScores();
    }

    getScores() {
        return this.scores;
    }

    renderScores(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const scores = this.getScores();
        if (scores.length === 0) {
            container.innerHTML = '<p class="no-scores">No scores yet. Be the first!</p>';
            return;
        }

        let html = '<table class="scores-table">';
        html += '<tr><th>Rank</th><th>Name</th><th>Score</th><th>Wave</th></tr>';
        scores.forEach((entry, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            html += `<tr><td>${medal}</td><td>${entry.name}</td><td>${entry.score}</td><td>${entry.wave}</td></tr>`;
        });
        html += '</table>';
        container.innerHTML = html;
    }
}

const highScoreManager = new HighScoreManager();

// ==================== GAME INSTANCE ====================

const game = new Game();
let currentPlayerName = '';

// ==================== BUTTON HANDLERS ====================

document.getElementById('startBtn').addEventListener('click', () => {
    soundManager.init();
    currentPlayerName = document.getElementById('playerName').value.trim() || 'Tank Commander';
    startScreen.classList.add('hidden');
    difficultyScreen.classList.remove('hidden');
});

// Render high scores on start screen
highScoreManager.renderScores('highScoresList');

// Difficulty selection
document.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        selectedDifficulty = e.target.dataset.difficulty;

        // Apply difficulty settings
        switch(selectedDifficulty) {
            case 'easy':
                game.difficultyMultiplier = 0.6;
                game.baseZombieCount = 8;
                break;
            case 'medium':
                game.difficultyMultiplier = 1.0;
                game.baseZombieCount = 15;
                break;
            case 'epic':
                game.difficultyMultiplier = 1.8;
                game.baseZombieCount = 25;
                break;
        }

        game.zombiesPerWave = game.baseZombieCount;
        difficultyScreen.classList.add('hidden');
        hud.classList.remove('hidden');
        if (isMobile) mobileControls.classList.remove('hidden');
        currentState = GameState.PLAYING;
        game.reset();
    });
});

document.querySelectorAll('.upgrade-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const card = e.target.closest('.upgrade-card');
        const type = card.dataset.upgrade;
        game.applyUpgrade(type);
    });
});

document.getElementById('nextWaveBtn').addEventListener('click', () => {
    game.nextWave();
});

document.getElementById('restartBtn').addEventListener('click', () => {
    gameOverScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
    currentState = GameState.MENU;
});

// ==================== GAME LOOP ====================

function gameLoop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    if (currentState === GameState.PLAYING) {
        game.update(dt);
        game.draw();
    }

    animationId = requestAnimationFrame(gameLoop);
}

// Start loop
lastTime = performance.now();
animationId = requestAnimationFrame(gameLoop);
