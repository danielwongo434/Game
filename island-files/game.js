const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

const TILE_SIZE = 60; // 16 x 9 visible grid
const COLS = Math.floor(WIDTH / TILE_SIZE);   // 16
const VIEW_ROWS = Math.floor(HEIGHT / TILE_SIZE); // 9

const WORLD_ROWS = 18; // 2 x 9 rows (two "floors" stacked)
const WORLD_HEIGHT = WORLD_ROWS * TILE_SIZE;

// TILE TYPES
// 0 = floor, 1 = wall, 2 = corridor door (closed)
let map = [];

// Build solid walls everywhere
for (let y = 0; y < WORLD_ROWS; y++) {
  const row = [];
  for (let x = 0; x < COLS; x++) {
    row.push(1);
  }
  map.push(row);
}

// Helper to carve floor rectangle (inclusive)
function carveRect(x1, y1, x2, y2) {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      if (
        y > 0 && y < WORLD_ROWS - 1 &&
        x > 0 && x < COLS - 1
      ) {
        map[y][x] = 0;
      }
    }
  }
}

// Global central corridor (2 tiles wide) full height (except edges)
carveRect(7, 1, 8, WORLD_ROWS - 2);

// Build a 4–room block starting at baseRow (0 or 9)
function buildCluster(baseRow) {
  // Top-left room: cols 1–5, rows baseRow+1..baseRow+3
  carveRect(1, baseRow + 1, 5, baseRow + 3);
  // Top-right room: cols 10–14
  carveRect(10, baseRow + 1, 14, baseRow + 3);
  // Bottom-left room: rows baseRow+5..baseRow+7
  carveRect(1, baseRow + 5, 5, baseRow + 7);
  // Bottom-right room
  carveRect(10, baseRow + 5, 14, baseRow + 7);

  // Doors (all 1 tile wide)

  // Rooms → corridor
  map[baseRow + 2][6] = 0; // TL → corridor
  map[baseRow + 6][6] = 0; // BL → corridor
  map[baseRow + 2][9] = 0; // TR → corridor
  map[baseRow + 6][9] = 0; // BR → corridor

  // Between top/bottom rooms
  map[baseRow + 4][3] = 0;   // left side TL ↔ BL
  map[baseRow + 4][12] = 0;  // right side TR ↔ BR
}

// Top cluster (rows 0..8)
buildCluster(0);
// Bottom cluster (rows 9..17)
buildCluster(9);

// ==== CORRIDOR DOOR BETWEEN CLUSTERS ====
// Row 8 = barrier row, with a single corridor door at col 7
for (let x = 0; x < COLS; x++) {
  map[8][x] = 1; // wall row between clusters
}
map[8][7] = 2; // closed corridor door tile

let corridorDoorUnlocked = false; // true when door actually opens
let hasKeycard = false;           // true once keycard picked up

// ==== OFFICE PROPS ====
const props = [];

function addOffice(cx, cy) {
  // Desk
  props.push({ type: "desk", x: cx - 45, y: cy - 10, w: 90, h: 32, solid: true });

  // Chair (below desk)
  props.push({ type: "chair", x: cx - 18, y: cy + 22, w: 36, h: 20, solid: false });

  // Monitor
  props.push({
    type: "monitor",
    x: cx - 26,
    y: cy - 38,
    w: 52,
    h: 26,
    solid: false,
    seed: Math.random() * 10
  });

  // Tower
  props.push({
    type: "tower",
    x: cx + 50,
    y: cy - 2,
    w: 18,
    h: 32,
    solid: true
  });

  // Cabinet
  props.push({
    type: "cabinet",
    x: cx - 80,
    y: cy - 40,
    w: 28,
    h: 42,
    solid: true
  });

  // Plant
  props.push({
    type: "plant",
    x: cx + 70,
    y: cy - 45,
    w: 22,
    h: 30,
    solid: false
  });
}

function tileCenter(tx, ty) {
  return {
    x: (tx + 0.5) * TILE_SIZE,
    y: (ty + 0.5) * TILE_SIZE
  };
}

// Add offices to all 8 rooms
function addOfficesForCluster(baseRow) {
  const tl = tileCenter(3, baseRow + 2);
  const tr = tileCenter(12, baseRow + 2);
  const bl = tileCenter(3, baseRow + 6);
  const br = tileCenter(12, baseRow + 6);
  addOffice(tl.x, tl.y);
  addOffice(tr.x, tr.y);
  addOffice(bl.x, bl.y);
  addOffice(br.x, br.y);
}

addOfficesForCluster(0);  // top 4 rooms
addOfficesForCluster(9);  // bottom 4 rooms

// ==== KEYCARD (OBJECTIVE) ====
// Put a keycard in the top-right room of the bottom cluster
const keyTile = tileCenter(12, 11); // baseRow 9 -> 9+2 = 11 (TR room center)
props.push({
  type: "keycard",
  x: keyTile.x - 15,
  y: keyTile.y - 10,
  w: 30,
  h: 18,
  solid: false,
  collected: false
});

let messageText = "";
let messageTimer = 0; // ms

function showMessage(text, duration) {
  messageText = text;
  messageTimer = duration;
}

// ==== PLAYER SETUP ====
const player = {
  x: 7.5 * TILE_SIZE,            // central corridor
  y: 15.5 * TILE_SIZE,           // near bottom cluster
  speed: 0.18,
  dir: "up",
  moving: false,
  frame: 1,
  frameTime: 0
};

// Camera (vertical scroll)
let cameraY = WORLD_HEIGHT - HEIGHT;

// Sprite sheet info
const sprite = new Image();
sprite.src = "agent.png";
const SPRITE_COLS = 3;
const SPRITE_ROWS = 4;
let FRAME_W = 32;
let FRAME_H = 32;
const ANIM_SPEED = 120;

sprite.onload = () => {
  FRAME_W = sprite.width / SPRITE_COLS;
  FRAME_H = sprite.height / SPRITE_ROWS;
};

// INPUT
const keys = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
  w: false,
  a: false,
  s: false,
  d: false
};

let spacePressed = false;

window.addEventListener("keydown", (e) => {
  if (e.key in keys) keys[e.key] = true;
  if (e.code === "Space") {
    e.preventDefault();
    spacePressed = true;
  }
});

window.addEventListener("keyup", (e) => {
  if (e.key in keys) keys[e.key] = false;
  if (e.code === "Space") {
    spacePressed = false;
  }
});

let lastTime = 0;
let idleTime = 0;
let globalTime = 0;

// ==== GUARDS (FLOATING DRONES) ====
const VISION_RANGE = 260;
const VISION_ANGLE = Math.PI / 4; // 45°

const guards = [
  // Bottom corridor drone, patrolling vertically
  {
    x: 7.5 * TILE_SIZE,
    y: 14.5 * TILE_SIZE,
    min: 13.5 * TILE_SIZE,
    max: 16.5 * TILE_SIZE,
    vertical: true,
    dir: -1,
    speed: 0.06,
    facing: "up",
    seed: Math.random() * 10
  },
  // Top corridor drone
  {
    x: 7.5 * TILE_SIZE,
    y: 3.5 * TILE_SIZE,
    min: 1.5 * TILE_SIZE,
    max: 6.5 * TILE_SIZE,
    vertical: true,
    dir: 1,
    speed: 0.06,
    facing: "down",
    seed: Math.random() * 10
  }
];

function resetLevel() {
  player.x = 7.5 * TILE_SIZE;
  player.y = 15.5 * TILE_SIZE;
  cameraY = WORLD_HEIGHT - HEIGHT;

  hasKeycard = false;
  corridorDoorUnlocked = false;
  map[8][7] = 2; // close the door

  // Reset keycard
  for (const p of props) {
    if (p.type === "keycard") {
      p.collected = false;
    }
  }
}

function triggerDetection() {
  resetLevel();
  showMessage("Detected! Returning to start...", 2500);
}

function getFacingAngle(facing) {
  switch (facing) {
    case "right": return 0;
    case "left":  return Math.PI;
    case "down":  return Math.PI / 2;
    case "up":    return -Math.PI / 2;
    default:      return 0;
  }
}

// LOS test: raycast between (x1,y1) and (x2,y2) against walls and solid props
function hasLineOfSight(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return true;

  const stepLen = TILE_SIZE / 4;
  const steps = Math.ceil(dist / stepLen);
  const stepX = dx / steps;
  const stepY = dy / steps;

  for (let i = 1; i <= steps; i++) {
    const sx = x1 + stepX * i;
    const sy = y1 + stepY * i;

    const col = Math.floor(sx / TILE_SIZE);
    const row = Math.floor(sy / TILE_SIZE);

    if (row < 0 || row >= WORLD_ROWS || col < 0 || col >= COLS) return false;

    const tile = map[row][col];
    if (tile === 1 || (tile === 2 && !corridorDoorUnlocked)) {
      return false;
    }

    // Solid props also block line of sight
    for (const p of props) {
      if (!p.solid) continue;
      if (sx > p.x && sx < p.x + p.w && sy > p.y && sy < p.y + p.h) {
        return false;
      }
    }
  }

  return true;
}

function guardSeesPlayer(g) {
  const dx = player.x - g.x;
  const dy = player.y - g.y;
  const dist = Math.hypot(dx, dy);
  if (dist > VISION_RANGE) return false;

  const angleToPlayer = Math.atan2(dy, dx);
  const facingAngle = getFacingAngle(g.facing);

  let diff = angleToPlayer - facingAngle;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // wrap to [-π, π]

  if (Math.abs(diff) > VISION_ANGLE) return false;

  // Check walls/props between
  if (!hasLineOfSight(g.x, g.y, player.x, player.y)) return false;

  return true;
}

function updateGuards(dt) {
  for (const g of guards) {
    if (g.vertical) {
      g.y += g.dir * g.speed * dt;
      if (g.y < g.min) {
        g.y = g.min;
        g.dir = 1;
        g.facing = "down";
      } else if (g.y > g.max) {
        g.y = g.max;
        g.dir = -1;
        g.facing = "up";
      }
    } else {
      g.x += g.dir * g.speed * dt;
      if (g.x < g.min) {
        g.x = g.min;
        g.dir = 1;
        g.facing = "right";
      } else if (g.x > g.max) {
        g.x = g.max;
        g.dir = -1;
        g.facing = "left";
      }
    }

    if (guardSeesPlayer(g)) {
      triggerDetection();
      // Once one sees you, no need to check others this frame
      break;
    }
  }
}

// ===== MAIN LOOP =====
function loop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = timestamp - lastTime;
  lastTime = timestamp;

  globalTime += dt;

  update(dt);
  updateCamera();
  draw();

  requestAnimationFrame(loop);
}

function canMoveTo(nx, ny) {
  // Tile collision
  const col = Math.floor(nx / TILE_SIZE);
  const row = Math.floor(ny / TILE_SIZE);

  if (row < 0 || row >= WORLD_ROWS || col < 0 || col >= COLS) return false;

  const tile = map[row][col];
  if (tile === 1) return false;                   // wall
  if (tile === 2 && !corridorDoorUnlocked) return false; // closed corridor door

  // Props collision
  for (const p of props) {
    if (!p.solid) continue;
    if (nx > p.x && nx < p.x + p.w && ny > p.y && ny < p.y + p.h) {
      return false;
    }
  }

  return true;
}

// SPACE + proximity → pick up keycard
function checkKeycardPickup() {
  if (!spacePressed || hasKeycard) return;

  for (const p of props) {
    if (p.type !== "keycard" || p.collected) continue;

    const centerX = p.x + p.w / 2;
    const centerY = p.y + p.h / 2;
    const dx = player.x - centerX;
    const dy = player.y - centerY;
    const dist = Math.hypot(dx, dy);

    const pickupRadius = 70;

    if (dist < pickupRadius) {
      p.collected = true;
      hasKeycard = true;
      showMessage("Keycard acquired. Find the corridor door.", 3500);
    }
  }
}

// SPACE + proximity to door → unlock door (if you have keycard)
function checkDoorOpen() {
  if (!spacePressed || corridorDoorUnlocked || !hasKeycard) return;

  const doorCol = 7;
  const doorRow = 8;
  const doorCenterX = (doorCol + 0.5) * TILE_SIZE;
  const doorCenterY = (doorRow + 0.5) * TILE_SIZE;

  const dx = player.x - doorCenterX;
  const dy = player.y - doorCenterY;
  const dist = Math.hypot(dx, dy);

  const doorRadius = 70;

  if (dist < doorRadius) {
    corridorDoorUnlocked = true;
    map[8][7] = 0; // open door to floor
    showMessage("Door unlocked. Head to the upper offices.", 3500);
  }
}

function update(dt) {
  let dx = 0;
  let dy = 0;

  if (keys.ArrowUp || keys.w) dy -= 1;
  if (keys.ArrowDown || keys.s) dy += 1;
  if (keys.ArrowLeft || keys.a) dx -= 1;
  if (keys.ArrowRight || keys.d) dx += 1;

  player.moving = dx !== 0 || dy !== 0;

  if (player.moving) {
    const len = Math.hypot(dx, dy);
    if (len !== 0) {
      dx /= len;
      dy /= len;
    }

    const stepX = dx * player.speed * dt;
    const stepY = dy * player.speed * dt;

    let newX = player.x + stepX;
    let newY = player.y;

    if (!canMoveTo(newX, newY)) newX = player.x;

    newY = player.y + stepY;
    if (!canMoveTo(newX, newY)) newY = player.y;

    player.x = newX;
    player.y = newY;

    if (Math.abs(dx) > Math.abs(dy)) {
      player.dir = dx > 0 ? "right" : "left";
    } else {
      player.dir = dy > 0 ? "down" : "up";
    }

    player.frameTime += dt;
    if (player.frameTime >= ANIM_SPEED) {
      player.frameTime = 0;
      player.frame = (player.frame + 1) % SPRITE_COLS;
    }

    idleTime = 0;
  } else {
    player.frame = 1;
    player.frameTime = 0;
    idleTime += dt;
  }

  // Interactions
  checkKeycardPickup();
  checkDoorOpen();

  // Guards (movement + detection)
  updateGuards(dt);

  // Message timer
  if (messageTimer > 0) {
    messageTimer -= dt;
    if (messageTimer <= 0) {
      messageTimer = 0;
      messageText = "";
    }
  }
}

function updateCamera() {
  cameraY = player.y - HEIGHT / 2;
  if (cameraY < 0) cameraY = 0;
  if (cameraY > WORLD_HEIGHT - HEIGHT) cameraY = WORLD_HEIGHT - HEIGHT;
}

// ==== PROP DRAWING ====
function drawDesk(p) {
  ctx.fillStyle = "#8b4a2f";
  ctx.fillRect(p.x - 0, p.y - cameraY, p.w, p.h);
  ctx.fillStyle = "#b96b45";
  ctx.fillRect(p.x, p.y - cameraY, p.w, 4);
  const legW = 8, legH = 18;
  ctx.fillStyle = "#5b301f";
  ctx.fillRect(p.x + 6, p.y - cameraY + p.h, legW, legH);
  ctx.fillRect(p.x + p.w - 6 - legW, p.y - cameraY + p.h, legW, legH);
}

function drawChair(p) {
  ctx.fillStyle = "#374151";
  ctx.fillRect(p.x, p.y - cameraY, p.w, p.h);
  ctx.fillStyle = "#4b5563";
  ctx.fillRect(p.x, p.y - cameraY - 10, p.w, 10);
}

function drawMonitor(p) {
  ctx.fillStyle = "#111827";
  ctx.fillRect(p.x, p.y - cameraY, p.w, p.h);
  const t = globalTime;
  const flick = 0.5 + 0.5 * Math.sin(t / 120 + (p.seed || 0));
  const baseG = 180;
  const g = Math.floor(baseG + flick * 60);
  ctx.fillStyle = `rgb(40, ${g}, ${g + 10})`;
  ctx.fillRect(p.x + 4, p.y - cameraY + 4, p.w - 8, p.h - 10);
  ctx.fillStyle = "#4b5563";
  ctx.fillRect(p.x + p.w / 2 - 6, p.y - cameraY + p.h, 12, 6);
}

function drawTower(p) {
  ctx.fillStyle = "#1f2933";
  ctx.fillRect(p.x, p.y - cameraY, p.w, p.h);
  ctx.fillStyle = "#4b5563";
  ctx.fillRect(p.x + 3, p.y - cameraY + 4, p.w - 6, p.h - 8);
  ctx.fillStyle = "#10b981";
  ctx.fillRect(p.x + p.w - 6, p.y - cameraY + p.h - 10, 4, 6);
}

function drawCabinet(p) {
  ctx.fillStyle = "#8b4a2f";
  ctx.fillRect(p.x, p.y - cameraY, p.w, p.h);
  ctx.fillStyle = "#b96b45";
  ctx.fillRect(p.x + 3, p.y - cameraY + 5, p.w - 6, 4);
  ctx.fillRect(p.x + 3, p.y - cameraY + p.h / 2, p.w - 6, 4);
  ctx.fillStyle = "#e5e7eb";
  ctx.fillRect(p.x + p.w / 2 - 2, p.y - cameraY + 6, 4, 2);
  ctx.fillRect(p.x + p.w / 2 - 2, p.y - cameraY + p.h / 2 + 1, 4, 2);
}

function drawPlant(p) {
  ctx.fillStyle = "#166534";
  ctx.beginPath();
  ctx.ellipse(
    p.x + p.w / 2,
    p.y - cameraY + p.h / 2,
    p.w / 2,
    p.h / 2,
    0, 0, Math.PI * 2
  );
  ctx.fill();
  ctx.fillStyle = "#78350f";
  ctx.fillRect(p.x + p.w / 2 - 4, p.y - cameraY + p.h - 6, 8, 6);
}

// Keycard + upside-down green arrow
function drawKeycard(p) {
  if (p.collected) return;

  const y = p.y - cameraY;

  // Keycard body
  ctx.fillStyle = "#facc15";
  ctx.fillRect(p.x, y, p.w, p.h);
  ctx.strokeStyle = "#854d0e";
  ctx.lineWidth = 2;
  ctx.strokeRect(p.x, y, p.w, p.h);
  ctx.fillStyle = "#1f2937";
  ctx.fillRect(p.x + 4, y + 6, p.w - 8, 4); // stripe

  // Upside-down pulsing green arrow pointing at the card
  const cx = p.x + p.w / 2;
  const tipY = y - 4;          // tip just above the card
  const baseY = tipY - 18;     // base higher up
  const pulse = 0.5 + 0.5 * Math.sin(globalTime / 300);
  const alpha = 0.3 + 0.7 * pulse;

  ctx.fillStyle = `rgba(34,197,94,${alpha})`; // bright green

  ctx.beginPath();
  ctx.moveTo(cx, tipY);        // tip near card
  ctx.lineTo(cx - 10, baseY);  // upper left
  ctx.lineTo(cx + 10, baseY);  // upper right
  ctx.closePath();
  ctx.fill();
}

// ===== GUARD DRAWING =====
function drawGuards() {
  for (const g of guards) {
    const cx = g.x;
    const cy = g.y - cameraY;

    // Vision cone
    const facingAngle = getFacingAngle(g.facing);
    const startAngle = facingAngle - VISION_ANGLE;
    const endAngle = facingAngle + VISION_ANGLE;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const ang = startAngle + (endAngle - startAngle) * t;
      const px = cx + Math.cos(ang) * VISION_RANGE;
      const py = cy + Math.sin(ang) * VISION_RANGE;
      ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(248,113,113,0.16)"; // soft red
    ctx.fill();

    // Floating robot body
    const bob = Math.sin(globalTime / 400 + g.seed) * 3;

    // Outer ring
    ctx.beginPath();
    ctx.fillStyle = "#1f2933";
    ctx.arc(cx, cy + bob, 18, 0, Math.PI * 2);
    ctx.fill();

    // Inner body
    ctx.beginPath();
    ctx.fillStyle = "#4b5563";
    ctx.arc(cx, cy + bob, 14, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.beginPath();
    ctx.fillStyle = "#f97373";
    ctx.arc(cx, cy + bob, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = "#fee2e2";
    ctx.arc(cx + 2, cy + bob - 2, 3, 0, Math.PI * 2);
    ctx.fill();

    // Little bottom thruster glow
    ctx.fillStyle = "rgba(96,165,250,0.8)";
    ctx.beginPath();
    ctx.ellipse(cx, cy + bob + 16, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawProps() {
  for (const p of props) {
    if (p.type === "keycard" && p.collected) continue;

    switch (p.type) {
      case "desk":    drawDesk(p); break;
      case "chair":   drawChair(p); break;
      case "monitor": drawMonitor(p); break;
      case "tower":   drawTower(p); break;
      case "cabinet": drawCabinet(p); break;
      case "plant":   drawPlant(p); break;
      case "keycard": drawKeycard(p); break;
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  const startRow = Math.floor(cameraY / TILE_SIZE);
  const endRow = Math.min(WORLD_ROWS - 1, startRow + VIEW_ROWS + 1);

  // Tiles
  for (let y = startRow; y <= endRow; y++) {
    for (let x = 0; x < COLS; x++) {
      const tile = map[y][x];
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE - cameraY;

      if (tile === 1) {
        ctx.fillStyle = "#111827";
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = "#1f2937";
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
      } else if (tile === 2) {
        // corridor door (locked or unlocked visual)
        ctx.fillStyle = "#020617";
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = corridorDoorUnlocked ? "#16a34a" : "#9ca3af";
        ctx.fillRect(px + 8, py + 8, TILE_SIZE - 16, TILE_SIZE - 16);
        ctx.fillStyle = "#111827";
        ctx.fillRect(px + TILE_SIZE / 2 - 3, py + TILE_SIZE / 2 - 3, 6, 6);
      } else {
        // floor
        ctx.fillStyle = "#020617";
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  // Guards (vision cones + bodies)
  drawGuards();

  // Props
  drawProps();

  // Player
  const px = player.x;
  const py = player.y - cameraY;
  const idleOffset = player.moving ? 0 : Math.sin(idleTime / 400) * 2;

  if (sprite.complete && sprite.naturalWidth) {
    const dirIndex =
      player.dir === "right" ? 1 :
      player.dir === "left"  ? 0 :
      player.dir === "down"  ? 2 : 3;

    const sx = player.frame * FRAME_W;
    const sy = dirIndex * FRAME_H;

    const drawSize = 64;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      sprite,
      sx, sy, FRAME_W, FRAME_H,
      px - drawSize / 2,
      py - drawSize / 2 + idleOffset,
      drawSize,
      drawSize
    );
  }

  // HUD message
  if (messageTimer > 0 && messageText) {
    ctx.fillStyle = "rgba(15,23,42,0.8)";
    ctx.fillRect(0, 0, WIDTH, 40);
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "18px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(messageText, WIDTH / 2, 20);
  }

  // Bottom hint depending on state
  ctx.fillStyle = "rgba(15,23,42,0.75)";
  ctx.fillRect(0, HEIGHT - 40, WIDTH, 40);
  ctx.fillStyle = "#a7f3d0";
  ctx.font = "16px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const keyProp = props.find(p => p.type === "keycard" && !p.collected);

  if (keyProp && !hasKeycard) {
    ctx.fillText("Find the keycard and press SPACE to pick it up.", WIDTH / 2, HEIGHT - 20);
  } else if (hasKeycard && !corridorDoorUnlocked) {
    ctx.fillText("Go to the corridor door and press SPACE to unlock it.", WIDTH / 2, HEIGHT - 20);
  } else if (corridorDoorUnlocked) {
    ctx.fillText("Avoid the drones and reach the upper offices.", WIDTH / 2, HEIGHT - 20);
  }
}

requestAnimationFrame(loop);
