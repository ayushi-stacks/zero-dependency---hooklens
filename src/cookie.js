'use strict';

function parse(value) {
  const cookies = Object.create(null);
  if (!value) return cookies;

  for (const pair of String(value).split(';')) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const separator = trimmed.indexOf('=');
    const rawName = separator === -1 ? trimmed : trimmed.slice(0, separator).trim();
    const rawValue = separator === -1 ? '' : trimmed.slice(separator + 1).trim();
    if (!rawName) continue;
    cookies[decode(rawName)] = decode(rawValue);
  }

  return cookies;
}

function serialize(name, value, options = {}) {
  const output = [`${encodeURIComponent(String(name))}=${encodeURIComponent(String(value))}`];

  if (options.maxAge !== undefined && options.maxAge !== null) {
    const maxAge = Number(options.maxAge);
    if (!Number.isFinite(maxAge)) {
      throw new TypeError(`Cookie maxAge must be a finite number: ${options.maxAge}`);
    }
    output.push(`Max-Age=${Math.floor(maxAge)}`);
  }
  if (options.domain) output.push(`Domain=${options.domain}`);
  if (options.path) output.push(`Path=${options.path}`);
  if (options.expires) {
    const expires = options.expires instanceof Date ? options.expires : new Date(options.expires);
    if (Number.isNaN(expires.getTime())) {
      throw new TypeError(`Cookie expires must be a valid date: ${options.expires}`);
    }
    output.push(`Expires=${expires.toUTCString()}`);
  }
  if (options.httpOnly) output.push('HttpOnly');
  if (options.secure) output.push('Secure');
  if (options.sameSite) output.push(`SameSite=${String(options.sameSite)}`);

  return output.join('; ');
}

// A Cookie header is attacker-controlled, so a bad escape returns the raw text
// rather than throwing out of the parser and failing the whole request.
function decode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

module.exports = {
  parse,
  serialize,
};
