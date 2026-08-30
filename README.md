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
- Completion-time request logging
- Atomic JSON persistence with serialized mutations
- Server-Sent Events for live browser updates
- A responsive webhook inspector with channel creation, endpoint copy, search, filters, event detail, and copy-as-cURL
- Cookie parsing with signed-cookie verification, plus `res.cookie()`, `res.clearCookie()`, `res.redirect()`, and `res.sendStatus()`
- Standalone `http-errors`, `statuses`, `content-type`, `encodeurl`, `cookie`, and `cookie-signature` replacements, each called on the request path

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

Responses also carry `res.sendStatus(code)`, `res.redirect([status], url)`, `res.cookie(name, value, options)`, and `res.clearCookie(name, options)`. The same utility modules are exposed directly for standalone use: `expressless.statuses`, `expressless.httpError`, `expressless.contentType`, `expressless.encodeUrl`, and `expressless.cookie` / `expressless.cookieSignature`.

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

The body parsers buffer `IncomingMessage` chunks up to a fixed limit. HookLens captures raw webhook bodies before JSON middleware runs, so JSON webhooks are stored exactly as received. Static serving resolves and then canonicalizes paths before streaming. The demo store serializes mutations through a promise queue, writes a complete temporary JSON file, and renames it into place only after the write succeeds.

The scope is intentionally smaller than Express. It implements the common HTTP utility layer a JSON API actually touches, including error creation, common HTTP status names, content-type parsing, URL encoding, and signed cookies, while leaving proxy-aware routing, range negotiation, template engines, and deeper Express compatibility behavior out of scope. [STDLIB.md](STDLIB.md) records every substitution and gap.

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
