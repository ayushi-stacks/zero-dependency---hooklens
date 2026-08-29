'use strict';

const fs = require('node:fs');
const path = require('node:path');

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
      response.setHeader('Content-Length', stats.size);

      if (request.method === 'HEAD') {
        response.end();
        return;
      }

      const stream = fs.createReadStream(resolved);
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
