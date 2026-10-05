// Người bán hàng ở sảnh (chỉ để trang trí): Cô Ba Cá Viên (xe đẩy) và Anh Tèo Burger (quầy).
// Vẽ xe hàng + người bán và bong bóng chữ rao hàng định kỳ (chỉ hiện chữ, không đọc to).
// Dùng chung canvas `ctx`, `roundRect`, `drawAvatar` của các file khác.

const NPC_LINES = {
  fishball: ["Cá viên chiên đâyyy! 🍢", "Nóng giòn đây, 5 ngàn một xiên!", "Cá viên, bò viên, xúc xích đâyyy!", "Ai ăn cá viên chiên hông nè?", "Chấm tương ớt cay xè nè!"],
  burger: ["Hamburger nóng hổi đây! 🍔", "Burger bò phô mai nóng hổi đây!", "Bánh mới nướng, thơm phức nè!", "Ai đói bụng ghé ăn burger nha!", "Burger gà giòn rụm đây!"],
};
const NPC_LOOK = {
  fishball: { hair: 3, hairColor: 0, skin: 1, shirt: 5, bottom: 0, bottomColor: 0 },
  burger: { hair: 0, hairColor: 1, skin: 0, shirt: 6, bottom: 0, bottomColor: 0 },
};

// Lời rao theo thời gian (mọi máy thấy giống nhau): mỗi 9 giây rao 1 câu trong 4 giây
function npcLine(id, now) {
  const k = id === "burger" ? 4500 : 0, slot = Math.floor((now + k) / 9000);
  if ((now + k) % 9000 > 4000) return null;
  return NPC_LINES[id][slot % NPC_LINES[id].length];
}

function drawNpc(n, t, labelOnly) {
  const now = Date.now();
  const x = n.x, feet = n.y - 34, bob = Math.sin(t / 500 + x) * 1.5;
  const hx = x + (n.id === "fishball" ? 8 : 0), top = feet - 84 + bob;
  if (labelOnly) return drawNpcLabel(n, hx, top, now);
  drawAvatar(ctx, NPC_LOOK[n.id], x + (n.id === "fishball" ? 8 : 0), feet + bob, 3, "down", 0);
  if (n.id === "fishball") {
    // Nón lá
    ctx.fillStyle = "#e9d9a6"; ctx.beginPath(); ctx.moveTo(hx, top - 16); ctx.lineTo(hx - 40, top + 22); ctx.lineTo(hx + 40, top + 22); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#c8b07a"; ctx.lineWidth = 1.5;
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(hx - 40 * i / 4, top - 16 + 38 * i / 4); ctx.lineTo(hx + 40 * i / 4, top - 16 + 38 * i / 4); ctx.stroke(); }
    ctx.strokeStyle = "#a68a52"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hx - 40, top + 22); ctx.lineTo(hx + 40, top + 22); ctx.stroke();
  } else {
    // Mũ đầu bếp
    ctx.fillStyle = "#fff"; ctx.strokeStyle = "#dfe6e9"; ctx.lineWidth = 2;
    ctx.fillRect(hx - 17, top + 6, 34, 16); ctx.strokeRect(hx - 17, top + 6, 34, 16);
    for (const [dx, dy, r] of [[-12, 2, 12], [0, -4, 14], [12, 2, 12]]) { ctx.beginPath(); ctx.arc(hx + dx, top + dy, r, 0, 7); ctx.fill(); ctx.stroke(); }
  }
}
// Tên + lời rao: vẽ sau cùng để không bị dù / mái che che mất
function drawNpcLabel(n, hx, top, now) {
  const nameY = top - 26;
  ctx.font = "bold 14px system-ui"; ctx.textAlign = "center";
  ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,.7)"; ctx.strokeText(n.name, hx, nameY);
  ctx.fillStyle = "#ffeaa7"; ctx.fillText(n.name, hx, nameY);
  const line = npcLine(n.id, now);
  if (line) {
    ctx.font = "bold 14px system-ui";
    const w = ctx.measureText(line).width + 20, by = nameY - 44;
    ctx.fillStyle = "#fff"; roundRect(hx - w / 2, by, w, 30, 12); ctx.fill();
    ctx.beginPath(); ctx.moveTo(hx - 6, by + 30); ctx.lineTo(hx + 6, by + 30); ctx.lineTo(hx, by + 38); ctx.fill();
    ctx.fillStyle = n.id === "fishball" ? "#d63031" : "#e17055"; ctx.textBaseline = "middle"; ctx.fillText(line, hx, by + 15); ctx.textBaseline = "alphabetic";
  }
}

function drawFishballCart(n, t) {
  const { x, y } = n;
  ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.beginPath(); ctx.ellipse(x, y + 2, 70, 12, 0, 0, 7); ctx.fill();
  // Dù sọc đỏ trắng
  ctx.fillStyle = "#7f8c8d"; ctx.fillRect(x - 54, y - 150, 4, 96);
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? "#fff" : "#e74c3c";
    ctx.beginPath(); ctx.moveTo(x - 52, y - 158); ctx.arc(x - 52, y - 158, 74, Math.PI + (i * Math.PI) / 8, Math.PI + ((i + 1) * Math.PI) / 8); ctx.fill();
  }
  // Thân xe
  ctx.fillStyle = "#c0392b"; roundRect(x - 60, y - 60, 120, 46, 6); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.fillRect(x - 60, y - 60, 120, 5);
  ctx.fillStyle = "#f9ca24"; ctx.font = "bold 13px system-ui"; ctx.textAlign = "center"; ctx.fillText("CÁ VIÊN CHIÊN 5K", x, y - 30);
  // Tủ kính có xiên cá viên
  ctx.fillStyle = "rgba(223,249,251,.55)"; ctx.fillRect(x - 54, y - 94, 62, 34); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.strokeRect(x - 54, y - 94, 62, 34);
  for (let i = 0; i < 5; i++) {
    const sx = x - 46 + i * 12;
    ctx.fillStyle = "#8d6e63"; ctx.fillRect(sx, y - 90, 2, 28);
    for (let k = 0; k < 3; k++) { ctx.fillStyle = ["#e67e22", "#d35400", "#f39c12"][(i + k) % 3]; ctx.beginPath(); ctx.arc(sx + 1, y - 84 + k * 8, 4, 0, 7); ctx.fill(); }
  }
  // Nồi dầu bốc khói
  ctx.fillStyle = "#2d3436"; ctx.beginPath(); ctx.ellipse(x + 32, y - 66, 20, 8, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#f6b93b"; ctx.beginPath(); ctx.ellipse(x + 32, y - 68, 16, 5, 0, 0, 7); ctx.fill();
  for (let i = 0; i < 3; i++) {
    const k = (t / 1300 + i / 3) % 1;
    ctx.fillStyle = `rgba(255,255,255,${0.55 * (1 - k)})`; ctx.beginPath(); ctx.arc(x + 32 + Math.sin(k * 7 + i) * 6, y - 76 - k * 40, 5 + k * 7, 0, 7); ctx.fill();
  }
  // Bánh xe
  for (const wx of [-40, 40]) { ctx.fillStyle = "#2d3436"; ctx.beginPath(); ctx.arc(x + wx, y - 8, 12, 0, 7); ctx.fill(); ctx.fillStyle = "#95a5a6"; ctx.beginPath(); ctx.arc(x + wx, y - 8, 4, 0, 7); ctx.fill(); }
}

function drawBurgerStand(n, t) {
  const { x, y } = n;
  ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.beginPath(); ctx.ellipse(x, y + 2, 72, 12, 0, 0, 7); ctx.fill();
  // Cột + biển hiệu + mái che sọc
  ctx.fillStyle = "#6d4c41"; ctx.fillRect(x - 60, y - 150, 6, 100); ctx.fillRect(x + 54, y - 150, 6, 100);
  ctx.fillStyle = "#c0392b"; roundRect(x - 52, y - 168, 104, 30, 8); ctx.fill();
  ctx.fillStyle = "#ffeaa7"; ctx.font = "bold 17px system-ui"; ctx.textAlign = "center"; ctx.fillText("🍔 BURGER", x, y - 147);
  for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? "#f9ca24" : "#e74c3c"; ctx.fillRect(x - 64 + i * 16, y - 134, 16, 16); }
  for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? "#f9ca24" : "#e74c3c"; ctx.beginPath(); ctx.arc(x - 56 + i * 16, y - 118, 8, 0, Math.PI); ctx.fill(); }
  // Quầy
  ctx.fillStyle = "#fdcb6e"; roundRect(x - 62, y - 62, 124, 52, 6); ctx.fill();
  ctx.fillStyle = "#8d6e63"; ctx.fillRect(x - 66, y - 66, 132, 8);
  ctx.fillStyle = "#e17055"; ctx.font = "bold 13px system-ui"; ctx.fillText("Burger bò 30K", x, y - 30);
  // Vỉ nướng + burger + khói
  ctx.fillStyle = "#636e72"; ctx.fillRect(x + 12, y - 74, 44, 8);
  for (const bx of [x + 22, x + 44]) {
    ctx.fillStyle = "#e1a95f"; ctx.beginPath(); ctx.ellipse(bx, y - 80, 9, 5, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = "#6d4c41"; ctx.fillRect(bx - 9, y - 80, 18, 3); ctx.fillStyle = "#2ecc71"; ctx.fillRect(bx - 9, y - 77, 18, 2);
  }
  for (let i = 0; i < 3; i++) {
    const k = (t / 1500 + i / 3) % 1;
    ctx.fillStyle = `rgba(200,200,200,${0.5 * (1 - k)})`; ctx.beginPath(); ctx.arc(x + 34 + Math.sin(k * 6 + i) * 8, y - 90 - k * 36, 5 + k * 6, 0, 7); ctx.fill();
  }
  // Chai tương cà, mù tạt
  ctx.fillStyle = "#d63031"; roundRect(x - 50, y - 86, 9, 20, 3); ctx.fill();
  ctx.fillStyle = "#f9ca24"; roundRect(x - 38, y - 86, 9, 20, 3); ctx.fill();
}

// Thêm người bán + xe hàng vào danh sách vẽ theo chiều sâu
function addNpcItems(items, t) {
  for (const n of WORLDS.lobby.decor.npcs) {
    items.push({ y: n.y - 34, draw: () => drawNpc(n, t) });
    items.push({ y: 1e6, draw: () => drawNpc(n, t, true) }); // lớp chữ trên cùng
    items.push({ y: n.y, draw: () => (n.id === "fishball" ? drawFishballCart(n, t) : drawBurgerStand(n, t)) });
  }
}
