// Tiny motion kit for frame-driven films.
const K = {
  clamp: (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)),
  seg(t, a, b) { return K.clamp((t - a) / (b - a)); },
  outCubic: (x) => 1 - Math.pow(1 - x, 3),
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outQuint: (x) => 1 - Math.pow(1 - x, 5),
  outBack: (x) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2),
  inOutQuart: (x) => (x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2),
  lerp: (a, b, x) => a + (b - a) * x,
  $: (s) => document.querySelector(s),
  $$: (s) => [...document.querySelectorAll(s)],
  css(el, o) { if (typeof el === 'string') el = K.$(el); if (el) Object.assign(el.style, o); },
  // Scene visibility with a soft in/out fade.
  show(el, t, a, b, fade = 0.25) {
    const v = K.clamp(Math.min((t - a) / fade, (b - t) / fade));
    K.css(el, { opacity: v, visibility: v > 0 ? 'visible' : 'hidden' });
    return v;
  },
};
window.K = K;
