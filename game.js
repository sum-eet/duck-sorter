// Game constants
const CANVAS_WIDTH = window.innerWidth;
const CANVAS_HEIGHT = window.innerHeight;
const DUCK_RADIUS = 12;
const DOG_RADIUS = 21; // 1.5x bigger than before
const DOG_SPEED = 320.0;
const DOG_ROTATION_SPEED = 10.0;
const DOG_ACCELERATION = 5.0;
const DOG_EFFECT_RADIUS = 150;
const DOG_REPULSION_STRENGTH = 50000;
const MAX_SPEED = 300;
const DAMPING = 0.98;
const SEPARATION_DISTANCE = 40;
const SEPARATION_STRENGTH = 2.0;
const COHESION_STRENGTH = 0.5;
const TARGET_RING_RADIUS = 200;
const RING_ATTRACTION_STRENGTH = 1.0;
const BOUNDARY_MARGIN = 50;
const BOUNDARY_FORCE_STRENGTH = 500;
const BOUNDARY_BOUNCE_FACTOR = 0.5;
const CLUSTER_RADIUS_THRESHOLD = 50.0;
const GROUP_SEPARATION_THRESHOLD = 150.0;
const DOG_FOLLOW_DISTANCE = 0; // No gap between dog and mouse

// Game boundaries
const LEFT_BOUND = DUCK_RADIUS * 2;
const RIGHT_BOUND = CANVAS_WIDTH - DUCK_RADIUS * 2;
const TOP_BOUND = DUCK_RADIUS * 2;
const BOTTOM_BOUND = CANVAS_HEIGHT - DUCK_RADIUS * 2;

// Game state
const dog = {
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT / 2,
    vx: 0,
    vy: 0,
    angle: 0, // Current angle
    targetAngle: 0 // Target angle for smooth rotation
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

// Initialize ducks in a circle with random velocities
function initializeDucks() {
    ducks = [];
    const numColors = Math.min(currentLevel + 1, MAX_LEVEL);
    const ducksPerColor = numColors <= 2 ? 5 : 
                         numColors <= 3 ? 4 : 3;
    const totalDucks = numColors * ducksPerColor;
    
    // Create all ducks first
    for (let i = 0; i < totalDucks; i++) {
        const colorIndex = Math.floor(i / ducksPerColor);
        const angle = (i * 2 * Math.PI) / totalDucks;
        const radius = Math.min(CANVAS_WIDTH, CANVAS_HEIGHT) * 0.35;
        
        ducks.push({
            x: CANVAS_WIDTH / 2 + Math.cos(angle) * radius,
            y: CANVAS_HEIGHT / 2 + Math.sin(angle) * radius,
            vx: (Math.random() - 0.5) * 100,
            vy: (Math.random() - 0.5) * 100,
            color: COLORS[colorIndex],
            tailAngle: 0,
            eyeBlink: 0,
            eyeBlinkTimer: Math.random() * 5
        });
    }
    
    // Shuffle the ducks to intermix colors
    for (let i = ducks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ducks[i], ducks[j]] = [ducks[j], ducks[i]];
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
    if (gameState !== "running") return false;
    
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
            groupCenter = vectorAdd(groupCenter, duck);
        });
        groupCenter = vectorScale(groupCenter, 1 / group.length);
        centers[color] = groupCenter;
        
        // Check if all ducks in the group are close to the center
        let maxDistance = 0;
        group.forEach(duck => {
            const distance = vectorDistance(duck, groupCenter);
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
        // Move dog directly to mouse position
        dog.x = mouseX;
        dog.y = mouseY;
        
        // Calculate angle for dog rotation
        const dx = mouseX - dog.x;
        const dy = mouseY - dog.y;
        dog.angle = Math.atan2(dy, dx);
        
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
            const toDuck = vectorSubtract(duck, { x: dog.x, y: dog.y });
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
                    const diff = vectorSubtract(duck, otherDuck);
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
            
            // 3. Cohesion: steer toward the average position of up to 3 nearest neighbors of same color
            const distances = [];
            ducks.forEach(otherDuck => {
                if (otherDuck !== duck && otherDuck.color === duck.color) {
                    const d = vectorDistance(duck, otherDuck);
                    distances.push({ distance: d, pos: otherDuck });
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
                const cohesionVector = vectorSubtract(duck, avgPos);
                acceleration = vectorAdd(
                    acceleration,
                    vectorScale(cohesionVector, COHESION_STRENGTH)
                );
            }
            
            // 4. Ring Attraction: steer back to a target radial distance from the center
            const radialVector = vectorSubtract(duck, center);
            const currentDistance = vectorLength(radialVector);
            const error = currentDistance - TARGET_RING_RADIUS;
            const ringForce = vectorScale(
                vectorNormalize(radialVector),
                -(error * RING_ATTRACTION_STRENGTH)
            );
            acceleration = vectorAdd(acceleration, ringForce);
            
            // 5. Enhanced Boundary Force: stronger centripetal force near edges
            const margin = BOUNDARY_MARGIN;
            const maxForce = BOUNDARY_FORCE_STRENGTH * 2;
            
            if (duck.x < LEFT_BOUND + margin) {
                const factor = Math.pow(1.0 - ((duck.x - LEFT_BOUND) / margin), 2);
                acceleration.x += maxForce * factor;
                // Add centripetal force towards center
                const toCenter = vectorSubtract(center, duck);
                const centripetalForce = vectorScale(vectorNormalize(toCenter), maxForce * factor);
                acceleration = vectorAdd(acceleration, centripetalForce);
            }
            if (RIGHT_BOUND - duck.x < margin) {
                const factor = Math.pow(1.0 - ((RIGHT_BOUND - duck.x) / margin), 2);
                acceleration.x -= maxForce * factor;
                // Add centripetal force towards center
                const toCenter = vectorSubtract(center, duck);
                const centripetalForce = vectorScale(vectorNormalize(toCenter), maxForce * factor);
                acceleration = vectorAdd(acceleration, centripetalForce);
            }
            if (duck.y < TOP_BOUND + margin) {
                const factor = Math.pow(1.0 - ((duck.y - TOP_BOUND) / margin), 2);
                acceleration.y += maxForce * factor;
                // Add centripetal force towards center
                const toCenter = vectorSubtract(center, duck);
                const centripetalForce = vectorScale(vectorNormalize(toCenter), maxForce * factor);
                acceleration = vectorAdd(acceleration, centripetalForce);
            }
            if (BOTTOM_BOUND - duck.y < margin) {
                const factor = Math.pow(1.0 - ((BOTTOM_BOUND - duck.y) / margin), 2);
                acceleration.y -= maxForce * factor;
                // Add centripetal force towards center
                const toCenter = vectorSubtract(center, duck);
                const centripetalForce = vectorScale(vectorNormalize(toCenter), maxForce * factor);
                acceleration = vectorAdd(acceleration, centripetalForce);
            }
            
            // Update velocity (with damping)
            duck.vx += acceleration.x * dt;
            duck.vy += acceleration.y * dt;
            
            // Limit speed
            const speed = vectorLength({ x: duck.vx, y: duck.vy });
            if (speed > MAX_SPEED) {
                duck.vx = (duck.vx / speed) * MAX_SPEED;
                duck.vy = (duck.vy / speed) * MAX_SPEED;
            }
            
            // Apply damping
            duck.vx *= DAMPING;
            duck.vy *= DAMPING;
            
            // Update position only if game is running
            if (gameState === "running") {
                duck.x += duck.vx * dt;
                duck.y += duck.vy * dt;
            }
            
            // Firm boundaries: clamp and bounce off edges
            if (duck.x < LEFT_BOUND) {
                duck.x = LEFT_BOUND;
                duck.vx = Math.abs(duck.vx) * BOUNDARY_BOUNCE_FACTOR;
            } else if (duck.x > RIGHT_BOUND) {
                duck.x = RIGHT_BOUND;
                duck.vx = -Math.abs(duck.vx) * BOUNDARY_BOUNCE_FACTOR;
            }
            
            if (duck.y < TOP_BOUND) {
                duck.y = TOP_BOUND;
                duck.vy = Math.abs(duck.vy) * BOUNDARY_BOUNCE_FACTOR;
            } else if (duck.y > BOTTOM_BOUND) {
                duck.y = BOTTOM_BOUND;
                duck.vy = -Math.abs(duck.vy) * BOUNDARY_BOUNCE_FACTOR;
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
        if (vectorLength({ x: duck.vx, y: duck.vy }) > 0.1) {
            angle = Math.atan2(duck.vy, duck.vx);
        }
        
        // Draw duck body
        ctx.save();
        ctx.translate(duck.x, duck.y);
        ctx.rotate(angle);
        
        // Body
        const speedFactor = Math.min(vectorLength({ x: duck.vx, y: duck.vy }) / MAX_SPEED, 1.0);
        const elongation = 1.0 + speedFactor * 0.3; // Max 30% elongation
        
        const baseLength = DUCK_RADIUS * 1.8;
        const baseWidth = DUCK_RADIUS * 1.2;
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

// Handle mouse movement
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
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