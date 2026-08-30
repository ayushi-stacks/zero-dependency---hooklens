# The Idea: expressless

Build a minimal but real HTTP framework on Node's built-in `http`/`net`/`url`/`fs` modules that replaces what people actually reach for Express to do, then prove it by building a working demo API on top of it.

Not a goal: feature parity with Express's [28 runtime dependencies](https://github.com/expressjs/express/blob/master/package.json). Scope is deliberately narrow — reimplement the packages a real small API actually touches, and document explicitly (in STDLIB.md) which of the remaining 11 we skipped and why.

## What we're reimplementing

| Express dependency | We replace it with | Why it's in scope |
|---|---|---|
| `router` (core routing) | Hand-rolled path matcher, `:param` extraction, method dispatch | The whole point of the framework |
| `body-parser` | Manual stream buffering + `JSON.parse` / manual urlencoded split | Every real API needs this |
| `serve-static` + `send` + `mime-types` | `fs.createReadStream` + hand-written extension→MIME lookup table | Needed for the demo app's static assets |
| `morgan` | A tiny stdout request logger middleware | Cheap, useful, good demo of the middleware system |
| `http-errors` + `statuses` | An error factory carrying `status` and `expose`, over a local status catalogue | Error flow touches every request |
| `content-type` + `encodeurl` | RFC 7231 parameter parsing; idempotent URL encoding | Body-parser matching and `res.redirect()` both need them |
| `cookie` + `cookie-signature` | `serialize`/`parse` plus HMAC-SHA256 signed values | HookLens remembers the last viewed channel |
| `etag` + `fresh` + `vary` | Content and stat validators, conditional-GET comparison, `Vary` maintenance | Turns repeat inspector polling into 304s |
| `range-parser` + `content-disposition` | Byte-range resolution; RFC 5987 download names | Partial payload fetches, channel export, raw-body download |

Everything below the first four rows was added after kickoff, one layer at a time as the previous one proved out. STDLIB.md is the authoritative record of what actually shipped.

## What we're explicitly NOT reimplementing (and why)

`finalhandler`, `on-finished`, `proxy-addr`, `type-is`, `accepts`, `depd`, `debug`, `qs` (nested-bracket parsing), `escape-html`, `merge-descriptors`, `once`.

These are content-negotiation edge cases, proxy awareness, or internal plumbing that HookLens does not exercise. Reimplementing them adds risk (subtle bugs) without adding anything a judge will see in the demo. This exact list — and the reasoning — goes into STDLIB.md as the "what we scoped out" section, since honest scoping is worth more in judging than 28 half-broken reimplementations.

## Feature set (build in this order, cut from the bottom if time runs short)

1. **Router** — `app.get/post/put/delete(path, handler)`, path-to-matcher compilation, `:param` extraction, query string parsing via `url.parse`.
2. **Middleware chain** — `app.use()`, `next()`, error-handling middleware (4-arg signature), execution order guarantees.
3. **Response helpers** — `res.json()`, `res.status()`, `res.send()`, method chaining.
4. **Body parsing** — JSON and urlencoded, reading the request stream manually (`req.on('data'/'end')`), size limits, malformed-JSON error handling.
5. **Static file serving** — `express.static()` equivalent: `fs.createReadStream`, extension→MIME table, directory traversal protection (`path.normalize` + prefix check), 404 fallback.
6. **Dev logger middleware** — method, path, status, response time to stdout.

## The demo app

A small real thing built on `expressless`, not a hello-world — proves usefulness (35% of judging weight). The selected demo is HookLens: a self-hosted webhook inspector that creates capture channels, accepts real POST/PUT/PATCH webhook traffic at `/hooks/:channelId`, redacts sensitive headers, streams events to the browser with Server-Sent Events, stores recent captures in JSON, and serves a static inspector UI from disk. It exercises route params, flat query parsing, JSON API bodies, raw request streams, static files, error handling, persistence, and concurrent network clients in one coherent app.

## Why this fits the "Package Killer" bonus (+3 points)

Express is one of the most-downloaded npm packages in existence — reimplementing its core surface is an immediately legible "package kill" for judges, unlike a niche package nobody's heard of. Cited explicitly in the bonus criteria: "reimplement a package people actually use... ideally something with real download numbers behind it."

## Track fit

Track C — Web & Network: "HTTP servers, routers, clients, static-site servers... should handle concurrent connections and real clients or servers." `expressless` + demo app is a direct, uncontrived fit — no track-justification gymnastics needed (unlike Track F entries).
