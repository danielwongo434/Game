const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

const TILE_SIZE = 60; // 16 x 9 grid
const COLS = Math.floor(WIDTH / TILE_SIZE);  // 16
const ROWS = Math.floor(HEIGHT / TILE_SIZE); // 9

// 0 = floor, 1 = wall
let map = [];

// Build solid walls everywhere
for (let y = 0; y < ROWS; y++) {
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
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
        map[y][x] = 0;
      }
    }
  }
}

// ---- Layout: 4 rooms + corridor ----
// Perimeter walls stay as 1 (we don't carve on row 0, row 8, col 0, col 15)

// Central corridor (2 tiles wide) from row 1 to row 7
// Columns 7 and 8 are the corridor
carveRect(7, 1, 8, 7);

// Top-left room floor: cols 1–5, rows 1–3
carveRect(1, 1, 5, 3);
// Top-right room floor: cols 10–14, rows 1–3
carveRect(10, 1, 14, 3);
// Bottom-left room floor: cols 1–5, rows 5–7
carveRect(1, 5, 5, 7);
// Bottom-right room floor: cols 10–14, rows 5–7
carveRect(10, 5, 14, 7);

// Doors (one tile wide)
// Rooms → corridor
map[2][6] = 0; // TL → corridor
map[6][6] = 0; // BL → corridor
map[2][9] = 0; // TR → corridor
map[6][9] = 0; // BR → corridor

// Between top/bottom rooms
map[4][3] = 0;   // left side TL ↔ BL
map[4][12] = 0;  // right side TR ↔ BR

// ==== OFFICE PROPS ====
// type: "desk", "monitor", "tower", "cabinet", "chair", "plant"
// solid: blocks movement or not
const props = [];

// Utility to add office layout around a center point (cx, cy)
function addOffice(cx, cy) {
  // Desk
  props.push({
    type: "desk",
    x: cx - 45,
    y: cy - 10,
    w: 90,
    h: 32,
    solid: true
  });

  // Chair (below desk)
  props.push({
    type: "chair",
    x: cx - 18,
    y: cy + 22,
    w: 36,
    h: 20,
    solid: false
  });

  // Monitor on desk
  props.push({
    type: "monitor",
    x: cx - 26,
    y: cy - 38,
    w: 52,
    h: 26,
    solid: false,
    seed: Math.random() * 10
  });

  // Computer tower (to right of desk)
  props.push({
    type: "tower",
    x: cx + 50,
    y: cy - 2,
    w: 18,
    h: 32,
    solid: true
  });

  // Filing cabinet (behind desk, a bit to left)
  props.push({
    type: "cabinet",
    x: cx - 80,
    y: cy - 40,
    w: 28,
    h: 42,
    solid: true
  });

  // Plant (for flavor)
  props.push({
    type: "plant",
    x: cx + 70,
    y: cy - 45,
    w: 22,
    h: 30,
    solid: false
  });
}

// Room centers (approx in pixels)
function tileCenter(cx, cy) {
  return {
    x: (cx + 0.5) * TILE_SIZE,
    y: (cy + 0.5) * TILE_SIZE
  };
}

// TL room center: between cols 1–5, rows 1–3
let cTL = tileCenter(3, 2);
// TR room
let cTR = tileCenter(12, 2);
// BL room
let cBL = tileCenter(3, 6);
// BR room
let cBR = tileCenter(12, 6);

// Add office layout to each room
addOffice(cTL.x, cTL.y);
addOffice(cTR.x, cTR.y);
addOffice(cBL.x, cBL.y);
addOffice(cBR.x, cBR.y);

// ==== PLAYER SETUP ====
const player = {
  x: 7.5 * TILE_SIZE,   // start in central corridor near bottom
  y: 6.5 * TILE_SIZE,
  speed: 0.18, // pixels per ms
  dir: "up", // "up" | "down" | "left" | "right"
  moving: false,
  frame: 1,
  frameTime: 0
};

// Sprite sheet info (3 columns x 4 rows)
const sprite = new Image();
sprite.src = "agent.png"; // transparent sprite
const SPRITE_COLS = 3;
const SPRITE_ROWS = 4;
let FRAME_W = 32;
let FRAME_H = 32;
const ANIM_SPEED = 120; // ms per frame

sprite.onload = () => {
  FRAME_W = sprite.width / SPRITE_COLS;
  FRAME_H = sprite.height / SPRITE_ROWS;
};

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

window.addEventListener("keydown", (e) => {
  if (e.key in keys) keys[e.key] = true;
});

window.addEventListener("keyup", (e) => {
  if (e.key in keys) keys[e.key] = false;
});

let lastTime = 0;
let idleTime = 0;
let globalTime = 0; // for monitor flicker

function loop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = timestamp - lastTime;
  lastTime = timestamp;

  globalTime += dt;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}

function canMoveTo(nx, ny) {
  // Tile collision
  const col = Math.floor(nx / TILE_SIZE);
  const row = Math.floor(ny / TILE_SIZE);

  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) {
    return false;
  }
  if (map[row][col] === 1) {
    return false;
  }

  // Prop collision (for solid furniture)
  for (const p of props) {
    if (!p.solid) continue;
    if (
      nx > p.x &&
      nx < p.x + p.w &&
      ny > p.y &&
      ny < p.y + p.h
    ) {
      return false;
    }
  }

  return true;
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
    dx /= len;
    dy /= len;

    const stepX = dx * player.speed * dt;
    const stepY = dy * player.speed * dt;

    let newX = player.x + stepX;
    let newY = player.y;

    if (!canMoveTo(newX, newY)) {
      newX = player.x;
    }

    newY = player.y + stepY;
    if (!canMoveTo(newX, newY)) {
      newY = player.y;
    }

    player.x = newX;
    player.y = newY;

    // direction
    if (Math.abs(dx) > Math.abs(dy)) {
      player.dir = dx > 0 ? "right" : "left";
    } else {
      player.dir = dy > 0 ? "down" : "up";
    }

    // walking animation
    player.frameTime += dt;
    if (player.frameTime >= ANIM_SPEED) {
      player.frameTime = 0;
      player.frame = (player.frame + 1) % SPRITE_COLS;
    }

    idleTime = 0;
  } else {
    player.frame = 1; // idle frame
    player.frameTime = 0;
    idleTime += dt;
  }
}

function drawDesk(p) {
  // Top surface
  ctx.fillStyle = "#8b4a2f";
  ctx.fillRect(p.x, p.y, p.w, p.h);

  // Edge highlight
  ctx.fillStyle = "#b96b45";
  ctx.fillRect(p.x, p.y, p.w, 4);

  // Legs
  const legW = 8;
  const legH = 18;
  ctx.fillStyle = "#5b301f";
  ctx.fillRect(p.x + 6, p.y + p.h, legW, legH);
  ctx.fillRect(p.x + p.w - 6 - legW, p.y + p.h, legW, legH);
}

function drawChair(p) {
  // Seat
  ctx.fillStyle = "#374151";
  ctx.fillRect(p.x, p.y, p.w, p.h);

  // Back
  ctx.fillStyle = "#4b5563";
  ctx.fillRect(p.x, p.y - 10, p.w, 10);
}

function drawMonitor(p) {
  // Body
  ctx.fillStyle = "#111827";
  ctx.fillRect(p.x, p.y, p.w, p.h);

  // Screen flicker
  const t = globalTime;
  const flick = 0.5 + 0.5 * Math.sin(t / 120 + (p.seed || 0));
  const baseG = 180;
  const g = Math.floor(baseG + flick * 60); // between 180–240
  ctx.fillStyle = `rgb(40, ${g}, ${g + 10})`;
  ctx.fillRect(p.x + 4, p.y + 4, p.w - 8, p.h - 10);

  // Stand
  ctx.fillStyle = "#4b5563";
  ctx.fillRect(p.x + p.w / 2 - 6, p.y + p.h, 12, 6);
}

function drawTower(p) {
  ctx.fillStyle = "#1f2933";
  ctx.fillRect(p.x, p.y, p.w, p.h);
  ctx.fillStyle = "#4b5563";
  ctx.fillRect(p.x + 3, p.y + 4, p.w - 6, p.h - 8);
  ctx.fillStyle = "#10b981";
  ctx.fillRect(p.x + p.w - 6, p.y + p.h - 10, 4, 6);
}

function drawCabinet(p) {
  ctx.fillStyle = "#8b4a2f";
  ctx.fillRect(p.x, p.y, p.w, p.h);
  ctx.fillStyle = "#b96b45";
  ctx.fillRect(p.x + 3, p.y + 5, p.w - 6, 4);
  ctx.fillRect(p.x + 3, p.y + p.h / 2, p.w - 6, 4);
  ctx.fillStyle = "#e5e7eb";
  ctx.fillRect(p.x + p.w / 2 - 2, p.y + 6, 4, 2);
  ctx.fillRect(p.x + p.w / 2 - 2, p.y + p.h / 2 + 1, 4, 2);
}

function drawPlant(p) {
  ctx.fillStyle = "#166534";
  ctx.beginPath();
  ctx.ellipse(p.x + p.w / 2, p.y + p.h / 2, p.w / 2, p.h / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#78350f";
  ctx.fillRect(p.x + p.w / 2 - 4, p.y + p.h - 6, 8, 6);
}

function drawProps() {
  for (const p of props) {
    switch (p.type) {
      case "desk":
        drawDesk(p);
        break;
      case "chair":
        drawChair(p);
        break;
      case "monitor":
        drawMonitor(p);
        break;
      case "tower":
        drawTower(p);
        break;
      case "cabinet":
        drawCabinet(p);
        break;
      case "plant":
        drawPlant(p);
        break;
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  // Draw tiles
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const tile = map[y][x];
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;

      if (tile === 1) {
        // wall
        ctx.fillStyle = "#111827";
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = "#1f2937";
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
      } else {
        // floor
        ctx.fillStyle = "#020617";
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  // Draw office furniture
  drawProps();

  // Draw player
  const px = player.x;
  const py = player.y;
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
  } else {
    ctx.fillStyle = "#9ca3af";
    ctx.beginPath();
    ctx.arc(px, py, 10, 0, Math.PI * 2);
    ctx.fill();
  }
}

requestAnimationFrame(loop);
