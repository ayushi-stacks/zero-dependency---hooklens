# expressless

`expressless` is a small, zero-dependency HTTP framework for Node.js. It rebuilds the practical Express surface used by a typical JSON API: routing, middleware, response helpers, body parsing, static files, and request logging, using only Node's standard library.

The included HookLens demo is a self-hosted webhook inspector. It creates local webhook endpoints, captures real POST/PUT/PATCH traffic, redacts sensitive headers, streams new events to the browser over Server-Sent Events, and persists recent captures in an atomic JSON store. This is a Track C (Web & Network) entry for the Hackathon Raptors Zero Dependency hackathon.

## Run it

Node.js 18 or newer is the only requirement, and there is deliberately no install step. Developed and verified on Node 22.14.0. Node 18 and 20 are both past end-of-life, so Node 22 LTS or newer is recommended.

```bash
node demo/server.js
```

Open `http://127.0.0.1:3000`. Set `PORT` or `HOST` to change the listener.

```bash
PORT=8080 node demo/server.js
```

On PowerShell:

```powershell
$env:PORT=8080; node demo/server.js
```

Set `HOOKLENS_SECRET` to keep the signed "last viewed channel" cookie valid across restarts. Without it the server generates a random secret at startup, so the cookie stops verifying after a restart and the inspector falls back to the first channel.

## What is included

- Method routing for GET, POST, PUT, PATCH, and DELETE
- Decoded `:parameters`, flat query parsing, trailing-slash handling, and HEAD fallback
- Ordered middleware with `next()` and four-argument error middleware
- Chainable `res.status()`, `res.send()`, and `res.json()` helpers
- JSON and URL-encoded body parsing with configurable byte limits
- Static streaming with MIME headers, index files, HEAD support, and traversal/symlink guards
- Conditional GETs: automatic ETags, `Last-Modified` on files, and 304 responses driven by `If-None-Match` and `If-Modified-Since`
- Byte-range requests with 206 responses, `Content-Range`, `If-Range` revalidation, and 416 for unsatisfiable asks
- Completion-time request logging
- Atomic JSON persistence with serialized mutations
- Server-Sent Events for live browser updates
- A responsive webhook inspector with channel creation, endpoint copy, search, filters, event detail, copy-as-cURL, channel export, raw-body download, and a live HTTP probe panel
- Cookie parsing with signed-cookie verification, plus `res.cookie()`, `res.clearCookie()`, `res.redirect()`, and `res.sendStatus()`
- Standalone `http-errors`, `statuses`, `content-type`, `encodeurl`, `cookie`, `cookie-signature`, `etag`, `fresh`, `vary`, `range-parser`, and `content-disposition` replacements, each called on the request path

## Framework API

```js
const expressless = require('./src');

const app = expressless();
app.use(expressless.logger());
app.use(expressless.json());

app.get('/hello/:name', (req, res) => {
  res.status(200).json({
    message: `Hello, ${req.params.name}`,
    query: req.query,
  });
});

app.use((error, req, res, next) => {
  res.status(error.status || 500).json({ error: error.message });
});

app.listen(3000);
```

Built-in middleware factories are `expressless.json()`, `expressless.urlencoded()`, `expressless.static(root)`, `expressless.logger()`, and `expressless.cookies(secret)`. The last populates `req.cookies` and, when a secret is supplied, verifies `s:`-prefixed values into `req.signedCookies`; a cookie whose signature does not verify is dropped rather than surfaced.

Responses also carry `res.sendStatus(code)`, `res.redirect([status], url)`, `res.cookie(name, value, options)`, `res.clearCookie(name, options)`, `res.vary(field)`, and `res.attachment(filename)`. Requests expose `req.fresh`, which reports lazily whether the validators already on the response satisfy the client's conditional headers.

`res.json()` and `res.send()` tag successful GET and HEAD responses with an ETag and answer a matching `If-None-Match` with a 304 automatically. A handler that also sets `Accept-Ranges: bytes` opts that response into `Range` handling; without that header a `Range` request is ignored, so no handler can accidentally return a slice of something it never declared range-capable.

The same utility modules are exposed directly for standalone use: `expressless.statuses`, `expressless.httpError`, `expressless.contentType`, `expressless.encodeUrl`, `expressless.etag`, `expressless.fresh`, `expressless.vary`, `expressless.rangeParser`, `expressless.contentDisposition`, and `expressless.cookie` / `expressless.cookieSignature`.

## HookLens API

| Method | Path | Behavior |
|---|---|---|
| GET | `/api/health` | Framework and demo health response |
| GET | `/api/session` | Last channel viewed by this browser, from a signed cookie |
| GET | `/api/channels` | List capture channels |
| POST | `/api/channels` | Validate and create a channel |
| GET | `/api/channels/:channelId` | Fetch one channel summary |
| GET | `/api/channels/:channelId/events` | List captured events with filters |
| GET | `/api/channels/:channelId/events/:eventId` | Fetch one captured event |
| GET | `/api/channels/:channelId/events/:eventId/body` | Raw captured payload as an opaque download; honours `Range` |
| GET | `/api/channels/:channelId/export` | Channel and events as a named JSON attachment |
| DELETE | `/api/channels/:channelId/events` | Clear captured events |
| GET | `/api/channels/:channelId/stream` | Stream live updates as SSE |
| POST/PUT/PATCH | `/hooks/:channelId` | Capture a webhook payload |
| GET | `/hooks/:channelId` | Redirect a pasted webhook URL to the inspector |

Event filters: `search` and `method=POST|PUT|PATCH`.

```bash
curl -X POST http://127.0.0.1:3000/api/channels \
  -H "Content-Type: application/json" \
  --data "{\"id\":\"stripe-dev\",\"name\":\"Stripe dev\"}"

curl -X POST "http://127.0.0.1:3000/hooks/stripe-dev?attempt=1" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer secret" \
  --data "{\"type\":\"checkout.session.completed\"}"
```

## Quality gate

```bash
node scripts/lint.js
node --test
node scripts/verify-zero-deps.js
node scripts/verify-build.js
```

Run the complete gate with `npm run check`. This invokes npm's script runner only; it does not install or resolve any package.

The deterministic build command is:

```bash
node scripts/build.js
```

It creates `dist/expressless` plus a sorted SHA-256 manifest. The release directory can run directly with `node dist/expressless/demo/server.js`.

## Design

`src/application.js` owns one ordered layer stack. Middleware layers match every request; route layers additionally match method and compiled path segments. Calling `next(error)` advances through the same stack while selecting only four-argument error handlers.

The body parsers buffer `IncomingMessage` chunks up to a fixed limit. HookLens captures raw webhook bodies before JSON middleware runs, so JSON webhooks are stored exactly as received. Static serving resolves and then canonicalizes paths before streaming, and sets validators before opening the file so a repeat visit is answered from headers alone. The demo store serializes mutations through a promise queue, writes a complete temporary JSON file, and renames it into place only after the write succeeds.

A raw captured payload is served as `application/octet-stream` with `nosniff` and a `Content-Disposition` attachment, never under the Content-Type the sender supplied. Echoing that header back would let a webhook sender store HTML and have this origin serve it as a page.

The scope is intentionally smaller than Express. It implements the common HTTP utility layer a JSON API actually touches, including error creation, common HTTP status names, content-type parsing, URL encoding, signed cookies, conditional requests, byte ranges, and download naming, while leaving proxy-aware routing, content negotiation, template engines, and deeper Express compatibility behavior out of scope. [STDLIB.md](STDLIB.md) records every substitution and gap.

## Repository map

| Path | Purpose |
|---|---|
| `src/` | Framework implementation |
| `demo/` | HookLens API, validation, storage, event hub, and server entry point |
| `public/` | Browser inspector and visual asset |
| `test/` | Framework and end-to-end HTTP tests |
| `scripts/` | Lint, build, reproducibility, and dependency checks |
| `docs/DEPENDENCY_PROOF.md` | Zero-dependency evidence |
| `docs/DEMO_SCRIPT.md` | Five-minute recording plan |
| `STDLIB.md` | Package-to-stdlib substitution log |

## License

MIT
