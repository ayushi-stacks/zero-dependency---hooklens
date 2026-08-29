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
    cookies[decodeURIComponent(rawName)] = decodeURIComponent(rawValue);
  }

  return cookies;
}

function serialize(name, value, options = {}) {
  const output = [`${encodeURIComponent(String(name))}=${encodeURIComponent(String(value))}`];

  if (options.maxAge !== undefined && options.maxAge !== null) {
    output.push(`Max-Age=${Number(options.maxAge)}`);
  }
  if (options.domain) output.push(`Domain=${options.domain}`);
  if (options.path) output.push(`Path=${options.path}`);
  if (options.expires) {
    const expires = options.expires instanceof Date ? options.expires : new Date(options.expires);
    output.push(`Expires=${expires.toUTCString()}`);
  }
  if (options.httpOnly) output.push('HttpOnly');
  if (options.secure) output.push('Secure');
  if (options.sameSite) output.push(`SameSite=${String(options.sameSite)}`);
  if (options.signed) output.push('Signed');

  return output.join('; ');
}

module.exports = {
  parse,
  serialize,
};
