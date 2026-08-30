'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const expressless = require('../src');
const etag = require('../src/etag');
const fresh = require('../src/fresh');
const vary = require('../src/vary');
const { close, listen, request } = require('./helpers');

test('etag derives stable strong tags from content and weak tags from stats', () => {
  assert.equal(etag('hello'), etag(Buffer.from('hello')));
  assert.notEqual(etag('hello'), etag('hellp'));
  assert.match(etag('hello'), /^"5-[\w+/]{27}"$/);
  assert.match(etag(''), /^"0-/);
  assert.match(etag('hello', { weak: true }), /^W\/"5-/);

  const modifiedAt = 1756500000000;
  const stats = { size: 1024, mtime: new Date(modifiedAt) };
  assert.equal(etag(stats), `W/"400-${modifiedAt.toString(16)}"`);
  assert.equal(etag(stats, { weak: false }), `"400-${modifiedAt.toString(16)}"`);

  // A same-length overwrite inside one clock tick is invisible to size+mtime,
  // which is the whole reason stat tags default to weak.
  assert.equal(etag({ size: 1024, mtime: new Date(1756500000000) }), etag(stats));
  assert.throws(() => etag({ nope: true }), TypeError);
});

test('fresh honours weak comparison, wildcards, and a no-cache request', () => {
  assert.equal(fresh({}, {}), false);
  assert.equal(fresh({ 'if-none-match': '"abc"' }, { etag: '"abc"' }), true);
  assert.equal(fresh({ 'if-none-match': 'W/"abc"' }, { etag: '"abc"' }), true);
  assert.equal(fresh({ 'if-none-match': '"abc"' }, { etag: 'W/"abc"' }), true);
  assert.equal(fresh({ 'if-none-match': '"a", "abc"' }, { etag: '"abc"' }), true);
  assert.equal(fresh({ 'if-none-match': '"zzz"' }, { etag: '"abc"' }), false);
  assert.equal(fresh({ 'if-none-match': '*' }, { etag: '"abc"' }), true);
  assert.equal(fresh({ 'if-none-match': '"abc"' }, {}), false);

  const cacheControl = { 'if-none-match': '"abc"', 'cache-control': 'no-cache' };
  assert.equal(fresh(cacheControl, { etag: '"abc"' }), false);

  const modified = new Date(1756500000000).toUTCString();
  assert.equal(fresh({ 'if-modified-since': modified }, { 'last-modified': modified }), true);
  assert.equal(fresh({ 'if-modified-since': new Date(0).toUTCString() }, { 'last-modified': modified }), false);
  assert.equal(fresh({ 'if-modified-since': 'not a date' }, { 'last-modified': modified }), false);

  // RFC 9110 13.1.3: If-Modified-Since is ignored when If-None-Match is present,
  // so a changed entity is never reported fresh on the strength of its date.
  const both = { 'if-none-match': '"new"', 'if-modified-since': modified };
  assert.equal(fresh(both, { etag: '"old"', 'last-modified': modified }), false);
});

test('vary appends field names once and collapses to a wildcard', () => {
  assert.equal(vary.append('', 'Accept'), 'Accept');
  assert.equal(vary.append('Accept', 'Accept-Encoding'), 'Accept, Accept-Encoding');
  assert.equal(vary.append('Accept', 'accept'), 'Accept');
  assert.equal(vary.append('', ['Cookie', 'Accept']), 'Cookie, Accept');
  assert.equal(vary.append('Accept', '*'), '*');
  assert.equal(vary.append('*', 'Accept'), '*');
  assert.throws(() => vary.append('', 'bad header'), TypeError);
  assert.throws(() => vary(null, 'Accept'), TypeError);
});

test('res.json tags successful GETs and answers a matching validator with 304', async (context) => {
  const app = expressless();
  app.get('/items', (req, res) => res.json({ items: [1, 2, 3] }));
  app.post('/items', (req, res) => res.json({ created: true }));
  app.get('/missing', (req, res, next) => next(expressless.httpError(404, 'Nope')));

  const server = await listen(app);
  context.after(() => close(server));

  const first = await request(server, { path: '/items' });
  assert.equal(first.status, 200);
  assert.ok(first.headers.etag);

  const revalidated = await request(server, {
    path: '/items',
    headers: { 'If-None-Match': first.headers.etag },
  });
  assert.equal(revalidated.status, 304);
  assert.equal(revalidated.body, '');
  assert.equal(revalidated.headers['content-type'], undefined);
  assert.equal(revalidated.headers.etag, first.headers.etag);

  const stale = await request(server, {
    path: '/items',
    headers: { 'If-None-Match': '"not-the-tag"' },
  });
  assert.equal(stale.status, 200);
  assert.deepEqual(stale.json, { items: [1, 2, 3] });

  // A write is not a cacheable representation, and neither is an error body.
  assert.equal((await request(server, { method: 'POST', path: '/items' })).headers.etag, undefined);
  assert.equal((await request(server, { path: '/missing' })).headers.etag, undefined);
});

test('req.fresh reads the response validators and respects a no-cache request', async (context) => {
  const app = expressless();
  app.get('/fixed', (req, res) => {
    res.setHeader('ETag', '"fixed"');
    res.json({ fresh: req.fresh });
  });

  const server = await listen(app);
  context.after(() => close(server));

  const cold = await request(server, { path: '/fixed' });
  assert.equal(cold.status, 200);
  assert.equal(cold.json.fresh, false);
  assert.equal(cold.headers.etag, '"fixed"');

  const warm = await request(server, { path: '/fixed', headers: { 'If-None-Match': '"fixed"' } });
  assert.equal(warm.status, 304);

  const forced = await request(server, {
    path: '/fixed',
    headers: { 'If-None-Match': '"fixed"', 'Cache-Control': 'no-cache' },
  });
  assert.equal(forced.status, 200);
  assert.equal(forced.json.fresh, false);
});

test('res.vary writes a deduplicated Vary header', async (context) => {
  const app = expressless();
  app.get('/negotiated', (req, res) => {
    res.vary('Cookie').vary(['cookie', 'Accept-Encoding']);
    res.json({ ok: true });
  });

  const server = await listen(app);
  context.after(() => close(server));

  const response = await request(server, { path: '/negotiated' });
  assert.equal(response.headers.vary, 'Cookie, Accept-Encoding');
});

test('static files carry validators and are revalidated without a read', async (context) => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'expressless-caching-'));
  await fs.promises.writeFile(path.join(root, 'styles.css'), 'body { color: red; }');
  context.after(() => fs.promises.rm(root, { recursive: true, force: true }));

  const app = expressless();
  app.use(expressless.static(root));
  const server = await listen(app);
  context.after(() => close(server));

  const first = await request(server, { path: '/styles.css' });
  assert.equal(first.status, 200);
  assert.match(first.headers.etag, /^W\/"/);
  assert.ok(first.headers['last-modified']);
  assert.equal(first.headers['accept-ranges'], 'bytes');

  const byTag = await request(server, {
    path: '/styles.css',
    headers: { 'If-None-Match': first.headers.etag },
  });
  assert.equal(byTag.status, 304);
  assert.equal(byTag.body, '');

  const byDate = await request(server, {
    path: '/styles.css',
    headers: { 'If-Modified-Since': first.headers['last-modified'] },
  });
  assert.equal(byDate.status, 304);

  const changed = await request(server, {
    path: '/styles.css',
    headers: { 'If-Modified-Since': new Date(0).toUTCString() },
  });
  assert.equal(changed.status, 200);
  assert.equal(changed.body, 'body { color: red; }');
});
