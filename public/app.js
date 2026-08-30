'use strict';

const elements = {
  channelCount: document.querySelector('#channel-count'),
  channelForm: document.querySelector('#channel-form'),
  channelList: document.querySelector('#channel-list'),
  channelName: document.querySelector('#channel-name'),
  clearEvents: document.querySelector('#clear-events'),
  copyCurl: document.querySelector('#copy-curl'),
  copyEndpoint: document.querySelector('#copy-endpoint'),
  detail: document.querySelector('#event-detail'),
  empty: document.querySelector('#empty-state'),
  endpoint: document.querySelector('#endpoint-url'),
  events: document.querySelector('#events'),
  eventSearch: document.querySelector('#event-search'),
  eventTotal: document.querySelector('#event-total'),
  lastMethod: document.querySelector('#last-method'),
  methodFilter: document.querySelector('#method-filter'),
  note: document.querySelector('#result-note'),
  streamState: document.querySelector('#stream-state'),
  toast: document.querySelector('#toast'),
};

let channels = [];
let activeChannelId = '';
let events = [];
let activeEventId = '';
let stream;
let searchTimer;
let toastTimer;

elements.channelForm.addEventListener('submit', createChannel);
elements.copyEndpoint.addEventListener('click', copyEndpoint);
elements.clearEvents.addEventListener('click', clearEvents);
elements.copyCurl.addEventListener('click', copyCurl);
elements.methodFilter.addEventListener('change', loadEvents);
elements.eventSearch.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadEvents, 180);
});

boot();

async function boot() {
  await loadChannels();
  if (channels.length === 0) {
    const channel = await api('/api/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'demo', name: 'Demo channel' }),
    });
    channels = [channel];
  }
  selectChannel(await rememberedChannelId());
}

async function rememberedChannelId() {
  const requested = new URLSearchParams(location.search).get('channel');
  if (channels.some((channel) => channel.id === requested)) return requested;

  try {
    const { lastChannel } = await api('/api/session');
    if (channels.some((channel) => channel.id === lastChannel)) return lastChannel;
  } catch {
    // A missing or unverifiable session cookie is not worth failing boot over.
  }

  return channels[0].id;
}

async function loadChannels() {
  const response = await api('/api/channels');
  channels = response.channels;
  elements.channelCount.textContent = channels.length;
  renderChannels();
}

function renderChannels() {
  elements.channelList.replaceChildren();
  for (const channel of channels) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = channel.id === activeChannelId ? 'channel active' : 'channel';
    button.innerHTML = `<strong></strong><span></span><em></em>`;
    button.querySelector('strong').textContent = channel.name;
    button.querySelector('span').textContent = `/${channel.id}`;
    button.querySelector('em').textContent = `${channel.eventCount} events`;
    button.addEventListener('click', () => selectChannel(channel.id));
    elements.channelList.append(button);
  }
}

async function createChannel(event) {
  event.preventDefault();
  const name = elements.channelName.value.trim();
  if (!name) return;

  try {
    const channel = await api('/api/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    elements.channelName.value = '';
    await loadChannels();
    selectChannel(channel.id);
    showToast('Channel created');
  } catch (error) {
    showToast(error.message, true);
  }
}

function selectChannel(channelId) {
  activeChannelId = channelId;
  activeEventId = '';
  renderChannels();
  renderEndpoint();
  openStream();
  loadEvents();
}

function renderEndpoint() {
  elements.endpoint.textContent = `${location.origin}/hooks/${activeChannelId}`;
}

async function loadEvents() {
  if (!activeChannelId) return;
  const query = new URLSearchParams();
  if (elements.methodFilter.value) query.set('method', elements.methodFilter.value);
  if (elements.eventSearch.value.trim()) query.set('search', elements.eventSearch.value.trim());

  try {
    const response = await api(`/api/channels/${activeChannelId}/events?${query}`);
    events = response.events;
    renderEvents();
  } catch (error) {
    showToast(error.message, true);
  }
}

function renderEvents() {
  elements.events.replaceChildren();
  elements.empty.hidden = events.length !== 0;
  elements.note.textContent = `${events.length} ${events.length === 1 ? 'event' : 'events'} shown`;
  elements.eventTotal.textContent = events.length;
  elements.lastMethod.textContent = events[0]?.method || '-';

  const active = events.find((event) => event.id === activeEventId) || events[0];
  activeEventId = active?.id || '';
  for (const event of events) elements.events.append(eventButton(event));
  renderDetail(active);
}

function eventButton(event) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = event.id === activeEventId ? 'event active' : 'event';
  button.innerHTML = '<span class="method"></span><strong></strong><time></time><em></em>';
  button.querySelector('.method').textContent = event.method;
  button.querySelector('strong').textContent = event.path;
  button.querySelector('time').textContent = formatTime(event.receivedAt);
  button.querySelector('em').textContent = `${event.size} bytes`;
  button.addEventListener('click', () => {
    activeEventId = event.id;
    renderEvents();
  });
  return button;
}

function renderDetail(event) {
  elements.copyCurl.disabled = !event;
  if (!event) {
    elements.detail.className = 'detail-empty';
    elements.detail.textContent = 'Select an event';
    return;
  }

  activeEventId = event.id;
  elements.detail.className = 'detail-content';
  elements.detail.replaceChildren(
    detailRow('Request', `${event.method} ${event.path}`),
    detailRow('Received', formatFullTime(event.receivedAt)),
    detailRow('Content type', event.contentType || 'none'),
    detailRow('Remote address', event.remoteAddress || 'unknown'),
    detailBlock('Headers', JSON.stringify(event.headers, null, 2)),
    detailBlock(event.bodyEncoding === 'base64' ? 'Body (base64)' : 'Body', event.body || '(empty)'),
  );
}

function detailRow(label, value) {
  const row = document.createElement('div');
  row.className = 'detail-row';
  row.innerHTML = '<span></span><strong></strong>';
  row.querySelector('span').textContent = label;
  row.querySelector('strong').textContent = value;
  return row;
}

function detailBlock(label, value) {
  const block = document.createElement('div');
  const heading = document.createElement('span');
  const code = document.createElement('pre');
  block.className = 'detail-block';
  heading.textContent = label;
  code.textContent = value;
  block.append(heading, code);
  return block;
}

function openStream() {
  if (stream) stream.close();
  elements.streamState.textContent = 'Connecting';
  stream = new EventSource(`/api/channels/${activeChannelId}/stream`);
  stream.addEventListener('ready', () => {
    elements.streamState.textContent = 'Live';
  });
  stream.addEventListener('captured', (event) => {
    const payload = JSON.parse(event.data);
    events = [payload.event, ...events.filter((item) => item.id !== payload.event.id)];
    renderEvents();
    loadChannels();
  });
  stream.addEventListener('cleared', () => {
    events = [];
    activeEventId = '';
    renderEvents();
    loadChannels();
  });
  stream.onerror = () => {
    elements.streamState.textContent = 'Reconnecting';
  };
}

async function clearEvents() {
  if (!activeChannelId || !window.confirm('Clear captured events for this channel?')) return;
  await api(`/api/channels/${activeChannelId}/events`, { method: 'DELETE' });
  events = [];
  activeEventId = '';
  renderEvents();
  await loadChannels();
  showToast('Events cleared');
}

function copyEndpoint() {
  copyText(elements.endpoint.textContent, 'Endpoint copied');
}

function copyCurl() {
  const event = events.find((item) => item.id === activeEventId) || events[0];
  if (!event) return;
  const endpoint = `${location.origin}/hooks/${activeChannelId}`;
  const contentType = event.contentType ? ` -H ${quote(`Content-Type: ${event.contentType}`)}` : '';
  copyText(`curl -X ${event.method} ${quote(endpoint)}${contentType} --data ${quote(event.body)}`, 'cURL copied');
}

async function copyText(value, message) {
  try {
    await navigator.clipboard.writeText(value);
    showToast(message);
  } catch {
    showToast(value);
  }
}

async function api(url, options) {
  const response = await fetch(url, options);
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) throw new Error(body?.error || `Request failed with status ${response.status}`);
  return body;
}

function quote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function formatTime(value) {
  return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .format(new Date(value));
}

function formatFullTime(value) {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

function showToast(message, failed = false) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.style.borderLeftColor = failed ? '#c23b45' : '#1b8a6b';
  elements.toast.hidden = false;
  toastTimer = setTimeout(() => { elements.toast.hidden = true; }, 2600);
}
