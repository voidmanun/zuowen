/* ---------------- 音效（sfx.js） ----------------
   设计约束（见 docs/adr）：
   - 纯 Web Audio 合成，零音频文件：没网也能响，核心循环离线可走完。
   - 开关独立存 localStorage（zwjm.sound），不进档案数据，导出档案不带它。
   - 浏览器要求用户手势后才能出声：所有音效都由点击触发，首次调用时才建 ctx。 */

const sfx = (() => {
  let ctx = null, master = null;
  const on = () => localStorage.getItem('zwjm.sound') !== '0';

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;                    /* 老浏览器没有 Web Audio：静默，不影响玩 */
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  /* 单音符：短包络（起音 8ms、指数收尾），slideTo 用于滑音 */
  function note(freq, delay, dur, type, vol, slideTo) {
    if (!on()) return;
    const c = ac(); if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  /* 白噪声脉冲：衰减采样 + 低通，打击感（怪兽受击用） */
  function noise(delay, dur, vol, cutoff) {
    if (!on()) return;
    const c = ac(); if (!c) return;
    const t = c.currentTime + delay;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
    const g = c.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }

  return {
    isOn: on,
    toggle(v) { localStorage.setItem('zwjm.sound', v ? '1' : '0'); },
    tick()  { note(1250, 0, .04, 'triangle', .05); },                                       /* 按钮轻点 */
    right() { note(784, 0, .09, 'triangle', .12); note(1047, .07, .13, 'triangle', .12); }, /* 点对：两音上行 */
    wrong() { note(196, 0, .16, 'square', .06, 150); },                                     /* 点错：低频闷响 */
    sheet() { note(320, 0, .12, 'sine', .09, 640); },                                       /* 底部面板弹出：上滑 */
    pick()  { note(620, 0, .06, 'triangle', .1); },                                         /* 选中技能填槽 */
    hit()   { noise(0, .09, .16, 900); note(96, 0, .1, 'sine', .22, 60); },                 /* 怪兽受击：噪声+低频 */
    win()   { [523, 659, 784, 1047].forEach((f, i) => note(f, i * .09, .15, 'triangle', .13)); },      /* 通关琶音 */
    lose()  { [330, 247, 196].forEach((f, i) => note(f, i * .13, .17, 'sine', .11)); },               /* 失败下行 */
    goal()  { [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) => note(f, i * .08, .13, 'triangle', .13)); } /* 日目标达成 */
  };
})();
