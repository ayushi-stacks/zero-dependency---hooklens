'use strict';

const { httpError } = require('../src');

const CHANNEL_ID = /^[a-z0-9][a-z0-9-]{2,38}[a-z0-9]$/;
const CHANNEL_NAME_LIMIT = 60;

function validateChannel(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw httpError(422, 'Request body must be a JSON object');
  }

  const name = normalizeName(input.name);
  const requestedId = input.id === undefined ? slugify(name) : normalizeId(input.id);
  if (!requestedId) throw httpError(422, 'name must include letters or numbers, or provide an id');

  return {
    id: requestedId,
    name,
  };
}

function normalizeName(value) {
  if (typeof value !== 'string') throw httpError(422, 'name must be a string');
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name) throw httpError(422, 'name is required');
  if (name.length > CHANNEL_NAME_LIMIT) throw httpError(422, 'name is too long');
  return name;
}

function normalizeId(value) {
  if (typeof value !== 'string') throw httpError(422, 'id must be a string');
  const id = value.trim().toLowerCase();
  if (!CHANNEL_ID.test(id)) {
    throw httpError(422, 'id must be 4-40 lowercase letters, numbers, or hyphens');
  }
  return id;
}

function slugify(value) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 34)
    .replace(/-+$/g, '');
  return CHANNEL_ID.test(slug) ? slug : '';
}

module.exports = {
  CHANNEL_ID,
  validateChannel,
};
