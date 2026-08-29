'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const expressless = require('../src');
const { close, listen, request } = require('./helpers');

test('logger writes method, URL, status, and elapsed time after response finish', async (context) => {
  const lines = [];
  const app = expressless();
  app.use(expressless.logger({ write: (line) => lines.push(line) }));
  app.get('/health', (req, res) => res.send('ok'));

  const server = await listen(app);
  context.after(() => close(server));

  await request(server, { path: '/health?full=true' });
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^GET \/health\?full=true 200 \d+\.\dms$/);
});
