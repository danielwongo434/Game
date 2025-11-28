const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

const player = {
  x: WIDTH / 2,
  y: HEIGHT / 2,
  radius: 10,
  speed: 0.18 // pixels per ms
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

  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
    player.x += dx * player.speed * dt;
    player.y += dy * player.speed * dt;
  }

  // keep inside the room
  const r = player.radius;
  player.x = Math.max(r, Math.min(WIDTH - r, player.x));
  player.y = Math.max(r, Math.min(HEIGHT - r, player.y));
}

function draw() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  // room background
  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // simple border
  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, WIDTH - 4, HEIGHT - 4);

  // player (temp chibi placeholder: small circle)
  ctx.fillStyle = "#9ca3af"; // gray outfit
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();

  // little "head" accent
  ctx.fillStyle = "#e5e7eb";
  ctx.beginPath();
  ctx.arc(player.x, player.y - 4, player.radius * 0.45, 0, Math.PI * 2);
  ctx.fill();
}

requestAnimationFrame(loop);
