'use strict';

const fs = require('node:fs');
const path = require('node:path');
const etag = require('./etag');
const fresh = require('./fresh');
const rangeParser = require('./range-parser');

const BYTES_UNIT = /^bytes=/i;

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
};

function serveStatic(root, options = {}) {
  const staticRoot = path.resolve(root);
  const indexFile = options.index === undefined ? 'index.html' : options.index;

  return async (request, response, next) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      next();
      return;
    }

    let resolved;
    try {
      resolved = resolveRequestPath(staticRoot, request.url);
    } catch (error) {
      next(error);
      return;
    }

    if (!resolved) {
      next(createError(403, 'Forbidden'));
      return;
    }

    try {
      let stats = await fs.promises.stat(resolved);
      if (stats.isDirectory() && indexFile) {
        resolved = path.join(resolved, indexFile);
        if (!isInside(staticRoot, resolved)) {
          next(createError(403, 'Forbidden'));
          return;
        }
        stats = await fs.promises.stat(resolved);
      }

      if (!stats.isFile()) {
        next();
        return;
      }

      const realPath = await fs.promises.realpath(resolved);
      if (!isInside(staticRoot, realPath)) {
        next(createError(403, 'Forbidden'));
        return;
      }
      resolved = realPath;

      response.statusCode = 200;
      response.setHeader('Content-Type', MIME_TYPES[path.extname(resolved).toLowerCase()] || 'application/octet-stream');
      response.setHeader('Last-Modified', stats.mtime.toUTCString());
      response.setHeader('ETag', etag(stats));
      response.setHeader('Accept-Ranges', 'bytes');

      // The validators are set before this check so a repeat visit is answered
      // from headers alone, without ever opening the file.
      if (fresh(request.headers, response.getHeaders())) {
        response.statusCode = 304;
        response.removeHeader('Content-Type');
        response.end();
        return;
      }

      const range = requestedRange(request, response, stats);
      if (range === rangeParser.UNSATISFIABLE) {
        response.statusCode = 416;
        response.setHeader('Content-Range', `bytes */${stats.size}`);
        response.removeHeader('Content-Type');
        response.end();
        return;
      }

      if (range) {
        response.statusCode = 206;
        response.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${stats.size}`);
      }
      response.setHeader('Content-Length', range ? range.end - range.start + 1 : stats.size);

      if (request.method === 'HEAD') {
        response.end();
        return;
      }

      const stream = fs.createReadStream(resolved, range || undefined);
      stream.once('error', (error) => {
        if (response.headersSent) {
          response.destroy(error);
        } else {
          next(error);
        }
      });
      stream.pipe(response);
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
        next();
        return;
      }
      next(error);
    }
  };
}

function requestedRange(request, response, stats) {
  if (!request.headers.range) return undefined;

  // bytes is the only unit served here. Any other unit means the Range header
  // is ignored entirely rather than answered or refused with a 416.
  if (!BYTES_UNIT.test(request.headers.range)) return undefined;

  // If-Range keeps a resumed download honest: once the file has changed, the
  // whole file is the right answer, not a fresh slice stitched onto the stale
  // prefix the client already holds.
  const ifRange = request.headers['if-range'];
  if (ifRange && !matchesEntity(ifRange, response)) return undefined;

  const ranges = rangeParser(stats.size, request.headers.range);
  if (ranges === rangeParser.MALFORMED) return undefined;
  if (ranges === rangeParser.UNSATISFIABLE) return ranges;

  // Several ranges at once would need a multipart/byteranges body. The full
  // file is always a valid answer to a range request, so that is what those
  // asks get instead.
  return ranges.length === 1 ? ranges[0] : undefined;
}

// RFC 9110 asks for strong comparison here, which a weak stat tag could never
// satisfy, so If-Range is matched byte-for-byte against the tag this server
// just issued. The date form is compared as a date.
function matchesEntity(ifRange, response) {
  if (ifRange.startsWith('"') || ifRange.startsWith('W/')) {
    return ifRange === response.getHeader('ETag');
  }

  const since = Date.parse(ifRange);
  return !Number.isNaN(since) && Date.parse(response.getHeader('Last-Modified')) <= since;
}

function resolveRequestPath(root, requestUrl) {
  const rawPath = String(requestUrl || '/').split('?', 1)[0];
  let decoded;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    throw createError(400, 'Malformed URL path');
  }

  if (decoded.includes('\0')) return null;
  const resolved = path.resolve(root, `.${decoded}`);
  return isInside(root, resolved) ? resolved : null;
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = serveStatic;
