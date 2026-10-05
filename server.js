// Server game sảnh 2D + các bàn chơi giữa người với người: Bầu Cua, Bài Cào, Xì Dách
// Chạy: npm install && npm start
const express = require("express");
const http = require("http");
const https = require("https");
const fs = require("fs");
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
  { id: "taixiu", name: "Tài Xỉu", icon: "🎲", x: 725, y: 40, w: 150, h: 210, color: "#8e44ad", open: false },
  { id: "caro", name: "Cờ Caro", icon: "⭕", x: 925, y: 40, w: 150, h: 210, color: "#2980b9", open: false },
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
// Mỗi ghế có 2 chỗ ngồi (tọa độ tâm nhân vật khi ngồi)
const BENCH_SPOTS = BENCHES.flatMap((b, bench) => [-28, 28].map((dx) => ({ x: b.x + dx, y: b.y - 8 - R, bench })));
const EMOTES = { wave: 3000, dance: 6000, heart: 3000, laugh: 3000, cry: 3000, sleep: Infinity };
// Không đi xuyên qua đài nước, gốc cây, ghế (xét theo vị trí bàn chân)
function blocked(x, y) {
  const fy = y + R;
  if (((x - FOUNTAIN.x) / (FOUNTAIN.rx + 20)) ** 2 + ((fy - FOUNTAIN.y) / (FOUNTAIN.ry + 18)) ** 2 < 1) return true; // tính cả thành hồ
  for (const t of TREES) if (Math.hypot(x - t.x, (fy - t.y) * 1.8) < 26) return true;
  for (const b of BENCHES) if (Math.abs(x - b.x) < 64 && fy > b.y - 18 && fy < b.y + 6) return true;
  return false;
}
function leaveBench(p) {
  if (p.pose !== "sit") return;
  const b = BENCHES[BENCH_SPOTS[p.spot].bench];
  p.pose = null; p.spot = null;
  p.y = b.y + 14; // đứng dậy ra phía trước ghế
}

const players = {}; // socketId -> player

function sanitizeName(n) {
  n = String(n || "").replace(/[<>]/g, "").trim().slice(0, 16);
  return n || "Khách" + Math.floor(Math.random() * 1000);
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
function newDeck() {
  const deck = [];
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push({ r, s });
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return deck;
}
const systemChat = (room, text) => io.to(room).emit("chat", { system: true, text });

// ===== Bàn chơi dùng chung =====
// Mỗi phòng game là một bàn 6 ghế. Người ngồi sớm nhất làm chủ bàn (cái).
// Game không giữ tiền của ai: chỉ chia bài / lắc xúc xắc, tính điểm và ghi lại thắng thua so với cái.
const SEATS = 6;
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
      game: t.room, seats, round: t.round, watchers,
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
      t.dice = [0, 1, 2].map(() => FACES[Math.floor(Math.random() * 6)]);
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
      for (const pid of seated(t)) t.hands[pid] = deck.splice(0, 3);
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
  for (let k = 1; k <= SEATS; k++) {
    const id = t.seats[(hostSeat + k) % SEATS];
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
      for (const pid of seated(t)) t.hands[pid] = t.deck.splice(0, 2);
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

for (const [room, game] of Object.entries({ baucua, baicao, xidach })) {
  tables[room] = { room, game, seats: Array(SEATS).fill(null), hostId: null, round: 0 };
  game.reset(tables[room]);
}
setInterval(() => {
  for (const t of Object.values(tables)) {
    if (t.game.tick) t.game.tick(t);
    sendTable(t);
  }
}, 500);

// Người bật mic trong phòng mới sẽ gửi tiếng tới người vừa vào; rời phòng thì ngắt kết nối giọng nói
function voiceEnterRoom(id, p) {
  for (const [pid, q] of members(p.room)) if (pid !== id && q.mic) io.to(pid).emit("voice:newPeer", id);
  if (p.mic) io.to(id).emit("voice:peers", members(p.room).map(([pid]) => pid).filter((pid) => pid !== id));
}
function voiceLeaveRoom(id, p) {
  io.to(p.room).emit("voice:left", id);
  p.speaking = false;
}

// ===== Kết nối =====
io.on("connection", (s) => {
  s.on("join", (name, look, cb) => {
    if (players[s.id]) return;
    players[s.id] = {
      name: sanitizeName(name),
      look: sanitizeLook(look),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      x: 600 + (Math.random() * 300 - 150),
      y: 735 + (Math.random() * 30 - 15),
      dx: 0, dy: 0,
      room: "lobby",
      bubble: null, bubbleUntil: 0,
      mic: false, speaking: false,
      pose: null, spot: null, emote: null, emoteAt: 0,
    };
    s.join("lobby");
    if (typeof cb === "function") cb({ id: s.id, map: MAP, doors: DOORS, faces: FACES, radius: R, httpsPort: HTTPS_PORT, decor: { fountain: FOUNTAIN, trees: TREES, benches: BENCHES } });
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
      if (p.emote === "sleep" || p.emote === "dance" || p.emote === "wave") p.emote = null;
    }
  });

  // Ngồi xuống ghế gần nhất còn trống
  s.on("sit", () => {
    const p = players[s.id];
    if (!p || p.room !== "lobby" || p.pose === "sit") return;
    const taken = new Set(Object.values(players).filter((q) => q.pose === "sit" && q.room === "lobby").map((q) => q.spot));
    let best = -1, bestD = 110;
    BENCH_SPOTS.forEach((sp, i) => {
      const d = Math.hypot(sp.x - p.x, sp.y - p.y);
      if (!taken.has(i) && d < bestD) { best = i; bestD = d; }
    });
    if (best < 0) return s.emit("toast", "Hãy lại gần một chiếc ghế còn trống để ngồi");
    p.pose = "sit"; p.spot = best; p.dx = p.dy = 0;
    p.x = BENCH_SPOTS[best].x; p.y = BENCH_SPOTS[best].y;
  });

  // Hành động / biểu cảm
  s.on("emote", (type) => {
    const p = players[s.id];
    if (!p || p.room !== "lobby" || !Object.prototype.hasOwnProperty.call(EMOTES, type)) return;
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
    voiceLeaveRoom(s.id, p);
    leaveBench(p); p.emote = null;
    s.leave("lobby"); s.join(d.id);
    p.room = d.id; p.dx = p.dy = 0;
    voiceEnterRoom(s.id, p);
    s.emit("roomChanged", d.id);
    systemChat(d.id, `${p.name} vào phòng ${d.name}`);
    if (tables[d.id]) sendTable(tables[d.id]);
  });

  s.on("leaveRoom", () => {
    const p = players[s.id];
    if (!p || p.room === "lobby") return;
    const d = DOORS.find((d) => d.id === p.room);
    const t = tables[p.room];
    if (t) standUp(t, s.id);
    voiceLeaveRoom(s.id, p);
    s.leave(p.room); s.join("lobby");
    p.room = "lobby";
    voiceEnterRoom(s.id, p);
    if (t) sendTable(t);
    if (d) { p.x = d.x + d.w / 2; p.y = d.y + d.h + 60; }
    s.emit("roomChanged", "lobby");
  });

  s.on("sit", (i) => {
    const p = players[s.id];
    const t = p && tables[p.room];
    i = Number(i);
    if (!t || !(i >= 0 && i < SEATS) || t.seats[i]) return;
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
  s.on("voice:mic", (on) => {
    const p = players[s.id];
    if (!p) return;
    p.mic = !!on; p.speaking = false;
    // Bật mic: trả về danh sách người cùng phòng để gửi tiếng tới họ
    if (p.mic) s.emit("voice:peers", members(p.room).map(([id]) => id).filter((id) => id !== s.id));
    else io.to(p.room).emit("voice:stop", s.id);
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
    if (!p || !q || p.room !== q.room) return;
    io.to(msg.to).emit("rtc", { ...msg, from: s.id });
  });

  s.on("disconnect", () => {
    const p = players[s.id];
    if (!p) return;
    const t = tables[p.room];
    if (t) standUp(t, s.id);
    voiceLeaveRoom(s.id, p);
    systemChat(p.room, `${p.name} đã thoát`);
    delete players[s.id];
    if (t) sendTable(t);
  });
});

// ===== Vòng lặp di chuyển (30 lần/giây) =====
let last = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = (now - last) / 1000;
  last = now;
  const lobby = [];
  const counts = Object.fromEntries(DOORS.map((d) => [d.id, 0]));
  for (const [id, p] of Object.entries(players)) {
    if (p.room !== "lobby") { if (counts[p.room] !== undefined) counts[p.room]++; continue; }
    if (p.pose !== "sit" && (p.dx || p.dy)) {
      const nx = Math.max(R, Math.min(MAP.w - R, p.x + p.dx * SPEED * dt));
      const ny = Math.max(R, Math.min(MAP.h - R, p.y + p.dy * SPEED * dt));
      // Bị vật cản thì thử trượt theo một trục
      if (!blocked(nx, ny)) { p.x = nx; p.y = ny; }
      else if (!blocked(nx, p.y)) p.x = nx;
      else if (!blocked(p.x, ny)) p.y = ny;
    }
    if (p.emote && now - p.emoteAt > EMOTES[p.emote]) p.emote = null;
    lobby.push({
      id, name: p.name, color: p.color, look: p.look, mic: p.mic, speaking: p.mic && p.speaking,
      pose: p.pose, emote: p.emote, emoteAge: p.emote ? now - p.emoteAt : 0,
      x: Math.round(p.x), y: Math.round(p.y),
      bubble: now < p.bubbleUntil ? p.bubble : null,
    });
  }
  io.to("lobby").emit("state", { players: lobby, counts });
}, 1000 / 30);

httpsServer.listen(HTTPS_PORT, "0.0.0.0");
server.listen(PORT, "0.0.0.0", () => {
  console.log("\n=== Game Sảnh đang chạy ===");
  console.log(`Trên máy này:      http://localhost:${PORT}`);
  for (const ip of lanIPs()) console.log(`Máy khác cùng wifi: http://${ip}:${PORT}`);
  console.log("\nMuốn dùng mic trên máy khác thì mở bằng https (lần đầu trình duyệt cảnh báo: bấm Nâng cao > Tiếp tục):");
  for (const ip of lanIPs()) console.log(`   https://${ip}:${HTTPS_PORT}`);
  console.log("\nNhấn Ctrl+C để tắt server.\n");
});
