'use strict';

const statuses = require('./statuses');

class HttpError extends Error {
  constructor(status, message, props) {
    const code = Number(status);
    super(message || statuses[code] || 'Error');
    this.name = createName(code);
    this.status = code;
    this.statusCode = code;
    this.expose = code < 500;
    if (props && typeof props === 'object') Object.assign(this, props);
  }
}

function createError(status, message, props) {
  if (status === undefined || status === null) {
    status = 500;
  }

  if (typeof status === 'object') {
    props = status;
    status = props.status || props.statusCode || 500;
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

  return new HttpError(code, message, props);
}

// Only 4xx and 5xx get named constructors; http-errors does not expose
// createError.OK, and neither should this.
for (const code of statuses.codes) {
  if (code < 400) continue;
  Object.defineProperty(createError, createName(code), {
    configurable: true,
    enumerable: false,
    value: (message, props) => createError(code, message, props),
  });
}

createError.createError = createError;
createError.HttpError = HttpError;

module.exports = createError;

function createName(code) {
  if (!Number.isInteger(code) || code < 100 || code > 599) {
    return 'Error';
  }

  // Punctuation is stripped rather than treated as a separator, so 418 is
  // ImATeapot and not IMATeapot.
  const name = statuses[code]
    .replace(/[^ 0-9a-z]/gi, '')
    .split(' ')
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join('');

  return name || 'Error';
}
