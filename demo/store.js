'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_RETENTION = 100;

function createHookStore(file, options = {}) {
  const dataFile = path.resolve(file);
  const retention = options.retention || DEFAULT_RETENTION;
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, `${JSON.stringify(emptyData(), null, 2)}\n`);

  let data = readData(dataFile);
  let mutationQueue = Promise.resolve();

  return {
    listChannels() {
      return data.channels.map((channel) => decorateChannel(channel, data.events[channel.id] || []));
    },

    getChannel(id) {
      const channel = data.channels.find((candidate) => candidate.id === id);
      return channel ? decorateChannel(channel, data.events[id] || []) : null;
    },

    createChannel(input) {
      return enqueue(async () => {
        const id = uniqueChannelId(data.channels, input.id);
        const now = new Date().toISOString();
        const channel = { id, name: input.name, createdAt: now, updatedAt: now };
        const nextData = cloneData(data);
        nextData.channels.push(channel);
        nextData.events[id] = [];
        await persist(dataFile, nextData);
        data = nextData;
        return decorateChannel(channel, []);
      });
    },

    listEvents(channelId, filters = {}) {
      const channel = this.getChannel(channelId);
      if (!channel) return null;

      const method = String(filters.method || '').toUpperCase();
      const search = String(filters.search || '').trim().toLowerCase();
      return (data.events[channelId] || [])
        .filter((event) => !method || event.method === method)
        .filter((event) => !search || eventSearchText(event).includes(search))
        .map(cloneEvent);
    },

    getEvent(channelId, eventId) {
      if (!this.getChannel(channelId)) return null;
      const event = (data.events[channelId] || []).find((candidate) => candidate.id === eventId);
      return event ? cloneEvent(event) : null;
    },

    addEvent(channelId, event) {
      return enqueue(async () => {
        const channelIndex = data.channels.findIndex((channel) => channel.id === channelId);
        if (channelIndex === -1) return null;

        const now = new Date().toISOString();
        const stored = {
          id: crypto.randomUUID(),
          receivedAt: now,
          ...event,
        };

        const nextData = cloneData(data);
        nextData.channels[channelIndex] = {
          ...nextData.channels[channelIndex],
          updatedAt: now,
        };
        nextData.events[channelId] = [stored, ...(nextData.events[channelId] || [])].slice(0, retention);
        await persist(dataFile, nextData);
        data = nextData;
        return cloneEvent(stored);
      });
    },

    clearEvents(channelId) {
      return enqueue(async () => {
        if (!data.channels.some((channel) => channel.id === channelId)) return null;
        const nextData = cloneData(data);
        nextData.events[channelId] = [];
        await persist(dataFile, nextData);
        data = nextData;
        return true;
      });
    },
  };

  function enqueue(operation) {
    const result = mutationQueue.then(operation);
    mutationQueue = result.catch(() => {});
    return result;
  }
}

function readData(file) {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (Array.isArray(parsed)) return emptyData();
  if (!parsed || typeof parsed !== 'object') throw new TypeError(`HookLens data must be an object: ${file}`);
  const channels = Array.isArray(parsed.channels) ? parsed.channels : [];
  const events = parsed.events && typeof parsed.events === 'object' && !Array.isArray(parsed.events)
    ? parsed.events
    : {};
  for (const channel of channels) {
    if (!Array.isArray(events[channel.id])) events[channel.id] = [];
  }
  return { channels, events };
}

async function persist(file, data) {
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  const serialized = `${JSON.stringify(data, null, 2)}\n`;

  try {
    await fs.promises.writeFile(temporary, serialized, { flag: 'wx' });
    await fs.promises.rename(temporary, file);
  } catch (error) {
    await fs.promises.rm(temporary, { force: true });
    throw error;
  }
}

function uniqueChannelId(channels, requested) {
  const used = new Set(channels.map((channel) => channel.id));
  if (!used.has(requested)) return requested;

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const base = requested.slice(0, Math.max(1, 40 - String(suffix).length - 1));
    const candidate = `${base}-${suffix}`;
    if (!used.has(candidate)) return candidate;
  }

  return crypto.randomUUID();
}

function decorateChannel(channel, events) {
  return {
    ...channel,
    eventCount: events.length,
    lastEventAt: events[0]?.receivedAt || null,
  };
}

function emptyData() {
  return { channels: [], events: {} };
}

function cloneData(data) {
  return {
    channels: data.channels.map((channel) => ({ ...channel })),
    events: Object.fromEntries(Object.entries(data.events).map(([id, events]) => [id, events.map(cloneEvent)])),
  };
}

function cloneEvent(event) {
  return {
    ...event,
    query: { ...event.query },
    headers: { ...event.headers },
  };
}

function eventSearchText(event) {
  return `${event.method} ${event.path} ${event.contentType} ${event.body} ${JSON.stringify(event.headers)}`.toLowerCase();
}

module.exports = createHookStore;
