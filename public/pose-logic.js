// Turns face and hand landmarks into numbers the on-screen Noor can copy ("mirror mode").
// No camera or browser code here, so it can be tested with Node.
//
// The preview is a MIRROR: when you turn your head to your left, your picture on screen turns
// to the left of the screen, and Noor copies that (like a reflection in a mirror).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./gesture-logic.js'));
  else root.PoseLogic = factory(root.GestureLogic);
})(typeof self !== 'undefined' ? self : this, function (GL) {
  'use strict';

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const mx = (p) => 1 - p.x;   // mirrored x

  /* ---------- Head ---------- */
  // Face-mesh points: 1 nose tip, 33 / 263 outer eye corners, 234 / 454 cheeks, 152 chin.
  // Returns raw numbers: roll (degrees, clockwise on screen is +), yawRaw (nose sideways, screen-left is -), pitchRaw.
  function headMetrics(lm, aspect) {
    aspect = aspect || 1.333;
    const left = lm[263], right = lm[33];            // 263 appears on the screen-left in the mirror
    const roll = Math.atan2(right.y - left.y, (mx(right) - mx(left)) * aspect) * 180 / Math.PI;
    const width = Math.abs(mx(lm[454]) - mx(lm[234])) || 1e-6;
    const yawRaw = (mx(lm[1]) - (mx(lm[234]) + mx(lm[454])) / 2) / width;
    const eyeY = (left.y + right.y) / 2;
    const pitchRaw = (lm[1].y - eyeY) / ((lm[152].y - eyeY) || 1e-6);
    return { roll, yawRaw, pitchRaw };
  }

  // The first few frames define "looking straight at the screen", so a camera placed a little
  // off-centre does not make Noor look sideways. reset() re-centres.
  class HeadFilter {
    constructor(baselineFrames) { this.need = baselineFrames || 8; this.reset(); }
    reset() { this.n = 0; this.sumYaw = 0; this.sumPitch = 0; this.base = null; }
    get ready() { return Boolean(this.base); }
    update(m) {
      if (!this.base) {
        this.sumYaw += m.yawRaw; this.sumPitch += m.pitchRaw;
        if (++this.n >= this.need) this.base = { yaw: this.sumYaw / this.n, pitch: this.sumPitch / this.n };
        return { yaw: 0, pitch: 0, roll: 0 };
      }
      return {
        yaw: clamp((m.yawRaw - this.base.yaw) / 0.22, -1, 1),       // -1 = turned to screen-left
        pitch: clamp((m.pitchRaw - this.base.pitch) / 0.10, -1, 1),   // +1 = head down (nod)
        roll: clamp(m.roll, -35, 35),
      };
    }
  }

  /* ---------- Face expression (blendshape scores 0..1) ---------- */
  function expression(categories) {
    const s = {};
    for (const c of categories || []) s[c.categoryName] = c.score;
    const g = (k) => s[k] || 0;
    // "Left"/"right" in the model are the person's own sides = the mirror's screen-left / screen-right.
    return {
      blinkL: clamp((g('eyeBlinkLeft') - 0.3) / 0.4, 0, 1),        // ignore the small squint of a smile
      blinkR: clamp((g('eyeBlinkRight') - 0.3) / 0.4, 0, 1),
      jaw: clamp(g('jawOpen') / 0.5, 0, 1),
      smile: clamp(((g('mouthSmileLeft') + g('mouthSmileRight')) / 2 - 0.25) / 0.6, 0, 1),
      brows: clamp((g('browInnerUp') + g('browOuterUpLeft') + g('browOuterUpRight')) / 1.5, 0, 1),
    };
  }

  /* ---------- Hands ---------- */
  // 'open' | 'fist' | 'point' | 'peace' | 'thumb'
  function handShape(lm, aspect, category, score) {
    aspect = aspect || 1.333;
    if (category === 'Thumb_Up' && score >= 0.5) return 'thumb';
    const f = GL.fingerStates(lm, aspect);
    const ext = (n) => f[n] === 'extended';
    const count = ['index', 'middle', 'ring', 'pinky'].filter(ext).length;
    if (count >= 3) return 'open';
    if (count === 2 && ext('index') && ext('middle')) return 'peace';
    if (count === 1 && ext('index')) return 'point';
    return 'fist';
  }

  // hands: [{landmarks, category, score}] -> { left: {angle, shape} | null, right: ... } for Noor's two arms.
  // angle: 0 = arm hanging down, 180 = straight up. Side = where the hand is on the (mirrored) screen.
  function armsFromHands(hands, aspect) {
    const out = { left: null, right: null };
    const items = (hands || []).filter((h) => h && h.landmarks && h.landmarks.length >= 21).map((h) => ({
      x: mx(h.landmarks[9]),
      raise: clamp((0.92 - h.landmarks[9].y) / 0.6, 0, 1),
      shape: handShape(h.landmarks, aspect, h.category, h.score),
    }));
    items.sort((a, b) => a.x - b.x);
    const arm = (it) => ({ angle: Math.round(8 + 162 * it.raise), shape: it.shape });
    if (items.length === 1) { out[items[0].x < 0.5 ? 'left' : 'right'] = arm(items[0]); }
    else if (items.length >= 2) { out.left = arm(items[0]); out.right = arm(items[items.length - 1]); }
    return out;
  }

  /* ---------- Smoothing ---------- */
  function smooth(prev, next, alpha) { return prev === undefined || prev === null ? next : prev + (next - prev) * alpha; }

  return { headMetrics, HeadFilter, expression, handShape, armsFromHands, smooth, clamp };
});
