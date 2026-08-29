'use strict';

const path = require('node:path');
const expressless = require('../src');
const createHookStore = require('./store');
const { validateChannel } = require('./validation');

const CAPTURE_LIMIT = 128 * 1024;
const REDACTED_HEADERS = new Set([
  'authorization',
  'cookie',
  'proxy-authorization',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
  'x-signature',
  'x-webhook-secret',
]);

function createDemoApp(options = {}) {
  const dataFile = options.dataFile || path.join(__dirname, 'data', 'hooks.json');
  const publicDirectory = options.publicDirectory || path.join(__dirname, '..', 'public');
  const store = createHookStore(dataFile, { retention: options.retention });
  const hub = createEventHub();
  const app = expressless();

  if (options.log !== false) app.use(expressless.logger({ write: options.writeLog }));

  for (const method of ['post', 'put', 'patch']) {
    app[method]('/hooks/:channelId', captureWebhook);
  }

  app.use(expressless.json({ limit: 32 * 1024 }));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', framework: 'expressless', demo: 'HookLens' });
  });

  app.get('/api/channels', (req, res) => {
    res.json({ channels: store.listChannels() });
  });

  app.post('/api/channels', async (req, res) => {
    const channel = await store.createChannel(validateChannel(req.body));
    res.status(201).json(channel);
  });

  app.get('/api/channels/:channelId', (req, res, next) => {
    const channel = store.getChannel(req.params.channelId);
    if (!channel) {
      next(httpError(404, 'Channel not found'));
      return;
    }
    res.json(channel);
  });

  app.get('/api/channels/:channelId/events', (req, res, next) => {
    const events = store.listEvents(req.params.channelId, req.query);
    if (!events) {
      next(httpError(404, 'Channel not found'));
      return;
    }
    res.json({ events, total: events.length });
  });

  app.get('/api/channels/:channelId/events/:eventId', (req, res, next) => {
    const event = store.getEvent(req.params.channelId, req.params.eventId);
    if (!event) {
      next(httpError(404, 'Event not found'));
      return;
    }
    res.json(event);
  });

  app.delete('/api/channels/:channelId/events', async (req, res, next) => {
    const cleared = await store.clearEvents(req.params.channelId);
    if (!cleared) {
      next(httpError(404, 'Channel not found'));
      return;
    }
    hub.publish(req.params.channelId, { type: 'cleared' });
    res.status(204).send();
  });

  app.get('/api/channels/:channelId/stream', (req, res, next) => {
    if (!store.getChannel(req.params.channelId)) {
      next(httpError(404, 'Channel not found'));
      return;
    }
    hub.subscribe(req.params.channelId, res);
  });

  app.use(expressless.static(publicDirectory));

  return { app, store, hub };

  async function captureWebhook(req, res, next) {
    const channel = store.getChannel(req.params.channelId);
    if (!channel) {
      next(httpError(404, 'Channel not found'));
      return;
    }

    try {
      const body = await readRawBody(req, CAPTURE_LIMIT);
      const event = await store.addEvent(channel.id, {
        method: req.method,
        path: req.path,
        query: req.query,
        headers: redactHeaders(req.headers),
        contentType: String(req.headers['content-type'] || ''),
        body: encodeBody(body, req.headers['content-type']),
        bodyEncoding: isTextBody(req.headers['content-type']) ? 'utf8' : 'base64',
        size: body.length,
        remoteAddress: req.socket.remoteAddress || '',
      });
      hub.publish(channel.id, { type: 'captured', event });
      res.status(202).json({ captured: true, channelId: channel.id, eventId: event.id });
    } catch (error) {
      next(error);
    }
  }
}

function createEventHub() {
  const subscribers = new Map();

  return {
    subscribe(channelId, response) {
      response.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      response.write('event: ready\ndata: {"type":"ready"}\n\n');

      const channelSubscribers = subscribers.get(channelId) || new Set();
      channelSubscribers.add(response);
      subscribers.set(channelId, channelSubscribers);

      const heartbeat = setInterval(() => {
        if (!response.writableEnded) response.write('event: ping\ndata: {}\n\n');
      }, 25000);

      response.on('close', () => {
        clearInterval(heartbeat);
        channelSubscribers.delete(response);
        if (channelSubscribers.size === 0) subscribers.delete(channelId);
      });
    },

    publish(channelId, payload) {
      const channelSubscribers = subscribers.get(channelId);
      if (!channelSubscribers) return;
      const serialized = JSON.stringify(payload);
      for (const response of channelSubscribers) {
        if (response.writableEnded) {
          channelSubscribers.delete(response);
          continue;
        }
        response.write(`event: ${payload.type}\ndata: ${serialized}\n\n`);
      }
    },

    subscriberCount(channelId) {
      return subscribers.get(channelId)?.size || 0;
    },
  };
}

function readRawBody(request, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let completed = false;

    const finish = (error, body) => {
      if (completed) return;
      completed = true;
      if (error) reject(error);
      else resolve(body);
    };

    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        finish(httpError(413, `Request body exceeds ${limit} bytes`));
        return;
      }
      chunks.push(chunk);
    });

    request.once('end', () => finish(null, Buffer.concat(chunks)));
    request.once('aborted', () => finish(httpError(400, 'Request body was aborted')));
    request.once('error', finish);
  });
}

function redactHeaders(headers) {
  const safeHeaders = {};
  for (const [name, value] of Object.entries(headers)) {
    safeHeaders[name] = REDACTED_HEADERS.has(name.toLowerCase()) ? '[redacted]' : value;
  }
  return safeHeaders;
}

function encodeBody(buffer, contentType) {
  return isTextBody(contentType) ? buffer.toString('utf8') : buffer.toString('base64');
}

function isTextBody(contentType) {
  const type = String(contentType || '').split(';', 1)[0].trim().toLowerCase();
  return type === ''
    || type.startsWith('text/')
    || type === 'application/json'
    || type === 'application/x-www-form-urlencoded'
    || type.endsWith('+json')
    || type.endsWith('+xml')
    || type === 'application/xml';
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = createDemoApp;
