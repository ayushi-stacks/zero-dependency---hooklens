'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const expressless = require('../src');
const { close, listen, request } = require('./helpers');

test('routes by method and extracts decoded parameters and query values', async (context) => {
  const app = expressless();
  app.get('/users/:id', (req, res) => res.json({ params: req.params, query: req.query }));

  const server = await listen(app);
  context.after(() => close(server));

  const matched = await request(server, {
    path: '/users/Ada%20Lovelace/?role=admin&role=author',
  });
  assert.equal(matched.status, 200);
  assert.deepEqual(matched.json, {
    params: { id: 'Ada Lovelace' },
    query: { role: ['admin', 'author'] },
  });

  const wrongMethod = await request(server, { method: 'POST', path: '/users/12' });
  assert.equal(wrongMethod.status, 404);
  assert.equal(wrongMethod.body, 'Not Found');
});

test('falls through unmatched paths and rejects malformed path encoding', async (context) => {
  const app = expressless();
  app.get('/known', (req, res) => res.send('known'));

  const server = await listen(app);
  context.after(() => close(server));

  assert.equal((await request(server, { path: '/unknown' })).status, 404);

  const malformed = await request(server, { path: '/%E0%A4%A' });
  assert.equal(malformed.status, 400);
  assert.match(malformed.json.error, /Invalid URL encoding/);
});

test('supports every documented route method and treats HEAD as GET', async (context) => {
  const app = expressless();
  for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    app[method](`/${method}`, (req, res) => res.send(method));
  }

  const server = await listen(app);
  context.after(() => close(server));

  for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
    const response = await request(server, { method, path: `/${method.toLowerCase()}` });
    assert.equal(response.status, 200);
    assert.equal(response.body, method.toLowerCase());
  }

  const head = await request(server, { method: 'HEAD', path: '/get' });
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
  assert.equal(head.headers['content-length'], '3');
});

test('prototype-like URL keys remain ordinary request data', async (context) => {
  const app = expressless();
  app.get('/keys/:__proto__', (req, res) => res.json({ params: req.params, query: req.query }));

  const server = await listen(app);
  context.after(() => close(server));

  const response = await request(server, { path: '/keys/value?__proto__=query-value&constructor=plain' });
  assert.equal(response.status, 200);
  assert.deepEqual(
    response.json,
    JSON.parse('{"params":{"__proto__":"value"},"query":{"__proto__":"query-value","constructor":"plain"}}'),
  );
});
