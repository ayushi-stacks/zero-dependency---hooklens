'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const expressless = require('../src');
const { close, listen, request } = require('./helpers');

test('static middleware serves files, indexes, MIME types, and HEAD requests', async (context) => {
  const parent = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'expressless-static-'));
  const root = path.join(parent, 'public');
  await fs.promises.mkdir(root);
  await fs.promises.writeFile(path.join(root, 'index.html'), '<h1>Home</h1>');
  await fs.promises.writeFile(path.join(root, 'styles.css'), 'body { color: red; }');
  context.after(() => fs.promises.rm(parent, { recursive: true, force: true }));

  const app = expressless();
  app.use(expressless.static(root));
  const server = await listen(app);
  context.after(() => close(server));

  const index = await request(server);
  assert.equal(index.status, 200);
  assert.equal(index.body, '<h1>Home</h1>');
  assert.equal(index.headers['content-type'], 'text/html; charset=utf-8');

  const css = await request(server, { path: '/styles.css' });
  assert.equal(css.status, 200);
  assert.equal(css.headers['content-type'], 'text/css; charset=utf-8');

  const head = await request(server, { method: 'HEAD', path: '/styles.css' });
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
  assert.equal(head.headers['content-length'], String(Buffer.byteLength('body { color: red; }')));
});

test('static middleware falls through missing files and blocks traversal', async (context) => {
  const parent = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'expressless-traversal-'));
  const root = path.join(parent, 'public');
  await fs.promises.mkdir(root);
  await fs.promises.writeFile(path.join(parent, 'secret.txt'), 'not public');
  context.after(() => fs.promises.rm(parent, { recursive: true, force: true }));

  const app = expressless();
  app.use(expressless.static(root));
  const server = await listen(app);
  context.after(() => close(server));

  assert.equal((await request(server, { path: '/missing.txt' })).status, 404);

  const traversal = await request(server, { path: '/%2e%2e/secret.txt' });
  assert.equal(traversal.status, 403);
  assert.notEqual(traversal.body, 'not public');
});
