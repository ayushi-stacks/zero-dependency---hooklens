'use strict';

const cookie = require('./cookie');
const cookieSignature = require('./cookie-signature');
const encodeurl = require('./encodeurl');
const statuses = require('./statuses');

function decorateResponse(request, response) {
  response.status = (code) => {
    if (!Number.isInteger(code) || code < 100 || code > 999) {
      throw new RangeError(`Invalid HTTP status code: ${code}`);
    }
    response.statusCode = code;
    return response;
  };

  response.json = (value) => {
    if (response.writableEnded) return response;

    const body = JSON.stringify(value);
    if (!response.hasHeader('Content-Type')) {
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    return finish(body === undefined ? '' : body);
  };

  response.send = (value = '') => {
    if (response.writableEnded) return response;
    if (value !== null && typeof value === 'object' && !Buffer.isBuffer(value)) {
      return response.json(value);
    }

    const body = Buffer.isBuffer(value) ? value : String(value);
    if (!response.hasHeader('Content-Type')) {
      response.setHeader(
        'Content-Type',
        Buffer.isBuffer(body) ? 'application/octet-stream' : 'text/html; charset=utf-8',
      );
    }
    return finish(body);
  };

  response.sendStatus = (code) => response.status(code).send(statuses[code] || String(code));

  response.redirect = (statusOrUrl, maybeUrl) => {
    const url = maybeUrl === undefined ? statusOrUrl : maybeUrl;
    const code = maybeUrl === undefined ? 302 : statusOrUrl;

    // A Location built from user input may already contain escapes, so it goes
    // through encodeurl rather than encodeURI to avoid double-encoding it.
    response.setHeader('Location', encodeurl(String(url)));
    return response.status(code).send(statuses[code] || '');
  };

  response.cookie = (name, value, options = {}) => {
    let outgoing = String(value);

    if (options.signed) {
      if (!request.secret) {
        throw new TypeError('Signed cookies require expressless.cookies(secret)');
      }
      outgoing = `s:${cookieSignature.sign(outgoing, request.secret)}`;
    }

    appendHeader('Set-Cookie', cookie.serialize(name, outgoing, options));
    return response;
  };

  response.clearCookie = (name, options = {}) => {
    const expired = { ...options, expires: new Date(0) };
    delete expired.maxAge;
    appendHeader('Set-Cookie', cookie.serialize(name, '', expired));
    return response;
  };

  function appendHeader(name, value) {
    const existing = response.getHeader(name);
    if (existing === undefined) {
      response.setHeader(name, value);
      return;
    }
    response.setHeader(name, Array.isArray(existing) ? [...existing, value] : [existing, value]);
  }

  function finish(body) {
    if (response.statusCode === 204 || response.statusCode === 304) {
      response.removeHeader('Content-Type');
      response.removeHeader('Content-Length');
      response.end();
      return response;
    }

    response.setHeader('Content-Length', Buffer.byteLength(body));
    response.end(request.method === 'HEAD' ? undefined : body);
    return response;
  }
}

module.exports = decorateResponse;
