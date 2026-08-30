'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const createDemoApp = require('../demo/app');
const expressless = require('../src');
const contentDisposition = require('../src/content-disposition');
const rangeParser = require('../src/range-parser');
const { close, listen, request } = require('./helpers');

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

test('range-parser resolves offsets, suffixes, and unsatisfiable asks', () => {
  // The parsed unit rides on the array as a property, so the entries are spread
  // out of it before comparison.
  const parse = (size, header) => [...rangeParser(size, header)];
  assert.deepEqual(parse(100, 'bytes=0-49'), [{ start: 0, end: 49 }]);
  assert.deepEqual(parse(100, 'bytes=50-'), [{ start: 50, end: 99 }]);
  assert.deepEqual(parse(100, 'bytes=-25'), [{ start: 75, end: 99 }]);
  assert.deepEqual(parse(100, 'bytes=0-999'), [{ start: 0, end: 99 }]);
  assert.deepEqual(parse(100, 'bytes=0-9,20-29'), [{ start: 0, end: 9 }, { start: 20, end: 29 }]);
  assert.equal(rangeParser(100, 'bytes=0-49').type, 'bytes');

  assert.equal(rangeParser(100, 'bytes=200-300'), rangeParser.UNSATISFIABLE);
  assert.equal(rangeParser(0, 'bytes=0-10'), rangeParser.UNSATISFIABLE);
  // A zero-length suffix asks for the last no bytes, which nothing satisfies.
  assert.equal(rangeParser(100, 'bytes=-0'), rangeParser.UNSATISFIABLE);

  // The parser stays unit-agnostic and reports what it saw; deciding that only
  // bytes can be served is the caller's job.
  assert.equal(rangeParser(100, 'items=0-9').type, 'items');
  assert.equal(rangeParser(100, 'no-equals-sign'), rangeParser.MALFORMED);
  assert.equal(rangeParser(100, 'bytes=abc-def'), rangeParser.MALFORMED);
  assert.equal(rangeParser(100, 'bytes=1.5-3'), rangeParser.MALFORMED);
  assert.equal(rangeParser(100, 'bytes=-'), rangeParser.MALFORMED);
  assert.throws(() => rangeParser(100, 5), TypeError);
  assert.throws(() => rangeParser(-1, 'bytes=0-1'), TypeError);
});

test('content-disposition escapes, truncates to a basename, and carries UTF-8 names', () => {
  assert.equal(contentDisposition('report.pdf'), 'attachment; filename="report.pdf"');
  assert.equal(contentDisposition('report.pdf', { type: 'inline' }), 'inline; filename="report.pdf"');
  assert.equal(contentDisposition(), 'attachment');

  // A caller cannot smuggle a path through a download name.
  assert.equal(contentDisposition('/etc/passwd'), 'attachment; filename="passwd"');
  assert.equal(contentDisposition('say "hi".txt'), 'attachment; filename="say \\"hi\\".txt"');

  const euro = contentDisposition('€ rates.txt');
  assert.equal(euro, 'attachment; filename="? rates.txt"; filename*=UTF-8\'\'%E2%82%AC%20rates.txt');
  assert.equal(contentDisposition.parse(euro).parameters.filename, '€ rates.txt');

  // Every emitted byte stays printable ASCII, so a CR/LF in an attacker-chosen
  // name is percent-encoded rather than reaching the header as a line break.
  const injected = contentDisposition('bad\r\nX-Evil: 1.txt');
  assert.doesNotMatch(injected, /[\r\n]/);
  assert.equal(contentDisposition.parse(injected).parameters.filename, 'bad\r\nX-Evil: 1.txt');

  // A literal %XX would be re-read as an escape by a decoding client.
  assert.match(contentDisposition('100%20.txt'), /filename\*=UTF-8''100%2520\.txt$/);

  assert.equal(contentDisposition.parse('attachment; filename="report; final.pdf"').parameters.filename, 'report; final.pdf');
  assert.equal(contentDisposition.parse('attachment; filename=report.pdf').parameters.filename, 'report.pdf');
  assert.equal(contentDisposition.parse("attachment; filename*=iso-8859-1''caf%E9.txt").parameters.filename, 'café.txt');
  assert.equal(contentDisposition.parse("inline; filename=fallback.txt; filename*=UTF-8''real.txt").parameters.filename, 'real.txt');
  assert.deepEqual(contentDisposition.parse('attachment').type, 'attachment');
  assert.throws(() => contentDisposition.parse('not a type'), TypeError);
  assert.throws(() => contentDisposition('x', { type: 'not a token' }), TypeError);
});

test('static serving answers byte ranges, rejects unsatisfiable ones, and ignores junk', async (context) => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'expressless-range-'));
  await fs.promises.writeFile(path.join(root, 'alphabet.txt'), ALPHABET);
  context.after(() => fs.promises.rm(root, { recursive: true, force: true }));

  const app = expressless();
  app.use(expressless.static(root));
  const server = await listen(app);
  context.after(() => close(server));

  const slice = await request(server, {
    path: '/alphabet.txt',
    headers: { Range: 'bytes=0-4' },
  });
  assert.equal(slice.status, 206);
  assert.equal(slice.body, 'abcde');
  assert.equal(slice.headers['content-range'], `bytes 0-4/${ALPHABET.length}`);
  assert.equal(slice.headers['content-length'], '5');

  const suffix = await request(server, {
    path: '/alphabet.txt',
    headers: { Range: 'bytes=-3' },
  });
  assert.equal(suffix.status, 206);
  assert.equal(suffix.body, 'xyz');

  const unsatisfiable = await request(server, {
    path: '/alphabet.txt',
    headers: { Range: 'bytes=900-1000' },
  });
  assert.equal(unsatisfiable.status, 416);
  assert.equal(unsatisfiable.headers['content-range'], `bytes */${ALPHABET.length}`);

  // A range header this server cannot honour is ignored, never fatal: the whole
  // entity always answers a range request correctly.
  for (const header of ['nonsense', 'bytes=0-4,10-14', 'items=0-4', 'items=900-1000']) {
    const full = await request(server, { path: '/alphabet.txt', headers: { Range: header } });
    assert.equal(full.status, 200);
    assert.equal(full.body, ALPHABET);
  }
});

test('If-Range serves the whole file once the entity has changed', async (context) => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'expressless-if-range-'));
  await fs.promises.writeFile(path.join(root, 'alphabet.txt'), ALPHABET);
  context.after(() => fs.promises.rm(root, { recursive: true, force: true }));

  const app = expressless();
  app.use(expressless.static(root));
  const server = await listen(app);
  context.after(() => close(server));

  const first = await request(server, { path: '/alphabet.txt' });
  const resumed = await request(server, {
    path: '/alphabet.txt',
    headers: { Range: 'bytes=0-4', 'If-Range': first.headers.etag },
  });
  assert.equal(resumed.status, 206);
  assert.equal(resumed.body, 'abcde');

  const restarted = await request(server, {
    path: '/alphabet.txt',
    headers: { Range: 'bytes=0-4', 'If-Range': '"a-different-file"' },
  });
  assert.equal(restarted.status, 200);
  assert.equal(restarted.body, ALPHABET);
});

test('res.send honours a range only for a handler that advertised Accept-Ranges', async (context) => {
  const app = expressless();
  app.get('/rangeable', (req, res) => {
    res.setHeader('Accept-Ranges', 'bytes');
    res.send(ALPHABET);
  });
  app.get('/plain', (req, res) => res.send(ALPHABET));

  const server = await listen(app);
  context.after(() => close(server));

  const partial = await request(server, { path: '/rangeable', headers: { Range: 'bytes=3-7' } });
  assert.equal(partial.status, 206);
  assert.equal(partial.body, 'defgh');
  assert.equal(partial.headers['content-range'], `bytes 3-7/${ALPHABET.length}`);

  const refused = await request(server, { path: '/rangeable', headers: { Range: 'bytes=99-120' } });
  assert.equal(refused.status, 416);

  const ignored = await request(server, { path: '/plain', headers: { Range: 'bytes=3-7' } });
  assert.equal(ignored.status, 200);
  assert.equal(ignored.body, ALPHABET);
});

test('HookLens exports a channel as a named download and streams captured bodies by range', async (context) => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'expressless-export-'));
  const dataFile = path.join(directory, 'hooks.json');
  await fs.promises.writeFile(dataFile, '{"channels":[],"events":{}}\n');
  context.after(() => fs.promises.rm(directory, { recursive: true, force: true }));

  const { app } = createDemoApp({ dataFile, log: false });
  const server = await listen(app);
  context.after(() => close(server));

  await request(server, {
    method: 'POST',
    path: '/api/channels',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'stripe-dev', name: 'Stripe € dev' }),
  });

  const payload = JSON.stringify({ type: 'checkout.session.completed', amount: 4200 });
  const captured = await request(server, {
    method: 'POST',
    path: '/hooks/stripe-dev',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  });
  assert.equal(captured.status, 202);

  const exported = await request(server, { path: '/api/channels/stripe-dev/export' });
  assert.equal(exported.status, 200);
  const disposition = contentDisposition.parse(exported.headers['content-disposition']);
  assert.equal(disposition.type, 'attachment');
  assert.equal(disposition.parameters.filename, 'HookLens Stripe € dev events.json');
  assert.doesNotMatch(exported.headers['content-disposition'], /[^\x20-\x7e]/);
  assert.equal(exported.json.channel.id, 'stripe-dev');
  assert.equal(exported.json.events.length, 1);

  const eventId = captured.json.eventId;
  const body = await request(server, { path: `/api/channels/stripe-dev/events/${eventId}/body` });
  assert.equal(body.status, 200);
  assert.equal(body.body, payload);
  assert.equal(body.headers['accept-ranges'], 'bytes');
  assert.equal(body.headers['x-content-type-options'], 'nosniff');
  // A captured Content-Type is attacker supplied and is never echoed back.
  assert.equal(body.headers['content-type'], 'application/octet-stream');
  assert.match(body.headers['content-disposition'], /^attachment; filename="POST-/);

  const head = await request(server, {
    path: `/api/channels/stripe-dev/events/${eventId}/body`,
    headers: { Range: 'bytes=0-15' },
  });
  assert.equal(head.status, 206);
  assert.equal(head.body, payload.slice(0, 16));
  assert.equal(head.headers['content-range'], `bytes 0-15/${payload.length}`);

  assert.equal((await request(server, { path: '/api/channels/nope/export' })).status, 404);
  assert.equal((await request(server, { path: '/api/channels/stripe-dev/events/nope/body' })).status, 404);
});

test('HookLens marks responses revalidatable and varies the session on Cookie', async (context) => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'expressless-vary-'));
  const dataFile = path.join(directory, 'hooks.json');
  await fs.promises.writeFile(dataFile, '{"channels":[],"events":{}}\n');
  context.after(() => fs.promises.rm(directory, { recursive: true, force: true }));

  const { app } = createDemoApp({ dataFile, log: false, secret: 'fixed-test-secret' });
  const server = await listen(app);
  context.after(() => close(server));

  const session = await request(server, { path: '/api/session' });
  assert.equal(session.headers.vary, 'Cookie');
  assert.equal(session.headers['cache-control'], 'no-cache');

  const channels = await request(server, { path: '/api/channels' });
  assert.ok(channels.headers.etag);

  const revalidated = await request(server, {
    path: '/api/channels',
    headers: { 'If-None-Match': channels.headers.etag },
  });
  assert.equal(revalidated.status, 304);
  assert.equal(revalidated.body, '');
});
