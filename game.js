// Game constants
const CANVAS_WIDTH = window.innerWidth;
const CANVAS_HEIGHT = window.innerHeight;
const DUCK_RADIUS = 12;  // Smaller ducks
const DOG_RADIUS = 21;   // 1.5x bigger dog (was 14)
const MAX_SPEED = 800.0; // Maximum speed for ducks
const DAMPING = 0.98;    // Damping factor (less damping = more bouncy)
const DOG_SPEED = 600.0; // Increased dog speed for better responsiveness
const DOG_FOLLOW_DISTANCE = 40.0; // Reduced follow distance for tighter control
const DOG_ROTATION_SPEED = 12.0;  // Increased rotation speed for more responsive turning
const DOG_ACCELERATION = 8.0;     // Increased acceleration for better response

// Repulsion (player/dog) parameters
const DOG_EFFECT_RADIUS = 180.0;  // When player is within this radius, repulsion activates
const DOG_REPULSION_STRENGTH = 6000.0;  // Increased repulsion strength to prevent overlaps

// Inter-boid forces
const SEPARATION_DISTANCE = 40.0;  // Increased minimum allowed distance between ducks
const SEPARATION_STRENGTH = 150.0;  // Increased force to keep ducks separate
const COHESION_STRENGTH = 0.005;  // Attraction toward nearby boids

// Ring (center) attraction – ducks try to keep to an orbit (target ring radius)
const TARGET_RING_RADIUS = 64.0;  // Doubled the target ring radius (was 32)
const RING_ATTRACTION_STRENGTH = 0.5;

// Boundary parameters
const LEFT_BOUND = DUCK_RADIUS;
const RIGHT_BOUND = CANVAS_WIDTH - DUCK_RADIUS;
const TOP_BOUND = DUCK_RADIUS;
const BOTTOM_BOUND = CANVAS_HEIGHT - DUCK_RADIUS;
const BOUNDARY_MARGIN = 20;
const BOUNDARY_FORCE_STRENGTH = 3500.0;  // Extra force when too close to edge
const BOUNDARY_BOUNCE_FACTOR = 1.05;  // On collision, bounce with slightly amplified speed

// Grouping (win condition) criteria
const CLUSTER_RADIUS_THRESHOLD = 80.0;  // Increased from 50 to account for stronger separation
const GROUP_SEPARATION_THRESHOLD = 200.0;  // Increased from 150 to account for larger play area

// Game state
let dog = {
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT / 2,
    vx: 0,
    vy: 0,
    targetX: CANVAS_WIDTH / 2,
    targetY: CANVAS_HEIGHT / 2,
    angle: 0,  // Current angle in radians
    targetAngle: 0  // Target angle in radians
};

let ducks = [];
const COLORS = ['#4169E1', '#FFD700', '#DC143C', '#32CD32', '#9370DB', '#FFA500'];
const NUM_DUCKS_PER_COLOR = 5;
const MAX_LEVEL = 5;  // Maximum level with all colors
let currentLevel = 1;  // Current level

// Game state variables
let gameState = "waiting"; // states: "waiting", "running", "ended"
let startTime = 0;
let timerValue = 0;
let finalTime = 0;
let mouseX = CANVAS_WIDTH / 2;
let mouseY = CANVAS_HEIGHT / 2;

// Initialize canvas
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// Initialize ducks
function initializeDucks() {
    ducks = [];
    const numColors = Math.min(currentLevel + 1, COLORS.length);  // Increase colors with level
    const totalDucks = NUM_DUCKS_PER_COLOR * numColors;
    const center = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
    const radius = 150; // Start ducks in a larger circle around the center
    
    for (let i = 0; i < totalDucks; i++) {
        const angle = (2 * Math.PI / totalDucks) * i;
        const angleWithRandom = angle + (Math.random() * 0.2 - 0.1); // Slight randomness
        const radiusVar = radius + (Math.random() * 30 - 15);
        
        const pos = {
            x: center.x + Math.cos(angleWithRandom) * radiusVar,
            y: center.y + Math.sin(angleWithRandom) * radiusVar
        };
        
        // Random initial velocity
        const velAngle = Math.random() * Math.PI * 2;
        const velMagnitude = 100 + Math.random() * 100; // Higher initial velocity
        const vel = {
            x: Math.cos(velAngle) * velMagnitude,
            y: Math.sin(velAngle) * velMagnitude
        };
        
        const colorIndex = Math.floor(i / NUM_DUCKS_PER_COLOR);
        ducks.push({
            pos: pos,
            vel: vel,
            color: COLORS[colorIndex],
            radius: DUCK_RADIUS,
            mass: 1.0,
            lastPos: { x: pos.x, y: pos.y } // For collision detection
        });
    }
}

// Vector operations
function vectorLength(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y) || 0.0001;
}

function vectorNormalize(v) {
    const len = vectorLength(v);
    return { x: v.x / len, y: v.y / len };
}

function vectorDistance(v1, v2) {
    return Math.sqrt((v1.x - v2.x) * (v1.x - v2.x) + (v1.y - v2.y) * (v1.y - v2.y)) || 0.0001;
}

function vectorScale(v, scale) {
    return { x: v.x * scale, y: v.y * scale };
}

function vectorAdd(v1, v2) {
    return { x: v1.x + v2.x, y: v1.y + v2.y };
}

function vectorSubtract(v1, v2) {
    return { x: v1.x - v2.x, y: v1.y - v2.y };
}

function vectorScaleToLength(v, length) {
    const currentLength = vectorLength(v);
    if (currentLength === 0) return v;
    return vectorScale(v, length / currentLength);
}

// Check if groups are properly separated
function groupsSeparated() {
    // Group ducks by color
    const groups = {};
    ducks.forEach(duck => {
        if (!groups[duck.color]) {
            groups[duck.color] = [];
        }
        groups[duck.color].push(duck);
    });
    
    // Check if we have the right number of groups
    const numColors = Math.min(currentLevel + 1, COLORS.length);
    if (Object.keys(groups).length < numColors) {
        return false;
    }
    
    // Check each group's tightness and separation
    const centers = {};
    for (const color in groups) {
        const group = groups[color];
        let groupCenter = { x: 0, y: 0 };
        
        // Calculate group center
        group.forEach(duck => {
            groupCenter = vectorAdd(groupCenter, duck.pos);
        });
        groupCenter = vectorScale(groupCenter, 1 / group.length);
        centers[color] = groupCenter;
        
        // Check if all ducks in the group are close to the center
        let maxDistance = 0;
        group.forEach(duck => {
            const distance = vectorDistance(duck.pos, groupCenter);
            maxDistance = Math.max(maxDistance, distance);
        });
        
        // Debug visualization of group centers and radii
        if (gameState === "running") {
            ctx.strokeStyle = color;
            ctx.beginPath();
            ctx.arc(groupCenter.x, groupCenter.y, CLUSTER_RADIUS_THRESHOLD, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        if (maxDistance > CLUSTER_RADIUS_THRESHOLD) {
            return false;
        }
    }
    
    // Check separation between all pairs of groups
    const colors = Object.keys(centers);
    for (let i = 0; i < colors.length; i++) {
        for (let j = i + 1; j < colors.length; j++) {
            const distance = vectorDistance(centers[colors[i]], centers[colors[j]]);
            
            // Debug visualization of group separation
            if (gameState === "running") {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.beginPath();
                ctx.moveTo(centers[colors[i]].x, centers[colors[i]].y);
                ctx.lineTo(centers[colors[j]].x, centers[colors[j]].y);
                ctx.stroke();
            }
            
            if (distance < GROUP_SEPARATION_THRESHOLD) {
                return false;
            }
        }
    }
    
    return true;
}

// Update game state
function update(dt) {
    if (gameState === "running") {
        // Calculate direction to mouse
        const dx = mouseX - dog.x;
        const dy = mouseY - dog.y;
        const distanceToMouse = Math.sqrt(dx * dx + dy * dy);
        
        // Set target angle to point toward mouse
        const targetAngle = Math.atan2(dy, dx);
        
        // Smoothly rotate to face mouse (faster rotation)
        let angleDiff = targetAngle - dog.angle;
        
        // Normalize angle difference to [-PI, PI]
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        
        // Apply smooth rotation with increased speed
        dog.angle += angleDiff * DOG_ROTATION_SPEED * dt;
        
        // Move dog directly towards mouse if beyond follow distance
        if (distanceToMouse > DOG_FOLLOW_DISTANCE) {
            // Calculate target velocity
            const targetVx = (dx / distanceToMouse) * DOG_SPEED;
            const targetVy = (dy / distanceToMouse) * DOG_SPEED;
            
            // Apply smooth acceleration
            dog.vx += (targetVx - dog.vx) * DOG_ACCELERATION * dt;
            dog.vy += (targetVy - dog.vy) * DOG_ACCELERATION * dt;
        } else {
            // Slow down when close to target
            dog.vx *= 0.8;
            dog.vy *= 0.8;
        }
        
        // Update position
        dog.x += dog.vx * dt;
        dog.y += dog.vy * dt;
        
        // Keep dog within bounds
        dog.x = Math.max(DOG_RADIUS, Math.min(CANVAS_WIDTH - DOG_RADIUS, dog.x));
        dog.y = Math.max(DOG_RADIUS, Math.min(CANVAS_HEIGHT - DOG_RADIUS, dog.y));
    }
    
    // Update ducks only if game is running
    if (gameState === "running") {
        ducks.forEach(duck => {
            const center = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
            let acceleration = { x: 0, y: 0 };
            
            // 1. Enhanced repulsion from the dog
            const toDuck = vectorSubtract(duck.pos, { x: dog.x, y: dog.y });
            const distToDog = vectorLength(toDuck);
            
            // Stronger repulsion when very close to dog
            if (distToDog < DOG_EFFECT_RADIUS) {
                const repulsionStrength = DOG_REPULSION_STRENGTH * (1 + (DOG_EFFECT_RADIUS - distToDog) / DOG_EFFECT_RADIUS);
                const repulsion = vectorScale(
                    vectorNormalize(toDuck),
                    repulsionStrength / distToDog
                );
                acceleration = vectorAdd(acceleration, repulsion);
            }
            
            // 2. Enhanced separation from nearby ducks
            let separationForce = { x: 0, y: 0 };
            let countSep = 0;
            
            ducks.forEach(otherDuck => {
                if (otherDuck !== duck) {
                    const diff = vectorSubtract(duck.pos, otherDuck.pos);
                    const d = vectorLength(diff);
                    
                    if (d < SEPARATION_DISTANCE) {
                        // Exponential increase in separation force as ducks get very close
                        const separationFactor = Math.pow(SEPARATION_DISTANCE / (d + 0.1), 2);
                        separationForce = vectorAdd(
                            separationForce,
                            vectorScale(vectorNormalize(diff), separationFactor)
                        );
                        countSep++;
                    }
                }
            });
            
            if (countSep > 0) {
                acceleration = vectorAdd(
                    acceleration,
                    vectorScale(separationForce, SEPARATION_STRENGTH)
                );
            }
            
            // 3. Cohesion: steer toward the average position of up to 3 nearest neighbors
            const distances = [];
            ducks.forEach(otherDuck => {
                if (otherDuck !== duck) {
                    const d = vectorDistance(duck.pos, otherDuck.pos);
                    distances.push({ distance: d, pos: otherDuck.pos });
                }
            });
            
            // Sort by distance
            distances.sort((a, b) => a.distance - b.distance);
            
            if (distances.length > 0) {
                const neighbors = distances.slice(0, Math.min(3, distances.length));
                let avgPos = { x: 0, y: 0 };
                
                neighbors.forEach(neighbor => {
                    avgPos = vectorAdd(avgPos, neighbor.pos);
                });
                
                avgPos = vectorScale(avgPos, 1 / neighbors.length);
                const cohesionVector = vectorSubtract(avgPos, duck.pos);
                acceleration = vectorAdd(
                    acceleration,
                    vectorScale(cohesionVector, COHESION_STRENGTH)
                );
            }
            
            // 4. Ring Attraction: steer back to a target radial distance from the center
            const radialVector = vectorSubtract(duck.pos, center);
            const currentDistance = vectorLength(radialVector);
            const error = currentDistance - TARGET_RING_RADIUS;
            const ringForce = vectorScale(
                vectorNormalize(radialVector),
                -(error * RING_ATTRACTION_STRENGTH)
            );
            acceleration = vectorAdd(acceleration, ringForce);
            
            // 5. Boundary Force: push ducks from the edges if within a margin
            if (duck.pos.x - LEFT_BOUND < BOUNDARY_MARGIN) {
                const factor = 1.0 - ((duck.pos.x - LEFT_BOUND) / BOUNDARY_MARGIN);
                acceleration.x += BOUNDARY_FORCE_STRENGTH * factor;
            }
            if (RIGHT_BOUND - duck.pos.x < BOUNDARY_MARGIN) {
                const factor = 1.0 - ((RIGHT_BOUND - duck.pos.x) / BOUNDARY_MARGIN);
                acceleration.x -= BOUNDARY_FORCE_STRENGTH * factor;
            }
            if (duck.pos.y - TOP_BOUND < BOUNDARY_MARGIN) {
                const factor = 1.0 - ((duck.pos.y - TOP_BOUND) / BOUNDARY_MARGIN);
                acceleration.y += BOUNDARY_FORCE_STRENGTH * factor;
            }
            if (BOTTOM_BOUND - duck.pos.y < BOUNDARY_MARGIN) {
                const factor = 1.0 - ((BOTTOM_BOUND - duck.pos.y) / BOUNDARY_MARGIN);
                acceleration.y -= BOUNDARY_FORCE_STRENGTH * factor;
            }
            
            // Update velocity (with damping)
            duck.vel = vectorAdd(duck.vel, vectorScale(acceleration, dt));
            
            // Limit speed
            const speed = vectorLength(duck.vel);
            if (speed > MAX_SPEED) {
                duck.vel = vectorScaleToLength(duck.vel, MAX_SPEED);
            }
            
            // Apply damping
            duck.vel = vectorScale(duck.vel, DAMPING);
            
            // Update position
            duck.pos = vectorAdd(duck.pos, vectorScale(duck.vel, dt));
            
            // Firm boundaries: clamp and bounce off edges
            if (duck.pos.x < LEFT_BOUND) {
                duck.pos.x = LEFT_BOUND;
                duck.vel.x = Math.abs(duck.vel.x) * BOUNDARY_BOUNCE_FACTOR;
            } else if (duck.pos.x > RIGHT_BOUND) {
                duck.pos.x = RIGHT_BOUND;
                duck.vel.x = -Math.abs(duck.vel.x) * BOUNDARY_BOUNCE_FACTOR;
            }
            
            if (duck.pos.y < TOP_BOUND) {
                duck.pos.y = TOP_BOUND;
                duck.vel.y = Math.abs(duck.vel.y) * BOUNDARY_BOUNCE_FACTOR;
            } else if (duck.pos.y > BOTTOM_BOUND) {
                duck.pos.y = BOTTOM_BOUND;
                duck.vel.y = -Math.abs(duck.vel.y) * BOUNDARY_BOUNCE_FACTOR;
            }
        });
        
        // Check win condition
        if (groupsSeparated()) {
            gameState = "ended";
            finalTime = timerValue;
        }
    }
}

// Draw game state
function draw() {
    // Clear canvas
    ctx.fillStyle = '#282C34'; // Dark background
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Draw subtle boundary
    ctx.strokeStyle = '#464A52'; // Subtle boundary color
    ctx.lineWidth = 2;
    ctx.strokeRect(
        LEFT_BOUND, 
        TOP_BOUND, 
        RIGHT_BOUND - LEFT_BOUND, 
        BOTTOM_BOUND - TOP_BOUND
    );
    
    // Draw target ring
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH/2, CANVAS_HEIGHT/2, TARGET_RING_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw ducks
    ducks.forEach(duck => {
        // Calculate angle for duck orientation
        let angle = 0;
        if (vectorLength(duck.vel) > 0.1) {
            angle = Math.atan2(duck.vel.y, duck.vel.x);
        }
        
        // Draw duck body
        ctx.save();
        ctx.translate(duck.pos.x, duck.pos.y);
        ctx.rotate(angle);
        
        // Body
        const speedFactor = Math.min(vectorLength(duck.vel) / MAX_SPEED, 1.0);
        const elongation = 1.0 + speedFactor * 0.3; // Max 30% elongation
        
        const baseLength = duck.radius * 1.8;
        const baseWidth = duck.radius * 1.2;
        const bodyLength = baseLength * elongation;
        const bodyWidth = baseWidth * (1.0 - speedFactor * 0.2);
        
        ctx.fillStyle = duck.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, bodyLength, bodyWidth, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Wings
        const wingLength = 16;
        const wingWidth = 10;
        const wingFlare = speedFactor;
        
        // Left wing
        ctx.beginPath();
        ctx.moveTo(bodyLength * 0.2, 0);
        ctx.lineTo(bodyLength * 0.2 + wingLength, wingWidth * wingFlare);
        ctx.lineTo(bodyLength * 0.2 + wingLength * 0.7, wingWidth * wingFlare * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Right wing
        ctx.beginPath();
        ctx.moveTo(bodyLength * 0.2, 0);
        ctx.lineTo(bodyLength * 0.2 + wingLength, -wingWidth * wingFlare);
        ctx.lineTo(bodyLength * 0.2 + wingLength * 0.7, -wingWidth * wingFlare * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Beak
        const beakLength = 8;
        const beakWidth = 5;
        ctx.fillStyle = '#FFC864'; // Orange beak
        ctx.beginPath();
        ctx.moveTo(bodyLength * 0.5, 0);
        ctx.lineTo(bodyLength * 0.5 + beakLength, beakWidth);
        ctx.lineTo(bodyLength * 0.5 + beakLength, -beakWidth);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Tail
        const tailLength = 12;
        const tailWidth = 8;
        // Animate tail wagging even when duck is static
        const tailWag = Math.sin(Date.now() * 0.01) * 0.3;
        ctx.beginPath();
        ctx.moveTo(-bodyLength * 0.5, 0);
        ctx.lineTo(-bodyLength * 0.5 - tailLength, tailWidth + tailWag * tailWidth);
        ctx.lineTo(-bodyLength * 0.5 - tailLength, -tailWidth + tailWag * tailWidth);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Eyes
        const eyeOffset = bodyLength * 0.3;
        const perpEye = bodyWidth * 0.3;
        
        // Left eye
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(eyeOffset, perpEye, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Right eye
        ctx.beginPath();
        ctx.arc(eyeOffset, -perpEye, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Pupils - blink occasionally
        const blinkFactor = Math.sin(Date.now() * 0.002) > 0.9 ? 0.1 : 1.0;
        const pupilOffset = 0.3 * 3 * speedFactor;
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(eyeOffset + pupilOffset, perpEye, 2 * blinkFactor, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(eyeOffset + pupilOffset, -perpEye, 2 * blinkFactor, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    });
    
    // Check win condition and visualize groups
    if (gameState === "running") {
        groupsSeparated(); // This will now draw the debug visualization
    }
    
    // Draw dog
    const dogSpeed = vectorLength({ x: dog.vx, y: dog.vy });
    
    ctx.save();
    ctx.translate(dog.x, dog.y);
    ctx.rotate(dog.angle);  // Use the smoothly interpolated angle
    
    // Dog body
    const speedFactor = Math.min(dogSpeed / DOG_SPEED, 1.0);
    const elongation = 1.0 + speedFactor * 0.3;
    
    const baseSize = DOG_RADIUS * 2;
    const bodyLength = baseSize * elongation;
    const bodyWidth = baseSize * (1.0 - speedFactor * 0.2);
    
    ctx.fillStyle = 'white';
    ctx.fillRect(-bodyLength/2, -bodyWidth/2, bodyLength, bodyWidth);
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    ctx.strokeRect(-bodyLength/2, -bodyWidth/2, bodyLength, bodyWidth);
    
    // Dog ears
    const earLength = 12;
    const earWidth = 8;
    
    // Left ear
    ctx.beginPath();
    ctx.moveTo(bodyLength * 0.3, bodyWidth * 0.3);
    ctx.lineTo(bodyLength * 0.3 + earLength, bodyWidth * 0.3 + earWidth);
    ctx.lineTo(bodyLength * 0.3 + earLength * 0.7, bodyWidth * 0.3 + earWidth * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Right ear
    ctx.beginPath();
    ctx.moveTo(bodyLength * 0.3, -bodyWidth * 0.3);
    ctx.lineTo(bodyLength * 0.3 + earLength, -bodyWidth * 0.3 - earWidth);
    ctx.lineTo(bodyLength * 0.3 + earLength * 0.7, -bodyWidth * 0.3 - earWidth * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Dog snout
    const snoutLength = 10;
    const snoutWidth = 8;
    ctx.fillStyle = '#C8C8C8'; // Light gray snout
    ctx.beginPath();
    ctx.moveTo(bodyLength * 0.5, 0);
    ctx.lineTo(bodyLength * 0.5 + snoutLength, snoutWidth);
    ctx.lineTo(bodyLength * 0.5 + snoutLength, -snoutWidth);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Dog tail with wagging animation
    const tailLength = 18;
    const tailWag = Math.sin(Date.now() * 0.01) * speedFactor * 0.5;
    const tailBase = -bodyLength * 0.5;
    const tailTip = tailBase - tailLength;
    const tailWidth = 6;
    
    ctx.beginPath();
    ctx.moveTo(tailBase, 0);
    ctx.lineTo(tailTip, tailWidth/2 + tailWag * tailLength);
    ctx.lineTo(tailTip, -tailWidth/2 + tailWag * tailLength);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Dog eyes
    const eyeOffset = bodyLength * 0.3;
    const perpEye = bodyWidth * 0.3;
    
    // Left eye
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(eyeOffset, perpEye, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Right eye
    ctx.beginPath();
    ctx.arc(eyeOffset, -perpEye, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Pupils
    const pupilOffset = 0.3 * 3 * speedFactor;
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(eyeOffset + pupilOffset, perpEye, 2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(eyeOffset + pupilOffset, -perpEye, 2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
    
    // Draw timer and game state
    ctx.fillStyle = 'white';
    ctx.font = '24px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Time: ${timerValue.toFixed(1)}s`, 20, 30);
    ctx.fillText(`Level: ${currentLevel}`, 20, 60);
    
    if (gameState === "waiting") {
        ctx.font = '36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Click to start', CANVAS_WIDTH/2, CANVAS_HEIGHT/2);
    } else if (gameState === "ended") {
        ctx.font = '36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Level ${currentLevel} Complete! Time: ${finalTime.toFixed(1)}s`, CANVAS_WIDTH/2, CANVAS_HEIGHT/2);
        
        if (currentLevel < MAX_LEVEL) {
            ctx.font = '24px Arial';
            ctx.fillText('Click to start next level', CANVAS_WIDTH/2, CANVAS_HEIGHT/2 + 40);
        } else {
            ctx.font = '24px Arial';
            ctx.fillText('Game Complete! Click to restart', CANVAS_WIDTH/2, CANVAS_HEIGHT/2 + 40);
        }
    }
    
    // Draw instructions
    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Move your mouse to control the dog', CANVAS_WIDTH/2, CANVAS_HEIGHT - 20);
}

// Game loop
let lastTime = 0;
function gameLoop(timestamp) {
    // Calculate delta time
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    
    // Update timer
    if (gameState === "running") {
        timerValue += dt;
    }
    
    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

// Handle keyboard input
document.addEventListener('keydown', (e) => {
    if (gameState === "running") {
        switch(e.key) {
            case 'ArrowUp':
                dog.targetY = dog.y - 50;
                break;
            case 'ArrowDown':
                dog.targetY = dog.y + 50;
                break;
            case 'ArrowLeft':
                dog.targetX = dog.x - 50;
                break;
            case 'ArrowRight':
                dog.targetX = dog.x + 50;
                break;
        }
    }
});

// Handle mouse movement
canvas.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});

// Handle mouse click
canvas.addEventListener('click', (e) => {
    if (gameState === "waiting") {
        gameState = "running";
        startTime = Date.now();
    } else if (gameState === "ended") {
        if (currentLevel < MAX_LEVEL) {
            currentLevel++;
        } else {
            currentLevel = 1; // Reset to level 1
        }
        gameState = "running";
        timerValue = 0;
        initializeDucks();
    }
});

// Start game
initializeDucks();
requestAnimationFrame(gameLoop); 