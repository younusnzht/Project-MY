const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../public/gesture-logic.js');
const FIX = require('./fixtures/hands.json'); // real landmarks produced by the real model on real hand photos

const frame = (name, extra) => Object.assign({ hands: FIX[name].hands, category: FIX[name].category, score: FIX[name].score, landmarks: FIX[name].landmarks, aspect: FIX[name].aspect }, extra);

test('classify: real hand photos', () => {
  assert.equal(G.classify(frame('fist')).gesture, 'fist');
  assert.equal(G.classify(frame('thumb_up')).gesture, 'thumbs_up');
  assert.equal(G.classify(frame('palm')).gesture, 'open_palm');
  // The picture shows a finger pointing to the right of the camera image; the preview is a mirror,
  // so on screen it points LEFT (and the other way round).
  assert.equal(G.classify(frame('point_raw_right')).gesture, 'point_left');
  assert.equal(G.classify(frame('point_raw_left')).gesture, 'point_right');
});

test('classify: waits when unsure, several hands, or other gestures', () => {
  assert.deepEqual(G.classify(frame('right_hands')), { gesture: null, reason: 'many-hands' });
  assert.equal(G.classify(frame('palm', { score: 0.4 })).gesture, null);       // model not sure
  assert.equal(G.classify(frame('fist', { score: 0.5 })).gesture, null);
  assert.equal(G.classify(frame('victory')).gesture, null);                      // peace sign: not one of ours
  assert.equal(G.classify(frame('pointing_up')).gesture, null);                  // pointing up is not left/right
  assert.equal(G.classify({ hands: 0 }).reason, 'no-hand');
  // "Open palm" label but fingers are really curled -> do not trust it
  assert.equal(G.classify(frame('fist', { category: 'Open_Palm', score: 0.9 })).gesture, null);
});

test('tracker: needs a steady hold, then fires exactly once', () => {
  const t = new G.GestureTracker();
  let fired = [];
  for (let ms = 0; ms <= 3000; ms += 66) { const r = t.update('thumbs_up', ms); if (r.fire) fired.push([r.fire, ms]); }
  assert.equal(fired.length, 1, 'only once while the gesture is held');
  assert.ok(fired[0][1] >= 800 && fired[0][1] < 900, 'fires after about 0.8 s, not before: ' + fired[0][1]);
});

test('tracker: a short wave of the hand does nothing', () => {
  const t = new G.GestureTracker();
  for (let ms = 0; ms < 600; ms += 66) assert.equal(t.update('open_palm', ms).fire, null);
  for (let ms = 600; ms < 2000; ms += 66) assert.equal(t.update(null, ms).fire, null); // hand left too soon
});

test('tracker: tiny flicker does not restart the hold', () => {
  const t = new G.GestureTracker();
  let fired = null;
  for (let ms = 0; ms <= 1200; ms += 66) {
    const g = ms === 330 ? null : 'open_palm';            // one lost frame
    const r = t.update(g, ms); if (r.fire) fired = ms;
  }
  assert.ok(fired && fired < 1000, 'still fires on time: ' + fired);
});

test('tracker: same gesture again only after the gesture changed, and after cooldown', () => {
  const t = new G.GestureTracker();
  const fires = [];
  const run = (g, from, to) => { for (let ms = from; ms < to; ms += 66) { const r = t.update(g, ms); if (r.fire) fires.push([r.fire, ms]); } };
  run('open_palm', 0, 1500);          // fires once
  run(null, 1500, 1700);              // hand away only 0.2 s (< release time)
  run('open_palm', 1700, 3500);       // still the same gesture -> no second action
  assert.equal(fires.length, 1);
  run(null, 3500, 4100);              // away long enough = released
  run('open_palm', 4100, 5200);       // can fire again
  assert.equal(fires.length, 2);
});

test('tracker: cooldown between different actions', () => {
  const t = new G.GestureTracker({ holdMs: 300, holdMsFist: 300, cooldownMs: 1500, releaseMs: 100 });
  const fires = [];
  const run = (g, from, to) => { for (let ms = from; ms < to; ms += 33) { const r = t.update(g, ms); if (r.fire) fires.push([r.fire, ms]); } };
  run('thumbs_up', 0, 500);
  run('fist', 500, 900);              // ready after 300 ms, but cooldown (1.5 s) not over yet
  assert.equal(fires.length, 1);
  run('fist', 900, 2000);
  assert.equal(fires.length, 2);
  assert.ok(fires[1][1] >= 1500, 'second action waited for the cooldown: ' + fires[1][1]);
});

test('tracker: several hands or unsure frames reset the wait', () => {
  const t = new G.GestureTracker();
  let any = null;
  for (let ms = 0; ms < 4000; ms += 66) { const r = t.update(ms % 400 < 200 ? 'fist' : null, ms); if (r.fire) any = ms; }
  assert.equal(any, null, 'an on/off flickering gesture never triggers');
});

test('fist reacts faster than the others', () => {
  const t = new G.GestureTracker();
  let first = null;
  for (let ms = 0; ms < 1000 && first === null; ms += 33) { const r = t.update('fist', ms); if (r.fire) first = ms; }
  assert.ok(first >= 500 && first < 600, String(first));
});
