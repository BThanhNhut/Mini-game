// Nhạc nền: phát file nhạc thư giãn lặp lại liên tục.
// Bật/tắt và âm lượng lưu trên máy; khi bật mic nhạc tự nhỏ lại; tăng/giảm âm lượng từ từ cho êm.
const Music = (() => {
  const SRC = "velariomusic-relaxing-music-608127.mp3";
  let audio = null, ac = null, gain = null, vol = 0.5, on = true, ducked = false, pauseTimer = null;
  try { const v = parseFloat(localStorage.getItem("musicVol")); if (v >= 0 && v <= 1) vol = v; on = localStorage.getItem("music") !== "off"; } catch (e) {}

  // Âm lượng mong muốn hiện tại (bình phương để thanh kéo nghe tự nhiên hơn)
  const targetVolume = () => (on ? vol * vol * (ducked ? 0.35 : 1) : 0);
  // Âm lượng chỉnh qua Web Audio (GainNode) vì iPhone không cho chỉnh audio.volume
  function fadeTo(v, ms = 800) {
    if (!gain) return;
    clearTimeout(pauseTimer);
    const t = ac.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(v, t + ms / 1000);
    if (v === 0) pauseTimer = setTimeout(() => audio.pause(), ms + 50); // tắt hẳn để đỡ tốn pin
  }

  return {
    // Gọi trong một thao tác của người dùng (bấm nút) để trình duyệt cho phép phát nhạc
    start() {
      if (!audio) {
        audio = new Audio(SRC); audio.loop = true; audio.preload = "auto";
        ac = new (window.AudioContext || window.webkitAudioContext)();
        gain = ac.createGain(); gain.gain.value = 0;
        ac.createMediaElementSource(audio).connect(gain); gain.connect(ac.destination);
      }
      if (!on) return;
      if (ac.state === "suspended") ac.resume();
      audio.play().catch(() => {});
      fadeTo(targetVolume(), 1500);
    },
    toggle() {
      on = !on;
      try { localStorage.setItem("music", on ? "on" : "off"); } catch (e) {}
      if (on) this.start(); else fadeTo(0, 600);
      return on;
    },
    setVolume(v) {
      vol = v;
      try { localStorage.setItem("musicVol", v); } catch (e) {}
      if (gain && on) fadeTo(targetVolume(), 150);
    },
    setScene() {}, // một bài nhạc dùng chung cho mọi nơi
    duck(d) { ducked = d; if (audio && on) fadeTo(targetVolume(), 600); }, // nhỏ nhạc khi đang bật mic
    get on() { return on; },
    get volume() { return vol; },
  };
})();
