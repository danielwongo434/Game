const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

// ==== TILE MAP SETUP ====
const TILE_SIZE = 60; // 16 x 9 grid (960x540)
const COLS = Math.floor(WIDTH / TILE_SIZE);  // 16
const ROWS = Math.floor(HEIGHT / TILE_SIZE); // 9

// 0 = floor, 1 = wall
let map = [];

// Start with all walls
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

// ---- Layout design (Zelda-style 4 rooms + corridor) ----
// Perimeter walls stay as 1 (we don't carve on row 0, row 8, col 0, col 15)

// Central corridor (2 tiles wide) from row 1 to row 7
// Columns 7 and 8 are open corridor
carveRect(7, 1, 8, 7);

// Top-left room floor: cols 1–5, rows 1–3
carveRect(1, 1, 5, 3);

// Top-right room floor: cols 10–14, rows 1–3
carveRect(10, 1, 14, 3);

// Bottom-left room floor: cols 1–5, rows 5–7
carveRect(1, 5, 5, 7);

// Bottom-right room floor: cols 10–14, rows 5–7
carveRect(10, 5, 14, 7);

// Row 4 is our horizontal wall between top and bottom rooms.
// We leave it as walls everywhere EXCEPT corridor, which is already carved.

// ---- Doors (all ONE TILE wide) ----

// Rooms → corridor:
// TL → corridor (through wall at col 6)
map[2][6] = 0;
// BL → corridor
map[6][6] = 0;
// TR → corridor (through wall at col 9)
map[2][9] = 0;
// BR → corridor
map[6][9] = 0;

// Between top and bottom rooms (vertical doors in horizontal wall row 4):
// Left side: TL ↔ BL (in the wall between them)
map[4][3] = 0; // roughly center of left rooms
// Right side: TR ↔ BR
map[4][12] = 0; // roughly center of right rooms

// ==== PLAYER SETUP ====
const player = {
  x: 7.5 * TILE_SIZE,   // start in central corridor near bottom
  y: 6.5 * TILE_SIZE,
  speed: 0.18, // pixels per ms
  dir: "up", // "up" | "down" | "left" | "right"
  moving: false,
  frame: 1,       // middle frame for idle
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
let idleTime = 0; // for breathing animation

function loop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = timestamp - lastTime;
  lastTime = timestamp;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}

function canMoveTo(nx, ny) {
  // Approximate player as a point for simple collision
  const col = Math.floor(nx / TILE_SIZE);
  const row = Math.floor(ny / TILE_SIZE);

  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) {
    return false;
  }

  return map[row][col] === 0;
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

    // Try moving X, then Y (simple collision resolution)
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

    // pick facing direction
    if (Math.abs(dx) > Math.abs(dy)) {
      player.dir = dx > 0 ? "right" : "left";
    } else {
      player.dir = dy > 0 ? "down" : "up";
    }

    // walking animation
    player.frameTime += dt;
    if (player.frameTime >= ANIM_SPEED) {
      player.frameTime = 0;
      player.frame = (player.frame + 1) % SPRITE_COLS; // 0,1,2
    }

    idleTime = 0; // reset idle timer while moving
  } else {
    // idle: middle frame + breathing timer
    player.frame = 1;
    player.frameTime = 0;
    idleTime += dt;
  }
}

function draw() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  // Draw floor + walls
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

  // Draw player
  const px = player.x;
  const py = player.y;

  const idleOffset = player.moving ? 0 : Math.sin(idleTime / 400) * 2;

  if (sprite.complete && sprite.naturalWidth) {
    // Map direction to row index in the sprite sheet
    const dirIndex =
      player.dir === "right" ? 1 :   // row 1 = facing right
      player.dir === "left"  ? 0 :   // row 0 = facing left
      player.dir === "down"  ? 2 :   // row 2 = facing down
      3;                             // row 3 = facing up

    const sx = player.frame * FRAME_W;
    const sy = dirIndex * FRAME_H;

    const drawSize = 64; // on-screen size
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
    // fallback placeholder
    ctx.fillStyle = "#9ca3af";
    ctx.beginPath();
    ctx.arc(px, py, 10, 0, Math.PI * 2);
    ctx.fill();
  }
}

requestAnimationFrame(loop);
