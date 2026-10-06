// Thuyền ở cầu tàu (bãi biển), hoạt cảnh ra khơi, và map Tàu Hải Tặc (lấy cảm hứng từ Thousand Sunny):
// boong cỏ, đầu sư tử, cột buồm có buồm đầu lâu đội mũ rơm, vườn quýt, xích đu, cabin bếp, biển chạy quanh tàu.
// Dùng chung `ctx`, `roundRect`, `drawAvatar`, `MAP`, `RADIUS` của client.js.

let boatAge = null; // bao lâu kể từ lúc thuyền rời bến (ms), null = thuyền đang neo
socket.on("state", (d) => { boatAge = d.boatDepart === null || d.boatDepart === undefined ? null : { age: d.boatDepart, at: Date.now() }; });

// ----- Thuyền buồm nhỏ (dùng ở bãi biển, trên tàu và trong hoạt cảnh) -----
function drawSailboat(x, y, s = 1, flip = false, t = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(flip ? -s : s, s);
  ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.beginPath(); ctx.ellipse(0, 14, 62, 9, 0, 0, 7); ctx.fill();
  // Thân thuyền gỗ
  ctx.fillStyle = "#8d5524"; ctx.beginPath(); ctx.moveTo(-60, -6); ctx.lineTo(60, -6); ctx.lineTo(44, 14); ctx.lineTo(-44, 14); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#a0652d"; ctx.fillRect(-58, -10, 116, 6);
  ctx.fillStyle = "#fff"; for (let i = -40; i <= 40; i += 20) ctx.fillRect(i - 3, 0, 6, 4);
  // Cột + buồm
  ctx.fillStyle = "#5d4037"; ctx.fillRect(-3, -86, 5, 80);
  ctx.fillStyle = "#fff8e1"; ctx.beginPath(); ctx.moveTo(4, -84); ctx.quadraticCurveTo(38 + Math.sin(t / 400) * 3, -50, 6, -14); ctx.fill();
  ctx.fillStyle = "#e17055"; ctx.beginPath(); ctx.moveTo(-6, -78); ctx.quadraticCurveTo(-30, -48, -8, -16); ctx.fill();
  ctx.restore();
}
// Thuyền neo ở cầu tàu; khi có người lên thì chạy ra xa rồi lát sau quay về
function drawDockBoat(b, t) {
  let age = boatAge ? boatAge.age + (Date.now() - boatAge.at) : Infinity;
  const SAIL = 3600, BACK = 9000;
  const bob = Math.sin(t / 700) * 2;
  if (age < SAIL) {
    const k = age / SAIL, e = k * k;
    drawSailboat(b.x + e * 320, b.y - e * 70 + bob, 1 - e * 0.55, false, t);
    ctx.fillStyle = "rgba(255,255,255,.6)"; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(b.x + e * 320 - 60 - i * 18, b.y - e * 70 + 14, 10 - i * 2, 3, 0, 0, 7); ctx.fill(); }
  } else if (age < BACK) {
    return; // thuyền đang ở ngoài khơi
  } else {
    ctx.globalAlpha = Math.min(1, (age - BACK) / 800); drawSailboat(b.x, b.y + bob, 1, false, t); ctx.globalAlpha = 1;
  }
}

// ----- Hoạt cảnh ra khơi (chỉ người lên thuyền thấy) -----
let sailScene = null;
socket.on("sail", ({ to, ms }) => {
  const cv = $("sailScene");
  cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio;
  cv.classList.remove("hidden", "out");
  sailScene = { to, start: performance.now(), ms };
  target = null; path = [];
  requestAnimationFrame(drawSailScene);
});
// Khi đã sang map mới thì cảnh mờ dần
socket.on("roomChanged", () => {
  if (!sailScene) return;
  $("sailScene").classList.add("out");
  setTimeout(() => { $("sailScene").classList.add("hidden"); sailScene = null; }, 600);
});
function drawSailScene(now) {
  if (!sailScene) return;
  const cv = $("sailScene"), g = cv.getContext("2d"), W = cv.width, H = cv.height, k = Math.min(1, (now - sailScene.start) / sailScene.ms);
  const toShip = sailScene.to === "ship", horizon = H * 0.45, saved = ctx;
  // Trời + mặt trời
  const sky = g.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, toShip ? "#74b9ff" : "#fab1a0"); sky.addColorStop(1, toShip ? "#dff9fb" : "#ffeaa7");
  g.fillStyle = sky; g.fillRect(0, 0, W, horizon);
  g.fillStyle = "#fdcb6e"; g.beginPath(); g.arc(W * 0.8, horizon * 0.45, H * 0.07, 0, 7); g.fill();
  // Biển trôi về phía sau
  const sea = g.createLinearGradient(0, horizon, 0, H);
  sea.addColorStop(0, "#0984e3"); sea.addColorStop(1, "#0a3d62");
  g.fillStyle = sea; g.fillRect(0, horizon, W, H - horizon);
  g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 2 * devicePixelRatio;
  for (let row = 0; row < 9; row++) {
    const y = horizon + 12 + row * row * 6 * devicePixelRatio, sp = 60 + row * 40, off = ((now / 1000) * sp) % 160;
    for (let x = -160 + (toShip ? -off : off) + 160; x < W; x += 160) { g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 20, y - 5, x + 40, y); g.stroke(); }
  }
  // Đích đến hiện dần phía trước: tàu hải tặc (ra khơi) hoặc bãi biển có dừa (về bờ)
  const dx = W * (0.95 - k * 0.2), dy = horizon, ds = (0.4 + k * 0.6) * devicePixelRatio;
  if (toShip) {
    g.save(); g.translate(dx, dy); g.scale(ds, ds);
    g.fillStyle = "#8d5524"; g.beginPath(); g.moveTo(-90, -10); g.lineTo(90, -10); g.lineTo(70, 20); g.lineTo(-70, 20); g.fill();
    g.fillStyle = "#f9ca24"; g.beginPath(); g.arc(96, -14, 16, 0, 7); g.fill(); // đầu sư tử
    g.fillStyle = "#5d4037"; g.fillRect(-4, -120, 6, 110);
    g.fillStyle = "#fff"; g.fillRect(-46, -112, 92, 64);
    g.fillStyle = "#2d3436"; g.beginPath(); g.arc(0, -84, 14, 0, 7); g.fill();
    g.fillStyle = "#f9ca24"; g.fillRect(-20, -100, 40, 6);
    g.restore();
  } else {
    g.fillStyle = "#f6d7a7"; g.beginPath(); g.ellipse(dx, dy + 6 * devicePixelRatio, 160 * ds, 18 * ds, 0, 0, 7); g.fill();
    g.fillStyle = "#2e7d32"; for (const px of [-60, 20, 90]) { g.beginPath(); g.arc(dx + px * ds, dy - 50 * ds, 22 * ds, 0, 7); g.fill(); }
  }
  // Thuyền của mình chạy, có nhân vật ngồi trên đó
  const bx = W * (0.15 + k * 0.4), by = H * 0.7 + Math.sin(now / 300) * 6 * devicePixelRatio, s = 1.6 * devicePixelRatio;
  ctx = g;
  // Ngoại hình của mình (lúc ngồi thuyền server ẩn mình khỏi bản đồ nên lấy từ lúc đăng nhập)
  drawSailboat(bx, by, s, false, now);
  drawAvatar(g, costume ? { ...look, costume } : look, bx - 34 * s, by - 4 * s, 2.4 * devicePixelRatio, "right", 0, "sit");
  ctx = saved;
  for (let i = 0; i < 5; i++) { g.fillStyle = `rgba(255,255,255,${0.5 - i * 0.09})`; g.beginPath(); g.ellipse(bx - (70 + i * 30) * s, by + 14 * s, (14 - i * 2) * s, 4 * s, 0, 0, 7); g.fill(); }
  // Chữ
  g.textAlign = "center"; g.font = `bold ${22 * devicePixelRatio}px system-ui`; g.fillStyle = "#fff"; g.strokeStyle = "rgba(0,0,0,.5)"; g.lineWidth = 5 * devicePixelRatio;
  const text = toShip ? "⛵ Đang ra khơi... Tàu Hải Tặc ở phía trước! 🏴‍☠️" : "⛵ Đang chèo thuyền về bãi biển... 🏖️";
  g.strokeText(text, W / 2, H * 0.14); g.fillText(text, W / 2, H * 0.14);
  requestAnimationFrame(drawSailScene);
}

// ===== Map Tàu Hải Tặc =====
function drawShip(W, t, items) {
  const D = W.decor, d = D.deck;
  // Biển quanh tàu, sóng trôi về phía đuôi (tàu đang chạy về bên phải)
  const sea = ctx.createLinearGradient(0, 0, 0, MAP.h);
  sea.addColorStop(0, "#0a6aa1"); sea.addColorStop(0.5, "#1e88c7"); sea.addColorStop(1, "#0a6aa1");
  ctx.fillStyle = sea; ctx.fillRect(-60, -60, MAP.w + 120, MAP.h + 120);
  ctx.strokeStyle = "rgba(255,255,255,.3)"; ctx.lineWidth = 2;
  for (let row = 0; row < 18; row++) {
    const y = -30 + row * 48, off = (t / 18 + row * 70) % 140;
    for (let x = MAP.w + 60 - off; x > -140; x -= 140) { ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 18, y - 6, x + 36, y); ctx.stroke(); }
  }
  // Vệt bọt sau đuôi tàu
  for (let i = 0; i < 10; i++) { const k = ((t / 1400 + i / 10) % 1); ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - k)})`; ctx.beginPath(); ctx.ellipse(d.x1 - 40 - k * 160, (d.y1 + d.y2) / 2 + Math.sin(i * 2) * 60 * k, 18 + k * 20, 6 + k * 4, 0, 0, 7); ctx.fill(); }
  // Thân tàu: đuôi phẳng bên trái, mũi nhọn bên phải
  const midY = (d.y1 + d.y2) / 2;
  const hull = () => { ctx.beginPath(); ctx.moveTo(d.x1 - 30, d.y1 - 40); ctx.lineTo(d.x2 - 40, d.y1 - 40); ctx.quadraticCurveTo(d.x2 + 70, d.y1 - 20, d.x2 + 88, midY); ctx.quadraticCurveTo(d.x2 + 70, d.y2 + 20, d.x2 - 40, d.y2 + 40); ctx.lineTo(d.x1 - 30, d.y2 + 40); ctx.closePath(); };
  ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.save(); ctx.translate(10, 16); hull(); ctx.fill(); ctx.restore();
  ctx.fillStyle = "#6d3b16"; hull(); ctx.fill();
  ctx.fillStyle = "#8d5524"; ctx.save(); ctx.translate(0, 0); ctx.scale(1, 1); hull(); ctx.lineWidth = 16; ctx.strokeStyle = "#a0652d"; ctx.stroke(); ctx.restore();
  // Boong cỏ (lawn deck) + viền gỗ
  ctx.fillStyle = "#7cb342"; roundRect(d.x1 - 10, d.y1 - 22, d.x2 - d.x1 + 40, d.y2 - d.y1 + 44, 30); ctx.fill();
  ctx.strokeStyle = "#558b2f"; ctx.lineWidth = 1.5;
  for (let i = 0; i < 160; i++) { const gx = d.x1 + ((i * 97) % (d.x2 - d.x1)), gy = d.y1 + ((i * 53) % (d.y2 - d.y1)); ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + 3, gy - 6); ctx.stroke(); }
  // Sàn gỗ ở mũi tàu
  ctx.fillStyle = "#c19a6b"; ctx.beginPath(); ctx.moveTo(d.x2 + 30, d.y1 - 20); ctx.quadraticCurveTo(d.x2 + 66, d.y1, d.x2 + 76, midY); ctx.quadraticCurveTo(d.x2 + 66, d.y2, d.x2 + 30, d.y2 + 20); ctx.fill();
  // Lan can
  ctx.strokeStyle = "#5d4037"; ctx.lineWidth = 6; roundRect(d.x1 - 14, d.y1 - 26, d.x2 - d.x1 + 48, d.y2 - d.y1 + 52, 32); ctx.stroke();
  ctx.fillStyle = "#4e342e";
  for (let x = d.x1; x <= d.x2 + 20; x += 40) { ctx.fillRect(x - 3, d.y1 - 34, 6, 14); ctx.fillRect(x - 3, d.y2 + 20, 6, 14); }
  // Đầu sư tử ở mũi tàu
  const lx = d.x2 + 88, ly = midY;
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; ctx.fillStyle = i % 2 ? "#e67e22" : "#f39c12"; ctx.beginPath(); ctx.ellipse(lx + Math.cos(a) * 34, ly + Math.sin(a) * 34, 16, 10, a, 0, 7); ctx.fill(); }
  ctx.fillStyle = "#fdcb6e"; ctx.beginPath(); ctx.arc(lx, ly, 30, 0, 7); ctx.fill();
  ctx.fillStyle = "#2d3436"; ctx.beginPath(); ctx.arc(lx - 10, ly - 6, 4, 0, 7); ctx.arc(lx + 10, ly - 6, 4, 0, 7); ctx.fill();
  ctx.fillStyle = "#e17055"; ctx.beginPath(); ctx.ellipse(lx, ly + 6, 7, 5, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = "#2d3436"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(lx, ly + 10); ctx.lineTo(lx, ly + 16); ctx.moveTo(lx - 10, ly + 18); ctx.quadraticCurveTo(lx, ly + 24, lx + 10, ly + 18); ctx.stroke();
  // Thuyền nhỏ về bờ, buộc ở mạn dưới
  const dg = D.dinghy;
  ctx.strokeStyle = "#d7ccc8"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(dg.x - 20, d.y2 + 22); ctx.lineTo(dg.x - 10, dg.y - 14); ctx.stroke();
  items.push({ y: dg.y, draw: () => drawSmallBoat(dg, t) });
  // Đồ vật trên boong
  items.push({ y: D.cabin.y2, draw: () => drawCabin(D.cabin) });
  for (const tr of D.trees) items.push({ y: tr.y, draw: () => drawTangerine(tr, t) });
  for (const b of D.benches) items.push({ y: b.y - 30, draw: () => drawBench(b) });
  items.push({ y: D.swing.y - 30, draw: () => drawSwing(D.swing, t) });
  items.push({ y: D.mast.y, draw: () => drawMast(D.mast, t) });
  addCrewItems(items, t); // Luffy, Zoro, Nami
}
function drawSmallBoat(b, t) {
  const bob = Math.sin(t / 600) * 2;
  ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.beginPath(); ctx.ellipse(b.x, b.y + 6, 56, 9, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#a0652d"; ctx.beginPath(); ctx.moveTo(b.x - 54, b.y - 16 + bob); ctx.lineTo(b.x + 54, b.y - 16 + bob); ctx.lineTo(b.x + 40, b.y + 4 + bob); ctx.lineTo(b.x - 40, b.y + 4 + bob); ctx.fill();
  ctx.fillStyle = "#6d4c41"; ctx.fillRect(b.x - 50, b.y - 20 + bob, 100, 5);
  ctx.strokeStyle = "#5d4037"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(b.x - 10, b.y - 8 + bob); ctx.lineTo(b.x + 40, b.y - 30 + bob); ctx.stroke(); // mái chèo
  ctx.font = "bold 13px system-ui"; ctx.textAlign = "center"; ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,.6)";
  ctx.strokeText("⛵ Về bãi biển", b.x, b.y + 30); ctx.fillStyle = "#ffeaa7"; ctx.fillText("⛵ Về bãi biển", b.x, b.y + 30);
}
function drawCabin(c) {
  const w = c.x2 - c.x1, h = c.y2 - c.y1;
  ctx.fillStyle = "#8d5524"; roundRect(c.x1 - 10, c.y1 - 70, w + 10, h + 70, 10); ctx.fill();
  ctx.fillStyle = "#a0652d"; ctx.fillRect(c.x1 - 10, c.y1 - 70, w + 10, 16);
  ctx.fillStyle = "#c0392b"; ctx.fillRect(c.x1 - 16, c.y1 - 82, w + 22, 14); // mái
  for (const wy of [c.y1 - 20, c.y1 + 50]) { ctx.fillStyle = "#5d4037"; ctx.beginPath(); ctx.arc(c.x1 + w / 2 - 4, wy, 20, 0, 7); ctx.fill(); ctx.fillStyle = "#81ecec"; ctx.beginPath(); ctx.arc(c.x1 + w / 2 - 4, wy, 14, 0, 7); ctx.fill(); }
  ctx.fillStyle = "#5d4037"; roundRect(c.x2 - 40, c.y2 - 70, 34, 70, [16, 16, 0, 0]); ctx.fill();
  ctx.fillStyle = "#f9ca24"; ctx.beginPath(); ctx.arc(c.x2 - 14, c.y2 - 34, 3, 0, 7); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = "bold 12px system-ui"; ctx.textAlign = "center"; ctx.fillText("🍖 BẾP", c.x1 + w / 2 - 4, c.y2 - 80);
}
function drawTangerine(tr, t) {
  const { x, y } = tr, sway = Math.sin(t / 1300 + x) * 1.5;
  ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.beginPath(); ctx.ellipse(x, y, 30, 9, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#8d6e63"; ctx.fillRect(x - 5, y - 34, 10, 34);
  ctx.fillStyle = "#6d4c41"; roundRect(x - 18, y - 12, 36, 14, 4); ctx.fill(); // bồn gỗ
  for (const [dx, dy, r] of [[-14, -48, 18], [14, -48, 18], [0, -64, 20]]) { ctx.fillStyle = "#388e3c"; ctx.beginPath(); ctx.arc(x + dx + sway, y + dy, r, 0, 7); ctx.fill(); }
  for (const [dx, dy] of [[-16, -50], [8, -44], [16, -58], [-4, -70], [-10, -60]]) { ctx.fillStyle = "#f39c12"; ctx.beginPath(); ctx.arc(x + dx + sway, y + dy, 4.5, 0, 7); ctx.fill(); }
}
function drawSwing(s, t) {
  const sway = Math.sin(t / 700) * 4;
  ctx.fillStyle = "#6d4c41"; ctx.fillRect(s.x - 40, s.y - 120, 8, 120); ctx.fillRect(s.x + 32, s.y - 120, 8, 120); ctx.fillRect(s.x - 44, s.y - 124, 88, 10);
  ctx.strokeStyle = "#d7ccc8"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.x - 22, s.y - 114); ctx.lineTo(s.x - 22 + sway, s.y - 26); ctx.moveTo(s.x + 22, s.y - 114); ctx.lineTo(s.x + 22 + sway, s.y - 26); ctx.stroke();
  ctx.fillStyle = "#a0652d"; roundRect(s.x - 28 + sway, s.y - 28, 56, 8, 3); ctx.fill();
}
function drawMast(m, t) {
  // Cột buồm + vòng ghế quanh chân cột
  ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(m.x, m.y, 40, 12, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#5d4037"; ctx.fillRect(m.x - 9, m.y - 400, 18, 400);
  ctx.fillStyle = "#4e342e"; ctx.fillRect(m.x - 120, m.y - 330, 240, 8); ctx.fillRect(m.x - 90, m.y - 170, 180, 7);
  // Đài quan sát
  ctx.fillStyle = "#6d4c41"; roundRect(m.x - 26, m.y - 412, 52, 20, 4); ctx.fill();
  // Buồm lớn: đầu lâu đội mũ rơm
  const bill = Math.sin(t / 900) * 6;
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "#fffaf0"; ctx.beginPath(); ctx.moveTo(m.x - 116, m.y - 322); ctx.lineTo(m.x + 116, m.y - 322); ctx.quadraticCurveTo(m.x + 128 + bill, m.y - 246, m.x + 90, m.y - 176); ctx.lineTo(m.x - 90, m.y - 176); ctx.quadraticCurveTo(m.x - 128 + bill, m.y - 246, m.x - 116, m.y - 322); ctx.fill();
  ctx.globalAlpha = 1;
  const sx = m.x + bill * 0.4, sy = m.y - 246;
  ctx.strokeStyle = "#2d3436"; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(sx - 40, sy - 26); ctx.lineTo(sx + 40, sy + 26); ctx.moveTo(sx + 40, sy - 26); ctx.lineTo(sx - 40, sy + 26); ctx.stroke(); // xương chéo
  ctx.fillStyle = "#2d3436"; ctx.beginPath(); ctx.arc(sx, sy - 4, 24, 0, 7); ctx.fill();
  ctx.fillStyle = "#fffaf0"; ctx.beginPath(); ctx.arc(sx - 8, sy - 2, 5, 0, 7); ctx.arc(sx + 8, sy - 2, 5, 0, 7); ctx.fill();
  ctx.fillStyle = "#f6d365"; ctx.beginPath(); ctx.ellipse(sx, sy - 22, 34, 8, 0, 0, 7); ctx.fill(); // vành mũ rơm
  ctx.beginPath(); ctx.ellipse(sx, sy - 30, 19, 12, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = "#d63031"; ctx.fillRect(sx - 19, sy - 28, 38, 5); // dải đỏ
  // Cờ trên đỉnh cột
  const fl = Math.sin(t / 250) * 4;
  ctx.fillStyle = "#2d3436"; ctx.beginPath(); ctx.moveTo(m.x + 9, m.y - 400); ctx.lineTo(m.x + 70, m.y - 392 + fl); ctx.lineTo(m.x + 9, m.y - 372); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(m.x + 32, m.y - 388 + fl / 2, 5, 0, 7); ctx.fill();
}

// ===== Băng hải tặc trên tàu: Luffy và Nami nói chuyện với nhau, Zoro ngủ (chỉ thức dậy khi người chơi chat với Zoro) =====
// Kịch bản chạy theo đồng hồ thật nên mọi người trên tàu thấy cùng một đoạn hội thoại.
const CREW_LINES = [
  [["luffy", "Nami ơi! Đói bụng quá, có thịt không?! 🍖"], ["nami", "Mới ăn sáng xong mà Luffy!!"], ["luffy", "Shishishi~ nhưng mà đói nữa rồi!"]],
  [["nami", "Zoro lại ngủ nữa rồi... 😑"], ["luffy", "Kệ cậu ấy, ngủ xong mới đánh hay!"], ["nami", "Hai người đừng có phá tàu là được! 💢"]],
  [["nami", "Phía trước có bão đó, mọi người cẩn thận! 🌀"], ["luffy", "Bão hả? Hay quá! Tiến lên!!"], ["nami", "Hay cái gì mà hay!! 👊"]],
  [["luffy", "Tui sẽ trở thành Vua Hải Tặc!! 👒"], ["nami", "Còn tôi sẽ vẽ bản đồ cả thế giới! 🗺️"], ["luffy", "Shishishi~ Tuyệt quá!"]],
  [["nami", "Ai lén ăn quýt của tôi đó?! 🍊"], ["luffy", "Không phải tui... *nhai nhai*"], ["nami", "LUFFY!!! 💢"]],
  [["luffy", "Ê mấy bạn mới lên tàu! Làm đồng đội của tui đi! 🏴‍☠️"], ["nami", "Đừng có rủ đại người ta như vậy chứ!"], ["luffy", "Muốn nói chuyện thì gọi Zoro đó, cậu ấy đang ngủ ở cột buồm!"]],
];
const LINE_MS = 3800, SCENE_GAP = 6000;
const zoroSay = { text: "", until: 0 }; // câu Zoro (AI) trả lời người chơi, client.js cập nhật khi có tin nhắn
// Dàn kịch bản thành dòng thời gian: [bắt đầu, kết thúc, ai nói, câu nói, cảnh số mấy]
const CREW_TIMELINE = (() => {
  const tl = []; let t = 0;
  CREW_LINES.forEach((scene, si) => {
    for (const [who, text] of scene) { tl.push({ start: t, end: t + LINE_MS, who, text, scene: si }); t += LINE_MS + 400; }
    t += SCENE_GAP;
  });
  return { list: tl, total: t };
})();
function crewNow(now) {
  const k = now % CREW_TIMELINE.total;
  const line = CREW_TIMELINE.list.find((l) => k >= l.start && k < l.end) || null;
  // Người đang trong cảnh (đang nói chuyện) thì thức, còn không thì Zoro ngủ
  const sceneIdx = (CREW_TIMELINE.list.find((l) => k < l.end + SCENE_GAP / 2 && k >= l.start - 400) || {}).scene;
  const inScene = sceneIdx === undefined ? [] : CREW_LINES[sceneIdx].map((l) => l[0]);
  return { line, inScene };
}
const CREW = {
  luffy: { name: "Luffy", color: "#ff7675", look: { hair: 0, hairColor: 0, skin: 0, shirtHex: "#d63031", bottom: 0, botHex: "#3867d6" } },
  zoro: { name: "Zoro", color: "#55efc4", look: { hair: 0, hairHex: "#27ae60", skin: 1, shirtHex: "#f5f6fa", bottom: 0, botHex: "#2d3436" } },
  nami: { name: "Nami", color: "#fdcb6e", look: { hair: 3, hairHex: "#e67e22", skin: 0, shirtHex: "#74b9ff", bottom: 1, botHex: "#f5f6fa" } },
};
// Vị trí từng người theo thời gian: Luffy đi qua lại ở mũi tàu, Nami đi quanh vườn quýt, Zoro ngồi tựa cột buồm
function crewPos(id, now) {
  if (id === "zoro") return { x: 700, y: 520, moving: false, sit: true };
  const ph = now / (id === "luffy" ? 2600 : 3400);
  const s = Math.sin(ph), moving = Math.abs(Math.cos(ph)) > 0.25;
  if (id === "luffy") return { x: 960, y: 440 + s * 90, moving, vx: 0, vy: Math.cos(ph) };
  return { x: 370 + s * 50, y: 460 + Math.sin(ph * 0.7) * 90, moving, vx: Math.cos(ph), vy: 0.7 * Math.cos(ph * 0.7) };
}
function drawCrewMember(id, t, st, positions) {
  const c = CREW[id], p = positions[id], feet = p.y + RADIUS;
  const talking = st.line && st.line.who === id;
  const speaker = st.line && positions[st.line.who];
  // Hướng nhìn: quay về phía người đang nói; lúc đi thì nhìn theo hướng đi
  let dir = "down";
  if (speaker && !talking && st.inScene.includes(id)) dir = Math.abs(speaker.x - p.x) > Math.abs(speaker.y - p.y) ? (speaker.x < p.x ? "left" : "right") : speaker.y < p.y ? "up" : "down";
  else if (p.moving) dir = Math.abs(p.vx) > Math.abs(p.vy) ? (p.vx < 0 ? "left" : "right") : p.vy < 0 ? "up" : "down";
  const walking = p.moving && !(st.inScene.includes(id) && st.line);
  const step = walking ? [1, 0, 2, 0][Math.floor(t / 150) % 4] : 0;
  ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.beginPath(); ctx.ellipse(p.x, feet, 22, 7, 0, 0, 7); ctx.fill();
  drawAvatar(ctx, c.look, p.x, feet - (step ? 2 : 0), 3, dir, step, p.sit ? "sit" : talking && id === "luffy" ? "wave" : null);
  const top = feet - 84 + (p.sit ? 12 : 0) - (step ? 2 : 0);
  if (id === "luffy" && dir !== "up") {
    // Mũ rơm + vết sẹo dưới mắt
    ctx.fillStyle = "#f6d365"; ctx.beginPath(); ctx.ellipse(p.x, top + 10, 32, 8, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(p.x, top + 4, 18, 12, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = "#d63031"; ctx.fillRect(p.x - 18, top + 2, 36, 4);
    if (dir === "down") { ctx.fillStyle = "#c0392b"; ctx.fillRect(p.x - 11, top + 36, 5, 2); }
  } else if (id === "luffy") {
    ctx.fillStyle = "#f6d365"; ctx.beginPath(); ctx.ellipse(p.x, top + 10, 32, 8, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(p.x, top + 4, 18, 12, 0, Math.PI, 0); ctx.fill();
  }
  if (id === "zoro") {
    // Đai bụng xanh + 3 thanh kiếm bên hông
    const by = feet - 26 + (p.sit ? 12 : 0);
    ctx.fillStyle = "#27ae60"; ctx.fillRect(p.x - 15, by, 30, 6);
    for (const [dx, col] of [[16, "#2d3436"], [20, "#f5f6fa"], [24, "#d63031"]]) { ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.x + dx - 4, by - 10); ctx.lineTo(p.x + dx + 8, by + 22); ctx.stroke(); }
    // Không có trong cảnh hội thoại thì ngủ khò
    if (!st.inScene.includes("zoro")) {
      const k = (t / 1500) % 1;
      ctx.globalAlpha = 1 - k; ctx.font = `bold ${14 + k * 8}px system-ui`; ctx.textAlign = "center"; ctx.fillStyle = "#dfe6e9";
      ctx.fillText("💤", p.x + 22 + k * 10, top + 10 - k * 24); ctx.globalAlpha = 1;
    }
  }
}
// Tên + bong bóng thoại (vẽ trên cùng)
function drawCrewLabel(id, st, positions) {
  const c = CREW[id], p = positions[id], top = p.y + RADIUS - 84 + (p.sit ? 12 : 0);
  ctx.font = "bold 14px system-ui"; ctx.textAlign = "center"; ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,.7)";
  ctx.strokeText(c.name, p.x, top - 24); ctx.fillStyle = c.color; ctx.fillText(c.name, p.x, top - 24);
  if (!st.line || st.line.who !== id) return;
  ctx.font = "bold 15px system-ui";
  const words = st.line.text.split(" "), lines = []; let cur = "";
  for (const w of words) { const test = cur ? cur + " " + w : w; if (ctx.measureText(test).width > 230 && cur) { lines.push(cur); cur = w; } else cur = test; }
  lines.push(cur);
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 22, h = lines.length * 20 + 12, by = top - 40 - h;
  ctx.fillStyle = "#fff"; roundRect(p.x - w / 2, by, w, h, 12); ctx.fill();
  ctx.strokeStyle = c.color; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(p.x - 7, by + h - 1); ctx.lineTo(p.x + 7, by + h - 1); ctx.lineTo(p.x, by + h + 9); ctx.fill();
  ctx.fillStyle = "#2d3436"; ctx.textBaseline = "middle";
  lines.forEach((l, i) => ctx.fillText(l, p.x, by + 16 + i * 20));
  ctx.textBaseline = "alphabetic";
}
function addCrewItems(items, t) {
  const now = Date.now();
  let st = crewNow(now);
  // Zoro đang trả lời người chơi thì thức dậy và hiện câu trả lời thay cho kịch bản
  if (now < zoroSay.until) st = { line: { who: "zoro", text: zoroSay.text }, inScene: [...st.inScene, "zoro"] };
  const positions = Object.fromEntries(Object.keys(CREW).map((id) => [id, crewPos(id, now)]));
  for (const id of Object.keys(CREW)) {
    items.push({ y: positions[id].y + RADIUS, draw: () => drawCrewMember(id, t, st, positions) });
    items.push({ y: 1e6, draw: () => drawCrewLabel(id, st, positions) });
  }
}
