'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const expressless = require('../src');
const { close, listen, request } = require('./helpers');

test('cookies middleware parses cookies and verifies signed values', async (context) => {
  const app = expressless();
  app.use(expressless.cookies('test-secret'));
  app.get('/read', (req, res) => {
    res.json({ cookies: { ...req.cookies }, signed: { ...req.signedCookies } });
  });
  app.get('/write', (req, res) => {
    res.cookie('plain', 'one', { path: '/' });
    res.cookie('token', 'user-42', { signed: true, httpOnly: true });
    res.json({ ok: true });
  });

  const server = await listen(app);
  context.after(() => close(server));

  const written = await request(server, { path: '/write' });
  const setCookie = written.headers['set-cookie'];
  assert.equal(setCookie.length, 2);
  assert.match(setCookie[0], /^plain=one; Path=\/$/);
  assert.match(setCookie[1], /^token=s%3Auser-42\./);
  assert.match(setCookie[1], /HttpOnly$/);

  const signedValue = decodeURIComponent(setCookie[1].split(';')[0].slice('token='.length));
  const echoed = await request(server, {
    path: '/read',
    headers: { Cookie: `plain=one; token=${encodeURIComponent(signedValue)}` },
  });
  assert.deepEqual(echoed.json.cookies, { plain: 'one' });
  assert.deepEqual(echoed.json.signed, { token: 'user-42' });
});

test('a tampered signed cookie is dropped rather than trusted', async (context) => {
  const app = expressless();
  app.use(expressless.cookies('test-secret'));
  app.get('/read', (req, res) => {
    res.json({ cookies: { ...req.cookies }, signed: { ...req.signedCookies } });
  });

  const server = await listen(app);
  context.after(() => close(server));

  const forged = await request(server, {
    path: '/read',
    headers: { Cookie: 'token=s%3Aadmin.not-a-real-signature' },
  });
  assert.deepEqual(forged.json.signed, {});
  assert.deepEqual(forged.json.cookies, {});
});

test('res.clearCookie expires the cookie', async (context) => {
  const app = expressless();
  app.get('/logout', (req, res) => {
    res.clearCookie('token', { path: '/' });
    res.status(204).send();
  });

  const server = await listen(app);
  context.after(() => close(server));

  const response = await request(server, { path: '/logout' });
  assert.match(response.headers['set-cookie'][0], /^token=; Path=\/; Expires=Thu, 01 Jan 1970/);
});

test('res.redirect sets an encoded Location without double-encoding', async (context) => {
  const app = expressless();
  app.get('/go', (req, res) => res.redirect('/target?q=a b'));
  app.get('/already', (req, res) => res.redirect(303, '/target?q=a%20b'));

  const server = await listen(app);
  context.after(() => close(server));

  const found = await request(server, { path: '/go' });
  assert.equal(found.status, 302);
  assert.equal(found.headers.location, '/target?q=a%20b');
  assert.equal(found.body, 'Found');

  const other = await request(server, { path: '/already' });
  assert.equal(other.status, 303);
  assert.equal(other.headers.location, '/target?q=a%20b');
});

test('res.sendStatus writes the status catalog message', async (context) => {
  const app = expressless();
  app.get('/teapot', (req, res) => res.sendStatus(418));

  const server = await listen(app);
  context.after(() => close(server));

  const response = await request(server, { path: '/teapot' });
  assert.equal(response.status, 418);
  assert.equal(response.body, "I'm a teapot");
});

test('the JSON body parser matches media types carrying parameters', async (context) => {
  const app = expressless();
  app.use(expressless.json());
  app.post('/echo', (req, res) => res.json({ body: req.body }));

  const server = await listen(app);
  context.after(() => close(server));

  const withCharset = await request(server, {
    method: 'POST',
    path: '/echo',
    headers: { 'Content-Type': 'Application/JSON; charset=UTF-8' },
    body: '{"a":1}',
  });
  assert.deepEqual(withCharset.json.body, { a: 1 });

  const wrongType = await request(server, {
    method: 'POST',
    path: '/echo',
    headers: { 'Content-Type': 'text/plain' },
    body: '{"a":1}',
  });
  assert.equal(wrongType.json.body, undefined);
});

test('the error path honours the http-errors expose flag', async (context) => {
  const app = expressless();
  app.get('/client', (req, res, next) => next(expressless.httpError(422, 'name is required')));
  app.get('/server', (req, res, next) => next(expressless.httpError(502, 'upstream mysql at 10.0.0.4 refused')));

  const server = await listen(app);
  context.after(() => close(server));

  const client = await request(server, { path: '/client' });
  assert.equal(client.status, 422);
  assert.deepEqual(client.json, { error: 'name is required' });

  const upstream = await request(server, { path: '/server' });
  assert.equal(upstream.status, 502);
  assert.deepEqual(upstream.json, { error: 'Bad Gateway' });

  const missing = await request(server, { path: '/nowhere' });
  assert.equal(missing.status, 404);
  assert.equal(missing.body, 'Not Found');
});
