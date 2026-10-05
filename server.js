// Server game sảnh 2D + các bàn chơi giữa người với người: Bầu Cua, Bài Cào, Xì Dách
// Chạy: npm install && npm start
const express = require("express");
const http = require("http");
const https = require("https");
const fs = require("fs");
const crypto = require("crypto");
const os = require("os");
const { Server } = require("socket.io");

const app = express();
app.use(express.static(__dirname + "/public"));
const server = http.createServer(app);
const io = new Server(server);
const PORT = Number(process.env.PORT) || 3000;
// Trình duyệt chỉ cho dùng mic trên https (hoặc localhost), nên mở thêm cổng https với chứng chỉ tự tạo
const HTTPS_PORT = Number(process.env.HTTPS_PORT) || PORT + 443;
const httpsServer = https.createServer(loadCert(), app);
io.attach(httpsServer);

function lanIPs() {
  const ips = [];
  for (const list of Object.values(os.networkInterfaces())) for (const i of list || []) if (i.family === "IPv4" && !i.internal) ips.push(i.address);
  return ips;
}
// Tạo chứng chỉ một lần rồi lưu vào thư mục cert/ (đổi mạng wifi thì xóa thư mục này để tạo lại)
function loadCert() {
  const dir = __dirname + "/cert";
  try { return { key: fs.readFileSync(dir + "/key.pem"), cert: fs.readFileSync(dir + "/cert.pem") }; } catch (e) {}
  const altNames = [{ type: 2, value: "localhost" }, { type: 7, ip: "127.0.0.1" }, ...lanIPs().map((ip) => ({ type: 7, ip }))];
  const pems = require("selfsigned").generate([{ name: "commonName", value: "game-sanh" }], {
    days: 3650, keySize: 2048, algorithm: "sha256",
    extensions: [{ name: "basicConstraints", cA: false }, { name: "subjectAltName", altNames }],
  });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dir + "/key.pem", pems.private);
  fs.writeFileSync(dir + "/cert.pem", pems.cert);
  return { key: pems.private, cert: pems.cert };
}

// ===== Bản đồ sảnh =====
const MAP = { w: 1200, h: 800 };
const DOORS = [
  { id: "baucua", name: "Bầu Cua", icon: "🦀", x: 125, y: 40, w: 150, h: 210, color: "#c0392b", open: true },
  { id: "baicao", name: "Bài Cào", icon: "🃏", x: 325, y: 40, w: 150, h: 210, color: "#16a085", open: true },
  { id: "xidach", name: "Xì Dách", icon: "♠️", x: 525, y: 40, w: 150, h: 210, color: "#d35400", open: true },
  { id: "tienlen", name: "Tiến Lên", icon: "🎴", x: 725, y: 40, w: 150, h: 210, color: "#8e44ad", open: true },
  { id: "caro", name: "Cờ Caro", icon: "⭕", x: 925, y: 40, w: 150, h: 210, color: "#2980b9", open: true },
];
const COLORS = ["#e67e22", "#1abc9c", "#3498db", "#9b59b6", "#f1c40f", "#e84393", "#2ecc71", "#fd79a8", "#00cec9", "#d35400"];
// Số lựa chọn cho từng phần của nhân vật (khớp với public/avatar.js)
const LOOK_SIZES = { hair: 6, hairColor: 7, skin: 3, shirt: 8, bottom: 2, bottomColor: 6 };
const SPEED = 220; // px/giây
const R = 18; // bán kính nhân vật

// ===== Trang trí sảnh: đài thác nước, ghế băng, cây xanh =====
const FOUNTAIN = { x: 600, y: 535, rx: 170, ry: 78 };
const TREES = [{ x: 90, y: 390 }, { x: 1110, y: 390 }, { x: 90, y: 745 }, { x: 1110, y: 745 }, { x: 205, y: 560 }, { x: 995, y: 560 }];
const BENCHES = [{ x: 330, y: 445 }, { x: 330, y: 700 }, { x: 870, y: 445 }, { x: 870, y: 700 }];
const EMOTES = { wave: 3000, dance: 6000, heart: 3000, laugh: 3000, cry: 3000, sleep: Infinity };
// ===== Người bán hàng (NPC) ở sảnh: chỉ để trang trí, rao hàng bằng bong bóng chữ =====
const NPCS = [
  { id: "fishball", name: "Cô Ba Cá Viên", x: 330, y: 600 },
  { id: "burger", name: "Anh Tèo Burger", x: 870, y: 600 },
];

// ===== Quán Cafe Mèo =====
const CAFE_TABLES = [{ x: 430, y: 470 }, { x: 760, y: 470 }, { x: 430, y: 680 }, { x: 760, y: 680 }];
const SOFA = { x: 165, y: 560 };
const CAFE_PLANTS = [{ x: 1140, y: 262 }, { x: 40, y: 770 }, { x: 1150, y: 772 }];
// Mèo đi dạo theo vòng (path) hoặc nằm ngủ một chỗ; vị trí tính theo thời gian nên mọi máy thấy giống nhau
const CATS = [
  { color: "orange", path: [[560, 385], [920, 385], [920, 578], [600, 578]], speed: 40, offset: 0 },
  { color: "gray", path: [[275, 420], [275, 765], [545, 765], [545, 600]], speed: 34, offset: 5000 },
  { color: "black", path: [[900, 612], [1090, 612], [1090, 770], [900, 770]], speed: 46, offset: 9000 },
  { color: "white", path: [[620, 300], [980, 300]], speed: 28, offset: 2000 },
  { color: "calico", sleep: true, x: 985, y: 470 },
  { color: "orange", sleep: true, x: 330, y: 335 },
  { color: "gray", sleep: true, x: 1060, y: 332, perch: 96 },
];

// ===== Các bản đồ đi lại được: Sảnh và Quán Cafe Mèo =====
// Vật cản tính theo vị trí bàn chân: ellipse {x,y,rx,ry} | rect {x1,y1,x2,y2} | tree {x,y}
// Chỗ ngồi: tâm nhân vật khi ngồi (x,y), hướng nhìn, nhóm (ngồi cùng nhóm mới nghe mic nhau), chỗ đứng dậy
// Cổng (portal): đi vào vùng này thì sang bản đồ khác, xuất hiện ở spawn
const WORLDS = {
  lobby: {
    name: "Sảnh",
    obstacles: [
      { type: "ellipse", x: FOUNTAIN.x, y: FOUNTAIN.y, rx: FOUNTAIN.rx + 20, ry: FOUNTAIN.ry + 18 }, // tính cả thành hồ
      ...TREES.map((t) => ({ type: "tree", ...t })),
      ...BENCHES.map((b) => ({ type: "rect", x1: b.x - 64, x2: b.x + 64, y1: b.y - 18, y2: b.y + 6 })),
      ...NPCS.map((n) => ({ type: "rect", x1: n.x - 64, x2: n.x + 64, y1: n.y - 58, y2: n.y + 8 })), // xe hàng + người bán
    ],
    seats: BENCHES.flatMap((b, i) => [-28, 28].map((dx) => ({ x: b.x + dx, y: b.y - 8 - R, dir: "down", group: "bench" + i, standX: b.x + dx, standY: b.y + 14 }))),
    portals: [{ x1: 0, x2: 40, y1: 470, y2: 650, to: "cafe", spawn: { x: 1100, y: 560 }, label: "☕ Cafe Mèo" }],
    decor: { fountain: FOUNTAIN, trees: TREES, benches: BENCHES, npcs: NPCS },
  },
  cafe: {
    name: "Cafe Mèo",
    obstacles: [
      { type: "rect", x1: 0, x2: 1200, y1: 0, y2: 228 },   // tường
      { type: "rect", x1: 60, x2: 480, y1: 0, y2: 305 },   // quầy pha chế
      { type: "ellipse", x: 1060, y: 330, rx: 44, ry: 20 }, // trụ cào mèo
      ...CAFE_TABLES.map((t) => ({ type: "ellipse", x: t.x, y: t.y, rx: 50, ry: 24 })),
      { type: "rect", x1: SOFA.x - 72, x2: SOFA.x + 72, y1: SOFA.y - 20, y2: SOFA.y + 6 },
      ...CAFE_PLANTS.map((t) => ({ type: "tree", ...t })),
    ],
    seats: [
      ...CAFE_TABLES.flatMap((t, i) => [
        { x: t.x - 72, y: t.y - 8 - R, dir: "right", group: "table" + i, standX: t.x - 72, standY: t.y + 44 },
        { x: t.x + 72, y: t.y - 8 - R, dir: "left", group: "table" + i, standX: t.x + 72, standY: t.y + 44 },
      ]),
      ...[-28, 28].map((dx) => ({ x: SOFA.x + dx, y: SOFA.y - 8 - R, dir: "down", group: "sofa", standX: SOFA.x + dx, standY: SOFA.y + 14 })),
    ],
    portals: [{ x1: 1160, x2: 1200, y1: 470, y2: 650, to: "lobby", spawn: { x: 85, y: 560 }, label: "🏛️ Sảnh" }],
    decor: { tables: CAFE_TABLES, sofa: SOFA, plants: CAFE_PLANTS, cats: CATS, catTree: { x: 1060, y: 330 } },
  },
};
function blocked(W, x, y) {
  const fy = y + R;
  for (const o of W.obstacles) {
    if (o.type === "ellipse" && ((x - o.x) / o.rx) ** 2 + ((fy - o.y) / o.ry) ** 2 < 1) return true;
    if (o.type === "tree" && Math.hypot(x - o.x, (fy - o.y) * 1.8) < 26) return true;
    if (o.type === "rect" && x > o.x1 && x < o.x2 && fy > o.y1 && fy < o.y2) return true;
  }
  return false;
}
function leaveBench(p) {
  if (p.pose !== "sit") return;
  const seat = WORLDS[p.room] && WORLDS[p.room].seats[p.spot];
  p.pose = null; p.spot = null;
  if (seat) { p.x = seat.standX; p.y = seat.standY; } // đứng dậy ra phía trước ghế
}

const players = {}; // socketId -> player

function sanitizeName(n) {
  n = String(n || "").replace(/[<>]/g, "").trim().slice(0, 16);
  return n || "Khách" + Math.floor(Math.random() * 1000);
}
// ===== Mã skin admin (Kaito Kid) =====
// Mã lấy từ biến môi trường ADMIN_CODE, hoặc file admin-code.txt (không đưa lên GitHub).
// Lần đầu chạy chưa có thì tự tạo mã ngẫu nhiên và lưu vào file đó.
const ADMIN_CODE = (() => {
  if (process.env.ADMIN_CODE) return process.env.ADMIN_CODE.trim();
  const file = __dirname + "/admin-code.txt";
  try { const c = fs.readFileSync(file, "utf8").trim(); if (c) return c; } catch (e) {}
  const c = "KID-" + crypto.randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
  fs.writeFileSync(file, c + "\n");
  return c;
})();
const MAX_CODE_TRIES = 5; // mỗi kết nối chỉ được thử sai 5 lần
function checkSkinCode(s, code) {
  if (typeof code !== "string" || !code.trim()) return false;
  s.data.codeTries = (s.data.codeTries || 0) + 1;
  if (s.data.codeTries > MAX_CODE_TRIES) return false;
  return code.trim().toUpperCase() === ADMIN_CODE.toUpperCase();
}

function sanitizeLook(l) {
  const out = {};
  for (const k in LOOK_SIZES) {
    const v = Math.floor(Number(l && l[k]));
    out[k] = v >= 0 && v < LOOK_SIZES[k] ? v : Math.floor(Math.random() * LOOK_SIZES[k]);
  }
  return out;
}
function nearDoor(p, d) {
  const m = 30;
  return p.x > d.x - m && p.x < d.x + d.w + m && p.y > d.y - m && p.y < d.y + d.h + m;
}
// ===== Ngẫu nhiên công bằng =====
// randInt(n): số nguyên đều trong [0, n) lấy từ bộ sinh số ngẫu nhiên mật mã của Node (crypto),
// không lệch do làm tròn và không đoán trước được như Math.random.
const randInt = (n) => crypto.randomInt(n);
// Xào bài Fisher–Yates: mọi cách xếp trong 52! cách đều có xác suất như nhau
function newDeck() {
  const deck = [];
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push({ r, s });
  for (let i = deck.length - 1; i > 0; i--) { const j = randInt(i + 1); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return deck;
}
// Chia lần lượt từng lá theo vòng như chia bài thật (mỗi người một lá rồi vòng lại)
function dealRound(deck, ids, n) {
  const hands = Object.fromEntries(ids.map((id) => [id, []]));
  for (let k = 0; k < n; k++) for (const id of ids) hands[id].push(deck.shift());
  return hands;
}
const systemChat = (room, text) => io.to(room).emit("chat", { system: true, text });

// ===== Bàn chơi dùng chung =====
// Mỗi phòng game là một bàn 6 ghế. Người ngồi sớm nhất làm chủ bàn (cái).
// Game không giữ tiền của ai: chỉ chia bài / lắc xúc xắc, tính điểm và ghi lại thắng thua so với cái.
const SEATS = 6; // số ghế mặc định; Tiến Lên 4 ghế, Caro 2 ghế (seatCount của từng game)
const tables = {};

function members(room) {
  return Object.entries(players).filter(([, p]) => p.room === room);
}
function seated(t) {
  return t.seats.filter(Boolean);
}
function updateHost(t) {
  const list = seated(t).sort((a, b) => players[a].seatSince - players[b].seatSince);
  const old = t.hostId;
  t.hostId = list[0] || null;
  if (t.hostId && old && old !== t.hostId) systemChat(t.room, `${players[t.hostId].name} làm chủ bàn`);
}
function standUp(t, id) {
  const i = t.seats.indexOf(id);
  if (i < 0) return;
  t.seats[i] = null;
  t.game.onStand(t, id);
  updateHost(t);
}
function sendTable(t) {
  const now = Date.now();
  const ms = members(t.room);
  const watchers = ms.filter(([id]) => !t.seats.includes(id)).map(([, p]) => p.name);
  for (const [viewer] of ms) {
    const seats = t.seats.map((id) => {
      if (!id || !players[id]) return null;
      const p = players[id];
      return {
        name: p.name, look: p.look, color: p.color, mic: p.mic, speaking: p.mic && p.speaking,
        isHost: id === t.hostId, isMe: id === viewer,
        bubble: now < p.bubbleUntil ? p.bubble : null,
        ...t.game.seatView(t, id, viewer),
      };
    });
    io.to(viewer).emit("table", {
      game: t.room, seats, round: t.round, watchers, maxPlayers: t.seats.length,
      mySeat: t.seats.indexOf(viewer), isHost: viewer === t.hostId,
      ...t.game.view(t, viewer),
    });
  }
}
function needHost(t, id) {
  if (id !== t.hostId) return "Chỉ chủ bàn mới làm được việc này";
  if (seated(t).length < 2) return "Cần ít nhất 2 người ngồi vào bàn";
  return null;
}

// ===== Bầu Cua =====
// Cái bấm Lắc (xúc xắc nằm dưới bát), mọi người đặt cược, cái bấm Mở bát.
// Cược chỉ để ghi lại: ra 1 con được bằng tiền cược, 2 con gấp 2, 3 con gấp 3; không ra thì mất cược.
const FACES = ["bau", "cua", "tom", "ca", "ga", "nai"];
const CHIPS = [10, 50, 100, 500];
const baucua = {
  reset(t) { t.phase = "idle"; t.dice = null; t.bets = {}; t.results = {}; t.tally = {}; t.history = []; },
  onStand(t, id) {
    if (t.phase === "bet") delete t.bets[id];
    delete t.tally[id];
  },
  seatView(t, id) {
    const bet = Object.values(t.bets[id] || {}).reduce((a, b) => a + b, 0);
    return { bet, net: t.phase === "open" && id in t.results ? t.results[id] : null, tally: t.tally[id] || 0 };
  },
  view(t, viewer) {
    const totals = Object.fromEntries(FACES.map((f) => [f, 0]));
    for (const b of Object.values(t.bets)) for (const f in b) totals[f] += b[f];
    return { phase: t.phase, dice: t.phase === "open" ? t.dice : null, totals, myBets: t.bets[viewer] || {}, history: t.history, chips: CHIPS };
  },
  actions: {
    shake(t, id) {
      const err = needHost(t, id); if (err) return err;
      if (t.phase === "bet") return "Bát đang úp, hãy mở bát trước";
      t.dice = [0, 1, 2].map(() => FACES[randInt(6)]);
      t.phase = "bet"; t.bets = {}; t.results = {}; t.round++;
      systemChat(t.room, `🎲 ${players[id].name} đã lắc ván #${t.round}, mọi người đặt cược đi!`);
    },
    open(t, id) {
      if (id !== t.hostId) return "Chỉ chủ bàn mới được mở bát";
      if (t.phase !== "bet") return;
      let hostNet = 0;
      for (const [pid, bets] of Object.entries(t.bets)) {
        let net = 0;
        for (const f in bets) {
          const n = t.dice.filter((d) => d === f).length;
          net += n > 0 ? bets[f] * n : -bets[f];
        }
        t.results[pid] = net; hostNet -= net;
        t.tally[pid] = (t.tally[pid] || 0) + net;
      }
      t.results[id] = hostNet;
      t.tally[id] = (t.tally[id] || 0) + hostNet;
      t.phase = "open";
      t.history.unshift(t.dice);
      t.history = t.history.slice(0, 8);
    },
    bet(t, id, arg) {
      const { face, amount } = arg || {};
      if (!t.seats.includes(id)) return "Hãy ngồi vào bàn để đặt cược";
      if (id === t.hostId) return "Bạn đang làm cái";
      if (t.phase !== "bet") return "Chờ cái lắc xong mới đặt được";
      if (!FACES.includes(face) || !CHIPS.includes(amount)) return;
      const b = (t.bets[id] = t.bets[id] || {});
      if ((b[face] || 0) + amount > 100000) return "Cược tối đa 100000 mỗi ô";
      b[face] = (b[face] || 0) + amount;
    },
    clear(t, id) {
      if (t.phase === "bet") delete t.bets[id];
    },
  },
};

// ===== Bài Cào =====
// Cái chia mỗi người 3 lá úp, mỗi người tự nặn bài rồi lật cho cả bàn xem.
// Nút = tổng điểm lấy hàng đơn vị (A=1, 2-9 theo số, 10/J/Q/K=0). Ba Tây (3 lá J/Q/K) lớn nhất.
function bkScore(cards) {
  if (cards.every((c) => c.r >= 11)) return { value: 10, label: "Ba Tây" };
  const nut = cards.reduce((a, c) => a + (c.r >= 10 ? 0 : c.r), 0) % 10;
  return { value: nut, label: nut === 0 ? "Bù" : nut + " nút" };
}
const baicao = {
  reset(t) { t.dealt = false; t.hands = {}; t.revealed = {}; },
  onStand(t, id) {
    delete t.hands[id]; delete t.revealed[id];
    if (!Object.keys(t.hands).length) t.dealt = false;
  },
  seatView(t, id, viewer) {
    const hand = t.hands[id], open = !!t.revealed[id];
    const show = hand && (open || id === viewer);
    let vsHost = null;
    const h = t.hands[t.hostId];
    if (hand && open && h && t.revealed[t.hostId] && id !== t.hostId) {
      const a = bkScore(hand).value, b = bkScore(h).value;
      vsHost = a > b ? "win" : a < b ? "lose" : "push";
    }
    return { hasCards: !!hand, count: hand ? hand.length : 0, revealed: open, cards: show ? hand : null, score: show ? bkScore(hand) : null, vsHost };
  },
  view(t) { return { dealt: t.dealt }; },
  actions: {
    deal(t, id) {
      const err = needHost(t, id); if (err) return err;
      const deck = newDeck();
      t.hands = {}; t.revealed = {};
      t.hands = dealRound(deck, seated(t), 3);
      t.dealt = true; t.round++;
      systemChat(t.room, `🃏 ${players[id].name} đã chia bài ván #${t.round}`);
    },
    reveal(t, id) {
      if (t.hands[id]) t.revealed[id] = true;
    },
  },
};

// ===== Xì Dách =====
// Cái chia mỗi người 2 lá. Mỗi người rút thêm (tối đa 5 lá) hoặc dằn khi đủ 16 điểm.
// A tính 11/10/1 khi có 2 lá, 10/1 khi 3 lá, 1 khi từ 4 lá. J/Q/K tính 10.
// Xì Bàng (2 lá A) > Xì Dách (A + 10/J/Q/K) > Ngũ Linh (5 lá không quá 21) > điểm thường.
// Quá 21 là Quắc (thua, trừ khi cái cũng quắc thì hòa). Cái cần ít nhất 15 điểm mới được lật bài.
// Tới lượt cái: cái có thể xét (lật) từng người để chốt kết quả với bài cái lúc đó, rồi rút thêm và xét tiếp.
// Bài và kết quả của người bị xét chỉ cái và người đó thấy; cả bàn chỉ thấy khi lật hết.
function xdScore(cards) {
  const n = cards.length;
  const aces = cards.filter((c) => c.r === 1).length;
  if (n === 2 && aces === 2) return { kind: "special", rank: 100, label: "Xì Bàng" };
  if (n === 2 && aces === 1 && cards.some((c) => c.r >= 10)) return { kind: "special", rank: 90, label: "Xì Dách" };
  const base = cards.reduce((a, c) => a + (c.r === 1 ? 0 : Math.min(c.r, 10)), 0);
  const opts = n <= 2 ? [11, 10, 1] : n === 3 ? [10, 1] : [1];
  // Chọn cách tính A cho điểm cao nhất không quá 21 (nếu không được thì lấy điểm thấp nhất)
  let best = null;
  const walk = (k, sum) => {
    if (k === aces) {
      const better = best === null || (sum <= 21 ? best > 21 || sum > best : best > 21 && sum < best);
      if (better) best = sum;
      return;
    }
    for (const o of opts) walk(k + 1, sum + o);
  };
  walk(0, base);
  if (best > 21) return { kind: "bust", rank: -1, total: best, label: `Quắc (${best})` };
  if (n === 5) return { kind: "five", rank: 80, total: best, label: "Ngũ Linh" };
  return { kind: "normal", rank: best, total: best, label: best + " điểm" };
}
function xdCompare(p, h) {
  if (p.kind === "bust") return h.kind === "bust" ? "push" : "lose";
  if (h.kind === "bust") return "win";
  if (p.kind === "normal" && p.total < 16) return "lose"; // non tuổi
  return p.rank > h.rank ? "win" : p.rank < h.rank ? "lose" : "push";
}
const XD_TURN_TIME = 60000; // mỗi lượt 60 giây, hết giờ tự dằn
const XD_DEAL_TIME = 4000; // thời gian hiệu ứng chia bài bên giao diện
// Lượt đi theo vòng ghế, bắt đầu từ người ngồi sau cái; cái đi cuối cùng
function xdNextTurn(t) {
  const hostSeat = t.seats.indexOf(t.hostId);
  let next = null;
  for (let k = 1; k <= t.seats.length; k++) {
    const id = t.seats[(hostSeat + k) % t.seats.length];
    if (id && id !== t.hostId && t.hands[id] && !t.done[id]) { next = id; break; }
  }
  if (!next && t.hostId && t.hands[t.hostId]) next = t.hostId;
  t.turn = next;
  t.turnEnds = Date.now() + XD_TURN_TIME;
  if (!next) xdRevealAll(t);
}
function xdRevealAll(t) {
  t.revealed = true; t.turn = null;
}
// Ai được xem bài của người này: cả bàn khi đã lật; khi mới bị xét thì chỉ cái và chính người đó
function xdCanSee(t, id, viewer) {
  if (t.revealed || t.shown[id] || id === viewer) return true;
  if (t.checked[id] && viewer === t.hostId) return true;
  if (id === t.hostId && t.checked[viewer]) return true; // người bị xét được xem bài cái
  return false;
}
// Kết quả so với cái: người đã bị xét giữ kết quả lúc xét, người còn lại so khi lật cả bàn
function xdResult(t, id) {
  if (t.checked[id]) return t.checked[id];
  if (t.revealed && id !== t.hostId && t.hands[id] && t.hands[t.hostId]) return xdCompare(xdScore(t.hands[id]), xdScore(t.hands[t.hostId]));
  return null;
}
function xdHostCanOpen(t) {
  const sc = xdScore(t.hands[t.hostId]);
  return !(sc.kind === "normal" && sc.total < 15);
}
const xidach = {
  reset(t) { t.dealt = false; t.hands = {}; t.done = {}; t.shown = {}; t.checked = {}; t.revealed = false; t.deck = []; t.turn = null; t.turnEnds = 0; },
  onStand(t, id) {
    delete t.hands[id]; delete t.done[id]; delete t.shown[id]; delete t.checked[id];
    if (!Object.keys(t.hands).length) { t.dealt = false; t.turn = null; }
  },
  // Gọi mỗi 0,5 giây: hết giờ thì tự dằn, người đang tới lượt rời bàn thì chuyển lượt
  tick(t) {
    if (!t.dealt || t.revealed) return;
    const p = players[t.turn];
    if (!t.turn || !p || !t.hands[t.turn] || !t.seats.includes(t.turn)) return xdNextTurn(t);
    if (Date.now() < t.turnEnds) return;
    if (t.turn === t.hostId) {
      systemChat(t.room, `⏰ ${p.name} hết giờ, tự động lật cả bàn`);
      xdRevealAll(t);
    } else {
      systemChat(t.room, `⏰ ${p.name} hết giờ, tự động dằn bài`);
      t.done[t.turn] = true;
      xdNextTurn(t);
    }
  },
  seatView(t, id, viewer) {
    const hand = t.hands[id];
    const see = !!(hand && xdCanSee(t, id, viewer));
    // Lá bài trước ghế lật ngửa khi người xem được thấy (bài của chính mình chỉ ngửa khi đã lật / bị xét)
    const open = see && (id !== viewer || t.revealed || !!t.shown[id] || !!t.checked[id]);
    const show = see;
    const canResult = t.revealed || (t.checked[id] && (viewer === id || viewer === t.hostId));
    const vsHost = hand && canResult ? xdResult(t, id) : null;
    return {
      checked: !!t.checked[id],
      canCheck: !t.revealed && t.turn === t.hostId && viewer === t.hostId && id !== t.hostId && !!hand && !t.checked[id],
      hasCards: !!hand, count: hand ? hand.length : 0, done: !!t.done[id], revealed: open,
      cards: show ? hand : null, score: show ? xdScore(hand) : null, vsHost,
      isTurn: !t.revealed && t.turn === id,
    };
  },
  view(t, viewer) {
    return {
      dealt: t.dealt, revealed: t.revealed,
      myTurn: !t.revealed && t.turn === viewer,
      turnName: t.turn && players[t.turn] ? players[t.turn].name : "",
      turnRemain: t.turn && !t.revealed ? Math.max(0, t.turnEnds - Date.now()) : 0,
      turnTime: XD_TURN_TIME,
    };
  },
  actions: {
    deal(t, id) {
      const err = needHost(t, id); if (err) return err;
      t.deck = newDeck();
      t.hands = {}; t.done = {}; t.shown = {}; t.checked = {}; t.revealed = false;
      t.hands = dealRound(t.deck, seated(t), 2);
      t.dealt = true; t.round++;
      systemChat(t.room, `♠️ ${players[id].name} đã chia bài ván #${t.round}`);
      // Xì Bàng / Xì Dách lật ngay; cái có Xì Bàng / Xì Dách thì lật cả bàn
      for (const pid of seated(t)) {
        const sc = xdScore(t.hands[pid]);
        if (sc.kind === "special") {
          t.shown[pid] = t.done[pid] = true;
          systemChat(t.room, `✨ ${players[pid].name} có ${sc.label}!`);
        }
      }
      if (t.shown[id]) xdRevealAll(t);
      else { xdNextTurn(t); t.turnEnds += XD_DEAL_TIME; } // chưa tính giờ trong lúc đang chia bài
    },
    hit(t, id) {
      const hand = t.hands[id];
      if (!hand || t.revealed) return;
      if (t.turn !== id) return "Chưa tới lượt của bạn";
      if (hand.length >= 5) return "Tối đa 5 lá";
      hand.push(t.deck.shift());
      const sc = xdScore(hand);
      if (id === t.hostId) t.turnEnds = Date.now() + XD_TURN_TIME;
      if (sc.kind === "bust" || hand.length === 5) {
        if (id === t.hostId) xdRevealAll(t); // cái quắc hoặc đủ 5 lá thì lật luôn
        else { t.done[id] = true; xdNextTurn(t); }
      }
    },
    stay(t, id) {
      const hand = t.hands[id];
      if (!hand || t.revealed || id === t.hostId) return;
      if (t.turn !== id) return "Chưa tới lượt của bạn";
      const sc = xdScore(hand);
      if (sc.kind === "normal" && sc.total < 16) return "Chưa đủ tuổi, cần ít nhất 16 điểm mới được dằn";
      t.done[id] = true;
      xdNextTurn(t);
    },
    reveal(t, id) {
      if (id !== t.hostId) return "Chỉ chủ bàn mới được lật cả bàn";
      if (!t.dealt || t.revealed || !t.hands[id]) return;
      if (t.turn !== id) return "Chờ mọi người rút xong mới tới lượt cái";
      if (!xdHostCanOpen(t)) return "Cái cần ít nhất 15 điểm mới được lật bài";
      xdRevealAll(t);
    },
    // Cái xét bài một người (arg = số ghế)
    check(t, id, seat) {
      if (id !== t.hostId) return "Chỉ cái mới được xét bài";
      if (!t.dealt || t.revealed) return;
      if (t.turn !== id) return "Chờ mọi người rút xong mới tới lượt cái";
      const target = t.seats[Number(seat)];
      if (!target || target === id || !t.hands[target] || t.checked[target]) return;
      if (!xdHostCanOpen(t)) return "Cái cần ít nhất 15 điểm mới được xét bài";
      const res = xdCompare(xdScore(t.hands[target]), xdScore(t.hands[id]));
      t.checked[target] = res;
      const word = { win: "hơn cái", lose: "kém cái", push: "hòa cái" }[res];
      // Cả bàn chỉ biết là đã xét; kết quả gửi riêng cho cái và người bị xét
      for (const pid of members(t.room).map(([pid]) => pid)) {
        const priv = pid === id || pid === target;
        io.to(pid).emit("chat", { system: true, text: priv
          ? `🔍 Cái xét bài ${players[target].name}: ${xdScore(t.hands[target]).label} so với cái ${xdScore(t.hands[id]).label}, ${word} (chỉ hai người thấy)`
          : `🔍 Cái đã xét bài ${players[target].name}` });
      }
      t.turnEnds = Date.now() + XD_TURN_TIME; // xét xong được thêm thời gian
      // Xét hết mọi người thì kết thúc ván
      if (seated(t).every((pid) => pid === id || !t.hands[pid] || t.checked[pid])) xdRevealAll(t);
    },
  },
};

// ===== Tiến Lên Miền Nam =====
// 2-4 người, mỗi người 13 lá. Thứ tự: 3 < 4 < ... < K < A < 2; chất: ♠ < ♣ < ♦ < ♥.
// Bộ: rác, đôi, sám cô, tứ quý, sảnh (≥3 lá liên tiếp, không có 2), đôi thông (≥3 đôi liên tiếp).
// Chặt: 3 đôi thông chặt heo; tứ quý chặt heo, đôi heo, 3 đôi thông; 4 đôi thông chặt heo, đôi heo, tứ quý, 3 đôi thông.
// Bỏ lượt thì chờ vòng sau; mọi người khác bỏ hết thì người đánh cuối được đánh tự do. Ai hết bài trước về nhất.
const TL_TURN_TIME = 30000;
const TL_DEAL_TIME = 5000; // thời gian hiệu ứng chia bài bên giao diện
const tlRank = (r) => (r === 1 ? 12 : r === 2 ? 13 : r - 2); // 3..K = 1..11, A = 12, 2 = 13
const tlVal = (c) => tlRank(c.r) * 4 + c.s;
const tlSort = (cards) => [...cards].sort((a, b) => tlVal(a) - tlVal(b));
function tlCombo(cards) {
  const cs = tlSort(cards);
  const n = cs.length, rk = cs.map((c) => tlRank(c.r)), high = tlVal(cs[n - 1]);
  const same = rk.every((r) => r === rk[0]);
  if (n === 1) return { type: "single", n, high, label: "Rác" };
  if (same && n === 2) return { type: "pair", n, high, label: "Đôi" };
  if (same && n === 3) return { type: "triple", n, high, label: "Sám cô" };
  if (same && n === 4) return { type: "quad", n, high, label: "Tứ quý" };
  const noTwo = rk[n - 1] < 13;
  if (n >= 3 && noTwo && rk.every((r, i) => i === 0 || r === rk[i - 1] + 1)) return { type: "straight", n, high, label: `Sảnh ${n} lá` };
  if (n >= 6 && n % 2 === 0 && noTwo) {
    let ok = true;
    for (let i = 0; i < n; i += 2) if (rk[i] !== rk[i + 1] || (i > 0 && rk[i] !== rk[i - 2] + 1)) ok = false;
    if (ok) return { type: "pairs", n, high, label: `${n / 2} đôi thông` };
  }
  return null;
}
function tlBeats(a, b) {
  if (!b) return true;
  if (a.type === b.type && a.n === b.n) return a.high > b.high;
  const heo = (x) => x.type === "single" && x.high >= 52, doiHeo = (x) => x.type === "pair" && x.high >= 52;
  const dt = (x, k) => x.type === "pairs" && x.n === k * 2;
  if (heo(b)) return dt(a, 3) || dt(a, 4) || a.type === "quad";
  if (doiHeo(b)) return a.type === "quad" || dt(a, 4);
  if (dt(b, 3)) return a.type === "quad" || dt(a, 4);
  if (b.type === "quad") return dt(a, 4);
  return false;
}
function tlSetTurn(t, id) { t.turn = id; t.turnSeat = t.seats.indexOf(id); t.turnEnds = Date.now() + TL_TURN_TIME; }
// Người kế tiếp theo vòng ghế, bỏ qua người đã bỏ lượt; vòng về tới người đánh cuối thì người đó đánh tự do
function tlNextTurn(t) {
  for (let k = 1; k <= t.seats.length; k++) {
    const id = t.seats[(t.turnSeat + k) % t.seats.length];
    if (!id || !t.order.includes(id)) continue;
    if (t.current && id === t.current.by) { t.current = null; t.passed = {}; return tlSetTurn(t, id); }
    if (!t.passed[id]) return tlSetTurn(t, id);
  }
}
function tlEnd(t, winner) {
  t.phase = "end"; t.winner = winner; t.lastWinner = winner; t.turn = null;
  if (winner && players[winner]) systemChat(t.room, `🏆 ${players[winner].name} về nhất!`);
}
function tlPlay(t, id, cards) {
  const combo = tlCombo(cards);
  if (!combo) return "Bộ bài này không hợp lệ";
  if (!tlBeats(combo, t.current && t.current.combo)) return "Bài này không chặn được";
  const chop = t.current && combo.type !== t.current.combo.type;
  t.hands[id] = t.hands[id].filter((c) => !cards.includes(c));
  if (chop) systemChat(t.room, `💥 ${players[id].name} chặt bằng ${combo.label}!`);
  t.current = { cards: tlSort(cards), combo, by: id, chop: !!chop };
  if (!t.hands[id].length) return tlEnd(t, id);
  tlNextTurn(t);
}
const tienlen = {
  maxPlayers: 4,
  seatCount: 4, // bộ bài 52 lá chỉ đủ chia 13 lá cho 4 người
  reset(t) { t.phase = "idle"; t.hands = {}; t.order = []; t.turn = null; t.turnSeat = 0; t.turnEnds = 0; t.current = null; t.passed = {}; t.winner = null; t.lastWinner = null; },
  onStand(t, id) {
    const playing = t.phase === "play" && t.order.includes(id);
    delete t.hands[id];
    if (!playing) return;
    t.order = t.order.filter((x) => x !== id);
    if (t.order.length < 2) return tlEnd(t, t.order[0] || null);
    if (t.current && t.current.by === id) { t.current = null; t.passed = {}; }
    if (t.turn === id) tlNextTurn(t);
  },
  // Hết giờ: đang được đánh tự do thì tự đánh lá nhỏ nhất, còn lại thì tự bỏ lượt
  tick(t) {
    if (t.phase !== "play" || !t.turn || Date.now() < t.turnEnds) return;
    const id = t.turn;
    if (!t.current) { systemChat(t.room, `⏰ ${players[id].name} hết giờ, tự đánh lá nhỏ nhất`); tlPlay(t, id, [t.hands[id][0]]); }
    else { systemChat(t.room, `⏰ ${players[id].name} hết giờ, tự bỏ lượt`); t.passed[id] = true; tlNextTurn(t); }
  },
  seatView(t, id, viewer) {
    const hand = t.hands[id];
    return {
      hasCards: !!(hand && hand.length), count: hand ? hand.length : 0,
      passed: t.phase === "play" && !!t.passed[id], isTurn: t.phase === "play" && t.turn === id, winner: t.winner === id,
      cards: hand && (id === viewer || t.phase === "end") ? hand : null,
    };
  },
  view(t, viewer) {
    return {
      phase: t.phase, dealt: t.phase !== "idle",
      current: t.current ? { cards: t.current.cards, label: t.current.combo.label, by: players[t.current.by] ? players[t.current.by].name : "", seat: t.seats.indexOf(t.current.by), chop: t.current.chop } : null,
      myTurn: t.phase === "play" && t.turn === viewer, lead: !t.current,
      turnName: t.turn && players[t.turn] ? players[t.turn].name : "",
      turnRemain: t.phase === "play" ? Math.max(0, t.turnEnds - Date.now()) : 0, turnTime: TL_TURN_TIME,
      winnerName: t.winner && players[t.winner] ? players[t.winner].name : "",
    };
  },
  actions: {
    deal(t, id) {
      const err = needHost(t, id); if (err) return err;
      if (t.phase === "play") return "Ván đang chơi";
      const ids = t.seats.filter(Boolean).slice(0, 4);
      const deck = newDeck();
      t.hands = {};
      t.hands = dealRound(deck, ids, 13);
      for (const pid of ids) t.hands[pid] = tlSort(t.hands[pid]);
      t.order = ids; t.phase = "play"; t.current = null; t.passed = {}; t.winner = null; t.round++;
      // Ván đầu: người có lá nhỏ nhất đi trước; các ván sau: người thắng ván trước đi trước
      const first = t.lastWinner && ids.includes(t.lastWinner) ? t.lastWinner : ids.reduce((a, b) => (tlVal(t.hands[a][0]) < tlVal(t.hands[b][0]) ? a : b));
      tlSetTurn(t, first);
      t.turnEnds += TL_DEAL_TIME;
      systemChat(t.room, `🎴 ${players[id].name} đã chia bài ván #${t.round}, ${players[first].name} đi trước`);
    },
    play(t, id, keys) {
      if (t.phase !== "play") return;
      if (t.turn !== id) return "Chưa tới lượt của bạn";
      if (!Array.isArray(keys) || !keys.length) return "Hãy chạm vào lá bài để chọn rồi bấm Đánh";
      const cards = [];
      for (const k of keys) {
        const c = t.hands[id].find((c) => `${c.r}-${c.s}` === k);
        if (!c || cards.includes(c)) return "Bài không hợp lệ";
        cards.push(c);
      }
      return tlPlay(t, id, cards);
    },
    pass(t, id) {
      if (t.phase !== "play" || t.turn !== id) return;
      if (!t.current) return "Bạn đang được đánh tự do, hãy chọn bài để đánh";
      t.passed[id] = true;
      tlNextTurn(t);
    },
  },
};

// ===== Cờ Caro =====
// 2 người, bàn 15x15, ai có 5 quân liền hàng (ngang, dọc, chéo) trước thì thắng. Ván sau đổi người đi trước.
const CARO_N = 15;
function caroWin(b, i) {
  const v = b[i], r0 = Math.floor(i / CARO_N), c0 = i % CARO_N;
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const line = [i];
    for (const sgn of [1, -1]) {
      let r = r0 + dr * sgn, c = c0 + dc * sgn;
      while (r >= 0 && r < CARO_N && c >= 0 && c < CARO_N && b[r * CARO_N + c] === v) { line.push(r * CARO_N + c); r += dr * sgn; c += dc * sgn; }
    }
    if (line.length >= 5) return line;
  }
  return null;
}
const caro = {
  maxPlayers: 2,
  seatCount: 2,
  reset(t) { t.board = Array(CARO_N * CARO_N).fill(0); t.phase = "idle"; t.xId = null; t.oId = null; t.turn = null; t.winner = null; t.winLine = null; t.last = -1; t.starter = null; t.draw = false; },
  onStand(t, id) {
    if (t.phase === "play" && (id === t.xId || id === t.oId)) {
      t.phase = "end"; t.winner = id === t.xId ? t.oId : t.xId; t.turn = null;
      systemChat(t.room, `🏳️ ${players[id].name} rời bàn, ${players[t.winner] ? players[t.winner].name : "đối thủ"} thắng`);
    }
  },
  seatView() { return {}; },
  view(t, viewer) {
    const nm = (id) => (id && players[id] ? players[id].name : "");
    return {
      phase: t.phase, board: t.board, n: CARO_N, last: t.last, winLine: t.winLine, draw: t.draw,
      xName: nm(t.xId), oName: nm(t.oId), mySide: viewer === t.xId ? 1 : viewer === t.oId ? 2 : 0,
      myTurn: t.phase === "play" && t.turn === viewer, turnName: nm(t.turn), winnerName: nm(t.winner),
    };
  },
  actions: {
    start(t, id) {
      const err = needHost(t, id); if (err) return err;
      if (t.phase === "play") return "Ván đang chơi";
      const ps = seated(t).slice(0, 2);
      const first = ps.find((p) => p !== t.starter) || ps[0];
      t.xId = first; t.oId = ps.find((p) => p !== first); t.starter = first;
      t.board = Array(CARO_N * CARO_N).fill(0); t.phase = "play"; t.turn = first; t.winner = null; t.winLine = null; t.last = -1; t.draw = false; t.round++;
      systemChat(t.room, `⭕ Ván #${t.round}: ${players[t.xId].name} (✕) đi trước, ${players[t.oId].name} (◯)`);
    },
    move(t, id, i) {
      i = Number(i);
      if (t.phase !== "play") return;
      if (t.turn !== id) return "Chưa tới lượt của bạn";
      if (!(i >= 0 && i < CARO_N * CARO_N) || t.board[i]) return;
      t.board[i] = id === t.xId ? 1 : 2; t.last = i;
      const line = caroWin(t.board, i);
      if (line) { t.phase = "end"; t.winner = id; t.winLine = line; t.turn = null; systemChat(t.room, `🏆 ${players[id].name} thắng ván caro!`); return; }
      if (t.board.every(Boolean)) { t.phase = "end"; t.draw = true; t.turn = null; return; }
      t.turn = id === t.xId ? t.oId : t.xId;
    },
  },
};

for (const [room, game] of Object.entries({ baucua, baicao, xidach, tienlen, caro })) {
  tables[room] = { room, game, seats: Array(game.seatCount || SEATS).fill(null), hostId: null, round: 0 };
  game.reset(tables[room]);
}
setInterval(() => {
  for (const t of Object.values(tables)) {
    if (t.game.tick) t.game.tick(t);
    sendTable(t);
  }
}, 500);

// ===== Nhóm nói chuyện bằng mic =====
// Trong phòng game: cả phòng nghe nhau. Ở sảnh: chỉ những người ngồi chung một ghế.
// Đứng ở sảnh thì không có mic (đang bật sẽ tự tắt).
function voiceGroupOf(p) {
  if (!WORLDS[p.room]) return "room:" + p.room;
  if (p.pose === "sit" && p.spot !== null) return p.room + ":" + WORLDS[p.room].seats[p.spot].group;
  return null;
}
function groupMembers(g) {
  return g ? Object.entries(players).filter(([, q]) => q.vgroup === g) : [];
}
function leaveVoiceGroup(id, p) {
  for (const [pid] of groupMembers(p.vgroup)) io.to(pid).emit("voice:left", id); // gồm cả chính mình
  p.vgroup = null; p.speaking = false;
}
// Gọi sau mỗi lần vào/ra phòng, ngồi/đứng: chuyển người chơi sang nhóm mới nếu cần
function updateVoice(id) {
  const p = players[id];
  if (!p) return;
  const g = voiceGroupOf(p);
  if (g === p.vgroup) return;
  leaveVoiceGroup(id, p);
  p.vgroup = g;
  if (!g && p.mic) { p.mic = false; io.to(id).emit("voice:forceOff", "Mic đã tắt vì bạn đứng dậy khỏi ghế"); }
  io.to(id).emit("voice:can", !!g);
  if (!g) return;
  for (const [pid, q] of groupMembers(g)) if (pid !== id && q.mic) io.to(pid).emit("voice:newPeer", id);
  if (p.mic) io.to(id).emit("voice:peers", groupMembers(g).map(([pid]) => pid).filter((pid) => pid !== id));
}

// ===== Kết nối =====
io.on("connection", (s) => {
  // Kiểm tra mã skin ở màn đăng nhập (trước khi vào game)
  s.on("skin:check", (code, cb) => {
    if (typeof cb !== "function") return;
    if ((s.data.codeTries || 0) >= MAX_CODE_TRIES) return cb({ ok: false, msg: "Nhập sai quá nhiều lần, hãy tải lại trang" });
    const ok = checkSkinCode(s, code);
    if (ok) s.data.skinOk = true;
    cb(ok ? { ok: true, costume: "kid" } : { ok: false, msg: "Mã skin không đúng" });
  });

  s.on("join", (name, look, opts, cb) => {
    if (typeof opts === "function") { cb = opts; opts = {}; }
    if (players[s.id]) return;
    const costume = s.data.skinOk || checkSkinCode(s, opts && opts.skinCode) ? "kid" : null;
    players[s.id] = {
      name: sanitizeName(name),
      look: costume ? { ...sanitizeLook(look), costume } : sanitizeLook(look),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      x: 600 + (Math.random() * 240 - 120),
      y: 735 + (Math.random() * 30 - 15),
      dx: 0, dy: 0,
      room: "lobby",
      bubble: null, bubbleUntil: 0,
      mic: false, speaking: false,
      pose: null, spot: null, emote: null, emoteAt: 0,
      vgroup: null,
    };
    s.join("lobby");
    if (typeof cb === "function") cb({ id: s.id, costume, map: MAP, doors: DOORS, faces: FACES, radius: R, httpsPort: HTTPS_PORT, worlds: WORLDS });
    systemChat("lobby", `${players[s.id].name} đã vào sảnh`);
  });

  s.on("input", (inp) => {
    const p = players[s.id];
    if (!p || !inp) return;
    let dx = Number(inp.dx) || 0, dy = Number(inp.dy) || 0;
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    p.dx = dx; p.dy = dy;
    // Đi lại thì đứng dậy và dừng các hành động kéo dài
    if (dx || dy) {
      leaveBench(p);
      updateVoice(s.id);
      if (p.emote === "sleep" || p.emote === "dance" || p.emote === "wave") p.emote = null;
    }
  });

  // Ngồi xuống ghế gần nhất còn trống (want: chỗ ngồi người chơi đã chạm vào, nếu có)
  s.on("sit", (want) => {
    const p = players[s.id];
    const W = p && WORLDS[p.room];
    if (!W || p.pose === "sit") return;
    const taken = new Set(Object.values(players).filter((q) => q.pose === "sit" && q.room === p.room).map((q) => q.spot));
    let best = -1, bestD = 110;
    W.seats.forEach((sp, i) => {
      const d = Math.hypot(sp.x - p.x, sp.y - p.y) - (i === Number(want) ? 60 : 0);
      if (!taken.has(i) && d < bestD) { best = i; bestD = d; }
    });
    if (best < 0) return s.emit("toast", "Hãy lại gần một chỗ ngồi còn trống");
    p.pose = "sit"; p.spot = best; p.dx = p.dy = 0;
    p.x = W.seats[best].x; p.y = W.seats[best].y;
    updateVoice(s.id);
  });

  // Vuốt mèo ở quán Cafe Mèo: cả quán thấy mèo kêu
  s.on("pet", (i) => {
    const p = players[s.id];
    i = Number(i);
    if (!p || p.room !== "cafe" || !(i >= 0 && i < CATS.length) || Date.now() - (p.lastPet || 0) < 800) return;
    p.lastPet = Date.now();
    io.to("cafe").emit("catPet", { i, name: p.name });
  });

  // Hành động / biểu cảm
  s.on("emote", (type) => {
    const p = players[s.id];
    if (!p || !WORLDS[p.room] || !Object.prototype.hasOwnProperty.call(EMOTES, type)) return;
    p.emote = type; p.emoteAt = Date.now();
  });

  s.on("chat", (text) => {
    const p = players[s.id];
    if (!p) return;
    text = String(text || "").trim().slice(0, 120);
    if (!text) return;
    p.bubble = text; p.bubbleUntil = Date.now() + 4000;
    io.to(p.room).emit("chat", { name: p.name, color: p.color, text });
  });

  s.on("enter", (doorId) => {
    const p = players[s.id];
    const d = DOORS.find((d) => d.id === doorId);
    if (!p || !d || p.room !== "lobby" || !nearDoor(p, d)) return;
    if (!d.open) return s.emit("toast", `${d.name} sắp ra mắt 🚧`);
    leaveBench(p); p.emote = null;
    s.leave("lobby"); s.join(d.id);
    p.room = d.id; p.dx = p.dy = 0;
    updateVoice(s.id);
    s.emit("roomChanged", d.id);
    systemChat(d.id, `${p.name} vào phòng ${d.name}`);
    if (tables[d.id]) sendTable(tables[d.id]);
  });

  s.on("leaveRoom", () => {
    const p = players[s.id];
    if (!p || WORLDS[p.room]) return; // chỉ rời phòng game, không áp dụng cho Sảnh / Cafe
    const d = DOORS.find((d) => d.id === p.room);
    const t = tables[p.room];
    if (t) standUp(t, s.id);
    s.leave(p.room); s.join("lobby");
    p.room = "lobby";
    updateVoice(s.id);
    if (t) sendTable(t);
    if (d) { p.x = d.x + d.w / 2; p.y = d.y + d.h + 60; }
    s.emit("roomChanged", "lobby");
  });

  s.on("sit", (i) => {
    const p = players[s.id];
    const t = p && tables[p.room];
    i = Number(i);
    if (!t || !(i >= 0 && i < t.seats.length) || t.seats[i]) return;
    if (t.game.maxPlayers && !t.seats.includes(s.id) && seated(t).length >= t.game.maxPlayers) return s.emit("toast", `Bàn này tối đa ${t.game.maxPlayers} người chơi`);
    if (t.seats.includes(s.id)) {
      if (t.hands && t.hands[s.id]) return s.emit("toast", "Đang có bài, không đổi ghế được");
      t.seats[t.seats.indexOf(s.id)] = null;
    } else p.seatSince = Date.now();
    t.seats[i] = s.id;
    updateHost(t);
    sendTable(t);
  });

  s.on("stand", () => {
    const p = players[s.id];
    const t = p && tables[p.room];
    if (!t) return;
    standUp(t, s.id);
    sendTable(t);
  });

  // Hành động trong game: chia bài, lắc, đặt cược, rút bài...
  s.on("act", (action, arg) => {
    const p = players[s.id];
    const t = p && tables[p.room];
    const fn = t && Object.prototype.hasOwnProperty.call(t.game.actions, action) && t.game.actions[action];
    if (!fn) return;
    const err = fn(t, s.id, arg);
    if (err) s.emit("toast", err);
    sendTable(t);
  });

  // ===== Nói chuyện bằng mic (WebRTC, server chỉ chuyển tín hiệu kết nối) =====
  s.on("voice:mic", (on, cb) => {
    const p = players[s.id];
    if (!p) return;
    if (on && !p.vgroup) {
      if (typeof cb === "function") cb({ ok: false, msg: "Chỉ bật mic được trong phòng game hoặc khi ngồi ghế ở sảnh" });
      return;
    }
    p.mic = !!on; p.speaking = false;
    // Bật mic: trả về danh sách người cùng nhóm để gửi tiếng tới họ
    if (p.mic) s.emit("voice:peers", groupMembers(p.vgroup).map(([id]) => id).filter((id) => id !== s.id));
    else for (const [pid] of groupMembers(p.vgroup)) io.to(pid).emit("voice:stop", s.id);
    if (typeof cb === "function") cb({ ok: true });
    if (tables[p.room]) sendTable(tables[p.room]);
  });
  s.on("voice:speaking", (on) => {
    const p = players[s.id];
    if (!p || !p.mic || p.speaking === !!on) return;
    p.speaking = !!on;
    if (tables[p.room]) sendTable(tables[p.room]);
  });
  s.on("rtc", (msg) => {
    const p = players[s.id], q = msg && players[msg.to];
    if (!p || !q || !p.vgroup || p.vgroup !== q.vgroup) return; // chỉ nối mic trong cùng nhóm
    io.to(msg.to).emit("rtc", { ...msg, from: s.id });
  });

  s.on("disconnect", () => {
    const p = players[s.id];
    if (!p) return;
    const t = tables[p.room];
    if (t) standUp(t, s.id);
    leaveVoiceGroup(s.id, p);
    systemChat(p.room, `${p.name} đã thoát`);
    delete players[s.id];
    if (t) sendTable(t);
  });
});

// Đi qua cổng: chuyển sang bản đồ khác
function changeWorld(id, p, portal) {
  const sock = io.sockets.sockets.get(id);
  if (!sock) return;
  sock.leave(p.room); sock.join(portal.to);
  p.room = portal.to; p.x = portal.spawn.x; p.y = portal.spawn.y; p.dx = p.dy = 0; p.emote = null;
  updateVoice(id);
  sock.emit("roomChanged", portal.to);
  systemChat(portal.to, `${p.name} đã tới ${WORLDS[portal.to].name}`);
}

// ===== Vòng lặp di chuyển (30 lần/giây) =====
let last = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = (now - last) / 1000;
  last = now;
  const lists = Object.fromEntries(Object.keys(WORLDS).map((w) => [w, []]));
  const counts = Object.fromEntries(DOORS.map((d) => [d.id, 0]));
  for (const [id, p] of Object.entries(players)) {
    const W = WORLDS[p.room];
    if (!W) { if (counts[p.room] !== undefined) counts[p.room]++; continue; }
    if (p.pose !== "sit" && (p.dx || p.dy)) {
      const nx = Math.max(R, Math.min(MAP.w - R, p.x + p.dx * SPEED * dt));
      const ny = Math.max(R, Math.min(MAP.h - R, p.y + p.dy * SPEED * dt));
      // Bị vật cản thì thử trượt theo một trục
      if (!blocked(W, nx, ny)) { p.x = nx; p.y = ny; }
      else if (!blocked(W, nx, p.y)) p.x = nx;
      else if (!blocked(W, p.x, ny)) p.y = ny;
      const portal = W.portals.find((g) => p.x >= g.x1 && p.x <= g.x2 && p.y + R >= g.y1 && p.y + R <= g.y2);
      if (portal) { changeWorld(id, p, portal); continue; }
    }
    if (p.emote && now - p.emoteAt > EMOTES[p.emote]) p.emote = null;
    lists[p.room].push({
      id, name: p.name, color: p.color, look: p.look, mic: p.mic, speaking: p.mic && p.speaking,
      pose: p.pose, sitDir: p.pose === "sit" ? W.seats[p.spot].dir : null, emote: p.emote, emoteAge: p.emote ? now - p.emoteAt : 0,
      x: Math.round(p.x), y: Math.round(p.y),
      bubble: now < p.bubbleUntil ? p.bubble : null,
    });
  }
  const online = Object.keys(players).length;
  for (const w in lists) io.to(w).emit("state", { players: lists[w], counts, online });
}, 1000 / 30);

httpsServer.listen(HTTPS_PORT, "0.0.0.0");
server.listen(PORT, "0.0.0.0", () => {
  console.log("\n=== Game Sảnh đang chạy ===");
  console.log(`Trên máy này:      http://localhost:${PORT}`);
  for (const ip of lanIPs()) console.log(`Máy khác cùng wifi: http://${ip}:${PORT}`);
  console.log("\nMuốn dùng mic trên máy khác thì mở bằng https (lần đầu trình duyệt cảnh báo: bấm Nâng cao > Tiếp tục):");
  for (const ip of lanIPs()) console.log(`   https://${ip}:${HTTPS_PORT}`);
  console.log(`\nMã skin admin (Kaito Kid): ${ADMIN_CODE}   (đổi trong file admin-code.txt)`);
  console.log("\nNhấn Ctrl+C để tắt server.\n");
});
