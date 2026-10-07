// Gesture rules for Noor. No camera or browser code here, so it can be tested with Node.
//  1. classify():  one camera frame (hand landmarks + model label) -> a gesture name, or null
//  2. GestureTracker: decides WHEN to act, so accidental movements do nothing
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GestureLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SETTINGS = {
    minScore: 0.55,       // the model must be at least 55% sure of its label
    holdMs: 800,          // a gesture must stay steady this long before Noor acts
    holdMsFist: 500,      // "stop" reacts a little faster
    releaseMs: 400,       // the gesture must change (or the hand leave) this long before the same action can repeat
    cooldownMs: 1500,     // minimum time between two actions
    graceMs: 150,         // ignore a one-frame flicker (anything longer restarts the hold)
  };

  const GESTURES = {
    open_palm: { icon: '✋', name: 'Open palm' },
    point_left: { icon: '👈', name: 'Pointing left' },
    point_right: { icon: '👉', name: 'Pointing right' },
    thumbs_up: { icon: '👍', name: 'Thumbs up' },
    fist: { icon: '✊', name: 'Closed fist' },
  };

  // Landmark numbers (MediaPipe hand): 0 wrist, then for each finger: knuckle, middle joint, tip.
  const FINGERS = { index: [5, 6, 8], middle: [9, 10, 12], ring: [13, 14, 16], pinky: [17, 18, 20] };

  const dist = (a, b, aspect) => Math.hypot((a.x - b.x) * aspect, a.y - b.y);

  // 'extended', 'curled' or 'unsure' for each finger (compares tip and middle joint distance from the wrist)
  function fingerStates(lm, aspect) {
    const out = {};
    for (const [name, [, pip, tip]] of Object.entries(FINGERS)) {
      const ratio = dist(lm[tip], lm[0], aspect) / dist(lm[pip], lm[0], aspect);
      out[name] = ratio > 1.15 ? 'extended' : ratio < 1.0 ? 'curled' : 'unsure';
    }
    return out;
  }

  // Index finger out, other three curled, and the finger points sideways -> 'left' / 'right'.
  // The preview is a mirror, so "left" means left on the screen, just like the picture the user sees.
  function pointDirection(lm, aspect) {
    const f = fingerStates(lm, aspect);
    if (f.index !== 'extended' || f.middle !== 'curled' || f.ring !== 'curled' || f.pinky !== 'curled') return null;
    const dx = -(lm[8].x - lm[5].x) * aspect;       // minus sign = mirror image
    const dy = lm[8].y - lm[5].y;
    if (Math.abs(dx) < 0.08 || Math.abs(dx) < 1.2 * Math.abs(dy)) return null; // not clearly sideways
    return dx < 0 ? 'left' : 'right';
  }

  // frame: { hands, category, score, landmarks, aspect }
  // returns { gesture, reason }  (gesture is null when Noor should simply wait)
  function classify(frame, settings) {
    const cfg = Object.assign({}, SETTINGS, settings);
    if (!frame || !frame.hands) return { gesture: null, reason: 'no-hand' };
    if (frame.hands > 1) return { gesture: null, reason: 'many-hands' };
    const lm = frame.landmarks;
    if (!lm || lm.length < 21) return { gesture: null, reason: 'no-hand' };
    const dir = pointDirection(lm, frame.aspect || 1.333);
    if (dir) return { gesture: dir === 'left' ? 'point_left' : 'point_right', reason: 'ok' };
    const map = { Open_Palm: 'open_palm', Thumb_Up: 'thumbs_up', Closed_Fist: 'fist' };
    const g = map[frame.category];
    if (!g) return { gesture: null, reason: 'unknown' };
    if (!(frame.score >= cfg.minScore)) return { gesture: null, reason: 'unsure' };
    if (g === 'open_palm') {   // double-check with finger shapes: at least 3 of 4 fingers must be clearly straight
      const open = Object.values(fingerStates(lm, frame.aspect || 1.333)).filter((s) => s === 'extended').length;
      if (open < 3) return { gesture: null, reason: 'unsure' };
    }
    return { gesture: g, reason: 'ok' };
  }

  // Decides when a steady gesture becomes an action.
  class GestureTracker {
    constructor(settings) {
      this.cfg = Object.assign({}, SETTINGS, settings);
      this.reset();
    }
    reset() {
      this.candidate = null; this.since = 0; this.lastSeen = 0;
      this.lastFired = null; this.differentSince = null; this.lastFireTime = -Infinity;
    }
    // gesture: name or null (null = no hand / several hands / unsure -> wait). Returns {fire, candidate, progress}
    update(gesture, now) {
      const cfg = this.cfg;
      // 1. Remember how long we have been looking at something different from the last action.
      if (gesture !== this.lastFired) {
        if (this.differentSince === null) this.differentSince = now;
        if (now - this.differentSince >= cfg.releaseMs) this.lastFired = null;
      } else {
        this.differentSince = null;
      }
      // 2. Follow the candidate gesture, ignoring very short flickers.
      if (gesture === this.candidate && gesture !== null) {
        this.lastSeen = now;
      } else if (gesture !== null && (this.candidate === null || now - this.lastSeen > cfg.graceMs)) {
        this.candidate = gesture; this.since = now; this.lastSeen = now;
      } else if (gesture === null && this.candidate !== null && now - this.lastSeen > cfg.graceMs) {
        this.candidate = null;
      }
      if (this.candidate === null) return { fire: null, candidate: null, progress: 0 };

      // 3. Has it been steady long enough?
      const need = this.candidate === 'fist' ? cfg.holdMsFist : cfg.holdMs;
      const progress = Math.min(1, (now - this.since) / need);
      const ready = progress >= 1 && this.lastFired === null && now - this.lastFireTime >= cfg.cooldownMs;
      if (ready) {
        this.lastFired = this.candidate;
        this.lastFireTime = now;
        this.differentSince = null;
        return { fire: this.candidate, candidate: this.candidate, progress: 1 };
      }
      return { fire: null, candidate: this.candidate, progress: this.lastFired === this.candidate ? 1 : progress };
    }
  }

  return { SETTINGS, GESTURES, FINGERS, fingerStates, pointDirection, classify, GestureTracker };
});
