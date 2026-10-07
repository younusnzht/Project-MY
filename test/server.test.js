// Tests the backend against a fake AI service (no real key or internet needed).
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

test('backend: demo mode, AI mode, history and key safety', async () => {
  let lastBody = null, lastHeaders = null;
  const fake = http.createServer((req, res) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      lastBody = JSON.parse(data); lastHeaders = req.headers;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ content: [{ type: 'text', text: 'Hi, Muhammad! How are you?' }] }));
    });
  });
  await new Promise((r) => fake.listen(0, '127.0.0.1', r));
  process.env.ANTHROPIC_API_URL = `http://127.0.0.1:${fake.address().port}/v1/messages`;
  delete process.env.NOOR_MODE;
  process.env.ANTHROPIC_API_KEY = 'your-api-key-here'; // the .env.example placeholder = not configured

  const { app } = require('../server.js');
  const srv = app.listen(0, '127.0.0.1');
  await new Promise((r) => srv.once('listening', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const post = (body) => fetch(base + '/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

  try {
    assert.deepEqual(await (await fetch(base + '/api/status')).json(), { ai: false, mode: 'demo', model: null });
    assert.equal((await post({ messages: [{ role: 'user', content: 'hi' }] })).status, 503);

    process.env.ANTHROPIC_API_KEY = 'sk-test-secret';
    const status = await (await fetch(base + '/api/status')).json();
    assert.equal(status.ai, true);
    assert.ok(!JSON.stringify(status).includes('sk-test'), 'status must not leak the key');

    const r = await post({ name: 'Muhammad', messages: [
      { role: 'user', content: 'Hi, my name is Muhammad.' },
      { role: 'assistant', content: 'Hi, Muhammad! How are you?' },
      { role: 'user', content: 'Explain that again' } ] });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { reply: 'Hi, Muhammad! How are you?' });
    assert.equal(lastHeaders['x-api-key'], 'sk-test-secret');
    assert.equal(lastBody.messages.length, 3, 'whole history is forwarded');
    assert.match(lastBody.system, /Muhammad/);
    assert.match(lastBody.system, /Grade 5/);

    assert.equal((await post({ messages: [{ role: 'assistant', content: 'x' }] })).status, 400);
    assert.equal((await post({})).status, 400);
    process.env.NOOR_MODE = 'demo';
    assert.equal((await post({ messages: [{ role: 'user', content: 'hi' }] })).status, 503);
  } finally {
    srv.close(); fake.close();
  }
});
