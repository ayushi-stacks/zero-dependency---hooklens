'use strict';

function logger(options = {}) {
  const write = options.write || ((line) => console.log(line));
  if (typeof write !== 'function') throw new TypeError('Logger write option must be a function');

  return (request, response, next) => {
    const startedAt = process.hrtime.bigint();

    response.once('finish', () => {
      const elapsedMilliseconds = Number(process.hrtime.bigint() - startedAt) / 1e6;
      write(`${request.method} ${request.url} ${response.statusCode} ${elapsedMilliseconds.toFixed(1)}ms`);
    });

    next();
  };
}

module.exports = logger;
