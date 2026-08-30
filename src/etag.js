'use strict';

const crypto = require('node:crypto');

const HASH_LENGTH = 27;

function etag(entity, options = {}) {
  const stats = asFileStats(entity);
  if (!stats && typeof entity !== 'string' && !Buffer.isBuffer(entity)) {
    throw new TypeError('An ETag entity must be a string, a Buffer, or fs.Stats');
  }

  const weak = options.weak === undefined ? Boolean(stats) : options.weak === true;
  const tag = stats ? statTag(stats) : entityTag(entity);
  return weak ? `W/${tag}` : tag;
}

function entityTag(entity) {
  const buffer = Buffer.isBuffer(entity) ? entity : Buffer.from(entity, 'utf8');
  const digest = crypto.createHash('sha256').update(buffer).digest('base64').slice(0, HASH_LENGTH);
  return `"${buffer.length.toString(16)}-${digest}"`;
}

// Size and mtime cannot see an overwrite that keeps the byte length and lands
// in the same clock tick, which is exactly why stat tags are weak by default.
function statTag(stats) {
  return `"${stats.size.toString(16)}-${stats.mtime.getTime().toString(16)}"`;
}

function asFileStats(value) {
  const looksLikeStats = value !== null
    && typeof value === 'object'
    && typeof value.size === 'number'
    && value.mtime instanceof Date;
  return looksLikeStats ? value : null;
}

module.exports = etag;
