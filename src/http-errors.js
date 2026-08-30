'use strict';

const statuses = require('./statuses');

function createError(status, message, props) {
  if (status === undefined || status === null) {
    status = 500;
  }

  if (typeof status === 'object') {
    props = status;
    status = props.status || 500;
    message = props.message || statuses[status] || 'Error';
  } else if (typeof status === 'string') {
    const parsed = Number(status);
    if (Number.isFinite(parsed) && status.trim() !== '') {
      status = parsed;
    } else {
      message = status;
      status = 500;
    }
  }

  const code = Number(status);
  if (!Number.isInteger(code) || code < 100 || code > 599) {
    throw new RangeError(`Invalid HTTP error status code: ${status}`);
  }

  const error = new Error(message || statuses[code] || 'Error');
  error.name = createName(code);
  error.status = code;
  error.statusCode = code;
  error.expose = code >= 400 && code < 500;

  if (props && typeof props === 'object') {
    Object.assign(error, props);
  }

  return error;
}

for (const code of statuses.codes) {
  const name = createName(code);
  Object.defineProperty(createError, name, {
    configurable: true,
    enumerable: false,
    value: (message, props) => createError(code, message, props),
  });
}

createError.createError = createError;
createError.HttpError = class HttpError extends Error {
  constructor(status, message, props) {
    super(message || statuses[status] || 'Error');
    this.name = createName(Number(status));
    this.status = Number(status);
    this.statusCode = Number(status);
    this.expose = Number(status) >= 400 && Number(status) < 500;
    if (props && typeof props === 'object') Object.assign(this, props);
  }
};

module.exports = createError;

function createName(code) {
  if (!Number.isInteger(code) || code < 100 || code > 599) {
    return 'Error';
  }

  const name = statuses[code].replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((segment, index) => {
      if (index === 0) return segment;
      return segment[0].toUpperCase() + segment.slice(1).toLowerCase();
    })
    .join('');

  return name || 'Error';
}
