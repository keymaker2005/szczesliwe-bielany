import assert from 'node:assert/strict';
import test from 'node:test';
import { ChatClient, chatDisabledByUrl, chatEndpoint, describeFailure, trimHistory } from '../js/chat.js';
import { createFakeServer } from '../tools/fake-czat.mjs';

const quiet = () => { const old = console.info; const calls = []; console.info = (...a) => calls.push(a); return { calls, restore: () => { console.info = old; } }; };

test('chat: address and the off switch', () => {
  assert.equal(chatEndpoint({ hostname: 'localhost' }), 'http://localhost:8787/api/czat');
  assert.equal(chatEndpoint({ hostname: '127.0.0.1' }), 'http://localhost:8787/api/czat');
  assert.equal(chatEndpoint({ hostname: 'localhost', search: '?czatport=8788' }), 'http://localhost:8788/api/czat');
  assert.equal(chatEndpoint({ hostname: 'bielany.zbigniew.ai', search: '?czatport=8788' }), '/api/czat');
  assert.equal(chatEndpoint({ hostname: 'bielany.zbigniew.ai' }), '/api/czat');
  assert.equal(chatDisabledByUrl('?czat=off'), true);
  assert.equal(chatDisabledByUrl('?a=1&czat=off'), true);
  assert.equal(chatDisabledByUrl('?czat=on'), false);
  assert.equal(chatDisabledByUrl(''), false);
});

test('chat: history keeps the last 6 exchanges and cuts long texts', () => {
  const h = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: `t${i}` }));
  const t = trimHistory(h);
  assert.equal(t.length, 12);
  assert.equal(t[0].text, 't8');
  assert.equal(t[11].text, 't19');
  assert.equal(trimHistory([{ role: 'user', text: 'x'.repeat(900) }])[0].text.length, 600);
});

test('chat: failures map to short Polish messages and the Przewodnik hint', () => {
  const slow = describeFailure({ reason: 'slow_down', message: 'Zwolnij.', retryAfter: 120 });
  assert.equal(slow.text, 'Zwolnij.');
  assert.equal(slow.retry, 120);
  assert.equal(slow.down, false);
  for (const reason of ['off', 'resting', 'forbidden', 'error', undefined]) {
    const f = describeFailure(reason ? { reason } : null);
    assert.equal(f.down, true, String(reason));
    assert.equal(f.guide, true);
    assert.match(f.text, /Przewodnik/);
  }
  assert.equal(describeFailure({ reason: 'turnstile' }).down, false);
});

async function withFake(options, run) {
  const { server, log } = createFakeServer(options);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const endpoint = `http://127.0.0.1:${server.address().port}/api/czat`;
  try { await run({ endpoint, log }); } finally { server.closeAllConnections(); await new Promise((r) => server.close(r)); }
}

test('chat client against the fake Worker: answers, session, history, slow_down, off', async () => {
  await withFake({}, async ({ endpoint, log }) => {
    let tokens = 0;
    const c = new ChatClient({ endpoint, disabled: false, getToken: async () => { tokens++; return 'tok'; } });
    assert.equal(await c.init(), 'ready');
    const a = await c.ask('Kto zbudował klasztor?');
    assert.equal(a.ok, true);
    assert.match(a.text, /Odpowiedź testowa/);
    const b = await c.ask('A drugie pytanie?');
    assert.equal(b.ok, true);
    assert.equal(tokens, 1, 'Turnstile only until a session exists');
    assert.equal(log[1].history.length, 2);
    assert.equal(log[1].session, c.session);
    const s = await c.ask('zwolnij');
    assert.equal(s.ok, false);
    assert.equal(s.down, false);
    assert.equal(s.retry, 120);
    assert.equal(c.available, true, 'slow_down does not switch the chat off');
    const o = await c.ask('wylacz');
    assert.equal(o.ok, false);
    assert.equal(o.guide, true);
    assert.equal(c.available, false);
    assert.equal(log.length, 4);
    assert.equal((await c.ask('jeszcze raz')).ok, false);
    assert.equal(log.length, 4, 'no more requests once off');
  });
});

test('chat client: stan enabled:false, ?czat=off, no server, not JSON, timeout', async () => {
  const q = quiet();
  try {
    await withFake({ stan: 'off' }, async ({ endpoint }) => {
      const c = new ChatClient({ endpoint, disabled: false, getToken: async () => 't' });
      assert.equal(await c.init(), 'off');
      assert.equal((await c.ask('hej')).guide, true);
    });
    const off = new ChatClient({ endpoint: 'http://127.0.0.1:1/api/czat', disabled: true });
    assert.equal((await off.ask('hej')).ok, false);
    const dead = new ChatClient({ endpoint: 'http://127.0.0.1:1/api/czat', disabled: false, getToken: async () => 't' });
    assert.equal(await dead.init(), 'off');
    assert.equal((await dead.ask('hej')).guide, true);
    assert.equal(q.calls.length, 1, 'one console.info only');
    await withFake({}, async ({ endpoint }) => {
      const h = new ChatClient({ endpoint, disabled: false, getToken: async () => 't' });
      assert.equal((await h.ask('html')).ok, false);
      assert.equal(h.available, false);
      const slow = new ChatClient({ endpoint, disabled: false, getToken: async () => 't', timeoutMs: 200 });
      assert.equal((await slow.ask('cisza')).ok, false);
      assert.equal(slow.available, false);
    });
  } finally { q.restore(); }
});

test('chat client: a failed Turnstile token does not call the Worker', async () => {
  await withFake({}, async ({ endpoint, log }) => {
    const c = new ChatClient({ endpoint, disabled: false, getToken: async () => { throw new Error('blocked'); } });
    const r = await c.ask('hej');
    assert.equal(r.ok, false);
    assert.equal(r.down, false);
    assert.equal(log.length, 0);
  });
});
