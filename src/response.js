'use strict';

const contentDisposition = require('./content-disposition');
const cookie = require('./cookie');
const cookieSignature = require('./cookie-signature');
const encodeurl = require('./encodeurl');
const etag = require('./etag');
const fresh = require('./fresh');
const rangeParser = require('./range-parser');
const statuses = require('./statuses');
const vary = require('./vary');

const BYTES_UNIT = /^bytes=/i;

function decorateResponse(request, response) {
  // req.fresh is really a property of the response validators, so it is defined
  // here where both objects are in scope, and read lazily so a handler still
  // gets its chance to set ETag or Last-Modified first.
  Object.defineProperty(request, 'fresh', {
    configurable: true,
    get: () => isValidatable() && fresh(request.headers, response.getHeaders()),
  });

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

  response.vary = (field) => {
    vary(response, field);
    return response;
  };

  // Only the disposition is set here. The Content-Type stays with whoever knows
  // the payload — res.json, res.send, or the static handler.
  response.attachment = (filename, options = {}) => {
    response.setHeader('Content-Disposition', contentDisposition(filename, options));
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
    if (response.statusCode === 204 || response.statusCode === 304) return endWithoutBody();

    if (isValidatable()) {
      if (!response.hasHeader('ETag')) response.setHeader('ETag', etag(body));
      if (fresh(request.headers, response.getHeaders())) {
        response.statusCode = 304;
        return endWithoutBody();
      }
    }

    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'utf8');
    const range = requestedRange(buffer.length);
    if (range === rangeParser.UNSATISFIABLE) {
      response.statusCode = 416;
      response.setHeader('Content-Range', `bytes */${buffer.length}`);
      return endWithoutBody();
    }

    if (range) {
      response.statusCode = 206;
      response.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${buffer.length}`);
    }

    const payload = range ? buffer.subarray(range.start, range.end + 1) : buffer;
    response.setHeader('Content-Length', payload.length);
    response.end(request.method === 'HEAD' ? undefined : payload);
    return response;
  }

  function isValidatable() {
    if (request.method !== 'GET' && request.method !== 'HEAD') return false;
    return response.statusCode === 304
      || (response.statusCode >= 200 && response.statusCode < 300);
  }

  // Range is honoured only for a handler that advertised Accept-Ranges: bytes,
  // so no handler can accidentally return a slice of a resource it never
  // declared range-capable.
  function requestedRange(size) {
    if (response.statusCode !== 200 || response.getHeader('Accept-Ranges') !== 'bytes') return undefined;
    if (!request.headers.range) return undefined;

    // bytes is the only unit served here. Any other unit means the Range header
    // is ignored entirely rather than answered or refused with a 416.
    if (!BYTES_UNIT.test(request.headers.range)) return undefined;

    // If-Range keeps a resumed download honest: once the entity has changed,
    // the whole thing is the right answer, not a fresh slice stitched onto the
    // stale prefix the client already holds.
    const ifRange = request.headers['if-range'];
    if (ifRange && ifRange !== response.getHeader('ETag')) return undefined;

    const ranges = rangeParser(size, request.headers.range);
    if (ranges === rangeParser.MALFORMED) return undefined;
    if (ranges === rangeParser.UNSATISFIABLE) return ranges;

    // Several ranges at once would need a multipart/byteranges body. The full
    // entity is always a valid answer to a range request, so that is what those
    // asks get instead.
    return ranges.length === 1 ? ranges[0] : undefined;
  }

  function endWithoutBody() {
    response.removeHeader('Content-Type');
    response.removeHeader('Content-Length');
    response.end();
    return response;
  }
}

module.exports = decorateResponse;
