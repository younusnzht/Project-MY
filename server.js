// Noor's small backend.
// Jobs: (1) serve the web page, (2) talk to the AI service so the API key stays secret.
require('dotenv').config();
const path = require('path');
const express = require('express');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1'; // only this laptop can open it
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
const API_URL = process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages';

// Read the key on every call so tests (and a restarted .env) behave simply.
function apiKey() {
  const key = (process.env.ANTHROPIC_API_KEY || '').trim();
  return key && !key.startsWith('your-') ? key : '';
}
function aiEnabled() {
  return Boolean(apiKey()) && process.env.NOOR_MODE !== 'demo';
}

function systemPrompt(name) {
  return [
    'You are Noor, a friendly AI robot helper for a Grade 5 student (about 10 years old).',
    'Personality: kind, patient, cheerful and encouraging.',
    'Language: simple English with short sentences. Explain hard words.',
    'Length: keep answers to 1-3 short sentences unless the student asks for more detail.',
    'Your words are read aloud, so write plain text only: no markdown, no bullet symbols, no emojis, no tables.',
    'Use conversation history. Handle follow-ups like "explain that again" (use different words), "make it shorter" and "give me another example".',
    'For homework, guide step by step and ask a small question so the student thinks too.',
    'Tell short, age-appropriate stories when asked.',
    'Never claim to set timers or reminders yourself. The app does that when the student says, for example, "set a timer for one minute".',
    'If you are not sure about a fact, say so honestly. Never make things up.',
    'If a topic is not suitable for children or is unsafe, gently say you cannot help and suggest talking to a parent or teacher.',
    name
      ? `The student's name is ${name}. Use it only now and then, naturally (not in every reply).`
      : 'You do not know the student\'s name yet. If it feels natural, you may ask for it once.',
  ].join('\n');
}

// Make sure the history is safe and valid before sending it on.
function cleanMessages(list) {
  const out = [];
  for (const m of Array.isArray(list) ? list.slice(-20) : []) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') continue;
    const content = m.content.trim().slice(0, 1000);
    if (!content) continue;
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += '\n' + content; // roles must alternate
    else out.push({ role: m.role, content });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

// Tiny rate limit (30 requests a minute per address) so a shared server cannot burn the key.
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 30;
}

const app = express();
app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));
// Hand-tracking library (installed by npm) is served from this computer, so gestures work offline.
app.use('/vendor/mediapipe', express.static(path.join(__dirname, 'node_modules', '@mediapipe', 'tasks-vision')));

app.get('/api/status', (req, res) => {
  res.json({ ai: aiEnabled(), mode: aiEnabled() ? 'ai' : 'demo', model: aiEnabled() ? MODEL : null });
});

app.post('/api/chat', async (req, res) => {
  if (!aiEnabled()) return res.status(503).json({ error: 'demo_mode' });
  if (rateLimited(req.ip)) return res.status(429).json({ error: 'too_many_requests' });

  const messages = cleanMessages(req.body && req.body.messages);
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return res.status(400).json({ error: 'bad_request' });
  }
  const name = typeof req.body.name === 'string' ? req.body.name.replace(/[^\p{L}\p{M}' -]/gu, '').slice(0, 30) : '';

  try {
    const upstream = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey(),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 350, temperature: 0.7, system: systemPrompt(name), messages }),
      signal: AbortSignal.timeout(20000),
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error('AI service error', upstream.status, data && data.error && data.error.message);
      return res.status(502).json({ error: 'ai_unavailable', status: upstream.status });
    }
    const reply = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join(' ').trim();
    if (!reply) return res.status(502).json({ error: 'empty_reply' });
    res.json({ reply });
  } catch (err) {
    console.error('AI request failed:', err.message);
    res.status(502).json({ error: 'ai_unavailable' });
  }
});

if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`\nNoor is awake!  Open  http://localhost:${PORT}  in Chrome or Edge.`);
    const fs = require('fs');
    if (!fs.existsSync(path.join(__dirname, 'node_modules', '@mediapipe', 'tasks-vision', 'vision_bundle.mjs'))) {
      console.log('WARNING: hand gestures need the library. Run "npm install" and start again.');
    }
    if (!fs.existsSync(path.join(__dirname, 'public', 'models', 'gesture_recognizer.task'))) {
      console.log('WARNING: public/models/gesture_recognizer.task is missing (hand gestures will not load). See README.');
    }
    console.log(aiEnabled() ? `AI mode ON (model: ${MODEL})` : 'DEMO MODE (no API key found - see README to turn on AI)');
  });
}

module.exports = { app, cleanMessages, systemPrompt };
