const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../public/pose-logic.js');
const FACES = require('./fixtures/faces.json'); // real landmarks / blendshapes from the real face model
const HANDS = require('./fixtures/hands.json');

const blend = (name) => Object.entries(FACES[name].blend).map(([categoryName, score]) => ({ categoryName, score }));

test('head: a straight face reads as centred, and the mirror image flips the sign', () => {
  const a = P.headMetrics(FACES.portrait.landmarks, FACES.portrait.aspect);
  const b = P.headMetrics(FACES.portrait_flip.landmarks, FACES.portrait_flip.aspect);
  assert.ok(Math.abs(a.roll) < 5 && Math.abs(a.yawRaw) < 0.1, JSON.stringify(a));
  assert.ok(a.yawRaw * b.yawRaw <= 0, 'flipping the picture flips the turn direction');
});

test('head: tilt (roll) follows the mirrored preview', () => {
  // The photo is rotated so the top of the head points to the left of the (mirrored) screen -> counter-clockwise -> negative
  const r = P.headMetrics(FACES.portrait_rotated.landmarks, FACES.portrait_rotated.aspect);
  assert.ok(r.roll < -60, String(r.roll));
});

test('head: turning to the screen-left gives a negative yaw, after centring', () => {
  const f = new P.HeadFilter(3);
  const lm = FACES.portrait.landmarks.map((p) => ({ ...p }));
  for (let i = 0; i < 3; i++) f.update(P.headMetrics(lm, FACES.portrait.aspect));
  assert.ok(f.ready);
  const turned = lm.map((p, i) => (i === 1 ? { x: p.x + 0.05, y: p.y } : p));      // nose moves to screen-left (raw x grows)
  assert.ok(f.update(P.headMetrics(turned, FACES.portrait.aspect)).yaw < -0.5);
  const turnedRight = lm.map((p, i) => (i === 1 ? { x: p.x - 0.05, y: p.y } : p));
  assert.ok(f.update(P.headMetrics(turnedRight, FACES.portrait.aspect)).yaw > 0.5);
  const down = lm.map((p, i) => (i === 1 ? { x: p.x, y: p.y + 0.03 } : p));          // nose lower = head down (nod)
  assert.ok(f.update(P.headMetrics(down, FACES.portrait.aspect)).pitch > 0.5);
  f.reset(); assert.ok(!f.ready);
});

test('face: smile and mouth from real blendshapes, squint is not a blink', () => {
  const e = P.expression(blend('portrait'));
  assert.equal(e.smile, 1);
  assert.ok(e.jaw > 0.1 && e.jaw < 0.6);
  assert.equal(e.blinkL, 0, 'a smiling squint (0.27) must not close the eyes');
  assert.equal(P.expression([{ categoryName: 'eyeBlinkLeft', score: 0.9 }]).blinkL, 1);
  assert.equal(P.expression([]).smile, 0);
});

test('hands: shapes from real hand photos', () => {
  const shape = (n) => P.handShape(HANDS[n].landmarks, HANDS[n].aspect, HANDS[n].category, HANDS[n].score);
  assert.equal(shape('fist'), 'fist');
  assert.equal(shape('palm'), 'open');
  assert.equal(shape('thumb_up'), 'thumb');
  assert.equal(shape('pointing_up'), 'point');
  assert.equal(shape('victory'), 'peace');
});

test('hands: which arm Noor raises, and how high', () => {
  const hand = (n, dx = 0, y) => ({ landmarks: HANDS[n].landmarks.map((p) => ({ x: p.x + dx, y: y === undefined ? p.y : p.y + y })), category: HANDS[n].category, score: HANDS[n].score });
  const base = HANDS.palm.landmarks[9];
  // hand on the left half of the mirrored screen = raw x > 0.5
  const left = P.armsFromHands([hand('palm', 0.8 - base.x)], 1);
  assert.ok(left.left && !left.right);
  const right = P.armsFromHands([hand('palm', 0.2 - base.x)], 1);
  assert.ok(right.right && !right.left);
  // higher hand (smaller y) = higher arm
  const hi = P.armsFromHands([hand('palm', 0.2 - base.x, 0.1 - base.y)], 1).right.angle;
  const lo = P.armsFromHands([hand('palm', 0.2 - base.x, 0.95 - base.y)], 1).right.angle;
  assert.ok(hi > 150 && lo < 20, `${hi} ${lo}`);
  // two hands -> both arms, left/right by screen position
  const both = P.armsFromHands([hand('palm', 0.8 - base.x), hand('fist', 0.2 - HANDS.fist.landmarks[9].x)], 1);
  assert.equal(both.left.shape, 'open'); assert.equal(both.right.shape, 'fist');
  assert.deepEqual(P.armsFromHands([], 1), { left: null, right: null });
});
