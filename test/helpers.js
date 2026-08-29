'use strict';

const http = require('node:http');

function listen(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1');
    server.once('error', reject);
    server.once('listening', () => resolve(server));
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function request(server, options = {}) {
  const address = server.address();

  return new Promise((resolve, reject) => {
    const outgoing = http.request({
      host: '127.0.0.1',
      port: address.port,
      method: options.method || 'GET',
      path: options.path || '/',
      headers: options.headers,
    }, (incoming) => {
      const chunks = [];
      incoming.on('data', (chunk) => chunks.push(chunk));
      incoming.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        const isJson = String(incoming.headers['content-type'] || '').includes('application/json');
        resolve({
          status: incoming.statusCode,
          headers: incoming.headers,
          body,
          json: isJson && body ? JSON.parse(body) : undefined,
        });
      });
    });

    outgoing.once('error', reject);
    if (options.body !== undefined) outgoing.write(options.body);
    outgoing.end();
  });
}

module.exports = {
  close,
  listen,
  request,
};
