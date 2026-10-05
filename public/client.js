const socket = io();
const $ = (id) => document.getElementById(id);
const canvas = $("game"), ctx = canvas.getContext("2d");

const FACE_INFO = {
  bau: { emo: "🎃", nm: "Bầu" }, cua: { emo: "🦀", nm: "Cua" }, tom: { emo: "🦐", nm: "Tôm" },
  ca: { emo: "🐟", nm: "Cá" }, ga: { emo: "🐓", nm: "Gà" }, nai: { emo: "🦌", nm: "Nai" },
};

let me = null, MAP = null, DOORS = [], FACES = [], RADIUS = 18;
let players = {}, counts = {};
let room = "lobby";
let scale = 1, offX = 0, offY = 0;
let target = null, path = [], pendingEnter = null, pendingSit = false;
const keys = {};

// ===== Đăng nhập =====
try { $("nameInput").value = localStorage.getItem("name") || ""; } catch (e) {}

// Tạo nhân vật
let look = randomLook();
try { const l = JSON.parse(localStorage.getItem("look")); if (l) look = normalizeLook(l); } catch (e) {}
const MAKER = [
  { key: "hair", label: "Kiểu tóc", names: AV.HAIR_STYLES },
  { key: "hairColor", label: "Màu tóc", colors: AV.HAIR },
  { key: "skin", label: "Màu da", colors: AV.SKIN },
  { key: "shirt", label: "Áo", colors: AV.SHIRT },
  { key: "bottom", label: "Quần / váy", names: AV.BOTTOMS },
  { key: "bottomColor", label: "Màu quần", colors: AV.BOTTOM },
];
function buildMaker() {
  const box = $("makerRows");
  box.innerHTML = "";
  for (const row of MAKER) {
    const r = document.createElement("div"); r.className = "mk-row";
    const lb = document.createElement("span"); lb.className = "mk-label"; lb.textContent = row.label;
    const opts = document.createElement("div"); opts.className = "mk-opts";
    (row.names || row.colors).forEach((v, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = (row.colors ? "mk-swatch" : "mk-name") + (look[row.key] === i ? " sel" : "");
      if (row.colors) b.style.background = v; else b.textContent = v;
      b.onclick = () => { look[row.key] = i; buildMaker(); };
      opts.append(b);
    });
    r.append(lb, opts); box.append(r);
  }
}
buildMaker();
$("randomLook").onclick = () => { look = randomLook(); buildMaker(); };
// Xem trước: nhân vật đi bộ và xoay 4 hướng
let previewDir = 0;
$("avatarPreview").onclick = () => previewDir = (previewDir + 1) % 4;
setInterval(() => {
  if (!$("login").classList.contains("hidden")) {
    const c = $("avatarPreview"), g = c.getContext("2d");
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(c.width / 2, c.height - 8, 34, 8, 0, 0, 7); g.fill();
    const step = [1, 0, 2, 0][Math.floor(performance.now() / 180) % 4];
    drawAvatar(g, look, c.width / 2, c.height - 8 - (step ? 4 : 0), 4, ["down", "left", "up", "right"][previewDir], step);
  }
}, 60);
$("loginForm").onsubmit = (e) => {
  e.preventDefault();
  const name = $("nameInput").value.trim();
  try { localStorage.setItem("name", name); localStorage.setItem("look", JSON.stringify(look)); } catch (e) {}
  socket.emit("join", name, look, (res) => {
    me = res.id; MAP = res.map; DOORS = res.doors; FACES = res.faces; RADIUS = res.radius; httpsPort = res.httpsPort; DECOR = res.decor;
    $("login").classList.add("hidden");
    ["hud", "help", "chat", "micBtn", "actionBar"].forEach((id) => $(id).classList.remove("hidden"));
    checkOrientation();
    $("hudName").textContent = "👤 " + (name || "Bạn");
  });
};
socket.on("disconnect", () => toast("Mất kết nối server..."));
socket.on("connect", () => { if (me) location.reload(); });

// ===== Nhận dữ liệu =====
socket.on("state", (data) => {
  const seen = new Set();
  for (const p of data.players) {
    seen.add(p.id);
    if (!players[p.id]) players[p.id] = { ...p, rx: p.x, ry: p.y };
    else Object.assign(players[p.id], p);
  }
  for (const id in players) if (!seen.has(id)) delete players[id];
  counts = data.counts;
  $("hudOnline").textContent = "👥 " + (data.players.length + Object.values(counts).reduce((a, b) => a + b, 0));
});
socket.on("toast", toast);
socket.on("chat", (m) => {
  const div = document.createElement("div");
  if (m.system) { div.className = "sys"; div.textContent = m.text; }
  else {
    const b = document.createElement("b"); b.style.color = m.color; b.textContent = m.name + ": ";
    div.append(b, document.createTextNode(m.text));
  }
  $("chatLog").append(div);
  while ($("chatLog").children.length > 50) $("chatLog").firstChild.remove();
  $("chatLog").scrollTop = 1e9;
});
socket.on("roomChanged", (r) => {
  room = r; target = null; pendingEnter = null;
  const isTable = TABLE_GAMES.includes(r);
  $("tableRoom").classList.toggle("hidden", !isTable);
  document.body.classList.toggle("in-table", isTable);
  lastT = null; lastRound = -1; deal.game = null;
  $("tPanel").innerHTML = ""; $("tPanel").dataset.html = "";
  for (const id of ["tHostBtns", "tCenter", "bkSeats"]) { $(id).innerHTML = ""; $(id).dataset.html = ""; }
  $("tStatus").textContent = "";
  $("enterBtn").classList.add("hidden");
  $("actionBar").classList.toggle("hidden", r !== "lobby");
  pendingSit = false;
  $("chatLog").innerHTML = "";
});

let toastTimer;
function toast(t) { const el = $("toast"); el.textContent = t; el.classList.remove("hidden"); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add("hidden"), 2500); }

// ===== Điều khiển =====
const typing = () => document.activeElement === $("chatInput") || document.activeElement === $("nameInput");
addEventListener("keydown", (e) => {
  if (!me) return;
  if (e.key === "Enter" && !typing()) { $("chatInput").focus(); e.preventDefault(); return; }
  if (e.key === "Escape") $("chatInput").blur();
  if (typing()) return;
  keys[e.key.toLowerCase()] = true;
  if (e.key.toLowerCase() === "e" && room === "lobby") { const d = currentDoor(); if (d) socket.emit("enter", d.id); }
  // Phím 1-7: các hành động trong sảnh
  const act = ACTIONS[+e.key - 1];
  if (act && room === "lobby") doAction(act.id);
});
addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });
addEventListener("blur", () => { for (const k in keys) keys[k] = false; });
$("chatForm").onsubmit = (e) => {
  e.preventDefault();
  const t = $("chatInput").value.trim();
  if (t) socket.emit("chat", t);
  $("chatInput").value = ""; $("chatInput").blur();
};
canvas.addEventListener("pointerdown", (e) => {
  if (!MAP || room !== "lobby") return;
  $("chatInput").blur();
  const x = (e.clientX * devicePixelRatio - offX) / scale, y = (e.clientY * devicePixelRatio - offY) / scale;
  const d = DOORS.find((d) => x > d.x && x < d.x + d.w && y > d.y && y < d.y + d.h);
  pendingEnter = d ? d.id : null;
  // Chạm vào ghế: đi tới trước ghế rồi ngồi xuống
  const b = DECOR && DECOR.benches.find((b) => Math.abs(x - b.x) < 72 && y > b.y - 70 && y < b.y + 10);
  pendingSit = !!b;
  if (d) goTo(d.x + d.w / 2, d.y + d.h / 2);
  else if (b) goTo(b.x + (x < b.x ? -28 : 28), b.y + 14);
  else goTo(x, y);
});
$("enterBtn").onclick = () => { const d = currentDoor(); if (d) socket.emit("enter", d.id); };

function currentDoor() {
  const p = players[me]; if (!p) return null;
  return DOORS.find((d) => p.x > d.x - 30 && p.x < d.x + d.w + 30 && p.y > d.y - 30 && p.y < d.y + d.h + 30);
}

let lastSent = "";
setInterval(() => {
  if (!me) return;
  let dx = 0, dy = 0;
  if (room === "lobby" && !typing()) {
    if (keys["a"] || keys["arrowleft"]) dx -= 1;
    if (keys["d"] || keys["arrowright"]) dx += 1;
    if (keys["w"] || keys["arrowup"]) dy -= 1;
    if (keys["s"] || keys["arrowdown"]) dy += 1;
    if (dx || dy) { target = null; path = []; pendingEnter = null; pendingSit = false; }
    else if (target && players[me]) {
      // Đi theo đường vòng đã tìm, tới điểm nào thì chuyển sang điểm kế tiếp
      const p = players[me];
      while (path.length && Math.hypot(path[0].x - p.x, path[0].y - p.y) < 12) path.shift();
      const wp = path[0] || target;
      const vx = wp.x - p.x, vy = wp.y - p.y, dist = Math.hypot(vx, vy);
      const left = Math.hypot(target.x - p.x, target.y - p.y);
      if (left < 8 || (!path.length && dist < 8)) { target = null; path = []; }
      else { dx = vx / dist; dy = vy / dist; }
      // Tới gần ghế thì ngồi luôn
      if (pendingSit && left < 26) { pendingSit = false; target = null; path = []; dx = dy = 0; socket.emit("sit"); }
    }
  }
  const s = dx.toFixed(2) + "," + dy.toFixed(2);
  if (s !== lastSent) { socket.emit("input", { dx, dy }); lastSent = s; }

  if (room === "lobby") {
    const d = currentDoor();
    const btn = $("enterBtn");
    if (d) {
      btn.textContent = d.open ? `Vào phòng ${d.icon} ${d.name}` : `${d.icon} ${d.name} (sắp ra mắt)`;
      btn.classList.remove("hidden");
      if (pendingEnter === d.id && d.open) { pendingEnter = null; socket.emit("enter", d.id); }
    } else btn.classList.add("hidden");
  }
}, 50);

// ===== Vẽ sảnh =====
function resize() {
  canvas.width = innerWidth * devicePixelRatio; canvas.height = innerHeight * devicePixelRatio;
  canvas.style.width = innerWidth + "px"; canvas.style.height = innerHeight + "px";
}
addEventListener("resize", resize); resize();

function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

// Vẽ một cánh cửa: biển tên phía trên, khung gỗ, cánh cửa mở dần khi nhân vật lại gần
const doorOpen = {};
function drawDoor(d, near) {
  const cx = d.x + d.w / 2;
  doorOpen[d.id] = (doorOpen[d.id] || 0) + (((near && d.open) ? 1 : 0) - (doorOpen[d.id] || 0)) * 0.15;
  const t = doorOpen[d.id];
  // Biển tên
  ctx.fillStyle = "#3e2723"; roundRect(d.x + 6, d.y, d.w - 12, 44, 8); ctx.fill();
  ctx.strokeStyle = "#f9ca24"; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = "#f9ca24"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = "bold 19px system-ui"; ctx.fillText(`${d.icon} ${d.name}`, cx, d.y + 23);
  // Khung cửa
  const fx = d.x + 8, fy = d.y + 52, fw = d.w - 16, fh = d.h - 52;
  ctx.fillStyle = "#3e2723"; roundRect(fx, fy, fw, fh, [40, 40, 0, 0]); ctx.fill();
  // Lòng cửa (bên trong phòng) sáng lên khi cửa mở
  const ix = fx + 9, iy = fy + 9, iw = fw - 18, ih = fh - 9;
  const g = ctx.createLinearGradient(0, iy, 0, iy + ih);
  g.addColorStop(0, "#1b1b1b"); g.addColorStop(1, d.open ? "#f6c94c" : "#2d3436");
  ctx.fillStyle = g; roundRect(ix, iy, iw, ih, [32, 32, 0, 0]); ctx.fill();
  // Cánh cửa (bản lề bên trái, thu hẹp khi mở để giả phối cảnh)
  const pw = iw * (1 - 0.8 * t);
  ctx.save();
  roundRect(ix, iy, iw, ih, [32, 32, 0, 0]); ctx.clip();
  ctx.fillStyle = d.open ? d.color : "#636e72"; ctx.fillRect(ix, iy, pw, ih);
  ctx.fillStyle = "rgba(0,0,0," + (0.35 * t) + ")"; ctx.fillRect(ix, iy, pw, ih);
  // Ô trang trí trên cánh cửa
  ctx.strokeStyle = "rgba(0,0,0,.3)"; ctx.lineWidth = 3;
  if (pw > 30) {
    roundRect(ix + pw * 0.15, iy + 30, pw * 0.7, ih * 0.32, 8); ctx.stroke();
    roundRect(ix + pw * 0.15, iy + 40 + ih * 0.36, pw * 0.7, ih * 0.38, 8); ctx.stroke();
  }
  // Tay nắm
  ctx.fillStyle = "#f9ca24"; ctx.beginPath(); ctx.arc(ix + pw - 14, iy + ih * 0.55, 6, 0, 7); ctx.fill();
  ctx.restore();
  // Rào chắn cho phòng chưa mở
  if (!d.open) {
    ctx.save(); ctx.translate(cx, iy + ih * 0.5); ctx.rotate(-0.25);
    ctx.fillStyle = "#fdcb6e"; ctx.fillRect(-iw * 0.65, -12, iw * 1.3, 24);
    ctx.fillStyle = "#2d3436"; ctx.font = "bold 13px system-ui"; ctx.fillText("SẮP RA MẮT", 0, 1);
    ctx.restore();
  }
  // Thảm chùi chân + số người
  ctx.fillStyle = d.open ? "rgba(0,0,0,.35)" : "rgba(0,0,0,.2)"; roundRect(cx - 55, d.y + d.h + 6, 110, 24, 6); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = "13px system-ui";
  ctx.fillText(d.open ? `👥 ${counts[d.id] || 0} người` : "🚧", cx, d.y + d.h + 18);
  ctx.textBaseline = "alphabetic";
}

// ===== Vẽ sảnh: nền, đài thác nước, cây, ghế =====
let DECOR = null;
// Vị trí cỏ / hoa cố định (tạo một lần bằng số ngẫu nhiên có hạt giống)
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const GRASS = [[8, 272, 250, 520], [942, 272, 250, 520]];
const BLADES = GRASS.flatMap(([gx, gy, gw, gh]) => Array.from({ length: 90 }, () => [gx + rnd() * gw, gy + 8 + rnd() * (gh - 16), rnd()]));
const FLOWERS = GRASS.flatMap(([gx, gy, gw, gh]) => Array.from({ length: 22 }, () => [gx + 10 + rnd() * (gw - 20), gy + 14 + rnd() * (gh - 28), ["#ff7675", "#fdcb6e", "#fd79a8", "#ffffff", "#a29bfe"][Math.floor(rnd() * 5)]]));

function drawGround() {
  // Sân lát đá
  for (let x = 0; x < MAP.w; x += 50) for (let y = 250; y < MAP.h; y += 50) {
    ctx.fillStyle = ((x + y) / 50) % 2 ? "#d7ccc8" : "#cfc3bd"; ctx.fillRect(x, y, 50, 50);
  }
  ctx.strokeStyle = "rgba(0,0,0,.06)"; ctx.lineWidth = 1;
  for (let x = 0; x < MAP.w; x += 50) { ctx.beginPath(); ctx.moveTo(x, 272); ctx.lineTo(x, MAP.h); ctx.stroke(); }
  for (let y = 300; y < MAP.h; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(MAP.w, y); ctx.stroke(); }
  // Hai bãi cỏ hai bên, viền đá
  for (const [gx, gy, gw, gh] of GRASS) {
    ctx.fillStyle = "#8d8378"; roundRect(gx - 4, gy - 4, gw + 8, gh + 8, 18); ctx.fill();
    ctx.fillStyle = "#7cb342"; roundRect(gx, gy, gw, gh, 14); ctx.fill();
  }
  ctx.strokeStyle = "#558b2f"; ctx.lineWidth = 2;
  for (const [x, y, k] of BLADES) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3 + k * 6, y - 7); ctx.stroke(); }
  for (const [x, y, c] of FLOWERS) {
    ctx.fillStyle = c;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x + Math.cos(i * 1.57) * 3, y + Math.sin(i * 1.57) * 3, 2.6, 0, 7); ctx.fill(); }
    ctx.fillStyle = "#f9ca24"; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, 7); ctx.fill();
  }
  ctx.strokeStyle = "#5d4037"; ctx.lineWidth = 8; ctx.strokeRect(4, 4, MAP.w - 8, MAP.h - 8);
}

function drawFountain(f, t) {
  const { x, y, rx, ry } = f;
  // Thành hồ bằng đá
  ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.beginPath(); ctx.ellipse(x, y + 16, rx + 18, ry + 14, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#8395a7"; ctx.beginPath(); ctx.ellipse(x, y + 8, rx + 14, ry + 12, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#c8d6e5"; ctx.beginPath(); ctx.ellipse(x, y, rx + 14, ry + 10, 0, 0, 7); ctx.fill();
  // Mặt nước + gợn sóng lan ra
  const wg = ctx.createRadialGradient(x, y - 10, 10, x, y, rx);
  wg.addColorStop(0, "#74b9ff"); wg.addColorStop(1, "#0984e3");
  ctx.fillStyle = wg; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.clip();
  for (let i = 0; i < 3; i++) {
    const k = ((t / 2200 + i / 3) % 1);
    ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - k)})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y + 12, 40 + k * (rx - 30), 14 + k * (ry - 12), 0, 0, 7); ctx.stroke();
  }
  ctx.restore();
  // Tháp đá 3 tầng
  const rock = (cx, cy, w, h) => {
    ctx.fillStyle = "#636e72"; roundRect(cx - w / 2, cy - h, w, h, 16); ctx.fill();
    ctx.fillStyle = "#7f8c8d"; roundRect(cx - w / 2 + 4, cy - h + 4, w - 8, h * 0.45, 12); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.15)"; roundRect(cx - w / 2 + 10, cy - h + 8, w * 0.35, 8, 4); ctx.fill();
  };
  rock(x, y + 6, 130, 56); rock(x - 4, y - 44, 96, 52); rock(x + 2, y - 90, 66, 50);
  // Bồn nhỏ trên đỉnh + tia nước phun lên
  ctx.fillStyle = "#b2bec3"; ctx.beginPath(); ctx.ellipse(x + 2, y - 142, 38, 10, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#74b9ff"; ctx.beginPath(); ctx.ellipse(x + 2, y - 143, 31, 6, 0, 0, 7); ctx.fill();
  for (let i = 0; i < 12; i++) {
    const k = (t / 900 + i / 12) % 1, side = i % 2 ? 1 : -1, sp = 8 + (i % 3) * 7;
    const px = x + 2 + side * sp * k * 2.2, py = y - 146 - 46 * k + 52 * k * k;
    ctx.fillStyle = `rgba(223,249,251,${0.9 - k * 0.6})`; ctx.beginPath(); ctx.arc(px, py, 2.6, 0, 7); ctx.fill();
  }
  // Ba dòng thác đổ xuống hồ
  for (const [sx, w, top] of [[x - 26, 18, y - 136], [x + 2, 24, y - 138], [x + 30, 16, y - 134]]) {
    const g = ctx.createLinearGradient(0, top, 0, y);
    g.addColorStop(0, "rgba(129,236,236,.85)"); g.addColorStop(1, "rgba(116,185,255,.75)");
    ctx.fillStyle = g; ctx.fillRect(sx - w / 2, top, w, y - top);
    ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 2;
    for (let yy = top + ((t / 8) % 18); yy < y; yy += 18) { ctx.beginPath(); ctx.moveTo(sx - w / 2 + 3, yy); ctx.lineTo(sx + w / 2 - 3, yy + 5); ctx.stroke(); }
    // Bọt nước dưới chân thác
    for (let i = 0; i < 5; i++) {
      const k = (t / 600 + i / 5) % 1;
      ctx.fillStyle = `rgba(255,255,255,${0.8 - k * 0.8})`;
      ctx.beginPath(); ctx.arc(sx + (i - 2) * w * 0.35, y + 2 - k * 10, 3 + k * 4, 0, 7); ctx.fill();
    }
  }
}

function drawTree(tr, t) {
  const { x, y } = tr, sway = Math.sin(t / 1400 + x) * 2;
  ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.beginPath(); ctx.ellipse(x, y, 40, 12, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#6d4c41"; ctx.fillRect(x - 9, y - 54, 18, 54);
  ctx.fillStyle = "#5d4037"; ctx.fillRect(x - 9, y - 54, 6, 54);
  const leaf = (dx, dy, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + dx + sway, y + dy, r, 0, 7); ctx.fill(); };
  leaf(-26, -74, 30, "#2e7d32"); leaf(26, -74, 30, "#2e7d32"); leaf(0, -100, 38, "#388e3c");
  leaf(-16, -84, 28, "#43a047"); leaf(18, -88, 26, "#43a047"); leaf(-6, -112, 20, "#66bb6a");
  leaf(-14, -104, 8, "rgba(255,255,255,.18)");
}

function drawBench(b) {
  const { x, y } = b, w = 130;
  ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.beginPath(); ctx.ellipse(x, y + 2, w / 2 + 6, 8, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#4e342e";
  for (const lx of [x - w / 2 + 8, x + w / 2 - 14]) { ctx.fillRect(lx, y - 58, 6, 58); }
  // Lưng ghế
  ctx.fillStyle = "#8d5524"; roundRect(x - w / 2, y - 60, w, 11, 4); ctx.fill();
  roundRect(x - w / 2, y - 44, w, 10, 4); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.15)"; ctx.fillRect(x - w / 2 + 4, y - 59, w - 8, 3);
  // Mặt ghế
  ctx.fillStyle = "#a0652d"; roundRect(x - w / 2 - 4, y - 26, w + 8, 10, 4); ctx.fill();
  ctx.fillStyle = "#7b4a1e"; ctx.fillRect(x - w / 2 - 2, y - 17, w + 4, 5);
}

// Nhân vật + tư thế (ngồi, vẫy tay, nhảy) + biểu cảm bay trên đầu
const EMO_ICON = { wave: "👋", dance: "🎵", heart: "❤️", laugh: "😂", cry: "😢", sleep: "💤" };
function drawPlayer(p, t) {
  if (p.emote !== p._emote) { p._emote = p.emote; p.emoteStart = Date.now() - (p.emoteAge || 0); }
  const age = p.emote ? Date.now() - p.emoteStart : 0;
  const x = p.rx, y = p.ry, sitting = p.pose === "sit";
  const feet = y + RADIUS, top = feet - 90 + (sitting ? 12 : 0); // nhân vật cao 90px tính từ chân
  if (!sitting) { ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(x, feet, 22, 7, 0, 0, 7); ctx.fill(); }
  if (p.id === me && !sitting) { ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.beginPath(); ctx.ellipse(x, feet, 30, 10, 0, 0, 7); ctx.stroke(); }
  // Hướng nhìn + bước chân
  const vx = p.x - p.rx, vy = p.y - p.ry;
  const moving = !sitting && Math.abs(vx) + Math.abs(vy) > 0.5;
  if (moving) p.dir = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? "left" : "right") : (vy < 0 ? "up" : "down");
  let dir = sitting ? "down" : p.dir || "down", step = moving ? [1, 0, 2, 0][Math.floor(t / 120) % 4] : 0, pose = sitting ? "sit" : null, lift = step ? 2 : 0;
  if (!moving && !sitting && p.emote === "dance") {
    dir = ["down", "left", "down", "right"][Math.floor(age / 380) % 4];
    step = [1, 2][Math.floor(age / 190) % 2];
    lift = Math.abs(Math.sin(age / 190 * Math.PI / 2)) * 10;
  }
  if (!moving && p.emote === "wave") { pose = sitting ? "sit" : "wave"; if (!sitting) step = Math.floor(age / 180) % 2; }
  drawAvatar(ctx, p.look, x, feet - lift, 3, dir, sitting ? 0 : step, pose);

  // Tên + mic
  ctx.font = "bold 15px system-ui"; ctx.textAlign = "center";
  ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,.7)"; ctx.strokeText(p.name, x, top - 6);
  ctx.fillStyle = p.id === me ? "#ffeaa7" : "#fff"; ctx.fillText(p.name, x, top - 6);
  if (p.mic) {
    // Biểu tượng mic cạnh tên, sáng xanh khi đang nói
    const mx = x + ctx.measureText(p.name).width / 2 + 14, my = top - 11;
    if (p.speaking) {
      const r = 11 + Math.sin(t / 120) * 2;
      ctx.fillStyle = "rgba(0,230,118,.9)"; ctx.shadowColor = "#00e676"; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(mx, my, r, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    } else { ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.beginPath(); ctx.arc(mx, my, 10, 0, 7); ctx.fill(); }
    ctx.font = "13px system-ui"; ctx.textBaseline = "middle"; ctx.fillText("🎤", mx, my + 1); ctx.textBaseline = "alphabetic";
  }
  let above = top - 26;
  if (p.bubble) {
    ctx.font = "14px system-ui";
    const msg = p.bubble.length > 40 ? p.bubble.slice(0, 40) + "…" : p.bubble;
    const w = ctx.measureText(msg).width + 16;
    ctx.fillStyle = "#fff"; roundRect(x - w / 2, top - 50, w, 26, 10); ctx.fill();
    ctx.fillStyle = "#222"; ctx.fillText(msg, x, top - 32);
    above = top - 60;
  }
  // Biểu cảm
  if (p.emote) {
    ctx.textBaseline = "middle";
    if (p.emote === "heart" || p.emote === "sleep" || p.emote === "dance") {
      // Biểu tượng bay lên rồi mờ dần, lặp lại
      for (let i = 0; i < 3; i++) {
        const k = ((age / 1200) + i / 3) % 1;
        ctx.globalAlpha = 1 - k;
        ctx.font = `${16 + k * 10}px system-ui`;
        ctx.fillText(EMO_ICON[p.emote], x + Math.sin(k * 6 + i) * 14 + (p.emote === "sleep" ? 14 : 0), above - k * 40);
      }
      ctx.globalAlpha = 1;
    } else {
      const pop = Math.min(1, age / 200);
      ctx.font = `${30 * pop}px system-ui`;
      ctx.fillText(EMO_ICON[p.emote], x + (p.emote === "wave" ? 22 : 0), above - 8 + Math.sin(age / 150) * 3);
      if (p.emote === "cry") {
        // Nước mắt rơi hai bên mặt
        for (const sx of [-10, 10]) {
          const k = (age / 700 + (sx > 0 ? 0.5 : 0)) % 1;
          ctx.fillStyle = `rgba(116,185,255,${1 - k})`;
          ctx.beginPath(); ctx.arc(x + sx, top + 36 + k * 26, 3, 0, 7); ctx.fill();
        }
      }
    }
    ctx.textBaseline = "alphabetic";
  }
}

function draw() {
  requestAnimationFrame(draw);
  const W = canvas.width, H = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#1e272e"; ctx.fillRect(0, 0, W, H);
  if (!MAP) return;
  scale = Math.min(W / MAP.w, H / MAP.h);
  offX = (W - MAP.w * scale) / 2; offY = (H - MAP.h * scale) / 2;
  // Điện thoại (dọc, hoặc ngang nhưng màn hình thấp): phóng to sảnh và cho khung nhìn đi theo nhân vật
  const mine = players[me];
  const shortLandscape = W >= H && innerHeight < 520;
  if (mine && (W < H || shortLandscape)) {
    scale = W < H ? Math.min(H / MAP.h, W / 460) : Math.max(scale, H / 680);
    const camX = mine.rx * scale, camY = mine.ry * scale;
    offX = MAP.w * scale > W ? Math.min(0, Math.max(W - MAP.w * scale, W / 2 - camX)) : (W - MAP.w * scale) / 2;
    offY = MAP.h * scale > H ? Math.min(0, Math.max(H - MAP.h * scale, H / 2 - camY)) : (H - MAP.h * scale) / 2;
  }
  ctx.setTransform(scale, 0, 0, scale, offX, offY);

  drawGround();

  // Tường phía trên + các cửa phòng
  ctx.fillStyle = "#6d4c41"; ctx.fillRect(8, 8, MAP.w - 16, 262);
  ctx.fillStyle = "#5d4037"; ctx.fillRect(8, 262, MAP.w - 16, 10);
  const nd = currentDoor();
  for (const d of DOORS) drawDoor(d, nd === d);

  // Đài nước, cây, ghế và người chơi vẽ theo thứ tự từ xa tới gần
  const now = performance.now();
  const items = [];
  if (DECOR) {
    items.push({ y: DECOR.fountain.y, draw: () => drawFountain(DECOR.fountain, now) });
    for (const t of DECOR.trees) items.push({ y: t.y, draw: () => drawTree(t, now) });
    for (const b of DECOR.benches) items.push({ y: b.y - 30, draw: () => drawBench(b) });
  }
  for (const p of Object.values(players)) {
    p.rx += (p.x - p.rx) * 0.35; p.ry += (p.y - p.ry) * 0.35;
    items.push({ y: p.ry + RADIUS, draw: () => drawPlayer(p, now) });
  }
  items.sort((a, b) => a.y - b.y).forEach((it) => it.draw());
  if (target) { ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(target.x, target.y, 10, 0, 7); ctx.stroke(); }
}
draw();

// ===== Bàn chơi (Bầu Cua, Bài Cào, Xì Dách) =====
const TABLE_GAMES = ["baucua", "baicao", "xidach"];
const SUITS = ["♠", "♣", "♦", "♥"], RANKS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
// Vị trí 6 ghế quanh bàn (% theo khung bàn); ghế của mình luôn ở dưới cùng
const SEAT_POS = [[50, 79], [14, 66], [14, 30], [50, 21], [86, 30], [86, 66]];
let lastT = null, peek = { round: -1, open: [] }, chip = 10, shakeUntil = 0, lastRound = -1;

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function cardHtml(c, faceUp, cls = "") {
  const red = c && c.s >= 2 ? " red" : "";
  const front = c ? `<span class="rk">${RANKS[c.r]}</span><span class="st">${SUITS[c.s]}</span>` : "";
  return `<div class="pcard ${cls}${faceUp && c ? "" : " back"}"><div class="front${red}">${front}</div><div class="backface"></div></div>`;
}
const deckHtml = (s, title) => `${cardHtml(null, false, "sm")}<span>${s.round ? "Ván #" + s.round : title}</span>`;
const signed = (n) => (n > 0 ? "+" : "") + n;
const vsLabel = { win: " · hơn cái", lose: " · kém cái", push: " · bằng cái" };
// Chỉ thay nội dung khi thật sự khác để không mất thao tác chạm đang dở
function setHtml(el, html) { if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; } }
const btn = (act, label, cls = "") => `<button data-act="${act}" class="${cls}">${label}</button>`;

$("tLeaveBtn").onclick = () => socket.emit("leaveRoom");
// Mọi nút trong bàn dùng chung một bộ xử lý
$("tableRoom").addEventListener("click", (e) => {
  const el = e.target.closest("[data-act],[data-sit],[data-bet],[data-chip],[data-peek]");
  if (!el) return;
  if (el.dataset.sit) socket.emit("sit", +el.dataset.sit);
  else if (el.dataset.bet) socket.emit("act", "bet", { face: el.dataset.bet, amount: chip });
  else if (el.dataset.chip) { chip = +el.dataset.chip; renderTable(); }
  else if (el.dataset.peek) { peek.open[+el.dataset.peek] = true; renderTable(); }
  else if (el.dataset.act === "stand") socket.emit("stand");
  else socket.emit("act", el.dataset.act, el.dataset.arg !== undefined ? +el.dataset.arg : undefined);
});
socket.on("table", (s) => { if (s.game === room) { s.recvAt = Date.now(); lastT = s; renderTable(); } });
// Số giây còn lại của lượt hiện tại (đếm ngược ngay trên máy, không cần chờ server)
const turnLeft = (s) => Math.max(0, Math.ceil((s.turnRemain - (Date.now() - s.recvAt)) / 1000));

function renderTable() {
  const s = lastT; if (!s) return;
  const G = GAMES[s.game];
  const me = s.mySeat >= 0 ? s.seats[s.mySeat] : null;
  const seatedCount = s.seats.filter(Boolean).length;
  const host = s.seats.find((x) => x && x.isHost);
  // Trạng thái chung
  let st;
  if (s.mySeat < 0) st = "Chạm vào ghế trống để ngồi vào bàn";
  else if (seatedCount < 2) st = "Đang chờ thêm người ngồi vào bàn...";
  else st = G.status(s, me, host ? host.name : "chủ bàn");
  trackDeal(s);
  const busy = dealing();
  $("tStatus").textContent = busy ? "🃏 Đang chia bài..." : st;
  setHtml($("tHostBtns"), s.isHost && !busy ? G.hostBtns(s).map((b) => btn(b.act, b.label, b.cls)).join("") : "");
  setHtml($("tCenter"), busy ? dealCenterHtml() : G.center(s));
  // Ghế quanh bàn
  const base = s.mySeat >= 0 ? s.mySeat : 0;
  setHtml($("bkSeats"), s.seats.map((x, i) => {
    const [left, top] = SEAT_POS[(i - base + 6) % 6];
    const pos = `style="left:${left}%;top:${top}%"`;
    if (!x) return `<div class="bk-seat" ${pos}><button class="bk-empty" data-sit="${i}">Ngồi</button></div>`;
    return `<div class="bk-seat${x.isMe ? " me" : ""}${x.isTurn ? " turn" : ""}" data-seat="${i}" ${pos}>` +
      (x.isTurn ? `<div class="bk-timer${turnLeft(s) <= 10 ? " low" : ""}">⏱ ${turnLeft(s)}s</div>` : "") +
      (x.bubble ? `<div class="bk-bubble">${esc(x.bubble)}</div>` : "") +
      `<div class="bk-avatar${x.speaking ? " talking" : ""}"><img src="${avatarDataURL(x.look)}" alt="">${x.isHost ? '<span class="bk-host" title="Chủ bàn">🏦</span>' : ""}` +
      (x.mic ? `<span class="bk-mic${x.speaking ? " on" : ""}" title="${x.speaking ? "Đang nói" : "Đang bật mic"}">🎤</span>` : "") + `</div>` +
      `<div class="bk-name" style="color:${x.color}">${esc(x.name)}</div>` + G.seat(x, s, i) + `</div>`;
  }).join(""));

  G.panel(s, me);
  const acts = $("tActions");
  if (acts) acts.style.visibility = busy ? "hidden" : "";
  $("bkWatchers").textContent = s.watchers.length ? "Đang xem: " + s.watchers.join(", ") : "";
}

// ===== Hiệu ứng chia bài: lá bài bay từ xấp bài giữa bàn tới từng ghế =====
// Mỗi lần chia kéo dài khoảng 3-4 giây: xào bài ~1 giây rồi chia lần lượt từng lá
const SHUFFLE_MS = 1000, FLY_MS = 420, DEAL_TOTAL = 3500;
let deal = { game: null, round: -1, counts: {}, arrive: {}, start: 0, until: 0 };
const dealing = () => Date.now() < deal.until;
const isPending = (i, k) => !!(deal.arrive[i] && deal.arrive[i][k] > Date.now());
function seatCounts(s) {
  const c = {};
  s.seats.forEach((x, i) => { c[i] = x && x.hasCards ? x.count : 0; });
  return c;
}
function trackDeal(s) {
  if (s.game === "baucua") return;
  const now = Date.now();
  // Vừa vào phòng: bài đã chia sẵn thì hiện luôn, không bay
  if (deal.game !== s.game) { deal = { game: s.game, round: s.round, counts: seatCounts(s), arrive: {}, start: 0, until: 0 }; return; }
  if (s.round !== deal.round) {
    // Ván mới: chia lần lượt từng lá theo vòng, bắt đầu từ người ngồi sau cái
    deal.round = s.round; deal.arrive = {};
    const hostIdx = Math.max(0, s.seats.findIndex((x) => x && x.isHost));
    const order = [];
    for (let k = 1; k <= 6; k++) { const i = (hostIdx + k) % 6; if (s.seats[i] && s.seats[i].hasCards) order.push(i); }
    const maxN = Math.max(0, ...order.map((i) => s.seats[i].count));
    const steps = order.reduce((a, i) => a + s.seats[i].count, 0);
    // Giãn khoảng cách giữa các lá để cả lần chia kéo dài khoảng DEAL_TOTAL
    const gap = Math.max(120, Math.min(600, (DEAL_TOTAL - SHUFFLE_MS - FLY_MS) / Math.max(1, steps - 1)));
    let step = 0;
    for (let c = 0; c < maxN; c++) for (const i of order) {
      if (c >= s.seats[i].count) continue;
      const delay = SHUFFLE_MS + step * gap;
      (deal.arrive[i] = deal.arrive[i] || [])[c] = now + delay + FLY_MS;
      flyCard(i, c, delay);
      step++;
    }
    deal.start = now;
    deal.until = now + SHUFFLE_MS + Math.max(0, step - 1) * gap + FLY_MS + 100;
    deal.counts = seatCounts(s);
    return;
  }
  // Rút thêm lá (Xì Dách)
  const counts = seatCounts(s);
  for (const i in counts) {
    const before = deal.counts[i] || 0;
    for (let c = before; c < counts[i] && before > 0; c++) {
      (deal.arrive[i] = deal.arrive[i] || [])[c] = now + FLY_MS;
      flyCard(+i, c, 0);
    }
  }
  deal.counts = counts;
}
// Xấp bài giữa bàn lúc đang xào / chia
function dealCenterHtml() {
  const shuffling = Date.now() - deal.start < SHUFFLE_MS;
  const cards = [0, 1, 2].map(() => cardHtml(null, false, "sm")).join("");
  return `<div class="deck-stack${shuffling ? " shuffling" : ""}">${cards}</div><span class="dealing-text">${shuffling ? "🔀 Đang xào bài..." : "🃏 Đang chia bài..."}</span>`;
}
function flyCard(i, c, delay) {
  setTimeout(() => {
    const table = $("bkTable"), src = $("tCenter").querySelector(".pcard") || $("tCenter");
    const seat = $("bkSeats").querySelector(`[data-seat="${i}"] .bk-mini`);
    const dst = seat && seat.children[c];
    if (!dst || room !== deal.game) return;
    const tb = table.getBoundingClientRect(), a = src.getBoundingClientRect(), b = dst.getBoundingClientRect();
    const el = document.createElement("div");
    el.className = "pcard sm fly";
    el.innerHTML = `<div class="front"></div><div class="backface"></div>`;
    el.style.left = a.left - tb.left + "px"; el.style.top = a.top - tb.top + "px";
    table.append(el);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transform = `translate(${b.left - a.left}px, ${b.top - a.top}px) rotateY(180deg) rotateZ(360deg)`;
    }));
    setTimeout(() => { el.remove(); renderTable(); }, FLY_MS + 40);
  }, delay);
}

// Lá bài nhỏ trước ghế + nhãn điểm
function seatCards(x, scoreText, i) {
  const n = x.count || 0;
  const mini = x.hasCards ? Array.from({ length: n }, (_, k) => cardHtml(x.revealed && x.cards ? x.cards[k] : null, x.revealed, "sm" + (isPending(i, k) ? " pending" : ""))).join("") : "";
  const cls = x.vsHost === "win" ? " win" : x.vsHost === "lose" ? " lose" : "";
  return `<div class="bk-mini">${mini}</div>` + (scoreText ? `<div class="bk-score${cls}">${scoreText}</div>` : "");
}
// Phần bài trên tay (thanh dưới): khung cố định để hiệu ứng lật bài chạy mượt
function handFrame() {
  const panel = $("tPanel");
  if (!$("tHand")) {
    panel.innerHTML = `<div class="t-hint" id="tHint"></div><div class="bk-hand" id="tHand"></div><div class="bk-actions" id="tActions"></div>`;
    panel.dataset.html = "";
  }
  return $("tHand");
}

const GAMES = {
  // ----- Bài Cào: nặn từng lá rồi lật cho cả bàn -----
  baicao: {
    status(s, me, hostName) {
      if (!s.dealt) return s.isHost ? "Bạn là chủ bàn, bấm Chia bài khi mọi người sẵn sàng" : `Chờ ${hostName} chia bài...`;
      const left = s.seats.filter((x) => x && x.hasCards && !x.revealed).length;
      return left ? `Ván #${s.round} · còn ${left} người chưa lật bài` : `Ván #${s.round} · mọi người đã lật bài`;
    },
    hostBtns: (s) => [{ act: "deal", label: s.dealt ? "🃏 Chia ván mới" : "🃏 Chia bài" }],
    center: (s) => deckHtml(s, "Bài Cào"),
    seat: (x, s, i) => seatCards(x, x.revealed && x.score ? x.score.label + (vsLabel[x.vsHost] || "") : x.hasCards ? "Chưa lật" : "", i),
    panel(s, me) {
      const hand = handFrame();
      if (peek.round !== s.round) peek = { round: s.round, open: [] };
      if (me && me.cards) {
        const key = s.round + ":" + me.cards.map((c) => c.r + "-" + c.s).join();
        if (hand.dataset.key !== key) {
          hand.innerHTML = me.cards.map((c, k) => cardHtml(c, false).replace('class="pcard', `data-peek="${k}" class="pcard`)).join("");
          hand.dataset.key = key;
        }
        [...hand.children].forEach((el, k) => { el.classList.toggle("back", !peek.open[k] && !me.revealed); el.classList.toggle("pending", isPending(s.mySeat, k)); });
        const allOpen = me.revealed || me.cards.every((_, k) => peek.open[k]);
        $("tHint").textContent = me.revealed ? `Đã lật: ${me.score.label}` : allOpen ? `Bài của bạn: ${me.score.label} (chỉ mình bạn thấy)` : "Chạm vào từng lá để nặn bài";
      } else {
        hand.innerHTML = ""; hand.dataset.key = "";
        $("tHint").textContent = s.mySeat < 0 ? "Bạn đang đứng xem. Chạm vào ghế trống để ngồi." : "Chưa có bài";
      }
      setHtml($("tActions"), (me && me.hasCards && !me.revealed ? btn("reveal", "👀 Lật bài cho cả bàn xem", "go") : "") + (me ? btn("stand", "Đứng dậy") : ""));
    },
  },

  // ----- Xì Dách: rút bài / dằn, cái lật cả bàn -----
  xidach: {
    status(s, me, hostName) {
      if (!s.dealt) return s.isHost ? "Bạn là chủ bàn, bấm Chia bài khi mọi người sẵn sàng" : `Chờ ${hostName} chia bài...`;
      if (s.revealed) return `Ván #${s.round} · đã lật bài`;
      const left = turnLeft(s);
      if (s.myTurn) return s.isHost ? `🔔 Tới lượt cái: rút thêm, xét từng người hoặc lật hết · còn ${left}s` : `🔔 Tới lượt bạn: rút hoặc dằn · còn ${left}s`;
      return `Đang tới lượt ${s.turnName} · còn ${left}s`;
    },
    hostBtns: (s) => [{ act: "deal", label: s.dealt ? "♠️ Chia ván mới" : "♠️ Chia bài" }]
      .concat(s.myTurn ? [{ act: "reveal", label: "👀 Lật hết", cls: "alt" }] : []),
    center: (s) => deckHtml(s, "Xì Dách"),
    seat(x, s, i) {
      let t = "";
      if (x.revealed && x.score) t = (x.checked ? "🔍 " : "") + x.score.label + (vsLabel[x.vsHost] || "");
      else if (x.checked) t = "🔍 Đã xét";
      else if (x.hasCards) t = x.done ? `${x.count} lá · Dằn` : `${x.count} lá`;
      return seatCards(x, t, i) + (x.canCheck ? `<button class="bk-check" data-act="check" data-arg="${i}">🔍 Xét bài</button>` : "");
    },
    panel(s, me) {
      const hand = handFrame();
      if (me && me.cards) {
        const key = s.round + ":" + me.cards.map((c) => c.r + "-" + c.s).join();
        if (hand.dataset.key !== key) { hand.innerHTML = me.cards.map((c) => cardHtml(c, true)).join(""); hand.dataset.key = key; }
        [...hand.children].forEach((el, k) => el.classList.toggle("pending", isPending(s.mySeat, k)));
        const sc = me.score;
        $("tHint").textContent = `Bài của bạn: ${sc.label}` + (s.revealed || me.checked ? (vsLabel[me.vsHost] || "") + (me.checked && !s.revealed ? " (cái đã xét, chỉ bạn và cái biết)" : "") : sc.kind === "bust" ? " 😢" : s.myTurn ? "" : me.done ? " · đã dằn" : " · chờ tới lượt");
      } else {
        hand.innerHTML = ""; hand.dataset.key = "";
        $("tHint").textContent = s.mySeat < 0 ? "Bạn đang đứng xem. Chạm vào ghế trống để ngồi." : "Chưa có bài";
      }
      const canPlay = s.myTurn && me && me.hasCards && me.count < 5;
      setHtml($("tActions"),
        (canPlay ? btn("hit", "🂠 Rút bài", "go") : "") +
        (canPlay && !s.isHost ? btn("stay", "✋ Dằn", "warn") : "") +
        (me ? btn("stand", "Đứng dậy") : ""));
    },
  },

  // ----- Bầu Cua: cái lắc, mọi người cược, cái mở bát -----
  baucua: {
    status(s, me, hostName) {
      if (s.phase === "idle") return s.isHost ? "Bạn là chủ bàn, bấm Lắc để bắt đầu" : `Chờ ${hostName} lắc...`;
      if (s.phase === "bet") return s.isHost ? "Mọi người đang đặt cược, bấm Mở bát khi xong" : "Đặt cược rồi chờ cái mở bát";
      return `Kết quả ván #${s.round}` + (s.isHost ? " · bấm Lắc để chơi tiếp" : "");
    },
    hostBtns: (s) => s.phase === "bet" ? [{ act: "open", label: "🥣 Mở bát", cls: "alt" }] : [{ act: "shake", label: "🎲 Lắc" }],
    center(s) {
      if (s.round !== lastRound) { if (lastRound !== -1 && s.phase === "bet") shakeUntil = Date.now() + 1200; lastRound = s.round; }
      const hist = s.history.length ? `<div class="t-history">Trước: ${s.history.slice(0, 4).map((h) => h.map((f) => FACE_INFO[f].emo).join("")).join(" · ")}</div>` : "";
      if (s.phase === "open") return `<div class="dice">${s.dice.map((f) => `<div class="die">${FACE_INFO[f].emo}</div>`).join("")}</div><span>Ván #${s.round}</span>${hist}`;
      const shaking = Date.now() < shakeUntil;
      return `<div class="bowl${shaking ? " shake" : ""}"></div><span>${s.phase === "bet" ? (shaking ? "Đang lắc..." : `Ván #${s.round} · bát đang úp`) : "Chờ cái lắc"}</span>${hist}`;
    },
    seat(x, s) {
      let t = "", cls = "";
      if (s.phase === "bet" && x.bet) t = `Cược ${x.bet}`;
      if (s.phase === "open" && x.net !== null) { t = signed(x.net); cls = x.net > 0 ? " win" : x.net < 0 ? " lose" : ""; }
      return (t ? `<div class="bk-score${cls}">${t}</div>` : "") + (x.tally ? `<div class="bk-tally">Tổng: ${signed(x.tally)}</div>` : "");
    },
    panel(s, me) {
      const panel = $("tPanel");
      if (!$("tBoard")) {
        panel.innerHTML = `<div class="t-hint" id="tHint"></div><div class="bc-board" id="tBoard"></div><div class="bc-chips" id="tChips"></div>`;
        panel.dataset.html = "";
      }
      const canBet = me && !s.isHost && s.phase === "bet";
      setHtml($("tBoard"), FACES.map((f) => {
        const mine = s.myBets[f] ? `<span class="mine">${s.myBets[f]}</span>` : "";
        const win = s.phase === "open" && s.dice.includes(f) ? " win" : "";
        return `<div class="bc-face${win}${canBet ? "" : " off"}"${canBet ? ` data-bet="${f}"` : ""}><div class="emo">${FACE_INFO[f].emo}</div><div class="nm">${FACE_INFO[f].nm}</div><div class="tot">${s.totals[f] || ""}</div>${mine}</div>`;
      }).join(""));
      const myTotal = Object.values(s.myBets).reduce((a, b) => a + b, 0);
      let hint;
      if (!me) hint = "Bạn đang đứng xem. Chạm vào ghế trống để ngồi.";
      else if (s.isHost) hint = s.phase === "open" && me.net !== null ? `Ván này cái ${me.net >= 0 ? "được" : "chung"} ${Math.abs(me.net)}` : "Bạn là cái, không đặt cược";
      else if (s.phase === "open") hint = me.net !== null ? `Ván này bạn ${me.net >= 0 ? "được" : "thua"} ${Math.abs(me.net)}` : "Ván này bạn không cược";
      else if (s.phase === "bet") hint = myTotal ? `Bạn đã cược ${myTotal} · chọn mức rồi chạm vào con vật` : "Chọn mức cược rồi chạm vào con vật";
      else hint = "Chờ cái lắc để đặt cược";
      $("tHint").textContent = hint;
      setHtml($("tChips"),
        (canBet ? s.chips.map((v) => `<button class="chip${v === chip ? " active" : ""}" data-chip="${v}">${v}</button>`).join("") + btn("clear", "Hủy cược") : "") +
        (me ? btn("stand", "Đứng dậy") : ""));
    },
  },
};
// Bộ đếm cho bát lắc (Bầu Cua), đồng hồ lượt (Xì Dách) và lúc đang chia bài
setInterval(() => { if (lastT && lastT.game === room && (room === "baucua" || room === "xidach" || dealing())) renderTable(); }, 300);

// ===== Mic: nói chuyện với người cùng phòng (WebRTC, mỗi người bật mic gửi tiếng thẳng tới từng người) =====
const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
let httpsPort = null, micStream = null, meter = null;
const pcOut = {}, pcIn = {}, audios = {};

function closeOut(id) { if (pcOut[id]) { pcOut[id].close(); delete pcOut[id]; } }
function closeIn(id) {
  if (pcIn[id]) { pcIn[id].close(); delete pcIn[id]; }
  if (audios[id]) { audios[id].srcObject = null; audios[id].remove(); delete audios[id]; }
}
function closeAllVoice() { Object.keys(pcOut).forEach(closeOut); Object.keys(pcIn).forEach(closeIn); }

async function sendTo(id) {
  if (!micStream || pcOut[id] || id === me) return;
  const pc = new RTCPeerConnection(ICE);
  pcOut[id] = pc;
  micStream.getTracks().forEach((t) => pc.addTrack(t, micStream));
  pc.onicecandidate = (e) => e.candidate && socket.emit("rtc", { to: id, kind: "ice", side: "in", candidate: e.candidate });
  pc.onconnectionstatechange = () => { if (pc.connectionState === "failed") closeOut(id); };
  await pc.setLocalDescription(await pc.createOffer());
  socket.emit("rtc", { to: id, kind: "offer", sdp: pc.localDescription });
}
socket.on("rtc", async (m) => {
  try {
    if (m.kind === "offer") {
      closeIn(m.from);
      const pc = new RTCPeerConnection(ICE);
      pcIn[m.from] = pc;
      pc.onicecandidate = (e) => e.candidate && socket.emit("rtc", { to: m.from, kind: "ice", side: "out", candidate: e.candidate });
      pc.ontrack = (e) => playVoice(m.from, e.streams[0]);
      await pc.setRemoteDescription(m.sdp);
      await pc.setLocalDescription(await pc.createAnswer());
      socket.emit("rtc", { to: m.from, kind: "answer", sdp: pc.localDescription });
    } else if (m.kind === "answer" && pcOut[m.from]) {
      await pcOut[m.from].setRemoteDescription(m.sdp);
    } else if (m.kind === "ice") {
      const pc = (m.side === "in" ? pcIn : pcOut)[m.from];
      if (pc) await pc.addIceCandidate(m.candidate);
    }
  } catch (e) { console.warn("rtc", e); }
});
socket.on("voice:peers", (ids) => ids.forEach(sendTo));
socket.on("voice:newPeer", (id) => sendTo(id));
socket.on("voice:stop", (id) => closeIn(id));
socket.on("voice:left", (id) => { if (id === me) closeAllVoice(); else { closeIn(id); closeOut(id); } });

// Phát tiếng người khác; trình duyệt chặn tự phát thì chờ người dùng chạm màn hình
let needUnlock = false;
function playVoice(id, stream) {
  if (!audios[id]) { audios[id] = document.createElement("audio"); audios[id].autoplay = true; audios[id].playsInline = true; document.body.append(audios[id]); }
  audios[id].srcObject = stream;
  audios[id].play().catch(() => { if (!needUnlock) { needUnlock = true; toast("🔈 Chạm vào màn hình để nghe tiếng mọi người"); } });
}
addEventListener("pointerdown", () => {
  if (!needUnlock) return;
  needUnlock = false;
  Object.values(audios).forEach((a) => a.play().catch(() => {}));
});

// Bật / tắt mic
$("micBtn").onclick = async () => {
  if (micStream) return stopMic();
  if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    const url = `https://${location.hostname}:${httpsPort}`;
    if (confirm(`Trình duyệt chỉ cho dùng mic khi mở bằng https.\n\nMở ${url} ?\n(Lần đầu sẽ có cảnh báo bảo mật: bấm "Nâng cao" rồi "Tiếp tục")`)) location.href = url;
    return;
  }
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch (e) {
    toast("Không mở được mic. Hãy cho phép trình duyệt dùng micro.");
    return;
  }
  startMeter();
  socket.emit("voice:mic", true);
  updateMicBtn();
};
function stopMic() {
  Object.keys(pcOut).forEach(closeOut);
  micStream.getTracks().forEach((t) => t.stop());
  micStream = null;
  stopMeter();
  socket.emit("voice:mic", false);
  updateMicBtn();
}
function updateMicBtn() {
  const b = $("micBtn");
  b.classList.toggle("on", !!micStream);
  b.textContent = micStream ? "🎙️ Tắt mic" : "🎤 Bật mic";
}

// Đo âm lượng mic để biết mình đang nói (sáng mic cho mọi người thấy)
function startMeter() {
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const an = ac.createAnalyser(); an.fftSize = 512;
  ac.createMediaStreamSource(micStream).connect(an);
  const buf = new Float32Array(an.fftSize);
  let speaking = false, lastLoud = 0;
  const timer = setInterval(() => {
    an.getFloatTimeDomainData(buf);
    let sum = 0; for (const v of buf) sum += v * v;
    const rms = Math.sqrt(sum / buf.length);
    if (rms > 0.025) lastLoud = Date.now();
    const now = Date.now() - lastLoud < 400; // giữ trạng thái thêm 0,4 giây để đèn không nhấp nháy liên tục
    if (now !== speaking) { speaking = now; socket.emit("voice:speaking", now); $("micBtn").classList.toggle("talking", now); }
  }, 100);
  meter = { ac, timer };
}
function stopMeter() {
  if (!meter) return;
  clearInterval(meter.timer); meter.ac.close(); meter = null;
  $("micBtn").classList.remove("talking");
}

// ===== Hành động trong sảnh: ngồi, vẫy tay, nhảy... =====
const ACTIONS = [
  { id: "sit", icon: "🪑", name: "Ngồi" }, { id: "wave", icon: "👋", name: "Vẫy tay" }, { id: "dance", icon: "💃", name: "Nhảy" },
  { id: "heart", icon: "❤️", name: "Thả tim" }, { id: "laugh", icon: "😂", name: "Cười" }, { id: "cry", icon: "😢", name: "Khóc" },
  { id: "sleep", icon: "💤", name: "Ngủ" },
];
$("actionBar").innerHTML = ACTIONS.map((a, i) => `<button data-action="${a.id}" title="${a.name} (phím ${i + 1})"><span>${a.icon}</span><small>${a.name}</small></button>`).join("");
$("actionBar").addEventListener("click", (e) => { const b = e.target.closest("[data-action]"); if (b) doAction(b.dataset.action); });
function doAction(id) {
  if (id === "sit") socket.emit("sit");
  else socket.emit("emote", id);
}

// ===== Điện thoại: nhắc xoay ngang, toàn màn hình =====
const isTouch = matchMedia("(pointer: coarse)").matches;
const canFullscreen = !!(document.documentElement.requestFullscreen && document.fullscreenEnabled);
let skipRotate = false;
try { skipRotate = sessionStorage.getItem("skipRotate") === "1"; } catch (e) {}
if (!canFullscreen) {
  // iPhone không cho trang web tự xoay / toàn màn hình: chỉ nhắc người dùng tự xoay
  $("rotateBtn").classList.add("hidden");
  $("rotateText").textContent = "Hãy xoay ngang điện thoại để chơi đẹp hơn (nhớ tắt Khóa xoay màn hình).";
}
function checkOrientation() {
  const portrait = innerHeight > innerWidth;
  $("rotateHint").classList.toggle("hidden", !(me && isTouch && portrait && !skipRotate));
  $("fsBtn").classList.toggle("hidden", !(me && isTouch && canFullscreen && !document.fullscreenElement));
}
async function goLandscape() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    if (screen.orientation && screen.orientation.lock) await screen.orientation.lock("landscape");
  } catch (e) {
    toast("Hãy tự xoay ngang điện thoại (tắt Khóa xoay màn hình)");
  }
  checkOrientation();
}
$("rotateBtn").onclick = goLandscape;
$("fsBtn").onclick = goLandscape;
$("rotateSkip").onclick = () => {
  skipRotate = true;
  try { sessionStorage.setItem("skipRotate", "1"); } catch (e) {}
  checkOrientation();
};
addEventListener("resize", checkOrientation);
document.addEventListener("fullscreenchange", checkOrientation);

// ===== Tìm đường vòng qua đài nước, cây, ghế (giống luật chặn ở server) =====
function blockedAt(x, y) {
  if (!DECOR) return false;
  const fy = y + RADIUS, f = DECOR.fountain;
  if (((x - f.x) / (f.rx + 20)) ** 2 + ((fy - f.y) / (f.ry + 18)) ** 2 < 1) return true;
  for (const t of DECOR.trees) if (Math.hypot(x - t.x, (fy - t.y) * 1.8) < 26) return true;
  for (const b of DECOR.benches) if (Math.abs(x - b.x) < 64 && fy > b.y - 18 && fy < b.y + 6) return true;
  return false;
}
const CELL = 20;
function walkable(x, y) {
  if (x < RADIUS || y < RADIUS || x > MAP.w - RADIUS || y > MAP.h - RADIUS) return false;
  return !blockedAt(x, y) && !blockedAt(x - 9, y) && !blockedAt(x + 9, y) && !blockedAt(x, y - 9) && !blockedAt(x, y + 9);
}
function clearLine(a, b) {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 8);
  for (let i = 1; i <= n; i++) if (!walkable(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n)) return false;
  return true;
}
// A* trên lưới ô 20px, rồi rút gọn các điểm thẳng hàng
function findPath(from, to) {
  if (clearLine(from, to)) return [];
  const cols = Math.ceil(MAP.w / CELL), rows = Math.ceil(MAP.h / CELL);
  const key = (c, r) => r * cols + c, center = (c, r) => ({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 });
  const sc = Math.floor(from.x / CELL), sr = Math.floor(from.y / CELL);
  let tc = Math.floor(to.x / CELL), tr = Math.floor(to.y / CELL);
  // Điểm đích nằm trong vật cản: lấy ô đi được gần nhất
  if (!walkable(center(tc, tr).x, center(tc, tr).y)) {
    let best = null, bd = Infinity;
    for (let r = Math.max(0, tr - 8); r <= Math.min(rows - 1, tr + 8); r++) for (let c = Math.max(0, tc - 8); c <= Math.min(cols - 1, tc + 8); c++) {
      const p = center(c, r), d = Math.hypot(c - tc, r - tr);
      if (d < bd && walkable(p.x, p.y)) { bd = d; best = [c, r]; }
    }
    if (!best) return [];
    [tc, tr] = best; to = center(tc, tr); target = to;
  }
  const g = new Map([[key(sc, sr), 0]]), prev = new Map(), open = [[sc, sr]], done = new Set();
  const h = (c, r) => Math.hypot(c - tc, r - tr);
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (g.get(key(...open[i])) + h(...open[i]) < g.get(key(...open[bi])) + h(...open[bi])) bi = i;
    const [c, r] = open.splice(bi, 1)[0], k = key(c, r);
    if (c === tc && r === tr) break;
    if (done.has(k)) continue;
    done.add(k);
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const p = center(nc, nr);
      if (!walkable(p.x, p.y)) continue;
      if (dc && dr && (!walkable(center(c + dc, r).x, center(c + dc, r).y) || !walkable(center(c, r + dr).x, center(c, r + dr).y))) continue;
      const nk = key(nc, nr), ng = g.get(k) + Math.hypot(dc, dr);
      if (!g.has(nk) || ng < g.get(nk)) { g.set(nk, ng); prev.set(nk, k); open.push([nc, nr]); }
    }
  }
  if (!prev.has(key(tc, tr))) return [];
  const cells = [];
  for (let k = key(tc, tr); k !== key(sc, sr); k = prev.get(k)) cells.unshift(center(k % cols, Math.floor(k / cols)));
  cells[cells.length - 1] = to;
  // Rút gọn: từ mỗi điểm nhảy tới điểm xa nhất còn nhìn thấy thẳng
  const out = [];
  let cur = from;
  for (let i = 0; i < cells.length; ) {
    let j = cells.length - 1;
    while (j > i && !clearLine(cur, cells[j])) j--;
    out.push(cells[j]); cur = cells[j]; i = j + 1;
  }
  return out;
}
function goTo(x, y) {
  target = { x, y };
  const p = players[me];
  path = p ? findPath({ x: p.x, y: p.y }, target) : [];
}
