'use strict';

const crypto = require('node:crypto');

function sign(value, secret) {
  const payload = String(value);
  const key = String(secret || '');
  const digest = crypto.createHmac('sha256', key).update(payload).digest('base64').replace(/=+$/g, '');
  return `${payload}.${digest}`;
}

function unsign(input, secret) {
  if (typeof input !== 'string') return false;
  const index = input.lastIndexOf('.');
  if (index <= 0) return false;

  const payload = input.slice(0, index);
  const expected = sign(payload, secret);
  if (input.length !== expected.length) return false;

  try {
    return crypto.timingSafeEqual(Buffer.from(input), Buffer.from(expected)) ? payload : false;
  } catch {
    return false;
  }
}

module.exports = {
  sign,
  unsign,
};
