// Game constants
const DUCK_RADIUS = 15;
const DOG_RADIUS = 21;
const DOG_SPEED = 400;
const MAX_SPEED = 200;
const DAMPING = 0.95;
const DOG_EFFECT_RADIUS = 100;
const SEPARATION_RADIUS = 30;
const SEPARATION_STRENGTH = 1;
const COHESION_STRENGTH = 0.02;
const CLUSTER_RADIUS_THRESHOLD = 50;
const GROUP_SEPARATION_THRESHOLD = 150;
const MAX_LEVEL = 5;

// Game state
let canvas = document.getElementById('gameCanvas');
let ctx = canvas.getContext('2d');
let gameState = 'waiting';  // 'waiting', 'running', or 'ended'
let startTime = 0;
let endTime = 0;
let currentLevel = 1;
let ducks = [];
let dog = {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    angle: 0,
    targetAngle: 0
};

// Initialize canvas size
function initializeCanvas() {
    const container = document.querySelector('.game-container');
    const containerWidth = container.clientWidth;
    const containerHeight = window.innerHeight - 200; // Account for header and margins
    
    // Set canvas size while maintaining aspect ratio
    const aspectRatio = 16/9;
    let width = containerWidth - 40; // Account for container padding
    let height = width / aspectRatio;
    
    // If height is too tall, constrain by height instead
    if (height > containerHeight) {
        height = containerHeight;
        width = height * aspectRatio;
    }
    
    canvas.width = width;
    canvas.height = height;
    
    // Center the dog initially
    dog.x = canvas.width / 2;
    dog.y = canvas.height / 2;
    dog.targetX = dog.x;
    dog.targetY = dog.y;
}

// Initialize ducks based on current level
function initializeDucks() {
    ducks = [];
    const numColors = Math.min(currentLevel + 1, 5);
    const ducksPerColor = 4;
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD'].slice(0, numColors);
    
    for (let i = 0; i < colors.length; i++) {
        for (let j = 0; j < ducksPerColor; j++) {
            const angle = (Math.PI * 2 * (j + i * ducksPerColor)) / (colors.length * ducksPerColor);
            const radius = Math.min(canvas.width, canvas.height) * 0.3;
            ducks.push({
                x: canvas.width/2 + Math.cos(angle) * radius,
                y: canvas.height/2 + Math.sin(angle) * radius,
                vx: 0,
                vy: 0,
                color: colors[i],
                tailAngle: Math.random() * Math.PI * 2,
                blinkTimer: Math.random() * 100
            });
        }
    }
}

// Update game state
function update(deltaTime) {
    if (gameState !== 'running') return;
    
    // Update dog position and angle
    const dx = dog.targetX - dog.x;
    const dy = dog.targetY - dog.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > 1) {
        dog.x += (dx / dist) * DOG_SPEED * deltaTime;
        dog.y += (dy / dist) * DOG_SPEED * deltaTime;
        dog.targetAngle = Math.atan2(dy, dx);
    }
    
    // Smoothly rotate dog
    const angleDiff = ((dog.targetAngle - dog.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    dog.angle += angleDiff * 10 * deltaTime;
    
    // Update ducks
    for (let duck of ducks) {
        // Always update tail wagging and blinking
        duck.tailAngle += Math.sin(Date.now() / 200) * 0.1;
        duck.blinkTimer = (duck.blinkTimer + 1) % 100;
        
        if (gameState === 'running') {
            // Calculate forces
            let fx = 0, fy = 0;
            
            // Dog repulsion
            const duckToDogX = duck.x - dog.x;
            const duckToDogY = duck.y - dog.y;
            const duckToDogDist = Math.sqrt(duckToDogX * duckToDogX + duckToDogY * duckToDogY);
            
            if (duckToDogDist < DOG_EFFECT_RADIUS) {
                const repulsion = (1 - duckToDogDist / DOG_EFFECT_RADIUS) * 2;
                fx += (duckToDogX / duckToDogDist) * repulsion * 1000;
                fy += (duckToDogY / duckToDogDist) * repulsion * 1000;
            }
            
            // Separation and cohesion
            for (let other of ducks) {
                if (other === duck) continue;
                
                const dx = duck.x - other.x;
                const dy = duck.y - other.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < SEPARATION_RADIUS) {
                    const force = (1 - dist / SEPARATION_RADIUS) * SEPARATION_STRENGTH;
                    fx += (dx / dist) * force * 1000;
                    fy += (dy / dist) * force * 1000;
                }
                
                if (duck.color === other.color) {
                    fx += (dx) * -COHESION_STRENGTH;
                    fy += (dy) * -COHESION_STRENGTH;
                }
            }
            
            // Boundary forces
            const margin = 50;
            if (duck.x < margin) fx += (margin - duck.x) * 2;
            if (duck.x > canvas.width - margin) fx += (canvas.width - margin - duck.x) * 2;
            if (duck.y < margin) fy += (margin - duck.y) * 2;
            if (duck.y > canvas.height - margin) fy += (canvas.height - margin - duck.y) * 2;
            
            // Update velocity and position
            duck.vx = (duck.vx + fx * deltaTime) * DAMPING;
            duck.vy = (duck.vy + fy * deltaTime) * DAMPING;
            
            const speed = Math.sqrt(duck.vx * duck.vx + duck.vy * duck.vy);
            if (speed > MAX_SPEED) {
                duck.vx = (duck.vx / speed) * MAX_SPEED;
                duck.vy = (duck.vy / speed) * MAX_SPEED;
            }
            
            duck.x += duck.vx * deltaTime;
            duck.y += duck.vy * deltaTime;
        }
    }
    
    // Check win condition
    if (checkWinCondition()) {
        gameState = 'ended';
        endTime = Date.now();
    }
}

// Draw game state
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw ducks
    for (let duck of ducks) {
        // Draw body
        ctx.beginPath();
        ctx.arc(duck.x, duck.y, DUCK_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = duck.color;
        ctx.fill();
        
        // Draw tail
        const tailLength = DUCK_RADIUS * 0.8;
        const tailWidth = DUCK_RADIUS * 0.4;
        ctx.beginPath();
        ctx.moveTo(
            duck.x + Math.cos(duck.tailAngle) * DUCK_RADIUS,
            duck.y + Math.sin(duck.tailAngle) * DUCK_RADIUS
        );
        ctx.lineTo(
            duck.x + Math.cos(duck.tailAngle) * (DUCK_RADIUS + tailLength),
            duck.y + Math.sin(duck.tailAngle) * (DUCK_RADIUS + tailLength)
        );
        ctx.lineWidth = tailWidth;
        ctx.strokeStyle = duck.color;
        ctx.lineCap = 'round';
        ctx.stroke();
        
        // Draw eyes
        const eyeOffset = DUCK_RADIUS * 0.4;
        const eyeRadius = DUCK_RADIUS * 0.15;
        const blinking = duck.blinkTimer > 95;
        
        if (!blinking) {
            ctx.beginPath();
            ctx.arc(duck.x + eyeOffset, duck.y - eyeOffset, eyeRadius, 0, Math.PI * 2);
            ctx.fillStyle = 'black';
            ctx.fill();
            
            ctx.beginPath();
            ctx.arc(duck.x - eyeOffset, duck.y - eyeOffset, eyeRadius, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.moveTo(duck.x + eyeOffset - eyeRadius, duck.y - eyeOffset);
            ctx.lineTo(duck.x + eyeOffset + eyeRadius, duck.y - eyeOffset);
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(duck.x - eyeOffset - eyeRadius, duck.y - eyeOffset);
            ctx.lineTo(duck.x - eyeOffset + eyeRadius, duck.y - eyeOffset);
            ctx.stroke();
        }
    }
    
    // Draw dog
    ctx.save();
    ctx.translate(dog.x, dog.y);
    ctx.rotate(dog.angle);
    
    // Body
    ctx.beginPath();
    ctx.arc(0, 0, DOG_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = '#8B4513';
    ctx.fill();
    
    // Nose
    ctx.beginPath();
    ctx.arc(DOG_RADIUS * 0.8, 0, DOG_RADIUS * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'black';
    ctx.fill();
    
    // Eyes
    const eyeOffset = DOG_RADIUS * 0.4;
    ctx.beginPath();
    ctx.arc(DOG_RADIUS * 0.3, -eyeOffset, DOG_RADIUS * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = 'black';
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(DOG_RADIUS * 0.3, eyeOffset, DOG_RADIUS * 0.15, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
    
    // Draw game state
    ctx.font = '20px Arial';
    ctx.fillStyle = 'white';
    
    if (gameState === 'waiting') {
        ctx.textAlign = 'center';
        ctx.fillText('Click to Start', canvas.width/2, canvas.height/2);
    } else if (gameState === 'running') {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        ctx.textAlign = 'left';
        ctx.fillText(`Time: ${elapsed}s    Level: ${currentLevel}`, 20, 30);
    } else if (gameState === 'ended') {
        const finalTime = Math.floor((endTime - startTime) / 1000);
        ctx.textAlign = 'center';
        if (currentLevel < MAX_LEVEL) {
            ctx.fillText(`Level ${currentLevel} Complete! Time: ${finalTime}s`, canvas.width/2, canvas.height/2);
            ctx.fillText('Click to start next level', canvas.width/2, canvas.height/2 + 30);
        } else {
            ctx.fillText(`Game Complete! Final Time: ${finalTime}s`, canvas.width/2, canvas.height/2);
            ctx.fillText('Click to play again', canvas.width/2, canvas.height/2 + 30);
        }
    }
}

// Check if ducks of the same color are grouped together
function checkWinCondition() {
    const colors = [...new Set(ducks.map(d => d.color))];
    
    for (let color of colors) {
        const colorDucks = ducks.filter(d => d.color === color);
        const otherDucks = ducks.filter(d => d.color !== color);
        
        // Check if ducks of the same color are close together
        for (let i = 0; i < colorDucks.length; i++) {
            for (let j = i + 1; j < colorDucks.length; j++) {
                const dx = colorDucks[i].x - colorDucks[j].x;
                const dy = colorDucks[i].y - colorDucks[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > CLUSTER_RADIUS_THRESHOLD) return false;
            }
        }
        
        // Check if this group is separated from other colors
        for (let colorDuck of colorDucks) {
            for (let otherDuck of otherDucks) {
                const dx = colorDuck.x - otherDuck.x;
                const dy = colorDuck.y - otherDuck.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < GROUP_SEPARATION_THRESHOLD) return false;
            }
        }
    }
    
    return true;
}

// Game loop
let lastTime = 0;
function gameLoop(timestamp) {
    const deltaTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    
    update(deltaTime);
    draw();
    requestAnimationFrame(gameLoop);
}

// Event listeners
canvas.addEventListener('click', (e) => {
    if (gameState === 'waiting') {
        gameState = 'running';
        startTime = Date.now();
    } else if (gameState === 'ended') {
        if (currentLevel < MAX_LEVEL) {
            currentLevel++;
        } else {
            currentLevel = 1;
        }
        gameState = 'running';
        startTime = Date.now();
        initializeDucks();
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (gameState === 'running') {
        const rect = canvas.getBoundingClientRect();
        dog.targetX = e.clientX - rect.left;
        dog.targetY = e.clientY - rect.top;
    }
});

// Handle window resize
window.addEventListener('resize', () => {
    initializeCanvas();
    initializeDucks();
});

// Start game
initializeCanvas();
initializeDucks();
requestAnimationFrame(gameLoop); 