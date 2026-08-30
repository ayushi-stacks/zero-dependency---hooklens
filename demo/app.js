'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const expressless = require('../src');
const createHookStore = require('./store');
const { validateChannel } = require('./validation');

const { contentType, httpError } = expressless;

const CAPTURE_LIMIT = 128 * 1024;
const LAST_CHANNEL_COOKIE = 'hooklens_last_channel';
const LAST_CHANNEL_MAX_AGE = 30 * 24 * 60 * 60;
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

  // Without a configured secret the signed cookie simply stops verifying after
  // a restart, so the UI falls back to the first channel instead of breaking.
  const secret = options.secret || process.env.HOOKLENS_SECRET || crypto.randomUUID();

  if (options.log !== false) app.use(expressless.logger({ write: options.writeLog }));
  app.use(expressless.cookies(secret));

  // Every response carries an ETag now, so no-cache tells the browser to
  // revalidate rather than answer from its own cache without asking. That is
  // what turns a repeat request into a visible 304 instead of a silent hit.
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache');
    next();
  });

  for (const method of ['post', 'put', 'patch']) {
    app[method]('/hooks/:channelId', captureWebhook);
  }

  // A webhook URL pasted into a browser arrives here as a GET; send it to the
  // inspector for that channel rather than falling through to a 404.
  app.get('/hooks/:channelId', (req, res) => {
    res.redirect(303, `/?channel=${req.params.channelId}`);
  });

  app.use(expressless.json({ limit: 32 * 1024 }));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', framework: 'expressless', demo: 'HookLens' });
  });

  app.get('/api/session', (req, res) => {
    // This answer is derived entirely from the request's signed cookie, so a
    // shared cache must not hand one browser's last channel to another.
    res.vary('Cookie');
    res.json({ lastChannel: req.signedCookies[LAST_CHANNEL_COOKIE] || null });
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

    res.cookie(LAST_CHANNEL_COOKIE, req.params.channelId, {
      signed: true,
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: LAST_CHANNEL_MAX_AGE,
    });
    res.json({ events, total: events.length });
  });

  app.get('/api/channels/:channelId/export', (req, res, next) => {
    const channel = store.getChannel(req.params.channelId);
    if (!channel) {
      next(httpError(404, 'Channel not found'));
      return;
    }

    // Channel names are user supplied and frequently not ASCII, which is the
    // case content-disposition exists for: the header gets an ASCII fallback
    // plus an RFC 5987 filename* carrying the real bytes.
    res.attachment(`HookLens ${channel.name} events.json`);
    res.json({ channel, events: store.listEvents(channel.id, req.query) });
  });

  app.get('/api/channels/:channelId/events/:eventId', (req, res, next) => {
    const event = store.getEvent(req.params.channelId, req.params.eventId);
    if (!event) {
      next(httpError(404, 'Event not found'));
      return;
    }
    res.json(event);
  });

  app.get('/api/channels/:channelId/events/:eventId/body', (req, res, next) => {
    const event = store.getEvent(req.params.channelId, req.params.eventId);
    if (!event) {
      next(httpError(404, 'Event not found'));
      return;
    }

    const binary = event.bodyEncoding === 'base64';
    const payload = Buffer.from(event.body || '', binary ? 'base64' : 'utf8');

    // The captured Content-Type is attacker supplied. Echoing it would let a
    // webhook sender store HTML and have this origin serve it back as a page,
    // so a raw body always leaves as an opaque download.
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Accept-Ranges', 'bytes');
    res.attachment(`${event.method}-${event.id}.${binary ? 'bin' : 'txt'}`);
    res.send(payload);
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
        // The Cookie header itself is redacted, but which cookies a sender
        // attached is exactly what you want to see when debugging a webhook.
        cookieNames: Object.keys(req.cookies).sort(),
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

function isTextBody(header) {
  let type;
  try {
    type = contentType.parse(header).type;
  } catch {
    return true;
  }

  return type.startsWith('text/')
    || type === 'application/json'
    || type === 'application/x-www-form-urlencoded'
    || type.endsWith('+json')
    || type.endsWith('+xml')
    || type === 'application/xml';
}

module.exports = createDemoApp;
