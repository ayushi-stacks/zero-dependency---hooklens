'use strict';

function splitPath(pathname) {
  if (pathname === '/') return [];
  return pathname.replace(/^\/+|\/+$/g, '').split('/');
}

function decodeSegment(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    const error = new URIError(`Invalid URL encoding in path segment: ${segment}`);
    error.status = 400;
    throw error;
  }
}

function compilePath(path) {
  if (typeof path !== 'string' || !path.startsWith('/')) {
    throw new TypeError('Route paths must be strings beginning with /');
  }

  return splitPath(path).map((segment) => {
    if (!segment.startsWith(':')) return { value: decodeSegment(segment) };

    const name = segment.slice(1);
    if (!name) throw new TypeError('Route parameter names cannot be empty');
    return { parameter: name };
  });
}

function matchPath(compiledPath, pathname) {
  const incoming = splitPath(pathname);
  if (incoming.length !== compiledPath.length) return null;

  const params = Object.create(null);
  for (let index = 0; index < compiledPath.length; index += 1) {
    const expected = compiledPath[index];
    const actual = decodeSegment(incoming[index]);

    if (expected.parameter) {
      params[expected.parameter] = actual;
    } else if (expected.value !== actual) {
      return null;
    }
  }

  return params;
}

function parseRequestUrl(request) {
  const parsed = new URL(request.url || '/', 'http://localhost');
  const query = Object.create(null);

  for (const [key, value] of parsed.searchParams) {
    if (!Object.prototype.hasOwnProperty.call(query, key)) {
      query[key] = value;
    } else if (Array.isArray(query[key])) {
      query[key].push(value);
    } else {
      query[key] = [query[key], value];
    }
  }

  request.path = parsed.pathname;
  request.query = query;
}

module.exports = {
  compilePath,
  matchPath,
  parseRequestUrl,
};
