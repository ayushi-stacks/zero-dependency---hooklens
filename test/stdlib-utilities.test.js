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

test('encodeurl leaves existing escapes alone and never throws', () => {
  assert.equal(encodeurl('/foo%20bar'), '/foo%20bar');
  assert.equal(encodeurl('/a%2Fb'), '/a%2Fb');
  assert.equal(encodeurl('/discount/100%'), '/discount/100%25');
  assert.equal(encodeurl('/a%zz'), '/a%25zz');
  assert.equal(encodeurl('/\uD800'), '/%EF%BF%BD');
  assert.equal(encodeurl(undefined), undefined);
});

test('cookie parsing survives malformed input and omits invented attributes', () => {
  assert.deepEqual({ ...cookie.parse('a=%E0%A4%A') }, { a: '%E0%A4%A' });
  assert.deepEqual({ ...cookie.parse('') }, {});
  assert.equal(Object.getPrototypeOf(cookie.parse('a=b')), null);

  // "Signed" is not a Set-Cookie attribute; Express signs the value instead.
  assert.equal(cookie.serialize('s', 'v', { signed: true }), 's=v');
  assert.throws(() => cookie.serialize('s', 'v', { maxAge: 'abc' }), TypeError);
  assert.throws(() => cookie.serialize('s', 'v', { expires: 'nonsense' }), TypeError);
});

test('content-type quotes parameter values that are not tokens', () => {
  assert.equal(contentType.format({ type: 'text/plain', parameters: { foo: 'bar baz' } }), 'text/plain; foo="bar baz"');
  assert.equal(contentType.parse(contentType.format({ type: 'text/plain', parameters: { foo: 'bar baz' } })).parameters.foo, 'bar baz');
  assert.equal(contentType.parse(contentType.format({ type: 'text/plain', parameters: { foo: 'say "hi"' } })).parameters.foo, 'say "hi"');
  assert.throws(() => contentType.parse(''), TypeError);
});

test('http errors are HttpError instances with faithful names and expose flags', () => {
  assert.ok(httpError(404) instanceof httpError.HttpError);
  assert.ok(httpError(404) instanceof Error);
  assert.equal(httpError(418).name, 'ImATeapot');
  assert.equal(httpError(203).name, 'NonAuthoritativeInformation');
  assert.equal(httpError(404).expose, true);
  assert.equal(httpError(500).expose, false);
  assert.equal(httpError.NotFound('gone').status, 404);
  assert.equal(httpError.OK, undefined);
  assert.throws(() => httpError(999), RangeError);
});

test('cookie signatures reject tampering', () => {
  const signed = cookieSignature.sign('session-token', 'super-secret');
  assert.equal(cookieSignature.unsign(signed, 'wrong-secret'), false);
  assert.equal(cookieSignature.unsign('session-token.deadbeef', 'super-secret'), false);
  assert.equal(cookieSignature.unsign('no-separator', 'super-secret'), false);
  assert.equal(cookieSignature.unsign(42, 'super-secret'), false);
});
