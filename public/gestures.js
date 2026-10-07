// Camera + hand tracking for Noor.
// Everything runs on this laptop: the camera picture goes to the on-page <video> and into the
// hand-tracking model (MediaPipe, loaded from this server's own files). Pictures are never
// saved, drawn to a downloadable image, or sent anywhere.
(function () {
  'use strict';
  const GL = window.GestureLogic;
  const $ = (id) => document.getElementById(id);

  const el = {
    btn: $('camBtn'), notice: $('camNotice'), box: $('camBox'), video: $('camVideo'), canvas: $('camCanvas'),
    label: $('gestureLabel'), fill: $('holdFill'),
  };

  const MODEL_URL = '/models/gesture_recognizer.task';
  const LIB_URL = '/vendor/mediapipe/vision_bundle.mjs';
  const WASM_URL = '/vendor/mediapipe/wasm';
  const FRAME_MS = 70;                       // look at about 14 pictures per second

  const api = { onFire: () => {}, active: false };
  let recognizer = null, lib = null, stream = null;
  let tracker = new GL.GestureTracker();
  let running = false, lastFrameAt = 0, lastVideoTime = -1, loadingToken = 0;

  function notice(text, info) {
    el.notice.textContent = text || '';
    el.notice.className = 'notice' + (info ? ' info' : '');
    el.notice.hidden = !text;
  }
  function setLabel(text, kind) { el.label.textContent = text; el.label.dataset.kind = kind || ''; }
  function setButton(on, busy) {
    el.btn.setAttribute('aria-pressed', String(on));
    el.btn.disabled = Boolean(busy);
    el.btn.textContent = busy ? '⏳ Starting camera…' : on ? '📷 Turn off gestures' : '📷 Turn on gestures';
  }

  async function loadModel() {
    if (recognizer) return recognizer;
    lib = lib || (await import(LIB_URL));
    const files = await lib.FilesetResolver.forVisionTasks(WASM_URL);
    const make = (delegate) => lib.GestureRecognizer.createFromOptions(files, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: 'VIDEO',
      numHands: 2,                           // see a second hand so Noor can wait instead of guessing
    });
    try { recognizer = await make('GPU'); } catch (e) { recognizer = await make('CPU'); }
    return recognizer;
  }

  function cameraErrorMessage(err) {
    switch (err && err.name) {
      case 'NotAllowedError': case 'SecurityError':
        return 'The camera is blocked. Click the 🔒 icon next to the web address, allow the Camera, then press the button again. Voice and typing still work!';
      case 'NotFoundError': case 'OverconstrainedError':
        return 'I cannot find a camera on this laptop. Voice and typing still work!';
      case 'NotReadableError': case 'AbortError':
        return 'The camera is busy. Close other apps that use it (Zoom, Teams, the Camera app), then try again.';
      default:
        return 'I could not start the camera (' + ((err && err.message) || 'unknown problem') + '). Voice and typing still work!';
    }
  }

  // Work out WHY loading failed, so the message says what to do.
  async function explainLoadFailure(err) {
    const exists = async (url) => { try { return (await fetch(url, { method: 'HEAD' })).ok; } catch (e) { return false; } };
    if (!(await exists(LIB_URL)) || !(await exists(WASM_URL + '/vision_wasm_internal.wasm'))) {
      return 'Noor cannot find the hand-tracking library. In the terminal: press Ctrl+C to stop Noor, run "npm install", then "npm start" again, and reload this page. Voice and typing still work!';
    }
    if (!(await exists(MODEL_URL))) {
      return 'The model file public/models/gesture_recognizer.task is missing. Download it again (see the README, "Internet needed?"). Voice and typing still work!';
    }
    return 'The hand-tracking model could not start on this computer (' + ((err && err.message) || err) + '). Try the newest Google Chrome or Microsoft Edge. Voice and typing still work!';
  }

  async function start() {
    if (running) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.isSecureContext) {
      notice('The camera needs the page to be opened at http://localhost:3000 in Chrome or Edge.');
      return;
    }
    const token = ++loadingToken;
    notice('');
    setButton(false, true);
    setLabel('Asking for the camera…');
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false });
    } catch (err) {
      setButton(false); setLabel('Camera is off'); notice(cameraErrorMessage(err));
      return;
    }
    if (token !== loadingToken) { stopStream(); return; }          // turned off while waiting
    try {
      setLabel('Loading hand tracking…');
      await loadModel();
    } catch (err) {
      console.error('Hand-tracking failed to load:', err);
      stopStream(); setButton(false); setLabel('Camera is off');
      notice(await explainLoadFailure(err));
      return;
    }
    if (token !== loadingToken) { stopStream(); return; }
    el.video.srcObject = stream;
    try { await el.video.play(); } catch (e) { /* autoplay is allowed for muted video */ }
    el.box.hidden = false;
    tracker = new GL.GestureTracker();
    lastVideoTime = -1;
    running = true; api.active = true;
    setButton(true);
    setLabel('Show me a gesture ✋ 👈 👉 👍 ✊');
    loop();
  }

  function stopStream() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    el.video.srcObject = null;
  }

  function stop() {
    loadingToken++;
    running = false; api.active = false;
    stopStream();
    el.box.hidden = true;
    el.fill.style.width = '0%';
    setButton(false);
    setLabel('Camera is off');
    clearCanvas();
  }

  function clearCanvas() {
    const c = el.canvas.getContext('2d');
    c.clearRect(0, 0, el.canvas.width, el.canvas.height);
  }

  function drawHand(landmarks) {
    const c = el.canvas.getContext('2d');
    const w = (el.canvas.width = el.video.videoWidth || 640);
    const h = (el.canvas.height = el.video.videoHeight || 480);
    c.clearRect(0, 0, w, h);
    if (!landmarks || !landmarks.length) return;
    c.lineWidth = 3; c.strokeStyle = '#7ff0e0'; c.fillStyle = '#ffb703';
    for (const hand of landmarks) {
      for (const { start, end } of lib.GestureRecognizer.HAND_CONNECTIONS) {
        c.beginPath(); c.moveTo(hand[start].x * w, hand[start].y * h); c.lineTo(hand[end].x * w, hand[end].y * h); c.stroke();
      }
      for (const p of hand) { c.beginPath(); c.arc(p.x * w, p.y * h, 4, 0, 6.3); c.fill(); }
    }
  }

  const REASON_TEXT = {
    'no-hand': 'I do not see a hand. Hold one up! 🖐',
    'many-hands': 'I see more than one hand, so I will wait. Please show one hand.',
    unsure: 'I am not sure yet. Hold your hand steady.',
    unknown: 'Hand seen. Try ✋ 👈 👉 👍 or ✊',
  };

  function loop() {
    if (!running) return;
    const now = performance.now();
    const video = el.video;
    if (now - lastFrameAt >= FRAME_MS && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastFrameAt = now; lastVideoTime = video.currentTime;
      let result = null;
      try { result = recognizer.recognizeForVideo(video, now); } catch (e) { console.warn(e); }
      if (result) handleResult(result, now, video);
    }
    requestAnimationFrame(loop);
  }

  function handleResult(result, now, video) {
    const hands = result.landmarks ? result.landmarks.length : 0;
    drawHand(result.landmarks);
    const top = result.gestures && result.gestures[0] && result.gestures[0][0];
    const verdict = GL.classify({
      hands,
      category: top ? top.categoryName : 'None',
      score: top ? top.score : 0,
      landmarks: hands ? result.landmarks[0] : null,
      aspect: (video.videoWidth || 640) / (video.videoHeight || 480),
    });
    const step = tracker.update(verdict.gesture, now);
    el.fill.style.width = Math.round(step.progress * 100) + '%';
    if (step.candidate) {
      const g = GL.GESTURES[step.candidate];
      setLabel(`${g.icon} ${g.name}${step.progress < 1 ? ' — hold steady…' : ' ✓'}`, 'seen');
    } else {
      setLabel(REASON_TEXT[verdict.reason] || REASON_TEXT.unknown, 'wait');
    }
    if (step.fire) api.onFire(step.fire);
  }

  el.btn.addEventListener('click', () => { if (running) stop(); else start(); });
  window.addEventListener('pagehide', () => { stopStream(); });
  setLabel('Camera is off');

  api.start = start;
  api.stop = stop;
  api.GESTURES = GL.GESTURES;
  window.NoorGestures = api;
})();
