'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const expressless = require('../src');
const contentType = require('../src/content-type');
const cookie = require('../src/cookie');
const cookieSignature = require('../src/cookie-signature');
const encodeurl = require('../src/encodeurl');
const httpError = require('../src/http-errors');
const statuses = require('../src/statuses');

test('Express-style utility modules are available and behave as expected', () => {
  assert.equal(statuses[404], 'Not Found');
  assert.equal(statuses.status(418), "I'm a teapot");
  assert.equal(statuses.message(200), 'OK');

  const notFound = httpError(404, 'Missing');
  assert.equal(notFound.status, 404);
  assert.equal(notFound.message, 'Missing');
  assert.equal(httpError(500).status, 500);

  const parsed = contentType.parse('application/json; charset=utf-8; foo="bar baz"');
  assert.equal(parsed.type, 'application/json');
  assert.equal(parsed.parameters.charset, 'utf-8');
  assert.equal(parsed.parameters.foo, 'bar baz');
  assert.equal(contentType.format({ type: 'application/json', parameters: { charset: 'utf-8' } }), 'application/json; charset=utf-8');

  assert.equal(encodeurl('/hello world/[]'), '/hello%20world/[]');

  const serialized = cookie.serialize('session', 'abc', {
    httpOnly: true,
    secure: true,
    maxAge: 60,
    path: '/',
  });
  assert.match(serialized, /^session=abc; Max-Age=60; Path=\/; HttpOnly; Secure$/);
  const parsedCookie = cookie.parse('session=abc; theme=dark');
  assert.equal(parsedCookie.session, 'abc');
  assert.equal(parsedCookie.theme, 'dark');

  const signed = cookieSignature.sign('session-token', 'super-secret');
  assert.equal(cookieSignature.unsign(signed, 'super-secret'), 'session-token');
  assert.equal(expressless.cookie.serialize('id', '1'), 'id=1');
  assert.equal(expressless.contentType.parse('text/plain').type, 'text/plain');
  assert.equal(expressless.encodeUrl('/hello world'), '/hello%20world');
  assert.equal(expressless.statuses[404], 'Not Found');
  assert.equal(expressless.httpError(422, 'bad').status, 422);
});
