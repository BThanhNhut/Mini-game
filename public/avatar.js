// Vẽ nhân vật pixel chibi kiểu Avatar: đầu to, tóc, áo, quần/váy, đi 4 hướng.
// Nhân vật rộng 20 ô, cao 28 ô (ô = u pixel), gốc tọa độ (fx, fy) là giữa bàn chân.

const AV = {
  HAIR_STYLES: ["Ngắn", "Dựng", "Hai bím", "Dài", "Mũ", "Xù"],
  HAIR: ["#2d1b0e", "#6b3e1f", "#e0a030", "#d63031", "#6c5ce7", "#e84393", "#dfe6e9"],
  SKIN: ["#ffe0c4", "#f1c27d", "#c68642"],
  SHIRT: ["#e74c3c", "#3498db", "#2ecc71", "#f1c40f", "#9b59b6", "#ff7eb3", "#ffffff", "#2d3436"],
  BOTTOMS: ["Quần", "Váy"],
  BOTTOM: ["#2c3e50", "#3867d6", "#8e6e53", "#e84393", "#20bf6b", "#f5f6fa"],
};
AV.SIZES = { hair: AV.HAIR_STYLES.length, hairColor: AV.HAIR.length, skin: AV.SKIN.length, shirt: AV.SHIRT.length, bottom: AV.BOTTOMS.length, bottomColor: AV.BOTTOM.length };

function normalizeLook(l) {
  const out = {};
  for (const k in AV.SIZES) {
    const v = Math.floor(Number(l && l[k]));
    out[k] = v >= 0 && v < AV.SIZES[k] ? v : 0;
  }
  return out;
}
function randomLook() {
  const out = {};
  for (const k in AV.SIZES) out[k] = Math.floor(Math.random() * AV.SIZES[k]);
  return out;
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  return "#" + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, "0")).join("");
}

// dir: "down" | "up" | "left" | "right"; step: 0 đứng yên, 1/2 hai nhịp bước chân
// pose: null | "sit" (ngồi ghế) | "wave" (giơ tay vẫy; step đổi nhịp vẫy)
// look.costume === "kid": skin đặc biệt Kaito Kid (mũ chóp, kính một mắt, vest trắng, áo choàng)
function drawAvatar(ctx, look, fx, fy, u, dir = "down", step = 0, pose = null) {
  const L = normalizeLook(look);
  const kid = !!(look && look.costume === "kid");
  const O = "#3b2416";
  const ox = fx - 10 * u, oy = fy - 28 * u;
  const sit = pose === "sit";
  let sh = sit ? 4 : 0; // ngồi thì hạ thân người xuống 4 ô
  const R = (col, c, r, w = 1, h = 1) => { ctx.fillStyle = col; ctx.fillRect(ox + c * u, oy + (r + sh) * u, w * u, h * u); };
  const B = (fill, c, r, w, h) => { R(O, c, r, w, h); R(fill, c + 1, r + 1, w - 2, h - 2); };
  let skin = AV.SKIN[L.skin], hair = AV.HAIR[L.hairColor], shirt = AV.SHIRT[L.shirt], bot = AV.BOTTOM[L.bottomColor];
  let skirt = L.bottom === 1, shoe = "#4a3426";
  if (kid) { skin = AV.SKIN[0]; hair = "#3d2a1e"; shirt = "#f5f6fa"; bot = "#f5f6fa"; skirt = false; shoe = "#dfe6e9"; }
  const hl = shade(hair, 0.3), back = dir === "up";
  const e = dir === "left" ? -2 : dir === "right" ? 2 : 0;
  const WHITE = "#f5f6fa", WSHADE = "#c8d1da";

  // Áo choàng trắng của Kid (phía sau lưng)
  const cape = () => {
    if (back) { B(WHITE, 3, 13, 14, 13); R(WSHADE, 9, 14, 2, 11); R(WSHADE, 4, 24, 12, 1); return; }
    const cx = dir === "right" ? 0 : dir === "left" ? 9 : 2, cw = dir === "down" ? 16 : 11;
    B(WHITE, cx, 13, cw, 13); R(WSHADE, cx + cw - 3, 14, 2, 11); R(WSHADE, cx + 1, 24, cw - 2, 1);
  };
  if (kid && !back) cape();

  // Tóc dài / hai bím nằm sau lưng
  const backHair = () => {
    if (L.hair === 3) B(hair, 2, 4, 16, 15);
    if (L.hair === 2) { B(hair, 0, 5, 4, 10); B(hair, 16, 5, 4, 10); R("#ff6b81", 1, 5, 2, 1); R("#ff6b81", 17, 5, 2, 1); }
  };
  if (!back) backHair();

  // Chân + giày (nhấc một chân khi bước)
  const leg = (c, t) => { R(O, c, t, 5, 7); R(skirt ? skin : bot, c + 1, t, 3, 4); R(shoe, c + 1, t + 4, 3, 2); };
  if (!sit) {
    leg(5, step === 1 ? 20 : 21);
    leg(10, step === 2 ? 20 : 21);
  }

  // Thân áo + quần/váy
  B(shirt, 5, 14, 10, 9);
  R(shade(shirt, 0.25), 8, 15, 4, 1); // cổ áo
  if (skirt) { B(bot, 4, 18, 12, 6); R(shade(bot, -0.2), 5, 22, 10, 1); }
  else { R(bot, 6, 19, 8, 3); R(shade(bot, -0.25), 6, 19, 8, 1); }
  // Vest trắng của Kid: áo sơ mi xanh, cà vạt đỏ, ve áo
  if (kid && !back) {
    if (dir === "down") { R("#3867d6", 8, 15, 4, 4); R("#d63031", 9, 15, 2, 4); R(WSHADE, 7, 15, 1, 5); R(WSHADE, 12, 15, 1, 5); }
    else { const tx = dir === "right" ? 11 : 6; R("#3867d6", tx, 15, 3, 3); R("#d63031", tx + 1, 15, 1, 3); }
  }
  // Ngồi: đầu gối và giày thò ra phía trước
  if (sit) {
    const s0 = sh; sh = 0;
    for (const c of [5, 10]) { R(O, c, 24, 5, 4); R(skirt ? skin : bot, c + 1, 24, 3, 1); R(shoe, c + 1, 25, 3, 2); }
    sh = s0;
  }

  // Tay (đung đưa theo bước chân)
  const sw = step === 1 ? 1 : step === 2 ? -1 : 0;
  const arm = (c, r) => { R(O, c, r, 3, 6); R(shirt, c + 1, r + 1, 1, 3); R(skin, c + 1, r + 4, 1, 1); };
  if (dir === "left" || dir === "right") { B(shirt, 8, 15 + sw, 4, 6); R(skin, 9, 19 + sw, 2, 1); }
  else { arm(3, 15 + sw); if (pose !== "wave" || back) arm(14, 15 - sw); }

  if (back) { if (kid) cape(); else backHair(); }

  // Đầu
  R(O, 4, 2, 12, 13); R(O, 3, 3, 14, 11);
  R(skin, 5, 3, 10, 11); R(skin, 4, 4, 12, 9);

  // Tóc (Kid: mũ chóp trắng có dải xanh, tóc nâu rối thò ra hai bên)
  if (kid) {
    if (back) { R(hair, 4, 3, 12, 9); R(shade(hair, 0.2), 6, 5, 3, 1); }
    else {
      R(hair, 4, 3, 2, 5); R(hair, 14, 3, 2, 5);
      R(hair, 5, 3, 3, 2); R(hair, 9 + e, 3, 2, 2); R(hair, 12, 3, 3, 2); R(hair, 6, 5, 1, 1); R(hair, 13, 5, 1, 1);
    }
    const bx = dir === "right" ? 3 : dir === "left" ? 1 : 2;
    R(O, bx, 1, 16, 3); R(WHITE, bx + 1, 2, 14, 1);               // vành mũ
    R(O, 4, -7, 12, 9); R(WHITE, 5, -6, 10, 7);                  // thân mũ
    R("#3867d6", 5, -1, 10, 2);                                  // dải xanh
    R("#ffffff", 6, -5, 2, 4); R(WSHADE, 13, -6, 2, 5);          // sáng / tối
  } else if (back) {
    if (L.hair === 4) {
      R("#4a2c17", 4, 5, 12, 7);
      R(O, 4, -1, 12, 1); R(O, 3, 0, 14, 6); R(hair, 4, 0, 12, 5); R(hl, 6, 1, 3, 1);
    } else if (L.hair === 5) {
      R(O, 3, -2, 14, 15); R(O, 1, 0, 18, 10); R(O, 2, -1, 16, 13);
      R(hair, 3, -1, 14, 13); R(hair, 2, 0, 16, 10); R(hl, 5, 0, 4, 1);
    } else {
      R(O, 4, 0, 12, 1); R(O, 3, 1, 14, 13); R(hair, 4, 1, 12, 12); R(hl, 6, 2, 3, 1);
    }
  } else if (L.hair === 4) {
    R("#4a2c17", 4, 6, 1, 3); R("#4a2c17", 15, 6, 1, 3);
    R(O, 4, -1, 12, 1); R(O, 3, 0, 14, 6); R(hair, 4, 0, 12, 5); R(hl, 6, 1, 3, 1);
    if (dir === "down") R("#fff", 9, 2, 2, 2);
    const bx = dir === "right" ? 8 : dir === "left" ? 0 : 2, bw = dir === "down" ? 16 : 12;
    R(O, bx, 5, bw, 2); R(shade(hair, -0.3), bx + 1, 5, bw - 2, 1);
  } else if (L.hair === 5) {
    R(O, 3, -2, 14, 12); R(O, 1, 0, 18, 8); R(O, 2, -1, 16, 10);
    R(hair, 3, -1, 14, 10); R(hair, 2, 0, 16, 8); R(hl, 5, 0, 4, 1);
    R(skin, 5, 6, 10, 3); R(hair, 5, 6, 2, 1); R(hair, 9, 6, 2, 1); R(hair, 13, 6, 2, 1);
  } else {
    R(O, 4, 0, 12, 1); R(O, 3, 1, 14, 7); R(hair, 4, 1, 12, 6); R(hl, 6, 2, 3, 1);
    R(skin, 5, 7, 10, 1); R(hair, 4, 7, 2, 1); R(hair, 9 + e, 7, 2, 1); R(hair, 14, 7, 2, 1);
    const side = L.hair === 3 ? 6 : 3;
    R(hair, 4, 7, 1, side); R(hair, 15, 7, 1, side);
    if (L.hair === 1) for (const c of [4, 7, 10, 13]) { R(O, c, -2, 3, 2); R(hair, c + 1, -1, 1, 2); }
    if (L.hair === 2) { R("#ff6b81", 3, 6, 1, 2); R("#ff6b81", 16, 6, 1, 2); }
  }

  // Giơ tay vẫy (vẽ sau đầu để cánh tay nằm trước)
  if (pose === "wave" && !back) {
    const wx = step === 1 ? 1 : 0;
    R(O, 14 + wx, 8, 3, 8); R(skin, 15 + wx, 9, 1, 2); R(shirt, 15 + wx, 11, 1, 4);
  }

  // Mặt
  if (!back) {
    const cl = (c) => Math.max(5, Math.min(13, c));
    R(O, 6 + e, 8, 2, 3); R(O, 12 + e, 8, 2, 3);
    R("#fff", 6 + e, 8); R("#fff", 12 + e, 8);
    R("#ff9aa2", cl(5 + e), 11, 2, 1); R("#ff9aa2", cl(13 + e), 11, 2, 1);
    R("#8b3a2b", 9 + e, 12, 2, 1);
    // Kính một mắt + dây đeo + cỏ bốn lá
    if (kid) {
      const mx = 5 + e;
      R("#dfe6e9", mx, 7, 4, 1); R("#dfe6e9", mx, 11, 4, 1); R("#dfe6e9", mx, 8, 1, 3); R("#dfe6e9", mx + 3, 8, 1, 3);
      R("rgba(200,230,255,.45)", mx + 1, 8, 2, 3);
      R("#b2bec3", mx, 12, 1, 4); R("#00b894", mx - 1, 16, 2, 2);
    }
  }
}

// Ảnh tĩnh của nhân vật (dùng cho ghế ở bàn bài), có cache theo ngoại hình
const avatarCache = {};
function avatarDataURL(look, u = 3, dir = "down") {
  const key = JSON.stringify(normalizeLook(look)) + (look && look.costume) + u + dir;
  if (avatarCache[key]) return avatarCache[key];
  // Cao 36 ô để vừa cả mũ chóp của skin Kid
  const c = document.createElement("canvas");
  c.width = 22 * u; c.height = 36 * u;
  drawAvatar(c.getContext("2d"), look, 11 * u, 35 * u, u, dir, 0);
  return (avatarCache[key] = c.toDataURL());
}
