// Vẽ bãi biển: biển có sóng vỗ, cầu tàu gỗ, ghế dù, hàng dừa, lâu đài cát, lửa trại,
// cua bò dọc bờ, hải âu bay, thuyền buồm trôi xa xa. Dùng chung `ctx`, `roundRect` của client.js.

// Cua bò qua lại dọc bờ (vị trí tính theo thời gian nên mọi máy thấy giống nhau)
const CRABS = [{ x1: 150, x2: 560, y: 335, speed: 22, offset: 0 }, { x1: 900, x2: 1150, y: 350, speed: 18, offset: 7000 }];

function drawBeach(W, t, items) {
  const D = W.decor, now = Date.now(), shore = D.shoreY;
  // Bãi cát + vài vệt cát sẫm
  const sand = ctx.createLinearGradient(0, shore, 0, MAP.h);
  sand.addColorStop(0, "#f6d7a7"); sand.addColorStop(1, "#ecc58a");
  ctx.fillStyle = sand; ctx.fillRect(0, shore - 30, MAP.w, MAP.h - shore + 30);
  ctx.fillStyle = "rgba(160,110,60,.12)";
  for (let i = 0; i < 40; i++) { const x = (i * 197) % MAP.w, y = shore + 60 + ((i * 131) % (MAP.h - shore - 70)); ctx.beginPath(); ctx.ellipse(x, y, 14, 4, 0, 0, 7); ctx.fill(); }
  // Biển: xanh đậm dần ra xa
  const sea = ctx.createLinearGradient(0, 0, 0, shore);
  sea.addColorStop(0, "#0a6aa1"); sea.addColorStop(0.7, "#1e9bd7"); sea.addColorStop(1, "#5ed3f0");
  ctx.fillStyle = sea; ctx.fillRect(0, 0, MAP.w, shore);
  // Sóng lăn tăn trên mặt biển
  ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 2;
  for (let row = 0; row < 7; row++) {
    const y = 30 + row * 38, off = (t / 40 + row * 60) % 120;
    for (let x = -120 + off; x < MAP.w; x += 120) { ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 15, y - 6, x + 30, y); ctx.stroke(); }
  }
  // Thuyền buồm trôi ngang phía xa
  const bx = ((now / 60) % (MAP.w + 200)) - 100;
  ctx.fillStyle = "#6d4c41"; ctx.beginPath(); ctx.moveTo(bx - 28, 64); ctx.lineTo(bx + 28, 64); ctx.lineTo(bx + 18, 76); ctx.lineTo(bx - 18, 76); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(bx - 2, 22); ctx.lineTo(bx - 2, 62); ctx.lineTo(bx - 26, 62); ctx.fill();
  ctx.fillStyle = "#ff7675"; ctx.beginPath(); ctx.moveTo(bx + 2, 28); ctx.lineTo(bx + 2, 62); ctx.lineTo(bx + 22, 62); ctx.fill();
  // Sóng vỗ bờ: viền bọt trắng dâng lên rút xuống
  const surge = Math.sin(t / 1100) * 10;
  ctx.fillStyle = "rgba(94,211,240,.55)";
  ctx.beginPath(); ctx.moveTo(0, shore - 10);
  for (let x = 0; x <= MAP.w; x += 20) ctx.lineTo(x, shore + 6 + surge + Math.sin(x / 60 + t / 500) * 6);
  ctx.lineTo(MAP.w, shore - 10); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 4; ctx.beginPath();
  for (let x = 0; x <= MAP.w; x += 20) { const y = shore + 6 + surge + Math.sin(x / 60 + t / 500) * 6; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.stroke();
  // Hải âu bay
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5;
  for (let i = 0; i < 3; i++) {
    const gx = ((now / (25 + i * 6) + i * 400) % (MAP.w + 100)) - 50, gy = 110 + i * 40 + Math.sin(now / 700 + i) * 10, flap = Math.sin(now / 150 + i) * 5;
    ctx.beginPath(); ctx.moveTo(gx - 12, gy - flap); ctx.quadraticCurveTo(gx - 6, gy - 8, gx, gy); ctx.quadraticCurveTo(gx + 6, gy - 8, gx + 12, gy - flap); ctx.stroke();
  }
  // Cầu tàu gỗ (đi ra được)
  const P = D.pier;
  ctx.fillStyle = "#5d4037";
  for (let y = P.y1 + 20; y < shore + 20; y += 60) { ctx.fillRect(P.x1 - 4, y, 8, 26); ctx.fillRect(P.x2 - 4, y, 8, 26); }
  for (let y = P.y1; y < shore + 30; y += 14) { ctx.fillStyle = (y / 14) % 2 ? "#a1887f" : "#8d6e63"; ctx.fillRect(P.x1, y, P.x2 - P.x1, 12); }
  ctx.fillStyle = "#6d4c41"; ctx.fillRect(P.x1 - 3, P.y1, 4, shore + 30 - P.y1); ctx.fillRect(P.x2 - 1, P.y1, 4, shore + 30 - P.y1);
  // Đồ vật sắp theo chiều sâu
  for (const p of D.palms) items.push({ y: p.y, draw: () => drawPalm(p, t) });
  for (const u of D.umbrellas) {
    items.push({ y: u.y - 30, draw: () => drawLoungers(u) });
    items.push({ y: u.y + 8, draw: () => drawUmbrella(u) }); // dù vẽ sau người ngồi
  }
  items.push({ y: D.campfire.y, draw: () => drawCampfire(D.campfire, t) });
  items.push({ y: D.sandcastle.y, draw: () => drawSandcastle(D.sandcastle) });
  if (D.honor) items.push({ y: D.honor.y, draw: () => drawHonorBoard(D.honor) });
  if (quizState) {
    const q = quizState;
    q.rx = q.rx === undefined ? q.x : q.rx + (q.x - q.rx) * 0.2; q.ry = q.ry === undefined ? q.y : q.ry + (q.y - q.ry) * 0.2;
    items.push({ y: q.ry + RADIUS, draw: () => drawQuizNpc(q, t) });
    items.push({ y: 1e6, draw: () => drawQuizBubble(q) }); // bong bóng câu đố luôn nằm trên cùng
  }
  if (D.boat) items.push({ y: D.boat.y + 20, draw: () => drawDockBoat(D.boat, t) }); // thuyền neo cạnh cầu tàu
  for (const c of CRABS) {
    const span = c.x2 - c.x1, k = ((now + c.offset) / 1000 * c.speed) % (span * 2), x = k < span ? c.x1 + k : c.x2 - (k - span);
    items.push({ y: c.y, draw: () => drawCrab(x, c.y, t) });
  }
}
function drawPalm(p, t) {
  const { x, y } = p, sway = Math.sin(t / 1300 + x) * 3;
  ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.beginPath(); ctx.ellipse(x + 20, y, 44, 10, 0, 0, 7); ctx.fill();
  // Thân dừa cong, có khía
  for (let i = 0; i < 9; i++) {
    const k = i / 9;
    ctx.fillStyle = i % 2 ? "#8d6e63" : "#a1887f";
    ctx.beginPath(); ctx.ellipse(x + Math.sin(k * 1.6) * 18 + sway * k, y - 10 - i * 14, 10 - k * 2, 8, 0, 0, 7); ctx.fill();
  }
  const tx = x + 18 + sway, ty = y - 136;
  // Lá dừa
  ctx.fillStyle = "#2e7d32";
  for (const a of [-2.7, -2.1, -1.4, -0.7, -0.2, 0.4]) {
    ctx.save(); ctx.translate(tx, ty); ctx.rotate(a + Math.sin(t / 900 + a) * 0.05);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(30, -18, 64, 6); ctx.quadraticCurveTo(30, -4, 0, 4); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = "#5d4037"; for (const [dx, dy] of [[-5, 4], [5, 5], [0, 9]]) { ctx.beginPath(); ctx.arc(tx + dx, ty + dy, 5, 0, 7); ctx.fill(); }
}
// Hai ghế bố dưới một cây dù
function drawLoungers(u) {
  for (const dx of [-30, 30]) {
    const x = u.x + dx, y = u.y;
    ctx.fillStyle = "rgba(0,0,0,.15)"; ctx.beginPath(); ctx.ellipse(x, y + 2, 26, 6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#795548"; ctx.fillRect(x - 22, y - 18, 3, 18); ctx.fillRect(x + 19, y - 18, 3, 18);
    ctx.fillStyle = dx < 0 ? "#00b894" : "#fdcb6e"; roundRect(x - 24, y - 50, 48, 16, 4); ctx.fill(); // lưng ghế
    ctx.fillStyle = dx < 0 ? "#55efc4" : "#ffeaa7"; roundRect(x - 24, y - 26, 48, 10, 3); ctx.fill(); // mặt ghế
  }
}
function drawUmbrella(u) {
  const { x, y } = u;
  ctx.fillStyle = "#dfe6e9"; ctx.fillRect(x - 2, y - 120, 4, 70);
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? "#fff" : "#0984e3";
    ctx.beginPath(); ctx.moveTo(x, y - 124); ctx.arc(x, y - 124, 78, Math.PI + (i * Math.PI) / 8, Math.PI + ((i + 1) * Math.PI) / 8); ctx.fill();
  }
}
function drawCampfire(c, t) {
  const { x, y } = c;
  ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.beginPath(); ctx.ellipse(x, y, 40, 12, 0, 0, 7); ctx.fill();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ctx.fillStyle = "#95a5a6"; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 30, y + Math.sin(a) * 10, 8, 5, 0, 0, 7); ctx.fill(); }
  ctx.strokeStyle = "#6d4c41"; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(x - 20, y + 2); ctx.lineTo(x + 20, y - 8); ctx.moveTo(x - 20, y - 8); ctx.lineTo(x + 20, y + 2); ctx.stroke();
  // Ngọn lửa nhảy múa + ánh sáng
  const glow = ctx.createRadialGradient(x, y - 20, 4, x, y - 20, 90);
  glow.addColorStop(0, "rgba(255,180,60,.35)"); glow.addColorStop(1, "rgba(255,180,60,0)");
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y - 20, 90, 0, 7); ctx.fill();
  for (const [dx, h, c2] of [[-8, 30, "#e17055"], [8, 34, "#e17055"], [0, 44, "#fdcb6e"], [0, 26, "#ffeaa7"]]) {
    const f = Math.sin(t / 90 + dx) * 4;
    ctx.fillStyle = c2; ctx.beginPath(); ctx.moveTo(x + dx - 9, y - 4); ctx.quadraticCurveTo(x + dx - 6, y - h * 0.6, x + dx + f, y - h); ctx.quadraticCurveTo(x + dx + 6, y - h * 0.6, x + dx + 9, y - 4); ctx.fill();
  }
  for (let i = 0; i < 4; i++) { const k = (t / 900 + i / 4) % 1; ctx.fillStyle = `rgba(255,200,80,${1 - k})`; ctx.beginPath(); ctx.arc(x + Math.sin(k * 9 + i) * 10, y - 40 - k * 50, 2, 0, 7); ctx.fill(); }
}
function drawSandcastle(c) {
  const { x, y } = c;
  ctx.fillStyle = "rgba(0,0,0,.15)"; ctx.beginPath(); ctx.ellipse(x, y, 40, 10, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#e1b77e"; ctx.fillRect(x - 32, y - 26, 64, 26);
  ctx.fillStyle = "#d4a56a"; ctx.fillRect(x - 36, y - 46, 18, 46); ctx.fillRect(x + 18, y - 46, 18, 46); ctx.fillRect(x - 10, y - 58, 20, 34);
  ctx.fillStyle = "#e1b77e"; for (const cx of [x - 27, x + 27, x]) for (const k of [-1, 1]) ctx.fillRect(cx + k * 5 - 3, cx === x ? y - 64 : y - 52, 6, 6);
  ctx.fillStyle = "#8d6e63"; roundRect(x - 6, y - 16, 12, 16, [6, 6, 0, 0]); ctx.fill();
  ctx.fillStyle = "#d63031"; ctx.fillRect(x, y - 82, 2, 20); ctx.beginPath(); ctx.moveTo(x + 2, y - 82); ctx.lineTo(x + 14, y - 77); ctx.lineTo(x + 2, y - 72); ctx.fill();
}
function drawCrab(x, y, t) {
  const step = Math.floor(t / 150) % 2;
  ctx.fillStyle = "rgba(0,0,0,.15)"; ctx.beginPath(); ctx.ellipse(x, y, 14, 4, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#d63031"; ctx.beginPath(); ctx.ellipse(x, y - 8, 10, 6, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#e17055"; ctx.beginPath(); ctx.arc(x - 13, y - 13, 4, 0, 7); ctx.arc(x + 13, y - 13, 4, 0, 7); ctx.fill(); // càng
  ctx.strokeStyle = "#d63031"; ctx.lineWidth = 2;
  for (const k of [-1, 1]) for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x + k * 7, y - 6 + i * 2); ctx.lineTo(x + k * (13 + (i + step) % 2 * 2), y - 2 + i * 2); ctx.stroke(); }
  ctx.fillStyle = "#2d3436"; ctx.fillRect(x - 4, y - 16, 2, 4); ctx.fillRect(x + 2, y - 16, 2, 4);
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x - 3, y - 17, 2, 0, 7); ctx.arc(x + 3, y - 17, 2, 0, 7); ctx.fill();
}

// ===== Bác Tư Đố Vui: đi dạo trên cát, đứng lại ra phép tính =====
let quizState = null;
socket.on("state", (data) => { if (data.quiz) { const old = quizState; quizState = { ...data.quiz, recvAt: Date.now(), rx: old && old.rx, ry: old && old.ry }; } else quizState = null; });
const QUIZ_LOOK = { hair: 0, hairColor: 6, skin: 1, shirt: 2, bottom: 0, bottomColor: 2 };
function drawQuizNpc(q, t) {
  const x = q.rx, feet = q.ry + RADIUS;
  const step = q.moving ? [1, 0, 2, 0][Math.floor(t / 140) % 4] : 0;
  ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.beginPath(); ctx.ellipse(x, feet, 22, 7, 0, 0, 7); ctx.fill();
  drawAvatar(ctx, QUIZ_LOOK, x, feet - (step ? 2 : 0), 3, q.dir || "down", step, q.moving ? null : "wave");
  const top = feet - 84 - (step ? 2 : 0);
  if (q.dir !== "up") { // khăn rằn caro quàng cổ
    for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? "#fff" : "#2d3436"; ctx.fillRect(x - 15 + i * 5, top + 40, 5, 5); ctx.fillStyle = i % 2 ? "#2d3436" : "#fff"; ctx.fillRect(x - 15 + i * 5, top + 45, 5, 4); }
  }
  // Nón lá
  ctx.fillStyle = "#e9d9a6"; ctx.beginPath(); ctx.moveTo(x, top - 16); ctx.lineTo(x - 40, top + 22); ctx.lineTo(x + 40, top + 22); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#a68a52"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 40, top + 22); ctx.lineTo(x + 40, top + 22); ctx.stroke();
}
// Bong bóng câu đố: tự xuống dòng, có đồng hồ đếm ngược khi đang đố
function drawQuizBubble(q) {
  const x = q.rx, top = q.ry + RADIUS - 84;
  // Tên bác vẽ ở lớp trên cùng để không bị dù / cây che
  ctx.font = "bold 14px system-ui"; ctx.textAlign = "center"; ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,.7)";
  ctx.strokeText("Bác Tư Đố Vui", x, top - 24); ctx.fillStyle = "#81ecec"; ctx.fillText("Bác Tư Đố Vui", x, top - 24);
  if (!q.say) return;
  ctx.font = "bold 16px system-ui"; ctx.textAlign = "center";
  const words = q.say.split(" "), lines = [];
  let cur = "";
  for (const w of words) { const test = cur ? cur + " " + w : w; if (ctx.measureText(test).width > 260 && cur) { lines.push(cur); cur = w; } else cur = test; }
  lines.push(cur);
  const left = Math.ceil(Math.max(0, q.remain - (Date.now() - q.recvAt)) / 1000);
  if (q.sub) lines.unshift(q.sub); // lời bác nói thêm: dẫn câu hỏi, nhắc giờ, trêu người trả lời sai
  if (q.remain > 0) lines.push(`⏳ còn ${left}s · gõ đáp án vào chat`);
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 24, h = lines.length * 21 + 14, by = top - 40 - h;
  ctx.fillStyle = q.remain > 0 ? "#fff8e1" : "#fff"; roundRect(x - w / 2, by, w, h, 12); ctx.fill();
  ctx.strokeStyle = q.remain > 0 ? "#f9ca24" : "#dfe6e9"; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = q.remain > 0 ? "#fff8e1" : "#fff"; ctx.beginPath(); ctx.moveTo(x - 7, by + h - 1); ctx.lineTo(x + 7, by + h - 1); ctx.lineTo(x, by + h + 9); ctx.fill();
  ctx.textBaseline = "middle";
  lines.forEach((l, i) => {
    const last = q.remain > 0 && i === lines.length - 1, sub = q.sub && i === 0;
    ctx.font = last ? "12px system-ui" : sub ? "italic bold 14px system-ui" : "bold 16px system-ui";
    ctx.fillStyle = last ? (left <= 5 ? "#d63031" : "#636e72") : sub ? "#e17055" : "#2d3436";
    ctx.fillText(l, x, by + 17 + i * 21);
  });
  ctx.textBaseline = "alphabetic";
}
// Tấm bảng vinh danh người trả lời đúng gần nhất
function drawHonorBoard(b) {
  const { x, y } = b, name = quizState && quizState.winner;
  ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.beginPath(); ctx.ellipse(x, y, 62, 10, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#5d4037"; ctx.fillRect(x - 46, y - 56, 7, 56); ctx.fillRect(x + 39, y - 56, 7, 56);
  ctx.fillStyle = "#8d6e63"; roundRect(x - 62, y - 120, 124, 70, 8); ctx.fill();
  ctx.fillStyle = "#2d5f4a"; roundRect(x - 56, y - 114, 112, 58, 6); ctx.fill();
  ctx.textAlign = "center"; ctx.fillStyle = "#f9ca24"; ctx.font = "bold 12px system-ui"; ctx.fillText("🧠 NHANH TRÍ NHẤT", x, y - 97);
  ctx.fillStyle = "#fff"; ctx.font = "bold 15px system-ui";
  const nm = name ? (name.length > 11 ? name.slice(0, 11) + "…" : name) : "Chưa có ai";
  ctx.fillText((name ? "👑 " : "") + nm, x, y - 72);
}
