'use strict';

function parse(value) {
  if (value === undefined || value === null) {
    throw new TypeError('Content-Type header is required');
  }

  const header = String(value).trim();
  if (!header) {
    throw new TypeError('Content-Type header is required');
  }

  const parameters = Object.create(null);
  const semicolon = header.indexOf(';');
  const type = semicolon === -1 ? header : header.slice(0, semicolon).trim();

  if (semicolon === -1) {
    return { type: type.toLowerCase(), parameters };
  }

  for (const part of header.slice(semicolon + 1).split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const equals = trimmed.indexOf('=');
    const key = equals === -1 ? trimmed : trimmed.slice(0, equals).trim();
    const rawValue = equals === -1 ? '' : trimmed.slice(equals + 1).trim();
    if (!key) continue;
    parameters[key.toLowerCase()] = parseParameterValue(rawValue);
  }

  return { type: type.toLowerCase(), parameters };
}

function format(input) {
  if (typeof input === 'string') return input;

  const type = input && input.type ? String(input.type) : 'application/octet-stream';
  const parameters = input && input.parameters ? input.parameters : {};
  const pairs = [];

  for (const [key, value] of Object.entries(parameters)) {
    if (value === undefined || value === null) continue;
    const encoded = String(value).replace(/"/g, '\\"');
    pairs.push(`${key}=${encoded}`);
  }

  return pairs.length === 0 ? type : `${type}; ${pairs.join('; ')}`;
}

function parseParameterValue(value) {
  if (!value) return '';
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\"/g, '"');
  }
  return value;
}

module.exports = {
  format,
  parse,
};
