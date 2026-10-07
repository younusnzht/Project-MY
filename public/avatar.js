// Noor's on-screen character. Two ways to move her:
//  * copy-me mode: setCamera() is called with your head, face and hands (from the camera) many times a second
//  * actions: perform('wave' | 'nod' | 'shake' | 'dance' | 'smile' | 'thumbs_up' | 'hands_up' | 'look_left' | 'look_right')
// Actions come from hand gestures or voice commands.
(function () {
  'use strict';
  const robot = document.getElementById('robot');
  const svg = robot.querySelector('svg');
  const q = (s) => svg.querySelector(s);
  const E = {
    pose: q('.head-pose'), face: q('.face'), eyeL: q('.eye-l'), eyeR: q('.eye-r'),
    mouth: q('.mouth'), smile: q('.mouth-smile'), open: q('.mouth-open'),
    armL: q('.arm-l'), armR: q('.arm-r'), handL: q('.arm-l .hand'), handR: q('.arm-r .hand'),
  };
  const P = window.PoseLogic;
  const REST = { yaw: 0, pitch: 0, roll: 0, blinkL: 0, blinkR: 0, jaw: 0, smile: 0, armL: { angle: 6, shape: 'fist' }, armR: { angle: 6, shape: 'fist' } };

  let cam = JSON.parse(JSON.stringify(REST));   // smoothed values coming from the camera
  let mirroring = false;
  let over = null, overUntil = 0, overTimer = null;   // temporary values from actions
  const armSeen = { left: 0, right: 0 };

  function render() {
    const s = Object.assign({}, cam, over || {});
    const armL = (over && over.armL) || cam.armL, armR = (over && over.armR) || cam.armR;
    if (mirroring || over) {
      E.pose.style.transform = `translate(${s.yaw * 9}px, ${s.pitch * 7}px) rotate(${s.roll}deg)`;
      E.face.style.transform = `translate(${s.yaw * 12}px, ${s.pitch * 6}px)`;
      E.eyeL.style.transform = `scaleY(${1 - s.blinkL * 0.92})`;
      E.eyeR.style.transform = `scaleY(${1 - s.blinkR * 0.92})`;
      const jaw = s.jaw, smile = s.smile;
      if (jaw > 0.15) {
        E.mouth.style.display = 'none'; E.smile.style.display = 'none'; E.open.style.display = '';
        E.open.setAttribute('ry', (3 + jaw * 17).toFixed(1));
        E.open.setAttribute('rx', (11 + smile * 8).toFixed(1));
      } else if (smile > 0.25) {
        E.mouth.style.display = 'none'; E.open.style.display = 'none'; E.smile.style.display = '';
        E.smile.setAttribute('d', `M ${92 - smile * 4} ${146 - smile * 4} Q 110 ${146 + smile * 24} ${128 + smile * 4} ${146 - smile * 4}`);
      } else {
        E.smile.style.display = 'none'; E.open.style.display = 'none'; E.mouth.style.display = '';
      }
      E.armL.style.transform = `rotate(${armL.angle}deg)`;
      E.armR.style.transform = `rotate(${-armR.angle}deg)`;
      E.handL.setAttribute('data-shape', armL.shape);
      E.handR.setAttribute('data-shape', armR.shape);
    }
  }

  function clearInline() {
    for (const k of ['pose', 'face', 'eyeL', 'eyeR', 'armL', 'armR']) E[k].style.transform = '';
    E.mouth.style.display = ''; E.smile.style.display = 'none'; E.open.style.display = 'none';
    E.handL.setAttribute('data-shape', 'fist'); E.handR.setAttribute('data-shape', 'fist');
  }

  // frame: { head: {yaw,pitch,roll}|null, expr: {blinkL,...}|null, arms: {left,right}|null }
  function setCamera(frame, now) {
    if (!mirroring) return;
    const sm = P.smooth;
    if (frame.head) { cam.yaw = sm(cam.yaw, frame.head.yaw, 0.5); cam.pitch = sm(cam.pitch, frame.head.pitch, 0.5); cam.roll = sm(cam.roll, frame.head.roll, 0.5); }
    else { cam.yaw = sm(cam.yaw, 0, 0.15); cam.pitch = sm(cam.pitch, 0, 0.15); cam.roll = sm(cam.roll, 0, 0.15); }
    const e = frame.expr || { blinkL: 0, blinkR: 0, jaw: 0, smile: 0 };
    cam.blinkL = sm(cam.blinkL, e.blinkL, 0.8); cam.blinkR = sm(cam.blinkR, e.blinkR, 0.8);
    cam.jaw = sm(cam.jaw, e.jaw, 0.6); cam.smile = sm(cam.smile, e.smile, 0.4);
    for (const side of ['left', 'right']) {
      const key = side === 'left' ? 'armL' : 'armR';
      const a = frame.arms && frame.arms[side];
      if (a) { armSeen[side] = now; cam[key] = { angle: sm(cam[key].angle, a.angle, 0.55), shape: a.shape }; }
      else if (now - armSeen[side] > 300) cam[key] = { angle: sm(cam[key].angle, 6, 0.25), shape: cam[key].angle < 25 ? 'fist' : cam[key].shape };
    }
    render();
  }

  function setMirroring(on) {
    mirroring = on;
    robot.classList.toggle('mirroring', on);
    cam = JSON.parse(JSON.stringify(REST));
    if (!on) { clearInline(); if (over) render(); } else render();
  }

  // Temporarily force some values (an action), then go back.
  function pulse(values, ms) {
    over = values; overUntil = Date.now() + ms;
    clearTimeout(overTimer);
    if (!mirroring) { /* render() still draws overrides */ }
    render();
    overTimer = setTimeout(() => { over = null; if (mirroring) render(); else clearInline(); }, ms);
  }

  function cls(name, ms) {
    robot.classList.add(name);
    setTimeout(() => robot.classList.remove(name), ms);
  }

  const ACTIONS = {
    wave() { pulse({ armR: { angle: 140, shape: 'open' }, smile: 0.8 }, 1800); cls('waving', 1800); },
    nod() { cls('nod', 1600); },
    shake() { cls('shake', 1500); },
    smile() { pulse({ smile: 1 }, 3000); },
    dance() { pulse({ smile: 1, armL: { angle: 120, shape: 'open' }, armR: { angle: 120, shape: 'open' } }, 4500); cls('dance', 4500); },
    thumbs_up() { pulse({ armR: { angle: 100, shape: 'thumb' }, smile: 1 }, 2500); },
    hands_up() { pulse({ armL: { angle: 165, shape: 'open' }, armR: { angle: 165, shape: 'open' }, smile: 0.6 }, 2500); },
    look_left() { look('left'); },
    look_right() { look('right'); },
  };
  let lookTimer = null;
  function look(dir) {
    if (mirroring) { pulse({ yaw: dir === 'left' ? -1 : 1 }, 2500); return; }   // briefly overrides copy-me
    robot.dataset.look = dir;
    clearTimeout(lookTimer);
    lookTimer = setTimeout(() => { delete robot.dataset.look; }, 5000);
  }
  function perform(name) { const f = ACTIONS[name]; if (f) f(); return Boolean(f); }
  function clearLook() { delete robot.dataset.look; }

  window.NoorAvatar = { setCamera, setMirroring, perform, look, clearLook, actions: Object.keys(ACTIONS), get mirroring() { return mirroring; } };
})();
