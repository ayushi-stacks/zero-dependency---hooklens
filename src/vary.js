'use strict';

const FIELD_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

function vary(response, field) {
  if (!response || typeof response.getHeader !== 'function') {
    throw new TypeError('vary() requires a ServerResponse');
  }

  const existing = response.getHeader('Vary');
  const header = Array.isArray(existing) ? existing.join(', ') : String(existing || '');
  response.setHeader('Vary', append(header, field));
}

function append(header, field) {
  if (typeof header !== 'string') throw new TypeError('Vary header must be a string');

  const fields = Array.isArray(field) ? field.map(String) : split(String(field));
  if (fields.length === 0) throw new TypeError('At least one Vary field name is required');
  for (const name of fields) {
    if (!FIELD_NAME.test(name)) throw new TypeError(`Invalid Vary field name: ${name}`);
  }

  const existing = split(header);
  // A single * already widens the cache key to every request header, so it
  // absorbs the list rather than being appended to it. Keeping both would
  // advertise a narrower key than the response actually has.
  if (fields.includes('*') || existing.includes('*')) return '*';

  const seen = new Set(existing.map((name) => name.toLowerCase()));
  const result = [...existing];
  for (const name of fields) {
    if (seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    result.push(name);
  }

  return result.join(', ');
}

function split(header) {
  return header.split(',').map((name) => name.trim()).filter(Boolean);
}

module.exports = vary;
module.exports.append = append;
