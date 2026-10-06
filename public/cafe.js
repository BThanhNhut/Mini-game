// Vẽ quán Cafe Mèo, cổng dịch chuyển giữa các bản đồ và những chú mèo.
// Dùng chung canvas `ctx` và hàm `roundRect` của client.js.

// ===== Cổng dịch chuyển =====
function drawPortal(g, t) {
  const left = g.x1 <= 0;
  const cx = left ? 34 : MAP.w - 34, cy = (g.y1 + g.y2) / 2 - 30, h = g.y2 - g.y1 + 40;
  // Vòng sáng xoáy
  const pulse = 0.5 + Math.sin(t / 400) * 0.15;
  const glow = ctx.createRadialGradient(cx, cy, 6, cx, cy, h / 2);
  glow.addColorStop(0, `rgba(162,155,254,${0.9 * pulse + 0.1})`);
  glow.addColorStop(0.6, "rgba(0,206,201,.55)");
  glow.addColorStop(1, "rgba(0,206,201,0)");
  ctx.fillStyle = glow; ctx.beginPath(); ctx.ellipse(cx, cy, 30, h / 2, 0, 0, 7); ctx.fill();
  for (let i = 0; i < 14; i++) {
    const a = t / 500 + (i * Math.PI * 2) / 14, r = 0.5 + 0.5 * Math.sin(t / 700 + i);
    ctx.fillStyle = `rgba(255,255,255,${0.4 + r * 0.5})`;
    ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 22 * r, cy + Math.sin(a) * (h / 2 - 10) * r, 2.2, 0, 7); ctx.fill();
  }
  // Vòm đá
  ctx.strokeStyle = "#7f8c8d"; ctx.lineWidth = 12;
  ctx.beginPath(); ctx.ellipse(cx, cy, 36, h / 2 + 4, 0, Math.PI, 0); ctx.stroke();
  ctx.fillStyle = "#636e72"; ctx.fillRect(cx - 44, cy, 14, h / 2 + 6); ctx.fillRect(cx + 30, cy, 14, h / 2 + 6);
  ctx.fillStyle = "rgba(255,255,255,.15)"; ctx.fillRect(cx - 42, cy + 4, 4, h / 2); ctx.fillRect(cx + 32, cy + 4, 4, h / 2);
  // Biển chỉ đường
  const sx = left ? cx + 54 : cx - 54, sy = cy - h / 2 - 8;
  ctx.font = "bold 15px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const label = left ? `${g.label} ←` : `→ ${g.label}`;
  const w = ctx.measureText(label).width + 18;
  ctx.fillStyle = "#3e2723"; roundRect(sx - w / 2, sy - 13, w, 26, 8); ctx.fill();
  ctx.strokeStyle = "#f9ca24"; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = "#f9ca24"; ctx.fillText(label, sx, sy + 1);
  ctx.textBaseline = "alphabetic";
}

// ===== Quán Cafe Mèo =====
function drawCafe(W, t, items) {
  const D = W.decor;
  // Sàn gỗ
  for (let y = 200, row = 0; y < MAP.h; y += 34, row++) {
    ctx.fillStyle = row % 2 ? "#c79a6b" : "#cfa577"; ctx.fillRect(0, y, MAP.w, 34);
    ctx.fillStyle = "rgba(0,0,0,.12)"; ctx.fillRect(0, y + 32, MAP.w, 2);
    for (let x = (row % 2) * 90; x < MAP.w; x += 180) ctx.fillRect(x, y, 2, 34);
  }
  // Tường kem + ốp gỗ
  ctx.fillStyle = "#f6e4cb"; ctx.fillRect(8, 8, MAP.w - 16, 184);
  ctx.fillStyle = "#a0522d"; ctx.fillRect(8, 184, MAP.w - 16, 44);
  ctx.fillStyle = "#8b4513"; ctx.fillRect(8, 182, MAP.w - 16, 6);
  for (let x = 30; x < MAP.w; x += 60) { ctx.fillStyle = "rgba(0,0,0,.12)"; ctx.fillRect(x, 192, 3, 34); }
  // Hai cửa sổ có mèo ngồi bậu cửa
  for (const wx of [560, 760]) {
    const sky = ctx.createLinearGradient(0, 70, 0, 170);
    sky.addColorStop(0, "#74b9ff"); sky.addColorStop(1, "#dff9fb");
    ctx.fillStyle = "#fff"; roundRect(wx - 6, 64, 152, 118, 8); ctx.fill();
    ctx.fillStyle = sky; ctx.fillRect(wx, 70, 140, 100);
    ctx.fillStyle = "#fff"; ctx.fillRect(wx + 68, 70, 5, 100); ctx.fillRect(wx, 117, 140, 5);
    ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.beginPath(); ctx.arc(wx + 30 + Math.sin(t / 3000 + wx) * 8, 90, 10, 0, 7); ctx.arc(wx + 42 + Math.sin(t / 3000 + wx) * 8, 88, 13, 0, 7); ctx.fill();
    ctx.fillStyle = "#dfe6e9"; ctx.fillRect(wx - 10, 176, 160, 8);
  }
  drawCat({ color: "black" }, 650, 176, false, 0, t, 2, true);
  // Biển hiệu
  ctx.font = "bold 34px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.shadowColor = "#fd79a8"; ctx.shadowBlur = 12 + Math.sin(t / 300) * 4;
  ctx.fillStyle = "#e84393"; ctx.fillText("🐾 CAFE MÈO 🐾", 700, 36);
  ctx.shadowBlur = 0;
  // Bảng menu
  ctx.fillStyle = "#6d4c41"; roundRect(946, 36, 186, 138, 8); ctx.fill();
  ctx.fillStyle = "#2d5f4a"; ctx.fillRect(954, 44, 170, 122);
  ctx.fillStyle = "#fff"; ctx.font = "bold 15px system-ui"; ctx.fillText("MENU ☕", 1039, 60);
  ctx.font = "12px system-ui"; ctx.textAlign = "left";
  ["Cà phê sữa ........ 25k", "Bạc xỉu ............ 30k", "Trà sữa mèo ...... 35k", "Bánh cá ............ 20k", "Vuốt mèo .......... free"].forEach((l, i) => ctx.fillText(l, 962, 82 + i * 18));
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  // Khung ảnh mèo trên tường
  for (const [fx, fy, c] of [[210, 70, "orange"], [300, 60, "gray"], [395, 76, "white"]]) {
    ctx.fillStyle = "#8d6e63"; ctx.fillRect(fx - 32, fy - 4, 64, 56); ctx.fillStyle = "#ffeaa7"; ctx.fillRect(fx - 26, fy + 2, 52, 44);
    drawCat({ color: c }, fx, fy + 40, false, 0, t, 2, true);
  }
  // Thảm tròn giữa quán có hình dấu chân mèo
  ctx.fillStyle = "#fab1a0"; ctx.beginPath(); ctx.ellipse(595, 578, 330, 172, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#ffeaa7"; ctx.beginPath(); ctx.ellipse(595, 578, 300, 150, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "rgba(225,112,85,.35)";
  for (const [px, py] of [[480, 560], [530, 610], [600, 545], [660, 600], [710, 560], [590, 680], [520, 500], [690, 500]]) paw(px, py);
  // Đồ vật sắp theo chiều sâu
  items.push({ y: 305, draw: () => drawCounter(t) });
  items.push({ y: D.catTree.y, draw: () => drawCatTree(D.catTree) });
  for (const tb of D.tables) items.push({ y: tb.y, draw: () => drawCafeTable(tb, t) });
  W.seats.forEach((st) => { if (st.group !== "sofa") items.push({ y: st.y + RADIUS - 30, draw: () => drawChair(st) }); });
  items.push({ y: D.sofa.y - 30, draw: () => drawSofa(D.sofa) });
  for (const pl of D.plants) items.push({ y: pl.y, draw: () => drawPlant(pl, t) });
  items.push({ y: D.adopter.y, draw: () => drawAdopter(D.adopter, t) });
  items.push({ y: 1e6, draw: () => drawAdopterLabel(D.adopter) }); // tên + biển luôn nằm trên cùng
  D.cats.forEach((c, i) => {
    const q = catPos(c, Date.now());
    items.push({ y: q.y + (c.perch ? 1 : 0), draw: () => drawCat(c, q.x, q.y - (c.perch || 0), q.moving, q.face, t, 3, false, i) });
  });
}
function paw(x, y) {
  ctx.beginPath(); ctx.ellipse(x, y, 9, 7, 0, 0, 7); ctx.fill();
  for (const [dx, dy] of [[-9, -10], [-3, -14], [3, -14], [9, -10]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, 3.4, 0, 7); ctx.fill(); }
}
function drawCounter(t) {
  // Kệ trên tường phía sau quầy
  ctx.fillStyle = "#8d6e63"; ctx.fillRect(70, 96, 400, 8); ctx.fillRect(70, 150, 400, 8);
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = ["#e17055", "#00b894", "#fdcb6e", "#74b9ff", "#a29bfe"][i % 5];
    ctx.fillRect(84 + i * 44, 72, 18, 24); ctx.fillStyle = "#fff"; ctx.fillRect(84 + i * 44, 128, 22, 22);
  }
  // Thân quầy
  ctx.fillStyle = "#6d4c41"; ctx.fillRect(60, 238, 420, 67);
  ctx.fillStyle = "#5d4037"; for (let x = 70; x < 480; x += 52) ctx.fillRect(x, 248, 40, 48);
  ctx.fillStyle = "#d7ccc8"; ctx.fillRect(54, 226, 432, 14);
  ctx.fillStyle = "#efebe9"; ctx.fillRect(54, 226, 432, 4);
  // Máy pha cà phê có hơi nước
  ctx.fillStyle = "#b2bec3"; roundRect(96, 176, 64, 52, 6); ctx.fill();
  ctx.fillStyle = "#636e72"; ctx.fillRect(104, 186, 48, 14); ctx.fillStyle = "#2d3436"; ctx.fillRect(120, 204, 16, 10);
  for (let i = 0; i < 3; i++) {
    const k = (t / 1400 + i / 3) % 1;
    ctx.fillStyle = `rgba(255,255,255,${0.6 * (1 - k)})`;
    ctx.beginPath(); ctx.arc(128 + Math.sin(k * 8 + i) * 6, 172 - k * 40, 5 + k * 6, 0, 7); ctx.fill();
  }
  // Tủ bánh + máy tính tiền + ly
  ctx.fillStyle = "rgba(223,249,251,.75)"; roundRect(230, 186, 110, 42, 6); ctx.fill();
  for (const [bx, c] of [[250, "#fd79a8"], [282, "#e17055"], [314, "#ffeaa7"]]) { ctx.fillStyle = c; ctx.fillRect(bx - 9, 208, 18, 14); }
  ctx.fillStyle = "#2d3436"; roundRect(392, 194, 52, 34, 5); ctx.fill(); ctx.fillStyle = "#55efc4"; ctx.fillRect(400, 200, 36, 10);
  for (const cx of [190, 360]) { ctx.fillStyle = "#fff"; ctx.fillRect(cx - 8, 212, 16, 16); ctx.fillStyle = "#6d4c41"; ctx.fillRect(cx - 6, 212, 12, 4); }
}
function drawCafeTable(tb, t) {
  const { x, y } = tb;
  ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.beginPath(); ctx.ellipse(x, y, 44, 12, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#5d4037"; ctx.fillRect(x - 5, y - 36, 10, 36); ctx.fillRect(x - 20, y - 4, 40, 6);
  ctx.fillStyle = "#795548"; ctx.beginPath(); ctx.ellipse(x, y - 36, 48, 20, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#a1887f"; ctx.beginPath(); ctx.ellipse(x, y - 39, 46, 17, 0, 0, 7); ctx.fill();
  // Ly cà phê bốc khói + đĩa bánh
  ctx.fillStyle = "#fff"; ctx.fillRect(x - 18, y - 52, 14, 12); ctx.fillStyle = "#6d4c41"; ctx.fillRect(x - 16, y - 52, 10, 3);
  const k = (t / 1600 + x / 100) % 1;
  ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - k)})`; ctx.beginPath(); ctx.arc(x - 11, y - 56 - k * 18, 3 + k * 3, 0, 7); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(x + 14, y - 42, 11, 4, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#fd79a8"; ctx.fillRect(x + 8, y - 49, 12, 7);
}
function drawChair(st) {
  // Ghế nhìn ngang: tựa lưng ở phía ngoài, đệm hồng
  const x = st.x, fy = st.y + RADIUS + 8, back = st.dir === "right" ? -1 : 1;
  ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.beginPath(); ctx.ellipse(x, fy, 22, 7, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#5d4037"; ctx.fillRect(x - 16, fy - 22, 4, 22); ctx.fillRect(x + 12, fy - 22, 4, 22);
  ctx.fillStyle = "#795548"; ctx.fillRect(x + back * 16 - 3, fy - 62, 7, 62);
  ctx.fillStyle = "#e17055"; roundRect(x + back * 16 - 5, fy - 60, 11, 30, 4); ctx.fill();
  ctx.fillStyle = "#fab1a0"; roundRect(x - 20, fy - 28, 40, 9, 4); ctx.fill();
}
function drawSofa(sf) {
  const { x, y } = sf, w = 140;
  ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.beginPath(); ctx.ellipse(x, y + 2, w / 2 + 8, 9, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#00897b"; roundRect(x - w / 2, y - 66, w, 46, 14); ctx.fill();
  ctx.fillStyle = "#26a69a"; roundRect(x - w / 2 + 6, y - 60, w / 2 - 9, 34, 10); ctx.fill(); roundRect(x + 3, y - 60, w / 2 - 9, 34, 10); ctx.fill();
  ctx.fillStyle = "#00796b"; roundRect(x - w / 2 - 8, y - 40, 18, 40, 7); ctx.fill(); roundRect(x + w / 2 - 10, y - 40, 18, 40, 7); ctx.fill();
  ctx.fillStyle = "#4db6ac"; roundRect(x - w / 2 + 6, y - 28, w - 12, 18, 6); ctx.fill();
  ctx.fillStyle = "#fdcb6e"; roundRect(x - 52, y - 54, 22, 18, 6); ctx.fill(); // gối nhỏ
}
function drawPlant(pl, t) {
  const { x, y } = pl, sway = Math.sin(t / 1200 + x) * 2;
  ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.beginPath(); ctx.ellipse(x, y, 22, 7, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#e17055"; ctx.beginPath(); ctx.moveTo(x - 18, y - 30); ctx.lineTo(x + 18, y - 30); ctx.lineTo(x + 13, y); ctx.lineTo(x - 13, y); ctx.fill();
  ctx.fillStyle = "#d35400"; ctx.fillRect(x - 20, y - 34, 40, 6);
  for (const [dx, dy, r, c] of [[-12, -46, 14, "#27ae60"], [12, -48, 14, "#27ae60"], [0, -62, 16, "#2ecc71"], [-4, -78, 10, "#55efc4"]]) {
    ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x + dx + sway, y + dy, r * 0.7, r, dx / 30, 0, 7); ctx.fill();
  }
}
function drawCatTree(ct) {
  const { x, y } = ct;
  ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.beginPath(); ctx.ellipse(x, y, 46, 12, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#d7ccc8"; roundRect(x - 40, y - 12, 80, 14, 6); ctx.fill();
  ctx.fillStyle = "#c8b49a"; ctx.fillRect(x - 8, y - 92, 16, 82);
  ctx.strokeStyle = "#a1887f"; ctx.lineWidth = 2;
  for (let yy = y - 88; yy < y - 12; yy += 7) { ctx.beginPath(); ctx.moveTo(x - 8, yy); ctx.lineTo(x + 8, yy + 4); ctx.stroke(); }
  ctx.fillStyle = "#d7ccc8"; roundRect(x - 34, y - 56, 34, 10, 5); ctx.fill();
  ctx.fillStyle = "#bcaaa4"; roundRect(x - 38, y - 102, 76, 14, 7); ctx.fill();
  // Quả bóng lủng lẳng
  ctx.strokeStyle = "#636e72"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 30, y - 46); ctx.lineTo(x - 30, y - 28); ctx.stroke();
  ctx.fillStyle = "#e84393"; ctx.beginPath(); ctx.arc(x - 30, y - 25, 5, 0, 7); ctx.fill();
}

// ===== Mèo =====
const CAT_COLORS = {
  orange: { body: "#f0932b", dark: "#c56d12" },
  gray: { body: "#a4b0be", dark: "#747d8c" },
  black: { body: "#2f3542", dark: "#1e2229", eye: "#fbc531" },
  white: { body: "#f5f6fa", dark: "#dcdde1" },
  calico: { body: "#f5f6fa", dark: "#e1b12c", patch: "#2f3542" },
};
// Vị trí mèo tại thời điểm `now`: đi theo vòng, dừng nghỉ ở mỗi góc (giống nhau trên mọi máy)
function catPos(c, now) {
  if (c.sleep) return { x: c.x, y: c.y, face: 1, moving: false };
  const pts = c.path, PAUSE = 1800;
  const segs = pts.map((p, i) => { const q = pts[(i + 1) % pts.length]; return { p, q, dur: (Math.hypot(q[0] - p[0], q[1] - p[1]) / c.speed) * 1000 }; });
  const total = segs.reduce((a, sg) => a + sg.dur + PAUSE, 0);
  let k = (now + c.offset) % total;
  for (const sg of segs) {
    const face = Math.sign(sg.q[0] - sg.p[0]) || c._face || 1;
    c._face = face;
    if (k < PAUSE) return { x: sg.p[0], y: sg.p[1], face, moving: false };
    k -= PAUSE;
    if (k < sg.dur) { const f = k / sg.dur; return { x: sg.p[0] + (sg.q[0] - sg.p[0]) * f, y: sg.p[1] + (sg.q[1] - sg.p[1]) * f, face, moving: true }; }
    k -= sg.dur;
  }
  return { x: pts[0][0], y: pts[0][1], face: 1, moving: false };
}
const catPetAt = {};
socket.on("catPet", ({ i }) => { catPetAt[i] = Date.now(); });

// Mèo pixel: (x, fy) là giữa bàn chân; face 1 nhìn phải, -1 nhìn trái; tiny: chỉ vẽ dáng ngồi nhỏ (tranh, bậu cửa)
function drawCat(c, x, fy, moving, face, t, u, tiny, index) {
  const col = CAT_COLORS[c.color] || CAT_COLORS.orange, O = "#2d1b0e";
  const sleep = !!c.sleep && !tiny;
  const ox = x - 8 * u, oy = fy - 11 * u;
  const R = (cl, cc, r, w = 1, h = 1) => {
    const xx = face < 0 ? 16 - cc - w : cc;
    ctx.fillStyle = cl; ctx.fillRect(ox + xx * u, oy + r * u, w * u, h * u);
  };
  if (!tiny) { ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.beginPath(); ctx.ellipse(x, fy, 8 * u, 2 * u, 0, 0, 7); ctx.fill(); }
  if (sleep) {
    // Nệm + mèo cuộn tròn ngủ
    if (!c.perch) { ctx.fillStyle = "#e17055"; ctx.beginPath(); ctx.ellipse(x, fy - 2, 9 * u, 3.4 * u, 0, 0, 7); ctx.fill(); ctx.fillStyle = "#fab1a0"; ctx.beginPath(); ctx.ellipse(x, fy - 4, 8 * u, 2.6 * u, 0, 0, 7); ctx.fill(); }
    R(O, 2, 5, 12, 6); R(col.body, 3, 6, 10, 4);
    R(O, 10, 3, 5, 6); R(col.body, 11, 4, 3, 4); R(O, 10, 2, 2, 2); R(O, 13, 2, 2, 2);
    R(O, 12, 6, 2, 1);
    R(col.dark, 3, 9, 9, 1);
    if (col.patch) { R(col.patch, 4, 6, 3, 2); R(col.dark, 8, 7, 3, 2); }
    else { R(col.dark, 5, 6, 1, 3); R(col.dark, 8, 6, 1, 3); }
    const k = (t / 1500 + x) % 1;
    ctx.globalAlpha = 1 - k; ctx.fillStyle = "#636e72"; ctx.font = `bold ${10 + k * 6}px system-ui`; ctx.textAlign = "center";
    ctx.fillText("z", x + (face < 0 ? -1 : 1) * (6 * u + k * 10), fy - 10 * u - k * 16); ctx.globalAlpha = 1;
  } else if (tiny) {
    // Mèo ngồi (nhìn thẳng)
    R(O, 4, 3, 8, 8); R(col.body, 5, 4, 6, 6); R(O, 4, 1, 2, 2); R(O, 10, 1, 2, 2);
    R(col.eye || O, 6, 5, 1, 1); R(col.eye || O, 9, 5, 1, 1); R("#ff7675", 7, 6, 2, 1);
    R(O, 11, 8, 3, 1); R(O, 13, 6, 1, 3);
  } else {
    // Mèo đi: thân, đầu, tai, đuôi vẫy, chân bước
    const step = moving ? Math.floor(t / 160) % 2 : 0, tail = Math.round(Math.sin(t / 300 + x) * 1);
    R(O, 1, 1 + tail, 2, 5 - tail); R(col.body, 1, 2 + tail, 1, 3 - tail);
    R(O, 2, 4, 10, 5); R(col.body, 3, 5, 8, 3);
    R(O, 10, 1, 6, 6); R(col.body, 11, 2, 4, 4);
    R(O, 10, 0, 2, 2); R(O, 14, 0, 2, 2); R("#ff9aa2", 11, 1); R("#ff9aa2", 14, 1);
    R(col.eye || O, 12, 3); R(col.eye || O, 14, 3); R("#ff7675", 13, 4);
    if (col.patch) { R(col.patch, 4, 5, 3, 2); R(col.dark, 8, 6, 2, 2); }
    else { R(col.dark, 5, 5, 1, 3); R(col.dark, 7, 5, 1, 3); }
    for (const [lc, up] of [[3, step], [5, 1 - step], [8, 1 - step], [10, step]]) R(O, lc, 9 - (moving ? up : 0), 1, 2);
  }
  // Được vuốt: tim bay lên + "Meo~"
  const pet = index !== undefined && catPetAt[index] ? Date.now() - catPetAt[index] : Infinity;
  if (pet < 2500) {
    const k = pet / 2500;
    ctx.globalAlpha = 1 - k; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "16px system-ui"; ctx.fillText("💕", x + Math.sin(k * 9) * 8, fy - 13 * u - k * 30);
    ctx.font = "bold 14px system-ui"; ctx.lineWidth = 3; ctx.strokeStyle = "#fff"; ctx.strokeText("Meo~", x, fy - 18 * u - k * 10);
    ctx.fillStyle = "#e84393"; ctx.fillText("Meo~", x, fy - 18 * u - k * 10);
    ctx.globalAlpha = 1; ctx.textBaseline = "alphabetic";
  }
}

// ===== Trạm cứu hộ mèo: chị Mai đứng sau chuồng gỗ có mèo con, nhận nuôi ở đây =====
const ADOPTER_LOOK = { hair: 3, hairColor: 1, skin: 0, shirt: 5, bottom: 1, bottomColor: 3 };
function drawAdopter(a, t) {
  const { x, y } = a, feet = y - 30, bob = Math.sin(t / 600) * 1.5;
  // Chị Mai + băng đô tai mèo
  drawAvatar(ctx, ADOPTER_LOOK, x - 30, feet + bob, 3, "down", 0);
  const top = feet - 84 + bob;
  for (const ex of [x - 44, x - 16]) {
    ctx.fillStyle = "#2d3436"; ctx.beginPath(); ctx.moveTo(ex - 7, top + 10); ctx.lineTo(ex, top - 6); ctx.lineTo(ex + 7, top + 10); ctx.fill();
    ctx.fillStyle = "#fd79a8"; ctx.beginPath(); ctx.moveTo(ex - 3, top + 8); ctx.lineTo(ex, top); ctx.lineTo(ex + 3, top + 8); ctx.fill();
  }
  // Chuồng gỗ thấp, nệm hồng, mèo con bên trong
  ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.beginPath(); ctx.ellipse(x + 10, y + 2, 66, 10, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#fab1a0"; ctx.fillRect(x - 54, y - 26, 128, 22);
  drawCat({ color: "orange", sleep: true }, x - 20, y - 6, false, 1, t, 2, false);
  drawCat({ color: "white" }, x + 20, y - 6, false, -1, t, 2, true);
  drawCat({ color: "gray" }, x + 50, y - 6, Math.sin(t / 900) > 0.6, 1, t, 2, false);
  ctx.fillStyle = "#a1887f";
  for (let i = 0; i <= 8; i++) ctx.fillRect(x - 58 + i * 16, y - 34, 5, 34);
  ctx.fillStyle = "#8d6e63"; ctx.fillRect(x - 60, y - 34, 136, 6); ctx.fillRect(x - 60, y - 14, 136, 5);
}
function drawAdopterLabel(a) {
  const { x, y } = a, top = y - 30 - 84;
  ctx.textAlign = "center";
  ctx.fillStyle = "#e84393"; roundRect(x - 66, top - 52, 132, 24, 8); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = "bold 13px system-ui"; ctx.textBaseline = "middle"; ctx.fillText("🐾 NHẬN NUÔI MÈO", x, top - 40); ctx.textBaseline = "alphabetic";
  ctx.font = "bold 13px system-ui"; ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,.7)";
  ctx.strokeText(a.name, x - 10, top - 10); ctx.fillStyle = "#ffeaa7"; ctx.fillText(a.name, x - 10, top - 10);
}
