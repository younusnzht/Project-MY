// Noor's "thinking helpers". No browser code in here, so it can be tested with Node.
// Contents: number words, maths, name memory, timer/reminder commands, and the offline Demo brain.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NoorLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- Number words: "twenty five" -> 25 ---------- */
  const UNITS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
  const TENS = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
  const SCALES = { thousand: 1000, million: 1000000 };
  const isNumWord = (w) => w in UNITS || w in TENS || w === 'hundred' || w in SCALES;
  const clean = (w) => (w || '').toLowerCase().replace(/[.,?!]+$/, '');

  function wordsToNumbers(text) {
    const toks = text.split(/\s+|(?<=[a-z])-(?=[a-z])/i).filter(Boolean);
    const out = [];
    let i = 0;
    while (i < toks.length) {
      if (!isNumWord(clean(toks[i]))) { out.push(toks[i]); i++; continue; }
      let total = 0, cur = 0, j = i;
      while (j < toks.length) {
        const w = clean(toks[j]);
        const r = cur % 100;
        if (w in UNITS && (r === 0 || (r >= 20 && r % 10 === 0 && UNITS[w] < 10 && UNITS[w] > 0))) cur += UNITS[w];
        else if (w in TENS && r === 0) cur += TENS[w];
        else if (w === 'hundred' && cur > 0 && cur < 100) cur *= 100;
        else if (w in SCALES && (cur > 0 || total === 0)) { total += (cur || 1) * SCALES[w]; cur = 0; }
        else if (w === 'and' && j > i && /^(hundred|thousand|million)$/.test(clean(toks[j - 1])) && isNumWord(clean(toks[j + 1]))) { /* skip "and" */ }
        else break;
        j++;
      }
      if (j === i) { out.push(toks[i]); i++; continue; } // lone word that did not fit (e.g. "five twenty")
      let value = String(total + cur);
      if (clean(toks[j]) === 'point' && clean(toks[j + 1]) in UNITS && UNITS[clean(toks[j + 1])] < 10) {
        let digits = '';
        j++;
        while (j < toks.length && clean(toks[j]) in UNITS && UNITS[clean(toks[j])] < 10) digits += UNITS[clean(toks[j++])];
        value += '.' + digits;
      }
      out.push(value);
      i = j;
    }
    return out.join(' ');
  }

  /* ---------- Maths (never uses eval) ---------- */
  class MathError extends Error {}

  function evaluate(expr) {
    const tokens = expr.match(/sqrt|\d+(?:\.\d+)?|\.\d+|[-+*/^()]/g) || [];
    if (tokens.join('') !== expr.replace(/\s+/g, '')) throw new MathError('syntax');
    let pos = 0;
    const peek = () => tokens[pos];
    function parseExpr() {
      let v = parseTerm();
      while (peek() === '+' || peek() === '-') { const op = tokens[pos++]; const r = parseTerm(); v = op === '+' ? v + r : v - r; }
      return v;
    }
    function parseTerm() {
      let v = parseUnary();
      while (peek() === '*' || peek() === '/') {
        const op = tokens[pos++]; const r = parseUnary();
        if (op === '/') { if (r === 0) throw new MathError('zero'); v /= r; } else v *= r;
      }
      return v;
    }
    function parseUnary() {
      if (peek() === '-') { pos++; return -parseUnary(); }
      if (peek() === '+') { pos++; return parseUnary(); }
      return parsePower();
    }
    function parsePower() {
      const base = parsePrimary();
      if (peek() === '^') { pos++; return Math.pow(base, parseUnary()); }
      return base;
    }
    function parsePrimary() {
      const tk = tokens[pos++];
      if (tk === 'sqrt') { const v = parsePrimary(); if (v < 0) throw new MathError('negative-root'); return Math.sqrt(v); }
      if (tk === '(') { const v = parseExpr(); if (tokens[pos++] !== ')') throw new MathError('syntax'); return v; }
      if (tk !== undefined && /^[\d.]/.test(tk)) return parseFloat(tk);
      throw new MathError('syntax');
    }
    const result = parseExpr();
    if (pos !== tokens.length) throw new MathError('syntax');
    return result;
  }

  function formatNumber(n) {
    return Number(n.toPrecision(12)).toLocaleString('en-US', { maximumFractionDigits: 8 });
  }

  // Returns null if the text is not a maths question, or {pretty, result} / {error}.
  function tryMath(input) {
    let t = ' ' + input.toLowerCase().replace(/[?!,=]/g, ' ') + ' ';
    t = t.replace(/\b(hey|hi|hello|noor|please|can you|could you|would you|tell me|what is|what's|whats|what are|how much is|how much|calculate|compute|solve|work out|figure out|the answer to|the result of|answer|find|equals?|equal to|is)\b/g, ' ');
    t = wordsToNumbers(t).replace(/\s+/g, ' ').trim();

    const pct = t.match(/^(\d+(?:\.\d+)?)\s*(?:%|percent)\s*of\s*(\d+(?:\.\d+)?)$/);
    let prettyOverride = null;
    if (pct) prettyOverride = `${pct[1]}% of ${pct[2]}`;

    t = t
      .replace(/\bsquare root of\s*(\d+(?:\.\d+)?)/g, 'sqrt($1)')
      .replace(/\bsqrt\s*(\d+(?:\.\d+)?)/g, 'sqrt($1)')
      .replace(/(\d+(?:\.\d+)?)\s*(?:%|percent)\s*of\s*/g, '($1/100)*')
      .replace(/\bhalf of\s*/g, '0.5*')
      .replace(/\b(?:double|twice)\s*/g, '2*')
      .replace(/\btriple\s*/g, '3*')
      .replace(/\bmultiply\s+(\S+)\s+by\s+(\S+)/g, '$1*$2')
      .replace(/\bdivide\s+(\S+)\s+by\s+(\S+)/g, '$1/$2')
      .replace(/\badd\s+(\S+)\s+(?:and|to)\s+(\S+)/g, '$1+$2')
      .replace(/\bsubtract\s+(\S+)\s+from\s+(\S+)/g, '$2-$1')
      .replace(/\bsquared\b/g, '^2')
      .replace(/\bcubed\b/g, '^3')
      .replace(/\bto the power of\b|\braised to\b/g, '^')
      .replace(/\b(?:multiplied by|multiply by|times|multiplied|into)\b|×/g, '*')
      .replace(/\b(?:divided by|divide by|over)\b|÷/g, '/')
      .replace(/\bplus\b/g, '+')
      .replace(/\b(?:minus|take away|less)\b|−/g, '-')
      .replace(/(\d)\s*x\s*(?=\d)/g, '$1*');

    const bare = t.replace(/sqrt/g, '').replace(/\s+/g, '');
    if (!/^[\d+\-*/().^]+$/.test(bare) || !/\d/.test(bare) || !/[-+*/^]|sqrt/.test(t)) return null;

    const expr = t.replace(/\s+/g, '');
    try {
      const value = evaluate(expr);
      if (!Number.isFinite(value)) return { error: "That number is too big for me to work out!" };
      const pretty = prettyOverride || expr.replace(/sqrt/g, '√').replace(/\*/g, ' × ').replace(/\//g, ' ÷ ')
        .replace(/(\d)([+-])(?=[\d(√])/g, '$1 $2 ').replace(/\s+/g, ' ').trim();
      return { pretty, result: formatNumber(value) };
    } catch (e) {
      if (!(e instanceof MathError)) throw e;
      if (e.message === 'zero') return { error: "We can't divide by zero. No number of groups can share nothing! Try a different one." };
      if (e.message === 'negative-root') return { error: "We can't take the square root of a negative number yet. That's for older students!" };
      return null; // not really maths
    }
  }

  /* ---------- Name memory ---------- */
  const NOT_NAMES = new Set(('fine good great okay ok well happy sad tired hungry thirsty sorry ready here back new in on at a an the not so very ' +
    'bored excited sick late done confused stuck nervous scared cold hot busy curious still just really also going trying learning doing having ' +
    'feeling from grade years year old young fifth five ten eleven twelve alright awesome amazing angry worried upset sleepy hello hi hey noor ' +
    'good bad terrible fantastic wonderful lost interested thinking asking wondering looking learning ill unwell better afraid proud shy sure ' +
    'wrong right correct kind funny smart clever nice').split(' '));
  const cap = (n) => n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
  const NAME = "([a-z][a-z'-]{1,19})";

  // Returns {name} when the message tells us (or corrects) the user's name, else null.
  function extractName(text, currentName) {
    let m;
    const ok = (w) => w && !NOT_NAMES.has(w.toLowerCase());
    if ((m = text.match(new RegExp(`\\bnot\\s+[a-z'-]+[, ]+(?:it'?s|it is|i'?m|i am|my name is|call me)\\s+${NAME}`, 'i'))) && ok(m[1])) return { name: cap(m[1]) };
    if ((m = text.match(new RegExp(`\\b(?:my name is|my name's|call me|you can call me|people call me|everyone calls me)\\s+${NAME}`, 'i'))) && ok(m[1])) return { name: cap(m[1]) };
    if (currentName && /^\s*(?:no|actually|sorry|wait|oops|that'?s wrong|that is wrong)\b|not my name/i.test(text)) {
      if ((m = text.match(new RegExp(`\\b(?:it'?s|it is|i'?m|i am|its)\\s+${NAME}`, 'i'))) && ok(m[1])) return { name: cap(m[1]) };
    }
    // "I'm Sara" / "this is Sara": only accept when written with a capital letter (speech engines add one).
    if ((m = text.match(/\b(?:[Ii] am|[Ii]'m|[Ii]m|[Tt]his is)\s+([A-Z][a-z'-]{1,19})\b/)) && ok(m[1])) return { name: cap(m[1]) };
    return null;
  }

  /* ---------- Time helpers & timer/reminder commands ---------- */
  const UNIT = '(hours?|hrs?|minutes?|mins?|seconds?|secs?)';

  // "one and a half minutes", "90 seconds", "half an hour" ... -> seconds (or null)
  function parseDuration(text) {
    let t = ' ' + wordsToNumbers(text.toLowerCase().replace(/[?!,]/g, ' ')) + ' ';
    t = t
      .replace(/\bhalf an? hour\b/g, ' 30 minutes ')
      .replace(/\bhalf an? minute\b/g, ' 30 seconds ')
      .replace(/\b(?:a )?quarter (?:of an |of a )?hour\b/g, ' 15 minutes ')
      .replace(/\ban hour and a half\b/g, ' 90 minutes ')
      .replace(/\ba minute and a half\b/g, ' 90 seconds ')
      .replace(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:and a half|and half)\\s*${UNIT}`, 'g'), (m, n, u) => ` ${+n + 0.5} ${u} `)
      .replace(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${UNIT}\\s+and\\s+a\\s+half`, 'g'), (m, n, u) => ` ${+n + 0.5} ${u} `)
      .replace(new RegExp(`\\b(?:a|an)\\s+(?=${UNIT}\\b)`, 'g'), ' 1 ');
    const re = new RegExp(`(\\d+(?:\\.\\d+)?)(?:\\s*-?\\s*${UNIT}|(h|m|s))\\b`, 'g');
    let total = 0, found = false, m;
    while ((m = re.exec(t))) {
      const unit = m[2] || m[3];
      const mult = unit[0] === 'h' ? 3600 : unit[0] === 'm' ? 60 : 1;
      total += parseFloat(m[1]) * mult;
      found = true;
    }
    total = Math.round(total);
    return found && total > 0 ? total : null;
  }

  function formatDuration(sec) {
    const h = Math.floor(sec / 3600), mi = Math.floor((sec % 3600) / 60), s = sec % 60;
    const parts = [];
    if (h) parts.push(`${h} hour${h > 1 ? 's' : ''}`);
    if (mi) parts.push(`${mi} minute${mi > 1 ? 's' : ''}`);
    if (s) parts.push(`${s} second${s > 1 ? 's' : ''}`);
    return parts.join(' and ') || '0 seconds';
  }

  function formatClock(sec) {
    const h = Math.floor(sec / 3600), mi = Math.floor((sec % 3600) / 60), s = sec % 60;
    const two = (n) => String(n).padStart(2, '0');
    return h ? `${h}:${two(mi)}:${two(s)}` : `${two(mi)}:${two(s)}`;
  }

  const toYou = (s) => s.replace(/\bmy\b/g, 'your').replace(/\b(?:me|i)\b/g, 'you').replace(/\bmyself\b/g, 'yourself');

  // Returns a command object, or null when the message is not a timer/reminder/stop request.
  function parseCommand(raw) {
    const lower = raw.trim().toLowerCase().replace(/[.!?]+$/, '');
    const dur = (s) => parseDuration(s);

    if (/^(?:noor[, ]*)?(?:please )?(?:stop(?: talking| speaking)?|be quiet|quiet|shh+|shush)$/.test(lower)) return { type: 'stopTalking' };
    if (/\b(?:cancel|stop|delete|clear|remove|turn off|end)\b[^.]*\b(?:timers?|reminders?|alarms?|countdowns?)\b/.test(lower)) return { type: 'cancel' };
    if (/how (?:much )?(?:time|long)[^.]*\b(?:left|remaining|to go)\b|\btime (?:is )?left\b|\bhow long until\b/.test(lower)) return { type: 'timeLeft' };

    // Actions the character performs ("wave", "nod", "dance" ...)
    const bare = lower.replace(/^(?:(?:hey|hi|ok|okay|please|noor|can you|could you|would you|will you)[, ]+)+/, '').trim();
    const ACTIONS = [
      ['wave', /^(?:wave|do a wave|wave (?:at|to) me|wave hello|wave your hand)$/],
      ['nod', /^(?:nod|nod your head|say yes with your head)$/],
      ['shake', /^(?:shake your head|shake no|say no with your head)$/],
      ['smile', /^(?:smile|give me a smile|show me a smile|give me a big smile)$/],
      ['dance', /^(?:dance|do a dance|dance for me|let'?s dance)$/],
      ['thumbs_up', /^(?:give me a thumbs up|thumbs up|show me a thumbs up|give a thumbs up)$/],
      ['hands_up', /^(?:(?:put|raise) your hands? up|hands up)$/],
      ['look_left', /^(?:look|turn|face)(?: your head)?(?: to the)? left$/],
      ['look_right', /^(?:look|turn|face)(?: your head)?(?: to the)? right$/],
    ];
    for (const [name, re] of ACTIONS) if (re.test(bare)) return { type: 'action', name };
    if (/^(?:go to sleep|sleep now|stop listening|go to standby)$/.test(bare)) return { type: 'sleep' };

    // Things inside Noor's own app: homework panel, study timer, new conversation
    if (/\b(?:close|hide)\b[^.]*\bhomework\b/.test(lower)) return { type: 'closeHomework' };
    if (/\b(?:open|show|go to|bring up)\b[^.]*\b(?:homework|study)\b[^.]*\b(?:panel|helper|help|tools?|corner)\b/.test(lower)) return { type: 'openHomework' };
    if (/\b(?:start|begin|run|set|go)\b[^.]*\b(?:study|homework|focus)\s+(?:timer|session|time)\b|^(?:my |the )?study timer$/.test(lower)) return { type: 'studyTimer', seconds: dur(lower) };
    if (/\b(?:start|begin|make|open)\s+(?:a\s+)?(?:new|fresh)\s+(?:conversation|chat)\b|\bstart over\b|\b(?:clear|reset)\s+(?:the |our )?(?:chat|conversation)\b/.test(lower)) return { type: 'newConversation' };

    // Reminders. The time phrase can come before or after what to remember.
    const forms = [
      [/remind(?:er)?\s+me\s+(?:in|after)\s+(.+?)\s+(?:to|about|that)\s+(.+)$/, 'dur-what'],
      [/remind(?:er)?\s+me\s+(?:to|about|that)\s+(.+)\s+(?:in|after|for)\s+(.+)$/, 'what-dur'],
      [/(?:set|make|create|add)\s+(?:me\s+)?an?\s+reminder\s+(?:for|in)\s+(.+?)\s+(?:to|about|that)\s+(.+)$/, 'dur-what'],
      [/(?:set|make|create|add)\s+(?:me\s+)?an?\s+reminder\s+(?:to|about)\s+(.+)\s+(?:in|after|for)\s+(.+)$/, 'what-dur'],
    ];
    for (const [re, order] of forms) {
      const m = lower.match(re);
      if (!m) continue;
      const seconds = dur(order === 'dur-what' ? m[1] : m[2]);
      const what = order === 'dur-what' ? m[2] : m[1];
      if (seconds) return { type: 'reminder', seconds, what: toYou(what) };
    }
    let m;
    if ((m = lower.match(/remind(?:er)?\s+me\s+(?:to|about|that)\s+(.+)$/))) return { type: 'needTime', what: toYou(m[1]) };
    if (/\b(?:set|make|create|add|start)\s+(?:me\s+)?an?\s+reminder\b/.test(lower)) return { type: 'needTime', what: '' };

    // Timers
    if (/\b(?:timer|countdown|count down|alarm)\b/.test(lower) || /\btime me\b/.test(lower)) {
      const seconds = dur(lower);
      if (seconds) return { type: 'timer', seconds };
      if (/\b(?:set|start|make|create|begin|run|put|need|want)\b/.test(lower)) return { type: 'needDuration' };
    }
    return null;
  }

  /* ---------- Wake phrase: "Hi Noor" ---------- */
  // Speech engines sometimes spell the name differently, so a few spellings are accepted.
  const NAMES = '(?:noor|nur|nour|noore|nora|nuur)';
  const WAKE = new RegExp(`\\b(?:hi|hey|hello|hay|hiya|okay|ok|salaam|assalamu alaikum|good (?:morning|afternoon|evening))[, ]+(?:there[, ]+)?${NAMES}\\b[,.!?]*\\s*`, 'i');
  const WAKE_BARE = new RegExp(`^\\s*${NAMES}\\b[,.!?]*\\s*`, 'i');
  // -> { woke: boolean, rest: what was said after the wake phrase }
  function parseWake(text) {
    let m = WAKE.exec(text);
    if (m) return { woke: true, rest: (text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)).trim() };
    m = WAKE_BARE.exec(text);
    if (m) return { woke: true, rest: text.slice(m[0].length).trim() };
    return { woke: false, rest: text };
  }

  /* ---------- Speech helper: make text sound right when read aloud ---------- */
  function speakable(text) {
    return text
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
      .replace(/√/g, ' square root of ')
      .replace(/×/g, ' times ')
      .replace(/÷/g, ' divided by ')
      .replace(/\^2\b/g, ' squared ')
      .replace(/\^3\b/g, ' cubed ')
      .replace(/(\d)\s*[-−]\s*(?=[\d(])/g, '$1 minus ')
      .replace(/(\d)\s*\+\s*(?=[\d(])/g, '$1 plus ')
      .replace(/\s=\s/g, ' equals ')
      .replace(/(\d)\s*%/g, '$1 percent')
      .replace(/[*#_`~]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Break a reply into sentences so Noor can pause between them.
  function splitSentences(text) {
    return (text.match(/[^.!?]+[.!?]*(?:\s+|$)/g) || [text]).map((s) => s.trim()).filter(Boolean);
  }

  /* ---------- Demo brain: works with no AI key ---------- */
  const TOPICS = [
    { id: 'the water cycle', test: /water cycle|evaporat|condensation|precipitation/,
      short: 'The water cycle is how water travels around Earth. The sun warms water, it rises as vapor, makes clouds, and falls back down as rain or snow.',
      detail: 'Here are the steps. One: the sun heats water in oceans and rivers, and it evaporates into the air. Two: the vapor cools and condenses into clouds. Three: water falls as rain, snow, or hail. Four: it collects in rivers, lakes, and oceans, and the cycle starts again.',
      again: 'Let me say it another way. Water is always on a trip! The sun lifts it up, the clouds carry it, and rain brings it back down.',
      examples: ['A puddle is a good example. When the sun shines, the puddle gets smaller because the water evaporates into the air.', 'Think of a cold glass of water on a hot day. Little drops form on the outside. That is condensation!'] },
    { id: 'photosynthesis', test: /photosynthesis|how do plants (make|get) (food|energy)/,
      short: 'Photosynthesis is how plants make their own food. They use sunlight, water, and air to make sugar and give us oxygen.',
      detail: 'Leaves hold a green stuff called chlorophyll. It catches sunlight. The plant takes in water through its roots and carbon dioxide through its leaves. Then it makes sugar for energy and releases oxygen for us to breathe.',
      again: 'Here is a simpler way. A plant is like a tiny kitchen. Sunlight is the stove, and water and air are the ingredients. The food it cooks is sugar!',
      examples: ['A sunflower turns its face to the sun to catch more light for making food.', 'A plant kept in a dark cupboard turns yellow and weak, because it cannot make food without light.'] },
    { id: 'gravity', test: /gravity|why do things fall/,
      short: 'Gravity is a force that pulls things toward each other. Earth\'s gravity pulls everything down toward the ground.',
      detail: 'Big things like planets have strong gravity. That is why you stay on the ground, and why the Moon goes around Earth. The Moon has less gravity than Earth, so astronauts can jump very high there.',
      again: 'Gravity is like an invisible hug from Earth. It keeps us on the ground and makes dropped things fall.',
      examples: ['When you drop a ball, gravity pulls it down to the floor.', 'The Moon circles Earth because Earth\'s gravity holds on to it, like a ball on a string.'] },
    { id: 'the solar system', test: /solar system|planets?\b/,
      short: 'The solar system is the Sun and everything that goes around it. There are eight planets: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, and Neptune.',
      detail: 'The four planets closest to the Sun are small and rocky. The four far away are big, and Jupiter is the biggest of all. Saturn is famous for its beautiful rings. Earth is the only planet we know that has life.',
      again: 'Imagine the Sun is a big glowing ball in the middle. Eight planets travel around it in circles, each at its own distance.',
      examples: ['To remember the order, try: My Very Eager Mother Just Served Us Noodles.', 'Jupiter is so big that more than one thousand Earths could fit inside it!'] },
    { id: 'fractions', test: /fractions?\b/,
      short: 'A fraction shows part of a whole. In three over four, the bottom number says how many equal parts, and the top number says how many we have.',
      detail: 'The top number is the numerator and the bottom number is the denominator. If a pizza is cut into 8 slices and you eat 3, you ate three eighths of the pizza.',
      again: 'Think of sharing a chocolate bar. If it has 4 equal pieces and you take 1, you have one fourth.',
      examples: ['A pizza cut into 4 equal slices: one slice is one fourth. Two slices are two fourths, which is the same as one half.', 'If a class has 10 students and 5 are girls, then five tenths, or one half, are girls.'] },
    { id: 'the food chain', test: /food chain|food web|predator|producer/,
      short: 'A food chain shows who eats what. Plants make food, animals eat plants, and bigger animals eat those animals.',
      detail: 'Plants are called producers. Animals that eat plants are herbivores, and animals that eat other animals are carnivores. All of them need the Sun, because the plants need sunlight to grow.',
      again: 'It is like a line of dinner guests. The grass gets eaten by a rabbit, and the rabbit gets eaten by a fox.',
      examples: ['Grass, then a grasshopper, then a frog, then a snake. Each one is food for the next.', 'In the ocean, tiny plants are eaten by small fish, and small fish are eaten by big fish.'] },
    { id: 'states of matter', test: /states? of matter|solid.*liquid|liquid.*gas/,
      short: 'Matter has three main states: solid, liquid, and gas. Solids keep their shape, liquids flow, and gases spread out everywhere.',
      detail: 'Heat can change the state. Ice is a solid. When it warms up it melts into liquid water. When water gets very hot, it becomes a gas called water vapor.',
      again: 'Think of water. Frozen, it is ice. Normal, it is a liquid. Boiling, it turns into steam.',
      examples: ['A rock is a solid, juice is a liquid, and the air in a balloon is a gas.', 'When you leave chocolate in the sun, it melts. A solid changed into a liquid!'] },
    { id: 'volcanoes', test: /volcano/,
      short: 'A volcano is an opening in Earth\'s crust where hot melted rock, called magma, can come out.',
      detail: 'Deep inside Earth it is so hot that rock melts. When the magma rises and bursts out, it is called lava. When lava cools, it turns into hard rock and builds the mountain taller.',
      again: 'Imagine shaking a fizzy drink and opening it. The pressure pushes the liquid out. A volcano erupts in a similar way.',
      examples: ['Mount Fuji in Japan is a volcano.', 'The islands of Hawaii were made by volcanoes, over a very long time.'] },
    { id: 'nouns, verbs and adjectives', test: /\bnouns?\b|\bverbs?\b|\badjectives?\b|parts of speech/,
      short: 'A noun names a person, place, or thing. A verb is an action word. An adjective describes a noun.',
      detail: 'In the sentence "The happy dog runs fast," dog is a noun, happy is an adjective, and runs is a verb. Fast tells how the dog runs, so it is an adverb.',
      again: 'Nouns are the "who or what". Verbs are the "doing". Adjectives are the "what kind".',
      examples: ['In "The tall girl jumped," girl is a noun, tall is an adjective, and jumped is a verb.', 'Try this one: "The small cat sleeps." Can you find the noun, the adjective, and the verb?'] },
  ];

  const WORDS = {
    evaporate: 'to change from a liquid into a gas, like water turning into vapor', habitat: 'the natural home of an animal or plant',
    adjective: 'a word that describes a noun, like "big" or "red"', noun: 'a word that names a person, place, or thing', verb: 'an action word, like "run" or "think"',
    predator: 'an animal that hunts other animals for food', prey: 'an animal that is hunted by another animal for food',
    generous: 'happy to give and share with others', courage: 'being brave even when you feel scared', kind: 'caring and gentle toward others',
    photosynthesis: 'how plants use sunlight to make their own food', ecosystem: 'a group of living things and their environment, all working together',
    numerator: 'the top number of a fraction', denominator: 'the bottom number of a fraction', erosion: 'when wind or water slowly wears away rock and soil',
    climate: 'the usual weather of a place over many years', weather: 'what the air outside is like today, such as sunny or rainy',
    migrate: 'to travel to another place for the season, like birds flying south', nocturnal: 'active at night instead of during the day',
    opinion: 'what a person thinks or feels about something', fact: 'something that is true and can be proved', sentence: 'a group of words that tells a complete idea',
    vocabulary: 'all the words that you know', continent: 'one of Earth\'s seven big land areas', mammal: 'an animal that has fur or hair and feeds its babies milk',
    reptile: 'a cold-blooded animal with scaly skin, like a snake or lizard', perimeter: 'the distance all the way around a shape',
    area: 'the amount of space inside a shape', symmetry: 'when both sides of something match, like a butterfly\'s wings',
    democracy: 'a way of running a country where people vote to choose their leaders', gravity: 'the force that pulls things toward each other',
    vapor: 'water that has turned into a gas', condense: 'to change from a gas into a liquid', friction: 'a force that slows things down when they rub together',
  };

  const STORIES = [
    { keys: /kind|nice|help/, text: 'Once there was a little robot named Bolt. One rainy day, Bolt saw a tiny bird shivering under a leaf. Bolt gently opened his umbrella and held it over the bird. The bird chirped a happy thank-you song. Bolt learned that a small act of kindness can make someone\'s whole day brighter.' },
    { keys: /honest|truth|lie/, text: 'Mina accidentally broke her mom\'s favorite cup. She felt scared, but she told the truth. Her mom hugged her and said, "Thank you for being honest. Cups can be fixed, but trust is special." Mina smiled and helped glue the cup back together.' },
    { keys: /never give up|try|persever|determin|brave|courage/, text: 'A little turtle wanted to climb a big hill. It was slow and tired, and other animals laughed. But the turtle kept going, one small step at a time. At the top, the turtle saw the whole valley glowing in the sunset. Slow and steady got there in the end.' },
    { keys: /team|friend|share|together|ants?/, text: 'Some little ants found a huge leaf. It was too heavy for one ant. So they lined up, lifted together, and carried it all the way home. Working as a team made the hard job easy. And that night, everyone shared a yummy dinner.' },
  ];

  const JOKES = [
    'Why did the robot go to school? To improve its byte-sized brain!',
    'What do you call a sleeping bull? A bulldozer!',
    'Why did the student eat her homework? Because the teacher said it was a piece of cake!',
  ];

  const pick = (arr, i) => arr[i % arr.length];

  // memory: { lastTopic, lastText, exampleIdx, storyIdx, jokeIdx, nameTick }
  function demoSentence(s, ctx, mem) {
    const t = s.toLowerCase().trim().replace(/[.!?]+$/, '');
    const nm = ctx.name ? `, ${ctx.name}` : '';
    const say = (text, topic) => { mem.lastText = text; if (topic !== undefined) mem.lastTopic = topic; return text; };

    // Introductions and name corrections
    const ni = extractName(s, ctx.prevName || ctx.name);
    if (ni) {
      if (ctx.prevName && ctx.prevName.toLowerCase() !== ni.name.toLowerCase())
        return say(`Oh, sorry about that! I will call you ${ni.name} from now on. How are you doing today?`);
      if (ctx.prevName) return say(`Yes, I remember, ${ni.name}! What would you like to do?`);
      return say(`Hi, ${ni.name}! How are you doing today?`);
    }
    if (/^(?:hi|hello|hey|hiya|good (?:morning|afternoon|evening)|salaam|assalamu alaikum|as-?salam)\b/.test(t) && t.split(' ').length <= 4) {
      return say(ctx.name ? `Hi again, ${ctx.name}! What would you like to do?` : 'Hi there! I am Noor, your AI helper. What is your name?');
    }
    if (/\bwhat(?:'s| is) my name\b|do you (?:know|remember) my name|who am i\b/.test(t))
      return say(ctx.name ? `Your name is ${ctx.name}! I remembered it.` : 'I do not know your name yet. What should I call you?');
    if (/\b(?:your name|who are you|who is this)\b/.test(t))
      return say('My name is Noor! I am your AI helper. What would you like to do today?');
    if (/how are you|how'?s it going|how do you do/.test(t))
      return say(`I am doing great, thank you for asking${nm}! How about you?`);
    if (/\b(?:what can you do|help me|what do you do|how do you work)\b/.test(t) && !/maths?|homework/.test(t))
      return say('I can answer school questions, explain lessons and words, do maths, tell short stories, and set timers and reminders. Just ask!');

    // Feelings
    if (/\b(?:fine|good|great|okay|ok|well|happy|awesome|amazing|excellent|wonderful|alright|not bad)\b/.test(t) && t.split(' ').length <= 5 && !/\bnot (?:so |very )?(?:good|well|great|okay)\b/.test(t))
      return say(`That is great to hear${nm}!`);
    if (/\b(?:sad|tired|bored|sick|upset|angry|worried|nervous|scared|bad|terrible|awful|not (?:so |very )?(?:good|well|great|okay))\b/.test(t) && t.split(' ').length <= 6)
      return say(`I am sorry you feel that way${nm}. I am here for you. Talking to a parent or teacher can help too. Would a short story or a joke cheer you up?`);

    // Follow-ups about the last answer
    const topic = mem.lastTopic;
    if (/(?:explain|say|tell).*\bagain\b|\brepeat (?:that|it)\b|\bonce more\b|(?:don'?t|do not) (?:understand|get) (?:it|that)|\bi'?m confused\b|another way/.test(t)) {
      if (topic && topic.again) return say('Okay, let me try again. ' + topic.again);
      if (mem.lastText) return say('Sure! ' + mem.lastText);
      return say('Of course! What would you like me to explain?');
    }
    if (/\bshorter\b|too long|\bin short\b|\bbriefly\b|\bsummar/.test(t)) {
      if (topic && topic.short) return say(topic.short.split(/(?<=[.!?])\s/)[0], topic);
      if (mem.lastText) return say(mem.lastText.split(/(?<=[.!?])\s/)[0]);
      return say('Sure! What should I make shorter?');
    }
    if (/another example|more examples?|give me (?:an |one )?example|for example|an example/.test(t)) {
      if (topic && topic.examples) { const e = pick(topic.examples, mem.exampleIdx++); return say(e, topic); }
      return say('I would love to! What should I give an example of?');
    }
    if (/tell me more|more (?:detail|info|about)|explain (?:it |that )?(?:more|better)|longer|in detail|step by step/.test(t)) {
      if (topic && topic.detail) return say(topic.detail, topic);
      return say('Happy to! What would you like to know more about?');
    }

    // Tasks
    if (/\b(?:joke|funny)\b/.test(t)) return say(pick(JOKES, mem.jokeIdx++));
    if (/\bstor(?:y|ies)\b/.test(t)) {
      const wantsNew = /another|next|different|more/.test(t);
      const story = (!wantsNew && STORIES.find((st) => st.keys.test(t))) || pick(STORIES, mem.storyIdx++);
      return say(story.text, null);
    }
    const w = t.match(/(?:what does|what is the meaning of|meaning of|define|what is a|what is an|what's a)\s+["']?([a-z-]+)["']?(?:\s+mean)?$/);
    if (w && WORDS[w[1]]) return say(`${cap(w[1])} means ${WORDS[w[1]]}.`, null);

    const found = TOPICS.find((tp) => tp.test.test(t));
    if (found) return say(found.short, found);

    if (/\b(?:maths?|math)\b.*\b(?:help|homework|question)\b|\b(?:help|homework)\b.*\bmaths?\b/.test(t))
      return say(`Of course${nm}! What maths question would you like help with?`, null);
    if (/\bhomework\b|\bhelp me (?:with|understand|learn)\b/.test(t))
      return say(`I would love to help${nm}! Tell me the question, and what you already tried. We will go step by step.`, null);
    if (/\b(?:thanks|thank you|thx)\b/.test(t)) return say(`You are welcome${nm}! I am happy to help.`);
    if (/\b(?:bye|goodbye|see you|good night)\b/.test(t)) return say(`Goodbye${nm}! Come back soon and we can learn more together.`);
    if (/^(?:yes|yeah|yep|sure|okay|ok|please)$/.test(t)) return say('Great! What would you like to do? I can explain a topic, tell a story, do maths, or set a timer.');
    if (/^(?:no|nope|nothing|no thanks)$/.test(t)) return say('That is okay! I am here whenever you want to ask something.');
    return null;
  }

  function demoReply(text, ctx, mem) {
    ctx = ctx || {};
    mem = mem || {};
    mem.exampleIdx = mem.exampleIdx || 0;
    mem.storyIdx = mem.storyIdx || 0;
    mem.jokeIdx = mem.jokeIdx || 0;
    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    const replies = [];
    for (const s of sentences) {
      const r = demoSentence(s, ctx, mem);
      if (r && !replies.includes(r)) replies.push(r);
    }
    if (replies.length) return replies.slice(0, 2).join(' ');
    return 'Hmm, I am not sure about that in Demo Mode. I know a few school topics, like the water cycle, plants, gravity, and fractions. I can also do maths, tell stories, and set timers. Try: "explain the water cycle"!';
  }

  return { parseWake, wordsToNumbers, tryMath, evaluate, extractName, parseDuration, formatDuration, formatClock, parseCommand,
    speakable, splitSentences, demoReply, TOPICS };
});
