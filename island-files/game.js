const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

// Player state
const player = {
  x: WIDTH / 2,
  y: HEIGHT / 2,
  speed: 0.18, // pixels per ms
  dir: "down", // "up" | "down" | "left" | "right"
  moving: false,
  frame: 1,       // middle frame for idle
  frameTime: 0
};

// Sprite sheet info
const sprite = new Image();
sprite.src = "agent.png"; // 3x4 frames
const COLS = 3;
const ROWS = 4;
let FRAME_W = 32;
let FRAME_H = 32;
const ANIM_SPEED = 120; // ms per frame

sprite.onload = () => {
  FRAME_W = sprite.width / COLS;
  FRAME_H = sprite.height / ROWS;
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
let idleTime = 0; // time spent idle for breathing animation

function loop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = timestamp - lastTime;
  lastTime = timestamp;

  update(dt);
  draw();

  requestAnimationFrame(loop);
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

    player.x += dx * player.speed * dt;
    player.y += dy * player.speed * dt;

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
      player.frame = (player.frame + 1) % COLS; // 0,1,2
    }

    idleTime = 0; // reset idle timer while moving
  } else {
    // idle: middle frame + breathing timer
    player.frame = 1;
    player.frameTime = 0;
    idleTime += dt;
  }

  const r = 12;
  player.x = Math.max(r, Math.min(WIDTH - r, player.x));
  player.y = Math.max(r, Math.min(HEIGHT - r, player.y));
}

function draw() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  // background
 ctx.fillStyle = "#b3b3b3"; // exact match to sprite background
 ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // border
  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, WIDTH - 4, HEIGHT - 4);

  const px = player.x;
  const py = player.y;
  const idleOffset = player.moving? 0 : Math.sin(idleTime / 400) * 2;

  if (sprite.complete && sprite.naturalWidth) {
    // map direction to row index in the sprite sheet
    // adjust if your rows are in a different order
   const dirIndex =
  player.dir === "right" ? 1 :   // row 1 = facing right
  player.dir === "left"  ? 0 :   // row 0 = facing left
  player.dir === "down"  ? 2 :   // row 2 = facing down
  3;                             // row 3 = facing up

    const sx = player.frame * FRAME_W;
    const sy = dirIndex * FRAME_H;

    const drawSize = 48; // on-screen size (scaled down)
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      sprite,
      sx, sy, FRAME_W, FRAME_H,
      px - drawSize / 2, py - drawSize / 2 + idleOffset,
      drawSize, drawSize
    );
  } else {
    // fallback circle if sprite not loaded
    ctx.fillStyle = "#9ca3af";
    ctx.beginPath();
    ctx.arc(px, py, 10, 0, Math.PI * 2);
    ctx.fill();
  }
}

requestAnimationFrame(loop);
