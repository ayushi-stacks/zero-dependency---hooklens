# Implementation Plan

Technical detail per phase from PHASES.md — which Node stdlib APIs back which feature. This is the reference to work from once kickoff hits; nothing here should be treated as already-written code.

## Phase 1 — Core framework

### HTTP server bootstrap
- `http.createServer((req, res) => { ... })` — the entire transport layer. No abstraction needed beyond Node's own `IncomingMessage`/`ServerResponse` objects.
- `app.listen(port)` wraps `server.listen(port)`.

### Router
- Store routes as `{ method, path, handler }` in an array (or map keyed by method for O(1) method lookup, then linear scan for path match — fine at hackathon scale).
- Path compilation: split `/users/:id` on `/`, mark segments starting with `:` as params. Match incoming `req.url` (stripped of query string via `url.parse(req.url, true)`) segment-by-segment.
- Query string: `url.parse(req.url, true).query` gives a parsed object for free — this is why we don't need `qs` for the common case (no nested bracket syntax support, and that's fine, documented as a scoping decision).

### Middleware chain
- `app.use(fn)` pushes `fn` onto a middleware array.
- A `dispatch(index, req, res)` function calls `middleware[index](req, res, () => dispatch(index + 1, req, res))` — classic linked-continuation pattern, no library needed.
- Error middleware: functions with 4 declared params (`(err, req, res, next)`) get called via a separate `next(err)` path that skips to the next error handler.

### Response helpers
- Monkey-patch/extend `res` per-request: `res.status = (code) => { res.statusCode = code; return res; }`, `res.json = (obj) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); }`.

### Body parsing
- `req.on('data', chunk => buffers.push(chunk))`, `req.on('end', () => { ... })`, concatenate with `Buffer.concat`, then `JSON.parse` for `application/json` or manual `&`/`=` split + `decodeURIComponent` for `application/x-www-form-urlencoded`.
- Wrap `JSON.parse` in try/catch — malformed body should reach error middleware via `next(err)`, not crash the process.
- Enforce a body size limit (reject if buffered length exceeds a constant) to avoid unbounded memory use — this is the one piece of "robustness" worth keeping since it's a one-line check.

### Static file serving
- Resolve requested path against a static root with `path.join` + `path.normalize`, then verify the resolved path still starts with the static root (prefix check) before touching the filesystem — this is the path-traversal guard `serve-static` provides.
- `fs.createReadStream(resolvedPath).pipe(res)` for the actual transfer; `fs.stat` first to check existence/is-file and to set `Content-Length`.
- MIME table: a plain object literal mapping `.html/.css/.js/.json/.png/.jpg/.svg/...` to content-type strings. No need for the full `mime-types` database — cover what the demo app actually serves.

### Dev logger
- Middleware that records `Date.now()` on entry, hooks `res.on('finish', ...)` to log `method path status Xms` to stdout.

## Phase 1 extension — conditional requests and partial transfer

Added once the core framework proved out. All five of these are Express 5 direct dependencies; STDLIB.md entries 24-28 carry the substitution reasoning.

### ETags (`src/etag.js`)
- `crypto.createHash('sha256')` over the response buffer, base64, truncated to 27 characters, prefixed with the byte length in hex: `"<len>-<digest>"`.
- An `fs.Stats` argument takes a different path entirely — `"<size>-<mtime>"` in hex — so a file never has to be read to be tagged. That tag is weak by default, because size and mtime cannot see a same-length overwrite landing in one clock tick.

### Freshness (`src/fresh.js`)
- `fresh(req.headers, res.getHeaders())` answers whether the client's copy is still current.
- `If-None-Match` uses weak comparison: strip a leading `W/` from both sides before comparing, so a weak stat tag satisfies a strong request tag. `*` matches anything present.
- A request `Cache-Control: no-cache` short-circuits to stale before any comparison runs.
- Per RFC 9110 13.1.3, `If-Modified-Since` is ignored whenever `If-None-Match` is also present.

### Vary (`src/vary.js`)
- `vary(res, field)` reads the current header, appends field names case-insensitively without duplicating, and writes it back. `append(header, field)` is the pure string form for testing.
- A `*` on either side collapses the result to `*`, since keeping both would advertise a narrower cache key than the response has.

### Byte ranges (`src/range-parser.js`)
- `parseRange(size, header)` returns an array of `{ start, end }` carrying the requested unit on `.type`, or the `MALFORMED` / `UNSATISFIABLE` sentinels.
- A suffix range (`bytes=-500`) resolves against the entity size; an open range (`bytes=500-`) runs to `size - 1`; an over-long end clamps to the last byte.
- The parser stays unit-agnostic. Rejecting anything that is not `bytes` belongs to the caller, in `src/static.js` and `src/response.js`.

### Download names (`src/content-disposition.js`)
- Formats `attachment; filename="..."`, adding `filename*=UTF-8''...` whenever the basename is not plain ASCII or holds a literal `%XX`.
- Only `path.basename()` is ever emitted and every emitted byte stays printable ASCII, so neither a directory path nor a CR/LF can be smuggled through a name that originally came from a webhook.
- `parse()` is quote-aware, so a `;` inside a quoted filename does not split the parameter list, and `filename*` always beats `filename`.

### Where they attach
- `res.json()` and `res.send()` tag 2xx GET/HEAD responses, then return 304 when the validators match.
- `src/static.js` sets `ETag`, `Last-Modified`, and `Accept-Ranges` before opening the file, so a 304 costs no filesystem read at all.
- `Range` is honoured only when the response already advertises `Accept-Ranges: bytes`. That keeps range behavior opt-in per handler rather than a surprise for every buffer that passes through `res.send()`.
- Multi-range asks parse but are answered with the whole entity; `multipart/byteranges` is out of scope.

## Phase 2 — Demo app

- Storage: a JSON file on disk (`fs.readFileSync`/`writeFileSync`, or async equivalents) — no embedded DB dependency needed for a small demo dataset.
- Routes: standard CRUD (`GET /items`, `GET /items/:id`, `POST /items`, `PUT /items/:id`, `DELETE /items/:id`) plus one static page at `/` served from `public/index.html`.
- Integration tests hit the running server over real HTTP using Node's own `http.request`, no supertest.

## Phase 3 — Testing, proof, docs

See TESTING.md and DEPENDENCY_PROOF.md for the detail; this section just notes what needs to exist:
- `test/router.test.js`, `test/middleware.test.js`, `test/body-parser.test.js`, `test/static.test.js`, `test/integration.test.js`.
- `scripts/verify-zero-deps.sh` — a small shell/node script that fails CI-style if `package.json` has non-empty `dependencies`/`devDependencies`, or if `node_modules`/a lockfile exists in the repo.

## Design principles to hold throughout

- No dependency on Express's actual source for implementation details beyond studying its *public API shape* (documented explicitly as reference-only in the rules — "study for ergonomics", not "copy code").
- Prefer Node's built-in `node:` prefix imports (`require('node:http')`) to make the zero-dep boundary visually obvious in every file.
- Every time something that "feels like it should be a package" gets built, add the entry to STDLIB.md immediately — don't batch this at the end, it's easy to forget the exact substitution reasoning under time pressure.
