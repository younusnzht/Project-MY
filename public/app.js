// Noor's web page: chat, microphone, voice, timers.
// The "thinking helpers" (maths, names, timers parsing, demo brain) are in noor-logic.js.
(function () {
  'use strict';
  const L = window.NoorLogic;
  const $ = (id) => document.getElementById(id);

  const el = {
    robot: $('robot'), status: $('statusText'), nameChip: $('nameChip'),
    mic: $('micBtn'), micLabel: $('micLabel'), micNotice: $('micNotice'),
    heard: $('heardBar'), heardText: $('heardText'), fix: $('fixBtn'), retry: $('retryBtn'),
    mute: $('muteBtn'), stopSpeak: $('stopSpeakBtn'), handsFree: $('handsFree'), voice: $('voiceSelect'), rate: $('rateRange'),
    timerList: $('timerList'), noTimers: $('noTimers'),
    chat: $('chat'), form: $('chatForm'), input: $('chatInput'), newChat: $('newChatBtn'),
    badge: $('modeBadge'), demoInfo: $('demoInfo'),
    overlay: $('alertOverlay'), alertText: $('alertText'), alertOk: $('alertOk'),
    confirmBar: $('confirmBar'), confirmText: $('confirmText'), confirmYes: $('confirmYes'), confirmNo: $('confirmNo'),
    hw: $('hwPanel'), studyMinutes: $('studyMinutes'), studyStart: $('studyStartBtn'), hwQuestion: $('hwQuestion'), hwAsk: $('hwAskBtn'),
  };

  const state = {
    name: null,
    history: [],        // [{role:'user'|'assistant', content}] sent to the AI so it remembers the chat
    aiAvailable: false,
    busy: false,
    muted: false,
    pending: null,      // when Noor asked a question, e.g. "For how long?"
    demoMemory: {},     // what the offline brain remembers (last topic, etc.)
    nameUses: 0,
    confirm: null,      // something Noor is waiting for a yes/no on: {text, yes}
    generation: 0,      // bumped when the user cancels, so a late answer is thrown away
  };

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode: fine */ } },
  };

  /* ================= Status & robot ================= */
  const STATUS_TEXT = {
    idle: 'Ready',
    listening: '👂 Listening… speak now',
    thinking: '🤔 Thinking…',
    speaking: '💬 Noor is speaking',
  };
  let status = 'idle';
  function setStatus(s) {
    status = s;
    el.robot.dataset.state = s;
    el.status.dataset.state = s;
    el.status.textContent = STATUS_TEXT[s];
  }

  /* ================= Chat ================= */
  function addMessage(who, text) {
    const div = document.createElement('div');
    div.className = 'msg ' + who;
    if (who !== 'note') {
      const label = document.createElement('span');
      label.className = 'who';
      label.textContent = who === 'noor' ? 'Noor' : (state.name || 'You');
      div.appendChild(label);
    }
    div.appendChild(document.createTextNode(text));
    el.chat.appendChild(div);
    el.chat.scrollTop = el.chat.scrollHeight;
  }

  function updateNameChip() {
    el.nameChip.hidden = !state.name;
    el.nameChip.textContent = state.name ? `💜 I remember your name: ${state.name}` : '';
  }

  // Use the name only now and then, so Noor does not sound repetitive.
  function nameTag() {
    if (!state.name) return '';
    return state.nameUses++ % 3 === 0 ? `, ${state.name}` : '';
  }

  /* ================= Voice output ================= */
  const synth = window.speechSynthesis;
  let voices = [];
  let speakToken = 0;

  function pickDefaultVoice(list) {
    const prefer = [/Google UK English Female/i, /Samantha/i, /Microsoft (Aria|Jenny|Sonia|Zira)/i, /Google US English/i, /Karen|Moira|Tessa|Serena/i, /female/i];
    for (const re of prefer) { const v = list.find((x) => re.test(x.name)); if (v) return v; }
    return list.find((v) => /^en-(US|GB)/i.test(v.lang)) || list[0];
  }

  function loadVoices() {
    if (!synth) return;
    voices = synth.getVoices().filter((v) => /^en/i.test(v.lang));
    if (!voices.length) return;
    const saved = store.get('noor.voice');
    const chosen = voices.find((v) => v.name === saved) || pickDefaultVoice(voices);
    el.voice.innerHTML = '';
    voices.forEach((v) => {
      const o = document.createElement('option');
      o.value = v.name; o.textContent = `${v.name} (${v.lang})`;
      if (v === chosen) o.selected = true;
      el.voice.appendChild(o);
    });
  }

  function currentVoice() { return voices.find((v) => v.name === el.voice.value) || null; }

  function cancelSpeech() {
    speakToken++;
    if (synth) synth.cancel();
    if (status === 'speaking') setStatus('idle');
  }

  // Speaks the text sentence by sentence with small pauses. Resolves true if it finished on its own.
  function speak(text) {
    cancelSpeech();
    const token = speakToken;
    if (state.muted || !synth) return Promise.resolve(false);
    stopListening();                       // never listen while Noor talks
    const parts = L.splitSentences(L.speakable(text));
    if (!parts.length) return Promise.resolve(false);
    setStatus('speaking');
    return new Promise((resolve) => {
      let i = 0;
      const next = () => {
        if (token !== speakToken) return resolve(false);          // someone interrupted
        if (i >= parts.length) { setStatus('idle'); return resolve(true); }
        const part = parts[i++];
        const u = new SpeechSynthesisUtterance(part);
        u.rate = parseFloat(el.rate.value) || 0.95;
        u.pitch = 1.1;
        const v = currentVoice();
        if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US';
        let started = false, advanced = false;
        const advance = () => {
          if (advanced) return;
          advanced = true; clearTimeout(watchdog);
          setTimeout(next, /[.!?]$/.test(part) ? 280 : 150);      // natural pause
        };
        u.onstart = () => { started = true; };
        u.onend = advance;
        u.onerror = advance;
        const watchdog = setTimeout(() => { if (!started) { synth.cancel(); advance(); } }, 5000);
        synth.speak(u);
      };
      next();
    });
  }

  function noorSays(text, opts) {
    opts = opts || {};
    addMessage('noor', text);
    if (opts.remember !== false) state.history.push({ role: 'assistant', content: text });
    return speak(text).then((finished) => {
      if (finished && el.handsFree.checked && !opts.noResume && !state.busy) startListening();
      return finished;
    });
  }

  /* ================= Voice input ================= */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  let session = null;

  function showNotice(text, info) {
    el.micNotice.textContent = text;
    el.micNotice.className = 'notice' + (info ? ' info' : '');
    el.micNotice.hidden = !text;
  }
  function showHeard(text, live) {
    el.heard.hidden = !text;
    el.heard.classList.toggle('live', Boolean(live));
    el.heardText.textContent = text;
  }
  function setMicButton(on) {
    el.mic.setAttribute('aria-pressed', String(on));
    el.micLabel.textContent = on ? 'Stop' : 'Talk to Noor';
    el.mic.querySelector('.mic-icon').textContent = on ? '⏹' : '🎤';
  }

  function startListening() {
    if (!SR || rec || state.busy) return;
    cancelSpeech();
    showNotice('');
    const s = { final: '', conf: 0, error: null, stopped: false, ignore: false };
    session = s;
    const r = new SR();
    rec = r;
    r.lang = 'en-US';
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    r.onstart = () => { setStatus('listening'); setMicButton(true); showHeard('…', true); };
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) { s.final += res[0].transcript; s.conf = res[0].confidence; } else interim += res[0].transcript;
      }
      showHeard((s.final + interim).trim() || '…', true);
    };
    r.onerror = (e) => { s.error = e.error; };
    r.onend = () => {
      if (rec === r) rec = null;
      setMicButton(false);
      if (status === 'listening') setStatus('idle');
      if (!s.ignore) onRecognitionEnd(s);
    };
    try { r.start(); } catch (e) { rec = null; setMicButton(false); showNotice('I could not start the microphone. Please try again.'); }
  }

  // stopListening() cancels quietly; the user pressing "Stop" instead sends what was heard.
  function stopListening() {
    if (!rec) return;
    if (session) session.ignore = true;
    try { rec.abort(); } catch (e) { /* already stopped */ }
    rec = null;
    setMicButton(false);
    if (status === 'listening') setStatus('idle');
  }

  function onRecognitionEnd(s) {
    const text = s.final.trim();
    if (s.error) {
      if (s.error === 'not-allowed' || s.error === 'service-not-allowed') {
        showHeard('');
        showNotice('The microphone is blocked. Click the 🔒 icon next to the web address, allow the Microphone, then reload the page. You can still type to Noor!');
      } else if (s.error === 'audio-capture') {
        showHeard('');
        showNotice('I cannot find a microphone. Please plug one in, or type to Noor.');
      } else if (s.error === 'network') {
        showHeard('');
        showNotice('Voice recognition needs the internet in this browser. Please check the connection, or type to Noor.');
      } else if (s.error === 'no-speech') {
        showHeard('');
        if (!s.stopped) { el.handsFree.checked = false; noorSays("I didn't hear anything. Please press the microphone and try again.", { remember: false, noResume: true }); }
      }
      return;
    }
    if (!text) {
      showHeard('');
      if (!s.stopped) noorSays("I didn't catch that. Could you say it again, please?", { remember: false, noResume: true });
      return;
    }
    showHeard(text, false);
    if ((s.conf > 0 && s.conf < 0.4) || text.length < 2) {
      noorSays("I'm not sure I heard that right. Could you say it again, please? Or press Fix it to type it.", { remember: false, noResume: true });
      return;
    }
    processUserText(text);
  }

  /* ================= Timers & reminders ================= */
  const timers = [];
  let timerId = 1;
  let audioCtx = null;

  function unlockAudio() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) { /* no audio available */ }
  }
  ['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, unlockAudio));

  function beep(times) {
    unlockAudio();
    if (!audioCtx) return;
    for (let i = 0; i < times; i++) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const t0 = audioCtx.currentTime + i * 0.4;
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.4, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start(t0); osc.stop(t0 + 0.3);
    }
  }

  function timerTitle(t) {
    if (t.kind === 'reminder') return `Reminder: ${t.what}`;
    return `${t.kind === 'study' ? 'Study timer' : 'Timer'}: ${L.formatDuration(t.total)}`;
  }

  function addTimer(kind, seconds, what) {
    const t = { id: timerId++, kind, what, total: seconds, endAt: Date.now() + seconds * 1000, done: false };
    const li = document.createElement('li');
    li.className = 'timer';
    li.innerHTML = '<span class="t-name"></span><span class="t-clock"></span><button class="t-cancel" type="button">Cancel</button><div class="t-bar"><i></i></div>';
    li.querySelector('.t-name').textContent = timerTitle(t);
    li.querySelector('.t-cancel').addEventListener('click', () => cancelTimer(t));
    t.li = li;
    timers.push(t);
    el.timerList.appendChild(li);
    renderTimer(t);
    refreshTimerList();
    return t;
  }

  function cancelTimer(t) {
    const i = timers.indexOf(t);
    if (i >= 0) timers.splice(i, 1);
    t.li.remove();
    refreshTimerList();
  }

  function refreshTimerList() { el.noTimers.hidden = timers.length > 0; }
  function remainingSeconds(t) { return Math.max(0, Math.ceil((t.endAt - Date.now()) / 1000)); }

  function renderTimer(t) {
    const left = remainingSeconds(t);
    t.li.querySelector('.t-clock').textContent = L.formatClock(left);
    t.li.querySelector('.t-bar i').style.width = `${Math.max(0, (left / t.total) * 100)}%`;
  }

  let alertLines = [];
  function fireTimer(t) {
    t.done = true;
    const msg = t.kind === 'reminder' ? `Reminder! It is time to ${t.what}.`
      : t.kind === 'study' ? 'Great job! Your study time is over. Take a short break.'
      : `Time is up! Your timer for ${L.formatDuration(t.total)} is done.`;
    t.li.classList.add('done');
    t.li.querySelector('.t-clock').textContent = 'Done!';
    t.li.querySelector('.t-cancel').textContent = 'Dismiss';
    t.li.querySelector('.t-bar i').style.width = '0%';
    alertLines.push(msg);
    el.alertText.textContent = alertLines.join(' ');
    el.overlay.hidden = false;
    el.alertOk.focus();
    beep(3);
    setTimeout(() => noorSays(msg, { noResume: true }), 1300);
    setTimeout(() => { if (timers.includes(t)) cancelTimer(t); }, 15000);
  }

  el.alertOk.addEventListener('click', () => { el.overlay.hidden = true; alertLines = []; });

  setInterval(() => {
    for (const t of timers.slice()) {
      if (t.done) continue;
      renderTimer(t);
      if (Date.now() >= t.endAt) fireTimer(t);
    }
  }, 250);

  /* ================= Understanding what the user wants ================= */
  const MAX_SECONDS = 24 * 3600;

  function startTimerFromCommand(kind, seconds, what) {
    if (seconds > MAX_SECONDS) return 'That is too long for me! I can set timers up to 24 hours.';
    addTimer(kind, seconds, what);
    const dur = L.formatDuration(seconds);
    if (kind === 'study') return `Okay${nameTag()}! Your study timer for ${dur} has started. Let's focus!`;
    return kind === 'reminder'
      ? `Okay${nameTag()}! I will remind you to ${what} in ${dur}. Please keep this page open.`
      : `Okay${nameTag()}! Your timer for ${dur} has started. I will tell you when time is up.`;
  }

  function activeTimers() { return timers.filter((t) => !t.done); }

  /* ---- Noor asks "yes or no?" and waits for a thumbs up, the word yes, or the Yes button ---- */
  let confirmTimeout = null;
  function clearConfirm() {
    state.confirm = null;
    el.confirmBar.hidden = true;
    clearTimeout(confirmTimeout);
  }
  function askConfirm(question, onYes) {
    clearConfirm();
    state.confirm = { question, onYes };
    el.confirmText.textContent = question;
    el.confirmBar.hidden = false;
    confirmTimeout = setTimeout(() => {
      if (!state.confirm) return;
      clearConfirm();
      addMessage('note', 'I stopped waiting for an answer, so nothing was changed.');
    }, 30000);
    return `${question} Give me a thumbs up, say yes, or press Yes.`;
  }
  function resolveConfirm(yes) {
    const c = state.confirm;
    if (!c) return null;
    clearConfirm();
    return yes ? c.onYes() : 'Okay, I cancelled that.';
  }

  function handleCommand(cmd) {
    switch (cmd.type) {
      case 'timer': return startTimerFromCommand('timer', cmd.seconds);
      case 'reminder': return startTimerFromCommand('reminder', cmd.seconds, cmd.what);
      case 'needDuration':
        state.pending = { kind: 'timer' };
        return 'Sure! For how long should I set the timer?';
      case 'needTime':
        if (!cmd.what) return 'Sure! Tell me like this: "remind me to drink water in 10 minutes."';
        state.pending = { kind: 'reminder', what: cmd.what };
        return `Okay! When should I remind you to ${cmd.what}? For example, "in 10 minutes".`;
      case 'cancel': {
        const n = timers.length;
        timers.slice().forEach(cancelTimer);
        el.overlay.hidden = true;
        return n ? `Okay, I cancelled ${n === 1 ? 'your timer' : `all ${n} timers`}.` : 'You do not have any timers running.';
      }
      case 'timeLeft': {
        const list = activeTimers();
        if (!list.length) return 'You do not have any timers running.';
        return list.slice(0, 3).map((t) => {
          const s = remainingSeconds(t);
          return `${t.kind === 'reminder' ? `Your reminder to ${t.what}` : `Your timer for ${L.formatDuration(t.total)}`} has ${L.formatDuration(s)} left.`;
        }).join(' ');
      }
      case 'openHomework':
        el.hw.open = true;
        el.hw.scrollIntoView({ block: 'nearest' });
        return 'Okay! I opened the homework helper. You can type a question there or start a study timer.';
      case 'closeHomework':
        el.hw.open = false;
        return 'Okay, I closed the homework helper.';
      case 'studyTimer': {
        const seconds = cmd.seconds || Number(el.studyMinutes.value) * 60;
        if (seconds > MAX_SECONDS) return 'That is too long for me! I can set timers up to 24 hours.';
        return askConfirm(`Shall I start a study timer for ${L.formatDuration(seconds)}?`, () => startTimerFromCommand('study', seconds));
      }
      case 'newConversation':
        return askConfirm('Do you want to start a new conversation? I will clear the chat and forget your name.',
          () => { setTimeout(() => newConversation(true), 0); return { skip: true }; });
      case 'stopTalking':
        cancelSpeech();
        return { text: 'Okay, I will be quiet.', silent: true };
      default: return null;
    }
  }

  function clockAnswer(text) {
    const t = text.toLowerCase();
    const now = new Date();
    if (/what(?:'s| is) the time|what time is it|tell me the time/.test(t))
      return `It is ${now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`;
    if (/what(?:'s| is)? (?:the |today'?s )?date|what day is (?:it|today)|what is today/.test(t))
      return `Today is ${now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.`;
    return null;
  }

  let aiController = null;
  async function askAI() {
    const ctrl = new AbortController();
    aiController = ctrl;
    const timeout = setTimeout(() => ctrl.abort(), 25000);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: state.history, name: state.name }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error('AI service returned ' + res.status);
      const data = await res.json();
      if (!data.reply) throw new Error('empty reply');
      return data.reply;
    } finally { clearTimeout(timeout); }
  }

  // Decide Noor's reply. Returns a string, or {text, silent}.
  async function decideReply(text) {
    const gen = state.generation;
    // 0. Noor is waiting for yes / no (thumbs up and fist are handled in onGesture)
    if (state.confirm) {
      if (/^(?:yes|yeah|yep|yup|sure|ok|okay|please|do it|go ahead|confirm)\b/i.test(text.trim())) return resolveConfirm(true);
      if (/^(?:no|nope|nah|cancel|never ?mind|stop|don'?t)\b/i.test(text.trim())) return resolveConfirm(false);
      clearConfirm();
    }
    // 1. Noor asked a question earlier ("For how long?"), so check if this answers it.
    if (state.pending) {
      const p = state.pending;
      state.pending = null;
      if (/never ?mind|forget it|cancel that|no thanks/i.test(text)) return 'Okay, no problem! I will not set it.';
      const seconds = L.parseDuration(text);
      if (seconds) return startTimerFromCommand(p.kind, seconds, p.what);
    }

    // 2. Timers, reminders and "stop"
    const cmd = L.parseCommand(text);
    if (cmd) { const r = handleCommand(cmd); if (r) return r; }

    // 3. Remember (or correct) the name
    const previousName = state.name;
    const found = L.extractName(text, previousName);
    if (found) { state.name = found.name; updateNameChip(); }

    // 4. Exact maths and clock questions are answered by the app, never guessed by the AI
    const math = L.tryMath(text);
    if (math) return math.error ? math.error : `${math.pretty} = ${math.result}.${state.name && state.nameUses++ % 3 === 0 ? ` Nice work, ${state.name}!` : ''}`;
    const clock = clockAnswer(text);
    if (clock) return clock;

    // 5. Everything else: the AI (with the whole chat history), or the offline Demo brain
    if (state.aiAvailable) {
      try { return await askAI(); } catch (err) {
        if (gen !== state.generation) throw new Error('cancelled');   // the user pressed stop (fist)
        console.warn(err);
        addMessage('note', 'I could not reach my AI brain just now, so I used my small offline brain for this answer.');
      }
    }
    await new Promise((r) => setTimeout(r, 350));
    return L.demoReply(text, { name: state.name, prevName: previousName }, state.demoMemory);
  }

  async function deliverReply(reply) {
    if (reply && reply.skip) return;
    if (typeof reply === 'object') {
      addMessage('noor', reply.text);
      state.history.push({ role: 'assistant', content: reply.text });
      setStatus('idle');
      return;
    }
    await noorSays(reply);
    if (status === 'thinking') setStatus('idle');
  }

  async function processUserText(raw) {
    const text = raw.trim();
    if (!text || state.busy) return;
    state.busy = true;
    const gen = state.generation;
    stopListening();
    cancelSpeech();
    showNotice('');
    addMessage('user', text);
    state.history.push({ role: 'user', content: text });
    setStatus('thinking');
    let reply;
    try {
      reply = await decideReply(text);
    } catch (err) {
      if (gen !== state.generation) return;        // cancelled: say nothing
      console.error(err);
      reply = 'Oops, something went wrong inside my circuits. Could you try again?';
    }
    if (gen !== state.generation) return;
    state.busy = false;
    await deliverReply(reply);
  }

  /* ================= Hand gestures (camera) ================= */
  const lookTimer = { id: null };

  function gestureNote(g, what) {
    const info = window.NoorGestures.GESTURES[g];
    addMessage('note', `${info.icon} ${info.name}: ${what}`);
  }

  function stopEverything() {
    state.generation++;                 // any answer that is still coming gets thrown away
    if (aiController) aiController.abort();
    state.busy = false;
    state.pending = null;
    clearConfirm();
    cancelSpeech();
    stopListening();
    el.overlay.hidden = true;
    alertLines = [];
    setStatus('idle');
  }

  function onGesture(g) {
    switch (g) {
      case 'open_palm': {
        el.robot.classList.add('waving');
        setTimeout(() => el.robot.classList.remove('waving'), 1700);
        gestureNote(g, 'Noor waves hello');
        noorSays(state.name ? `Hello, ${state.name}!` : 'Hello!', { remember: false, noResume: true });
        break;
      }
      case 'point_left':
      case 'point_right': {
        const dir = g === 'point_left' ? 'left' : 'right';
        el.robot.dataset.look = dir;
        clearTimeout(lookTimer.id);
        lookTimer.id = setTimeout(() => { delete el.robot.dataset.look; }, 5000);
        gestureNote(g, `Noor turns her face ${dir}`);
        break;
      }
      case 'thumbs_up':
        if (state.confirm) { gestureNote(g, 'confirmed'); answerConfirm(true, '👍 Yes (thumbs up)'); }
        else gestureNote(g, 'I saw it, but I am not waiting for a yes right now');
        break;
      case 'fist':
        stopEverything();
        gestureNote(g, 'I stopped talking and cancelled what I was doing (timers keep running)');
        break;
      default: break;
    }
  }

  async function answerConfirm(yes, label) {
    if (!state.confirm) return;
    addMessage('user', label);
    state.history.push({ role: 'user', content: yes ? 'Yes' : 'No' });
    await deliverReply(resolveConfirm(yes));
  }

  /* ================= Page controls ================= */
  el.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = el.input.value;
    el.input.value = '';
    showHeard('');
    processUserText(text);
  });

  el.mic.addEventListener('click', () => {
    if (rec) { if (session) session.stopped = true; rec.stop(); return; }   // "Stop": send what was heard
    startListening();
  });
  el.retry.addEventListener('click', () => { showHeard(''); startListening(); });
  el.fix.addEventListener('click', () => { el.input.value = el.heardText.textContent; showHeard(''); el.input.focus(); });

  el.mute.addEventListener('click', () => {
    state.muted = !state.muted;
    if (state.muted) cancelSpeech();
    el.mute.setAttribute('aria-pressed', String(state.muted));
    el.mute.textContent = state.muted ? '🔇 Voice: Off' : '🔊 Voice: On';
  });
  el.stopSpeak.addEventListener('click', cancelSpeech);
  el.confirmYes.addEventListener('click', () => answerConfirm(true, 'Yes'));
  el.confirmNo.addEventListener('click', () => answerConfirm(false, 'No'));
  el.studyStart.addEventListener('click', () => {
    const seconds = Number(el.studyMinutes.value) * 60;
    noorSays(startTimerFromCommand('study', seconds), { remember: false });
  });
  el.hwAsk.addEventListener('click', () => {
    const q = el.hwQuestion.value.trim();
    if (!q) { el.hwQuestion.focus(); return; }
    el.hwQuestion.value = '';
    processUserText(`Help me with this homework, step by step: ${q}`);
  });
  el.hwQuestion.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); el.hwAsk.click(); } });
  if (window.NoorGestures) window.NoorGestures.onFire = onGesture;
  el.voice.addEventListener('change', () => store.set('noor.voice', el.voice.value));
  el.rate.addEventListener('change', () => store.set('noor.rate', el.rate.value));

  document.querySelectorAll('.chip').forEach((chip) =>
    chip.addEventListener('click', () => processUserText(chip.dataset.say)));

  const GREETING = 'Hi! I am Noor, your AI helper. What is your name?';
  function newConversation(speakGreeting) {
    stopListening();
    cancelSpeech();
    state.generation++;
    clearConfirm();
    delete el.robot.dataset.look;
    state.name = null; state.history = []; state.pending = null; state.demoMemory = {}; state.nameUses = 0; state.busy = false;
    el.chat.innerHTML = '';
    el.input.value = '';
    showHeard(''); showNotice('');
    updateNameChip();
    setStatus('idle');
    addMessage('noor', GREETING);
    state.history.push({ role: 'assistant', content: GREETING });
    if (speakGreeting) speak(GREETING);
  }
  el.newChat.addEventListener('click', () => newConversation(true));

  /* ================= Start-up ================= */
  async function init() {
    el.rate.value = store.get('noor.rate') || '0.95';

    if (synth) {
      loadVoices();
      synth.onvoiceschanged = loadVoices;
    } else {
      el.mute.disabled = el.stopSpeak.disabled = true;
      showNotice('This browser cannot speak out loud, so you will read Noor\'s words on the screen. Chrome or Edge works best.', true);
    }

    if (!SR) {
      el.mic.disabled = true;
      el.micLabel.textContent = 'Voice not available';
      showNotice('Voice input needs Google Chrome or Microsoft Edge. You can still type to Noor below!', true);
    } else if (!window.isSecureContext) {
      showNotice('To use the microphone, open this page at http://localhost:3000 (not by IP address).', false);
    } else if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' }).then((p) => {
        if (p.state === 'denied') showNotice('The microphone is blocked. Click the 🔒 icon next to the web address, allow the Microphone, then reload. You can still type!');
      }).catch(() => {});
    }

    try {
      const res = await fetch('/api/status');
      const info = await res.json();
      state.aiAvailable = Boolean(info.ai);
    } catch (e) { state.aiAvailable = false; }
    el.badge.textContent = state.aiAvailable ? '✨ AI mode: connected' : '🧪 DEMO MODE (no AI key)';
    el.badge.className = 'badge ' + (state.aiAvailable ? 'ai' : 'demo');
    el.demoInfo.hidden = state.aiAvailable;

    newConversation(false);
  }

  // Tiny hooks so automated tests can check the app without a real microphone.
  window.__noor = { state, processUserText, timers, onGesture };
  init();
})();
