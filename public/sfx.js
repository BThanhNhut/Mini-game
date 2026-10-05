// Hiệu ứng âm thanh (tự tổng hợp bằng Web Audio, không cần file): xào bài, chia bài, đánh bài, chặt,
// lật bài, lắc bát Bầu Cua, đặt quân Caro. Bật/tắt riêng bằng nút 🔊, lưu trên máy.
const Sfx = (() => {
  let ac = null, out = null, noise = null, on = true;
  try { on = localStorage.getItem("sfx") !== "off"; } catch (e) {}

  function ready() {
    if (!on || document.hidden) return false;
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      out = ac.createGain(); out.gain.value = 0.7; out.connect(ac.destination);
      noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === "suspended") ac.resume();
    return true;
  }
  // Một tiếng "xoẹt" bằng tiếng ồn qua bộ lọc, tắt rất nhanh
  function burst(delay, dur, type, freq, gain, q = 0.8) {
    const t = ac.currentTime + delay;
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 0.8); s.stop(t + dur + 0.02);
  }
  // Tiếng "bụp" trầm (mặt bàn)
  function thump(delay, from, to, dur, gain) {
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
  }

  return {
    // Gọi trong một thao tác của người dùng để trình duyệt cho phát âm thanh
    unlock() { ready(); },
    // Xào bài: chuỗi tiếng lá bài lướt nhanh (~1 giây)
    shuffle() {
      if (!ready()) return;
      for (let i = 0; i < 22; i++) burst(i * 0.042 + Math.random() * 0.012, 0.035, "bandpass", 3200 + Math.random() * 1500, 0.12);
      burst(0.95, 0.09, "lowpass", 900, 0.25); thump(0.95, 160, 70, 0.08, 0.15); // gõ xấp bài xuống bàn
    },
    // Chia một lá: tiếng "phạch" ngắn
    deal() {
      if (!ready()) return;
      burst(0, 0.06, "highpass", 2400 + Math.random() * 800, 0.22);
      burst(0.03, 0.05, "lowpass", 700, 0.08);
    },
    // Lật / nặn một lá
    flip() { if (ready()) { burst(0, 0.05, "bandpass", 2800, 0.18, 1.2); burst(0.04, 0.04, "highpass", 4000, 0.08); } },
    // Đánh bài: mỗi lá đập xuống bàn một tiếng, cách nhau một chút
    play(n = 1) {
      if (!ready()) return;
      for (let i = 0; i < Math.min(n, 8); i++) {
        burst(i * 0.045, 0.08, "lowpass", 1600, 0.32);
        burst(i * 0.045, 0.03, "highpass", 3500, 0.12);
        thump(i * 0.045, 180, 80, 0.07, 0.12);
      }
    },
    // Chặt heo: tiếng "bùm" trầm + đập bài mạnh
    chop() {
      if (!ready()) return;
      thump(0, 120, 35, 0.6, 0.5);
      burst(0, 0.35, "lowpass", 500, 0.4);
      burst(0.02, 0.12, "highpass", 2500, 0.2);
    },
    // Lắc bát Bầu Cua: xúc xắc lắc lốc cốc
    dice() {
      if (!ready()) return;
      for (let i = 0; i < 14; i++) { const d = i * 0.08 + Math.random() * 0.03; burst(d, 0.03, "bandpass", 1800 + Math.random() * 1200, 0.16, 3); thump(d, 600, 300, 0.03, 0.05); }
    },
    // Đặt quân Caro: tiếng "cạch" gọn
    stone() { if (ready()) { thump(0, 1300, 700, 0.05, 0.18); burst(0, 0.03, "bandpass", 2600, 0.12, 2); } },
    toggle() { on = !on; try { localStorage.setItem("sfx", on ? "on" : "off"); } catch (e) {} return on; },
    get on() { return on; },
  };
})();
