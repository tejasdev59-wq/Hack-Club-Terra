const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const FRICTION = 0.985;
const ball = { x:100, y:250, r:10, vx:0, vy:0 };
const hole = { x:700, y:250, r:16 };
let strokes = 0;
let sunk = false;
let dragging = false;
let state = "menu"
let mouse = { x:0, y:0 };

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height), 
  };
}
canvas.addEventListener("pointerdown", (e) => {
    mouse = getPos(e);
    if (state === "menu") {
        state = "playing"
        return;
    }
    if (Math.hypot(mouse.x - ball.x, mouse.y - ball.y) < 40 && !sunk) dragging = true;
});

window.addEventListener("pointermove", (e) => {
    mouse = getPos(e);
}); 

window.addEventListener("pointerup", () => {
   if (!dragging) return;
   dragging = false;
   ball.vx = (ball.x - mouse.x) * 0.1;
   ball.vy = (ball.y - mouse.y) * 0.1;
   strokes++;
});

function update() {
    if (state !== "playing") return;
    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.vx *= FRICTION;
    ball.vy *= FRICTION;

    if (ball.x < ball.r) {ball.x = ball.r; ball.vx *= -1; }
    if (ball.x > canvas.width - ball.r) {ball.x = canvas.width - ball.r; ball.vx *= -1; }
    if (ball.y < ball.r) {ball.y = ball.r; ball.vy *= -1; }
    if (ball.y > canvas.height - ball.r) {ball.y = canvas.height - ball.r; ball.vy *= -1; }

    if (Math.hypot(ball.vx, ball.vy) < 0.05) {
        ball.vx = 0
        ball.vy = 0
    }
    const dx = hole.x - ball.x;
    const dy = hole.y - ball.y;
    const dist = Math.hypot(dx, dy);
    const speed = Math.hypot(ball.vx, ball.vy);

    if (!sunk && dist < 45 && dist > 0 && speed < 5) {
        const pull = 0.1 * (1 - dist/45);
        ball.vx += (dx / dist) * pull;
        ball.vy += (dy / dist) * pull ;
    }

    if (!sunk && dist < hole.r && speed < 4) {
        sunk = true;
        ball.x = hole.x;
        ball.y = hole.y;
        ball.vx = 0;
        ball.vy = 0;
    }
    }
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "black";
    ctx.beginPath();
    ctx.arc(hole.x, hole.y, hole.r, 0, Math.PI * 2);
    ctx.fill();
    
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

    if (dragging) { 
        ctx.strokeStyle = "white";
        ctx.beginPath();
        ctx.moveTo(ball.x, ball.y);
        ctx.lineTo(ball.x + (ball.x - mouse.x), ball.y + (ball.y - mouse.y));
        ctx.stroke();
    }

        ctx.fillStyle = "white";
        ctx.font = "20px sans-serif";
        ctx.fillText("Strokes: " + strokes, 20, 30);
    
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
}
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();