const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");


const FRICTION = 0.985;
const STOP_SPEED = 0.05;
const WALL_BOUNCE = 0.85;
const MAX_SPEED = 18;
const SUBSTEPS = 4;
const HOLE_R = 16;


const ZONE_TYPES = {
  sand: { friction: 0.94, color: "#e3c77a" },
  ice: { friction: 0.992, color: "#a9dcf0" },
  mud: { friction: 0.9, color: "#6b4a2f" },
};


const Vec2 = {
  add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y }),
  sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y }),
  scale: (a, s) => ({ x: a.x * s, y: a.y * s }),
  dot: (a, b) => a.x * b.x + a.y * b.y,
  len: (a) => Math.hypot(a.x, a.y),
  normalize: (a) => {
    const l = Math.hypot(a.x, a.y) || 1;
    return { x: a.x / l, y: a.y / l };
  },
  reflect: (v, n) => Vec2.sub(v, Vec2.scale(n, 2 * Vec2.dot(v, n))),
};

function inRect(p, r) {
  return p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h;
}


function rect(x, y, w, h) {
  return [
    { x1: x, y1: y, x2: x + w, y2: y },
    { x1: x + w, y1: y, x2: x + w, y2: y + h },
    { x1: x + w, y1: y + h, x2: x, y2: y + h },
    { x1: x, y1: y + h, x2: x, y2: y },
  ];
}

const levels = [
  {
    name: "Hole 1: The Basics",
    par: 2,
    tee: { x: 100, y: 250 },
    hole: { x: 700, y: 250 },
    walls: [],
  },
  {
    name: "Hole 2: The Wall",
    par: 3,
    tee: { x: 100, y: 250 },
    hole: { x: 700, y: 250 },
    walls: rect(380, 120, 30, 260),
  },
  {
    name: "Hole 3: Zig Zag",
    par: 4,
    tee: { x: 80, y: 420 },
    hole: { x: 720, y: 80 },
    walls: [...rect(250, 0, 30, 340), ...rect(500, 160, 30, 340)],
  },
  {
    name: "Hole 4: Sand Trap",
    par: 3,
    tee: { x: 100, y: 250 },
    hole: { x: 700, y: 250 },
    walls: [],
    zones: [{ type: "sand", x: 280, y: 120, w: 240, h: 260 }],
  },
  {
    name: "Hole 5: Water Hazard",
    par: 3,
    tee: { x: 100, y: 250 },
    hole: { x: 700, y: 250 },
    walls: [],
    water: [{ x: 350, y: 0, w: 100, h: 340 }], 
  },
  {
    name: "Hole 6: Slip and Slide",
    par: 4,
    tee: { x: 80, y: 420 },
    hole: { x: 720, y: 80 },
    walls: rect(380, 150, 30, 350),
    zones: [
      { type: "ice", x: 200, y: 300, w: 180, h: 200 },
      { type: "mud", x: 450, y: 0, w: 200, h: 200 },
    ],
  },
];


let state = "menu"; 
let levelIndex = 0;
let level = levels[0];
let walls = [];
let zones = [];
let water = [];
let results = [];
const ball = { x: 0, y: 0, r: 10, vx: 0, vy: 0 };
let lastPos = { x: 0, y: 0 };
let splashTimer = 0;
let strokes = 0;
let dragging = false;
let mouse = { x: 0, y: 0 };

function loadLevel(i) {
  levelIndex = i;
  level = levels[i];
  walls = [...rect(0, 0, canvas.width, canvas.height), ...level.walls];
  zones = level.zones || [];
  water = level.water || [];
  ball.x = level.tee.x;
  ball.y = level.tee.y;
  ball.vx = 0;
  ball.vy = 0;
  lastPos = { x: ball.x, y: ball.y };
  splashTimer = 0;
  strokes = 0;
  dragging = false;
}

function ballIsMoving() {
  return ball.vx !== 0 || ball.vy !== 0;
}

function getShot() {
  let vx = (ball.x - mouse.x) * 0.1;
  let vy = (ball.y - mouse.y) * 0.1;
  const sp = Math.hypot(vx, vy);
  if (sp > MAX_SPEED) {
    vx *= MAX_SPEED / sp;
    vy *= MAX_SPEED / sp;
  }
  return { vx, vy };
}

function scoreLabel(s, par) {
  const diff = s - par;
  if (s === 1) return "Hole in one!";
  if (diff <= -2) return "Eagle!";
  if (diff === -1) return "Birdie!";
  if (diff === 0) return "Par";
  if (diff === 1) return "Bogey";
  if (diff === 2) return "Double bogey";
  return "+" + diff;
}


function getPos(e) {
  const box = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - box.left) * (canvas.width / box.width),
    y: (e.clientY - box.top) * (canvas.height / box.height),
  };
}

canvas.addEventListener("pointerdown", (e) => {
  mouse = getPos(e);

  if (state === "menu") {
    results = [];
    loadLevel(0);
    state = "playing";
    return;
  }
  if (state === "holeDone") {
    if (levelIndex + 1 < levels.length) {
      loadLevel(levelIndex + 1);
      state = "playing";
    } else {
      state = "finished";
    }
    return;
  }
  if (state === "finished") {
    state = "menu";
    return;
  }

  const close = Math.hypot(mouse.x - ball.x, mouse.y - ball.y) < 40;
  if (close && !ballIsMoving()) dragging = true;
});

window.addEventListener("pointermove", (e) => {
  mouse = getPos(e);
});

window.addEventListener("pointerup", () => {
  if (!dragging) return;
  dragging = false;
  const shot = getShot();
  lastPos = { x: ball.x, y: ball.y }; 
  ball.vx = shot.vx;
  ball.vy = shot.vy;
  strokes++;
});


function collideSegment(seg) {
  const a = { x: seg.x1, y: seg.y1 };
  const b = { x: seg.x2, y: seg.y2 };
  const ab = Vec2.sub(b, a);
  const ap = Vec2.sub(ball, a);

  const t = Math.max(0, Math.min(1, Vec2.dot(ap, ab) / Vec2.dot(ab, ab)));
  const closest = Vec2.add(a, Vec2.scale(ab, t));
  const diff = Vec2.sub(ball, closest);
  const dist = Vec2.len(diff);
  if (dist >= ball.r) return;

  const n =
    dist > 0
      ? Vec2.scale(diff, 1 / dist)
      : Vec2.normalize({ x: -ab.y, y: ab.x });

  ball.x += n.x * (ball.r - dist);
  ball.y += n.y * (ball.r - dist);

  const v = { x: ball.vx, y: ball.vy };
  if (Vec2.dot(v, n) < 0) {
    const r = Vec2.scale(Vec2.reflect(v, n), WALL_BOUNCE);
    ball.vx = r.x;
    ball.vy = r.y;
  }
}

function update() {
  if (state !== "playing") return;
  if (splashTimer > 0) splashTimer--;

  for (let i = 0; i < SUBSTEPS; i++) {
    ball.x += ball.vx / SUBSTEPS;
    ball.y += ball.vy / SUBSTEPS;
    for (const w of walls) collideSegment(w);
  }


  let fric = FRICTION;
  for (const z of zones) {
    if (inRect(ball, z)) fric = ZONE_TYPES[z.type].friction;
  }
  ball.vx *= fric;
  ball.vy *= fric;
  if (Math.hypot(ball.vx, ball.vy) < STOP_SPEED) {
    ball.vx = 0;
    ball.vy = 0;
  }


  for (const w of water) {
    if (inRect(ball, w)) {
      ball.x = lastPos.x;
      ball.y = lastPos.y;
      ball.vx = 0;
      ball.vy = 0;
      strokes++;
      splashTimer = 90;
      return;
    }
  }

  const dx = level.hole.x - ball.x;
  const dy = level.hole.y - ball.y;
  const dist = Math.hypot(dx, dy);
  const speed = Math.hypot(ball.vx, ball.vy);

  if (dist < 45 && dist > 0 && speed < 5) {
    const pull = 0.1 * (1 - dist / 45);
    ball.vx += (dx / dist) * pull;
    ball.vy += (dy / dist) * pull;
  }

  if (dist < HOLE_R && speed < 4) {
    ball.x = level.hole.x;
    ball.y = level.hole.y;
    ball.vx = 0;
    ball.vy = 0;
    results.push({ name: level.name, strokes: strokes, par: level.par });
    state = "holeDone";
  }
}


function drawOverlay() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "white";
  ctx.textAlign = "center";
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (state === "menu") {
    ctx.fillStyle = "#1b3a2a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.font = "64px sans-serif";
    ctx.fillText("Fairway Chaos", canvas.width / 2, 210);
    ctx.font = "22px sans-serif";
    ctx.fillText("Click anywhere to play", canvas.width / 2, 270);
    ctx.textAlign = "left";
    return;
  }

  if (state === "finished") {
    ctx.fillStyle = "#1b3a2a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.font = "44px sans-serif";
    ctx.fillText("Scorecard", canvas.width / 2, 70);
    ctx.font = "20px sans-serif";
    let totalStrokes = 0;
    let totalPar = 0;
    results.forEach((r, i) => {
      totalStrokes += r.strokes;
      totalPar += r.par;
      ctx.fillText(
        r.name + "  -  " + r.strokes + " strokes (par " + r.par + ")",
        canvas.width / 2,
        120 + i * 34
      );
    });
    ctx.font = "28px sans-serif";
    ctx.fillText(
      "Total: " + totalStrokes + "  (par " + totalPar + ")",
      canvas.width / 2,
      120 + results.length * 34 + 30
    );
    ctx.font = "18px sans-serif";
    ctx.fillText("Click to return to the menu", canvas.width / 2, 470);
    ctx.textAlign = "left";
    return;
  }


  for (const z of zones) {
    ctx.fillStyle = ZONE_TYPES[z.type].color;
    ctx.fillRect(z.x, z.y, z.w, z.h);
  }


  for (const w of water) {
    ctx.fillStyle = "#2f7fd1";
    ctx.fillRect(w.x, w.y, w.w, w.h);
  }


  ctx.strokeStyle = "#5b3a1e";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  for (const w of level.walls) {
    ctx.beginPath();
    ctx.moveTo(w.x1, w.y1);
    ctx.lineTo(w.x2, w.y2);
    ctx.stroke();
  }

  // hole
  ctx.fillStyle = "black";
  ctx.beginPath();
  ctx.arc(level.hole.x, level.hole.y, HOLE_R, 0, Math.PI * 2);
  ctx.fill();

  if (dragging) {
    const shot = getShot();
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ball.x, ball.y);
    ctx.lineTo(ball.x + shot.vx * 10, ball.y + shot.vy * 10);
    ctx.stroke();
  }


  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fill();


  ctx.fillStyle = "white";
  ctx.textAlign = "left";
  ctx.font = "20px sans-serif";
  ctx.fillText(level.name, 20, 30);
  ctx.fillText("Par: " + level.par + "   Strokes: " + strokes, 20, 58);


  if (splashTimer > 0) {
    ctx.textAlign = "center";
    ctx.font = "32px sans-serif";
    ctx.fillText("Splash! +1 stroke", canvas.width / 2, 60);
    ctx.textAlign = "left";
  }


  if (state === "holeDone") {
    drawOverlay();
    ctx.font = "48px sans-serif";
    ctx.fillText(scoreLabel(strokes, level.par), canvas.width / 2, 210);
    ctx.font = "26px sans-serif";
    ctx.fillText("Strokes: " + strokes + "   Par: " + level.par, canvas.width / 2, 260);
    ctx.font = "18px sans-serif";
    const last = levelIndex + 1 >= levels.length;
    ctx.fillText(last ? "Click for scorecard" : "Click for next hole", canvas.width / 2, 310);
    ctx.textAlign = "left";
  }
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();