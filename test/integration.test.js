'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const createDemoApp = require('../demo/app');
const { close, listen, request } = require('./helpers');

test('HookLens creates a channel and captures a redacted JSON webhook', async (context) => {
  const fixture = await createFixture(context);
  const { app } = createDemoApp({ dataFile: fixture.dataFile, log: false });
  const server = await listen(app);
  context.after(() => close(server));

  const health = await request(server, { path: '/api/health' });
  assert.deepEqual(health.json, { status: 'ok', framework: 'expressless', demo: 'HookLens' });

  const channel = await request(server, jsonRequest('POST', '/api/channels', {
    id: 'stripe-dev',
    name: 'Stripe dev',
  }));
  assert.equal(channel.status, 201);
  assert.equal(channel.json.id, 'stripe-dev');

  const invalidChannel = await request(server, jsonRequest('POST', '/api/channels', {
    name: '!!!',
  }));
  assert.equal(invalidChannel.status, 422);

  const captured = await request(server, {
    method: 'POST',
    path: '/hooks/stripe-dev?attempt=1',
    headers: {
      Authorization: 'Bearer secret',
      'Content-Type': 'application/json',
      'X-Request-Id': 'evt_123',
    },
    body: JSON.stringify({ type: 'checkout.session.completed', amount: 4200 }),
  });
  assert.equal(captured.status, 202);
  assert.equal(captured.json.captured, true);

  const events = await request(server, { path: '/api/channels/stripe-dev/events?search=checkout' });
  assert.equal(events.status, 200);
  assert.equal(events.json.total, 1);
  assert.equal(events.json.events[0].method, 'POST');
  assert.equal(events.json.events[0].headers.authorization, '[redacted]');
  assert.equal(events.json.events[0].headers['x-request-id'], 'evt_123');
  assert.deepEqual(events.json.events[0].query, { attempt: '1' });
  assert.match(events.json.events[0].body, /checkout\.session\.completed/);
});

test('HookLens captures text bodies, filters by method, and persists across app instances', async (context) => {
  const fixture = await createFixture(context);
  const first = createDemoApp({ dataFile: fixture.dataFile, log: false });
  const firstServer = await listen(first.app);

  const channel = await request(firstServer, jsonRequest('POST', '/api/channels', {
    name: 'Release webhooks',
  }));
  assert.equal(channel.status, 201);

  const put = await request(firstServer, {
    method: 'PUT',
    path: `/hooks/${channel.json.id}`,
    headers: { 'Content-Type': 'text/plain' },
    body: 'deploy=green',
  });
  assert.equal(put.status, 202);
  await close(firstServer);

  const second = createDemoApp({ dataFile: fixture.dataFile, log: false });
  const secondServer = await listen(second.app);
  context.after(() => close(secondServer));

  const restored = await request(secondServer, { path: `/api/channels/${channel.json.id}/events?method=PUT` });
  assert.equal(restored.status, 200);
  assert.equal(restored.json.total, 1);
  assert.equal(restored.json.events[0].body, 'deploy=green');
});

test('HookLens streams captured events to connected browser clients over SSE', async (context) => {
  const fixture = await createFixture(context);
  const { app, hub } = createDemoApp({ dataFile: fixture.dataFile, log: false });
  const server = await listen(app);
  context.after(() => close(server));

  await request(server, jsonRequest('POST', '/api/channels', { id: 'live-feed', name: 'Live feed' }));
  const stream = await openEventStream(server, '/api/channels/live-feed/stream');
  await stream.waitFor('ready');
  assert.equal(hub.subscriberCount('live-feed'), 1);

  const delivered = stream.waitFor('captured');
  const captured = await request(server, {
    method: 'PATCH',
    path: '/hooks/live-feed',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ live: true }),
  });
  assert.equal(captured.status, 202);

  const message = await delivered;
  assert.equal(message.type, 'captured');
  assert.equal(message.event.method, 'PATCH');
  assert.match(message.event.body, /"live":true/);
  stream.close();
});

test('HookLens serialized storage handles concurrent captures without loss', async (context) => {
  const fixture = await createFixture(context);
  const { app } = createDemoApp({ dataFile: fixture.dataFile, log: false });
  const server = await listen(app);
  context.after(() => close(server));

  await request(server, jsonRequest('POST', '/api/channels', { id: 'burst', name: 'Burst' }));
  const captures = Array.from({ length: 24 }, (_, index) => request(server, {
    method: index % 2 === 0 ? 'POST' : 'PATCH',
    path: '/hooks/burst',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ index }),
  }));

  const responses = await Promise.all(captures);
  assert.ok(responses.every((response) => response.status === 202));
  assert.equal(new Set(responses.map((response) => response.json.eventId)).size, 24);

  const listed = await request(server, { path: '/api/channels/burst/events' });
  assert.equal(listed.json.total, 24);

  const persisted = JSON.parse(await fs.promises.readFile(fixture.dataFile, 'utf8'));
  assert.equal(persisted.events.burst.length, 24);
});

test('HookLens enforces capture limits and serves the browser interface', async (context) => {
  const fixture = await createFixture(context);
  const { app } = createDemoApp({ dataFile: fixture.dataFile, log: false });
  const server = await listen(app);
  context.after(() => close(server));

  await request(server, jsonRequest('POST', '/api/channels', { id: 'limited', name: 'Limited' }));
  const tooLarge = await request(server, {
    method: 'POST',
    path: '/hooks/limited',
    headers: { 'Content-Type': 'text/plain' },
    body: 'x'.repeat(129 * 1024),
  });
  assert.equal(tooLarge.status, 413);

  const page = await request(server);
  assert.equal(page.status, 200);
  assert.match(page.body, /HookLens/);
  assert.doesNotMatch(page.body, /Donor|donor|LifeLine/);

  const script = await request(server, { path: '/app.js' });
  assert.equal(script.status, 200);
  assert.match(script.headers['content-type'], /^text\/javascript/);
  assert.match(script.body, /\/api\/channels/);
  assert.doesNotMatch(script.body, /donor/i);

  const asset = await request(server, { path: '/brand-mark.svg' });
  assert.equal(asset.status, 200);
  assert.equal(asset.headers['content-type'], 'image/svg+xml');
});

async function createFixture(context) {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'expressless-demo-'));
  const dataFile = path.join(directory, 'hooks.json');
  await fs.promises.writeFile(dataFile, '{"channels":[],"events":{}}\n');
  context.after(() => fs.promises.rm(directory, { recursive: true, force: true }));
  return { dataFile };
}

function jsonRequest(method, requestPath, body) {
  return {
    method,
    path: requestPath,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function openEventStream(server, requestPath) {
  const address = server.address();
  const listeners = new Map();
  const queued = new Map();
  let buffer = '';
  let outgoing;

  const opened = new Promise((resolve, reject) => {
    outgoing = http.request({
      host: '127.0.0.1',
      port: address.port,
      method: 'GET',
      path: requestPath,
      headers: { Accept: 'text/event-stream' },
    }, (incoming) => {
      incoming.setEncoding('utf8');
      incoming.on('data', (chunk) => {
        buffer += chunk;
        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          deliver(frame);
          boundary = buffer.indexOf('\n\n');
        }
      });
      resolve(streamHandle());
    });
    outgoing.once('error', reject);
    outgoing.end();
  });

  function streamHandle() {
    return {
      waitFor(eventName) {
        return new Promise((resolve) => {
          const queuedEvents = queued.get(eventName) || [];
          if (queuedEvents.length > 0) {
            const [event, ...rest] = queuedEvents;
            queued.set(eventName, rest);
            resolve(event);
            return;
          }
          const eventListeners = listeners.get(eventName) || [];
          eventListeners.push(resolve);
          listeners.set(eventName, eventListeners);
        });
      },
      close() {
        outgoing.destroy();
      },
    };
  }

  function deliver(frame) {
    const lines = frame.split('\n');
    const eventLine = lines.find((line) => line.startsWith('event: '));
    const dataLine = lines.find((line) => line.startsWith('data: '));
    if (!eventLine || !dataLine) return;
    const eventName = eventLine.slice(7);
    const eventListeners = listeners.get(eventName) || [];
    const payload = JSON.parse(dataLine.slice(6));
    if (eventListeners.length === 0) {
      const queuedEvents = queued.get(eventName) || [];
      queuedEvents.push(payload);
      queued.set(eventName, queuedEvents);
      return;
    }
    listeners.set(eventName, []);
    for (const resolve of eventListeners) resolve(payload);
  }

  return opened;
}

test('HookLens redirects browser GETs, records cookie names, and remembers the last channel', async (context) => {
  const fixture = await createFixture(context);
  const { app } = createDemoApp({ dataFile: fixture.dataFile, log: false, secret: 'fixed-test-secret' });
  const server = await listen(app);
  context.after(() => close(server));

  await request(server, jsonRequest('POST', '/api/channels', { id: 'github-dev', name: 'GitHub dev' }));

  const pasted = await request(server, { path: '/hooks/github-dev' });
  assert.equal(pasted.status, 303);
  assert.equal(pasted.headers.location, '/?channel=github-dev');

  await request(server, {
    method: 'POST',
    path: '/hooks/github-dev',
    headers: {
      'Content-Type': 'application/json',
      Cookie: 'session=abc; tracking_id=xyz',
    },
    body: JSON.stringify({ action: 'opened' }),
  });

  const events = await request(server, { path: '/api/channels/github-dev/events' });
  assert.equal(events.json.events[0].headers.cookie, '[redacted]');
  assert.deepEqual(events.json.events[0].cookieNames, ['session', 'tracking_id']);

  const remembered = events.headers['set-cookie'][0];
  assert.match(remembered, /^hooklens_last_channel=s%3Agithub-dev\./);

  const session = await request(server, {
    path: '/api/session',
    headers: { Cookie: remembered.split(';')[0] },
  });
  assert.equal(session.json.lastChannel, 'github-dev');

  const anonymous = await request(server, { path: '/api/session' });
  assert.equal(anonymous.json.lastChannel, null);
});
