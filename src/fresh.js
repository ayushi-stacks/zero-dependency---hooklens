'use strict';

const NO_CACHE = /(?:^|,)\s*no-cache\s*(?:,|$)/;

function fresh(requestHeaders, responseHeaders) {
  const ifNoneMatch = header(requestHeaders, 'if-none-match');
  const ifModifiedSince = header(requestHeaders, 'if-modified-since');
  if (!ifNoneMatch && !ifModifiedSince) return false;

  // A client that explicitly asked to bypass its cache is never told the copy
  // is fresh, even when the validators would otherwise have matched.
  const cacheControl = header(requestHeaders, 'cache-control');
  if (cacheControl && NO_CACHE.test(cacheControl)) return false;

  // RFC 9110 13.1.3: a recipient MUST ignore If-Modified-Since when the request
  // also carries If-None-Match. The `fresh` package evaluates both and requires
  // both to pass, which can report a changed entity as fresh.
  if (ifNoneMatch) return matchesEntityTag(ifNoneMatch, header(responseHeaders, 'etag'));

  return notModifiedSince(ifModifiedSince, header(responseHeaders, 'last-modified'));
}

function matchesEntityTag(ifNoneMatch, entityTag) {
  if (ifNoneMatch.trim() === '*') return true;
  if (!entityTag) return false;

  // Weak comparison per RFC 9110 8.8.3.2: the W/ prefix is not part of the
  // match, so a weak stat tag still satisfies a strong If-None-Match.
  const target = stripWeak(entityTag.trim());
  return ifNoneMatch
    .split(',')
    .map((candidate) => stripWeak(candidate.trim()))
    .some((candidate) => candidate !== '' && candidate === target);
}

function notModifiedSince(ifModifiedSince, lastModified) {
  if (!lastModified) return false;
  const modifiedAt = Date.parse(lastModified);
  const since = Date.parse(ifModifiedSince);
  if (Number.isNaN(modifiedAt) || Number.isNaN(since)) return false;
  return modifiedAt <= since;
}

function stripWeak(value) {
  return value.startsWith('W/') ? value.slice(2) : value;
}

// Node lowercases both req.headers and res.getHeaders(), but a caller passing a
// hand-built object should not silently get a stale answer from a capitalised
// key, so a miss falls back to a case-insensitive scan.
function header(headers, name) {
  if (!headers) return undefined;
  let value = headers[name];
  if (value === undefined) {
    const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name);
    value = key === undefined ? undefined : headers[key];
  }
  return Array.isArray(value) ? value.join(', ') : value;
}

module.exports = fresh;
