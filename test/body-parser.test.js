'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const expressless = require('../src');
const { close, listen, request } = require('./helpers');

test('JSON parser handles valid and empty request bodies', async (context) => {
  const app = expressless();
  app.use(expressless.json());
  app.post('/echo', (req, res) => res.json(req.body));

  const server = await listen(app);
  context.after(() => close(server));

  const valid = await request(server, {
    method: 'POST',
    path: '/echo',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Ada', active: true }),
  });
  assert.deepEqual(valid.json, { name: 'Ada', active: true });

  const empty = await request(server, {
    method: 'POST',
    path: '/echo',
    headers: { 'Content-Type': 'application/json', 'Content-Length': 0 },
  });
  assert.deepEqual(empty.json, {});
});

test('JSON parser forwards malformed and oversized bodies as HTTP errors', async (context) => {
  const app = expressless();
  app.use(expressless.json({ limit: 16 }));
  app.post('/echo', (req, res) => res.json(req.body));

  const server = await listen(app);
  context.after(() => close(server));

  const malformed = await request(server, {
    method: 'POST',
    path: '/echo',
    headers: { 'Content-Type': 'application/json' },
    body: '{"broken":',
  });
  assert.equal(malformed.status, 400);

  const oversized = await request(server, {
    method: 'POST',
    path: '/echo',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'this is larger than sixteen bytes' }),
  });
  assert.equal(oversized.status, 413);
  assert.match(oversized.json.error, /exceeds 16 bytes/);
});

test('urlencoded parser decodes plus signs, escapes, and repeated keys', async (context) => {
  const app = expressless();
  app.use(expressless.urlencoded());
  app.post('/form', (req, res) => res.json(req.body));

  const server = await listen(app);
  context.after(() => close(server));

  const response = await request(server, {
    method: 'POST',
    path: '/form',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
    body: 'name=Ada+Lovelace&city=New%20York&role=author&role=mathematician',
  });

  assert.deepEqual(response.json, {
    name: 'Ada Lovelace',
    city: 'New York',
    role: ['author', 'mathematician'],
  });
});
