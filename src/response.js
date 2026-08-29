'use strict';

function decorateResponse(request, response) {
  response.status = (code) => {
    if (!Number.isInteger(code) || code < 100 || code > 999) {
      throw new RangeError(`Invalid HTTP status code: ${code}`);
    }
    response.statusCode = code;
    return response;
  };

  response.json = (value) => {
    if (response.writableEnded) return response;

    const body = JSON.stringify(value);
    if (!response.hasHeader('Content-Type')) {
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    return finish(body === undefined ? '' : body);
  };

  response.send = (value = '') => {
    if (response.writableEnded) return response;
    if (value !== null && typeof value === 'object' && !Buffer.isBuffer(value)) {
      return response.json(value);
    }

    const body = Buffer.isBuffer(value) ? value : String(value);
    if (!response.hasHeader('Content-Type')) {
      response.setHeader(
        'Content-Type',
        Buffer.isBuffer(body) ? 'application/octet-stream' : 'text/html; charset=utf-8',
      );
    }
    return finish(body);
  };

  function finish(body) {
    if (response.statusCode === 204 || response.statusCode === 304) {
      response.removeHeader('Content-Type');
      response.removeHeader('Content-Length');
      response.end();
      return response;
    }

    response.setHeader('Content-Length', Buffer.byteLength(body));
    response.end(request.method === 'HEAD' ? undefined : body);
    return response;
  }
}

module.exports = decorateResponse;
