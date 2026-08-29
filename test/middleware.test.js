'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const expressless = require('../src');
const { close, listen, request } = require('./helpers');

test('middleware runs in registration order and can stop the chain', async (context) => {
  const app = expressless();
  const order = [];

  app.use((req, res, next) => {
    order.push('first');
    next();
  });
  app.use((req, res, next) => {
    order.push('second');
    next();
  });
  app.get('/ordered', (req, res) => {
    order.push('route');
    res.json(order);
  });
  app.get('/stopped', (req, res) => res.send('route'));
  app.use((req, res) => res.status(418).send('stopped'));

  const server = await listen(app);
  context.after(() => close(server));

  const ordered = await request(server, { path: '/ordered' });
  assert.deepEqual(ordered.json, ['first', 'second', 'route']);

  const stopped = await request(server, { path: '/anything-else' });
  assert.equal(stopped.status, 418);
  assert.equal(stopped.body, 'stopped');
});

test('next(error) skips normal handlers and reaches error middleware', async (context) => {
  const app = expressless();
  let skipped = true;

  app.use((req, res, next) => next(Object.assign(new Error('bad input'), { status: 422 })));
  app.use((req, res, next) => {
    skipped = false;
    next();
  });
  app.use((error, req, res, next) => {
    res.status(error.status).json({ message: error.message });
  });

  const server = await listen(app);
  context.after(() => close(server));

  const response = await request(server);
  assert.equal(skipped, true);
  assert.equal(response.status, 422);
  assert.deepEqual(response.json, { message: 'bad input' });
});

test('response helpers chain, serialize objects, and ignore a second send', async (context) => {
  const app = expressless();
  app.get('/created', (req, res) => {
    res.status(201).send({ created: true });
    res.send('too late');
  });
  app.get('/empty', (req, res) => res.status(204).send('discarded'));
  app.get('/throw', () => {
    throw new Error('private detail');
  });

  const server = await listen(app);
  context.after(() => close(server));

  const created = await request(server, { path: '/created' });
  assert.equal(created.status, 201);
  assert.deepEqual(created.json, { created: true });

  const empty = await request(server, { path: '/empty' });
  assert.equal(empty.status, 204);
  assert.equal(empty.body, '');

  const failed = await request(server, { path: '/throw' });
  assert.equal(failed.status, 500);
  assert.deepEqual(failed.json, { error: 'Internal Server Error' });
});

test('invalid custom error statuses fall back to a safe 500 response', async (context) => {
  const app = expressless();
  app.get('/invalid-error', (req, res, next) => {
    next(Object.assign(new Error('bad status'), { status: 700 }));
  });

  const server = await listen(app);
  context.after(() => close(server));

  const response = await request(server, { path: '/invalid-error' });
  assert.equal(response.status, 500);
  assert.deepEqual(response.json, { error: 'Internal Server Error' });
});
