'use strict';

const DEFAULT_LIMIT = 100 * 1024;

function json(options = {}) {
  return createBodyParser('application/json', parseJson, options);
}

function urlencoded(options = {}) {
  return createBodyParser('application/x-www-form-urlencoded', parseUrlencoded, options);
}

function createBodyParser(mediaType, parse, options) {
  const limit = options.limit === undefined ? DEFAULT_LIMIT : options.limit;
  if (!Number.isInteger(limit) || limit < 0) {
    throw new TypeError('Body size limit must be a non-negative integer');
  }

  return (request, response, next) => {
    const contentType = String(request.headers['content-type'] || '')
      .split(';', 1)[0]
      .trim()
      .toLowerCase();

    if (contentType !== mediaType) {
      next();
      return;
    }

    readBody(request, limit, (error, body) => {
      if (error) {
        next(error);
        return;
      }

      try {
        request.body = parse(body);
        next();
      } catch (parseError) {
        parseError.status = 400;
        next(parseError);
      }
    });
  };
}

function readBody(request, limit, done) {
  const chunks = [];
  let size = 0;
  let limitError;
  let completed = false;

  const complete = (error, body) => {
    if (completed) return;
    completed = true;
    done(error, body);
  };

  request.on('data', (chunk) => {
    size += chunk.length;
    if (size > limit) {
      limitError ||= createError(413, `Request body exceeds ${limit} bytes`);
      return;
    }
    chunks.push(chunk);
  });

  request.once('end', () => {
    if (limitError) {
      complete(limitError);
      return;
    }
    complete(null, Buffer.concat(chunks).toString('utf8'));
  });
  request.once('aborted', () => complete(createError(400, 'Request body was aborted')));
  request.once('error', complete);
}

function parseJson(body) {
  return body.trim() === '' ? {} : JSON.parse(body);
}

function parseUrlencoded(body) {
  const result = {};
  if (body === '') return result;

  for (const pair of body.split('&')) {
    const separator = pair.indexOf('=');
    const rawKey = separator === -1 ? pair : pair.slice(0, separator);
    const rawValue = separator === -1 ? '' : pair.slice(separator + 1);
    const key = decodeFormComponent(rawKey);
    const value = decodeFormComponent(rawValue);

    if (Object.prototype.hasOwnProperty.call(result, key)) {
      result[key] = Array.isArray(result[key])
        ? [...result[key], value]
        : [result[key], value];
    } else {
      Object.defineProperty(result, key, {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
  }

  return result;
}

function decodeFormComponent(value) {
  return decodeURIComponent(value.replace(/\+/g, ' '));
}

function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = {
  json,
  urlencoded,
};
