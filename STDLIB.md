# STDLIB.md

Required submission doc. Format: `Normally: <package> -> Instead: <stdlib approach>`, with a short note on what the substitution cost or what edge case it made painful.

Target: 10+ entries for the STDLIB Log bonus (+3). Delivered: 28.

## Package Killer target

Bonus claim (+3): `express` and the dependency stack it installs. Every package below is replaced by first-party code in this repository. Nothing is wrapped, shimmed, or vendored.

| Package | Weekly downloads | Replaced by |
|---|---|---|
| `mime-types` | 263,474,820 | entry 6 |
| `content-type` | 206,657,086 | entry 12 |
| `cookie` | 206,078,581 | entry 14 |
| `statuses` | 188,614,039 | entry 11 |
| `qs` | 183,329,509 | entry 8 |
| `http-errors` | 169,873,339 | entry 10 |
| `encodeurl` | 150,223,271 | entry 13 |
| `content-disposition` | 143,298,903 | entry 28 |
| `send` | 143,260,992 | entry 5 |
| `serve-static` | 139,338,135 | entry 4 |
| `body-parser` | 139,301,713 | entry 3 |
| `fresh` | 137,376,038 | entry 25 |
| `cookie-signature` | 137,337,257 | entry 15 |
| `express` | 132,879,571 | entry 1 |
| `range-parser` | 126,787,861 | entry 27 |
| `vary` | 111,513,530 | entry 26 |
| `etag` | 111,298,854 | entry 24 |
| `router` | 64,411,246 | entry 2 |
| `morgan` | 13,351,654 | entry 7 |

Counts are npm `last-week` point figures for 23-29 Aug 2026.

Express 5.2.1 declares 28 direct dependencies. Seventeen are reimplemented here: `router`, `send`, `body-parser`, `serve-static`, `mime-types`, `qs`, `http-errors`, `statuses`, `content-type`, `encodeurl`, `cookie`, `cookie-signature`, `etag`, `fresh`, `vary`, `range-parser`, and `content-disposition`. `express` itself and the transitive `raw-body` bring the total to nineteen packages from that tree. `morgan` is a companion middleware rather than a dependency of Express.

This is a clean reimplementation of the surface a JSON API actually exercises, not a claim of Express parity. The "Explicitly out of scope" section at the end names the remaining sub-packages and why each is left unimplemented.

## Substitutions

1. Normally: `express` (core app) -> Instead: `node:http` creates the server around a callable application with route and middleware registration methods.
   Gap: the API deliberately omits Express settings, sub-apps, template engines, and compatibility aliases.
2. Normally: `router` -> Instead: a segment matcher compares URL paths and extracts decoded `:params` without regular expressions.
   Edge: malformed percent-encoding becomes a controlled 400 response instead of escaping the request loop.
3. Normally: `body-parser` -> Instead: `IncomingMessage` data/end events, `Buffer.concat`, and `JSON.parse` decode request bodies.
   Edge: buffering is capped at 100 KiB by default so an untrusted client cannot grow memory without bound.
4. Normally: `serve-static` -> Instead: `node:fs`, `node:path`, and `fs.createReadStream` resolve and stream files.
   Edge: every resolved path is checked with `path.relative` before filesystem access to block traversal outside the static root.
5. Normally: `send` -> Instead: `ServerResponse` headers plus a readable file stream provide lengths, HEAD handling, and streamed responses.
   Gap: conditional requests, ranges, cache policy, and ETags are intentionally out of scope.
6. Normally: `mime-types` -> Instead: a local extension-to-content-type table covers the assets used by the demo.
   Gap: unknown extensions safely fall back to `application/octet-stream`; this is not a complete media-type database.
7. Normally: `morgan` -> Instead: `process.hrtime.bigint()` and the response `finish` event produce one request log line.
   Gap: this includes one readable development format, not morgan's token and format system.
8. Normally: `qs` -> Instead: the built-in WHATWG `URL` and `URLSearchParams` APIs decode query strings.
   Gap: repeated flat keys are retained as arrays, while nested bracket notation is deliberately unsupported.
9. Normally: `supertest` -> Instead: `node:http` sends real requests to ephemeral ports and `node:test` plus `node:assert` checks responses.
   Cost: tests explicitly manage server startup, shutdown, request bodies, and response buffering.
10. Normally: `http-errors` -> Instead: a tiny error factory attaches numeric `status` and `statusCode` values to `Error` objects.
   Edge: results are HttpError instances with expose false for 5xx, so the default app path hides internal messages from clients while preserving the real error for debugging.
11. Normally: `statuses` -> Instead: a local HTTP status table exposes numeric code lookups and friendly message strings.
   Gap: covers the common status catalog rather than every RFC alias, and message/status are lookup functions rather than the object maps the package exposes.
12. Normally: `content-type` -> Instead: a lightweight parser/formatter handles media-type names and parameter strings such as `charset=utf-8`.
   Edge: values outside the RFC 7231 token grammar are quoted and escaped on output, so a parameter containing a space survives a format and parse round trip.
13. Normally: `encodeurl` -> Instead: `encodeURI()` is applied with bracket preservation for safe path formatting.
   Edge: existing %XX escapes pass through untouched and lone surrogates become U+FFFD, so encoding an already-encoded URL is idempotent and never throws.
14. Normally: `cookie` -> Instead: `serialize()` and `parse()` handle basic cookie attributes such as `Max-Age`, `Path`, `HttpOnly`, and `SameSite`.
   Edge: a malformed percent-escape in an attacker-supplied Cookie header returns the raw text instead of throwing out of the parser.
15. Normally: `cookie-signature` -> Instead: HMAC-SHA256 signing emits `value.signature` tokens that can be verified without external dependencies.
   Gap: the implementation targets signed session-style values rather than a password-authenticated cookie system.
16. Normally: `lowdb` -> Instead: `node:fs` loads and persists HookLens channels and captured events as JSON.
   Cost: this is intentionally a single-process store; mutation serialization protects concurrent requests, not multiple server processes.
17. Normally: `write-file-atomic` -> Instead: each mutation writes a uniquely named temporary file and renames it over the data file.
   Edge: failed writes remove their temporary file and leave the last complete dataset in place.
18. Normally: `uuid` -> Instead: `node:crypto.randomUUID()` creates channel-safe event identifiers.
   Gap: identifiers are opaque UUIDs without sortable timestamp semantics.
19. Normally: `eventsource` / `sse` -> Instead: `ServerResponse.writeHead()` and chunked `res.write()` emit Server-Sent Events frames directly.
   Edge: long-lived responses must be cleaned up on `close`, or tests and shutdown can hang.
20. Normally: `raw-body` -> Instead: HookLens reads `IncomingMessage` buffers directly for webhook captures before JSON middleware runs.
   Edge: binary-ish payloads are stored as base64 while common text, JSON, XML, and form bodies remain inspectable as UTF-8.
21. Normally: `helmet`-style sensitive-header helpers -> Instead: a small explicit denylist redacts auth, cookie, API key, signature, and webhook-secret headers.
   Gap: application-specific secret names still need to be added deliberately rather than inferred.
22. Normally: `eslint` -> Instead: `node:vm` parses every JavaScript file and a local script enforces whitespace and import-boundary rules.
   Gap: this focused lint does not attempt ESLint's semantic rule ecosystem.
23. Normally: `shx` / `cpy-cli` -> Instead: `node:fs` recursively creates a deterministic release directory and `node:crypto` hashes its manifest.
   Edge: the build sorts every path and excludes timestamps so two builds from identical source have identical manifest hashes.
24. Normally: `etag` -> Instead: `node:crypto` hashes a response body into a `"<length>-<digest>"` validator, and file responses derive a tag from size and mtime instead of reading the file.
   Edge: stat tags stay weak because a same-length overwrite inside one clock tick is invisible to size and mtime; the content hash is SHA-256 rather than the package's SHA-1.
25. Normally: `fresh` -> Instead: a validator comparison reads `If-None-Match` and `If-Modified-Since` and reports whether the client's copy is still current, which turns into a 304 with no body.
   Edge: RFC 9110 13.1.3 requires `If-Modified-Since` to be ignored when `If-None-Match` is present. The package evaluates both and requires both to pass, which can report a changed entity as fresh.
26. Normally: `vary` -> Instead: a case-insensitive field-name appender maintains the `Vary` header without duplicating entries.
   Edge: a `*` on either side collapses the whole list, because keeping both would advertise a narrower cache key than the response actually has.
27. Normally: `range-parser` -> Instead: a byte-range parser resolves explicit offsets and suffix ranges against the entity size, feeding 206 responses and `Content-Range`.
   Gap: multiple ranges parse correctly but are answered with the whole entity rather than a `multipart/byteranges` body, and the parser stays unit-agnostic, so the caller is what rejects a non-`bytes` unit.
28. Normally: `content-disposition` -> Instead: a formatter and parser emit `attachment; filename=...` plus an RFC 5987 `filename*` when the name is not plain ASCII.
   Edge: every emitted byte stays printable ASCII, so a CR/LF inside an attacker-supplied name is percent-encoded into `filename*` rather than reaching the header as a line break; only the basename is ever emitted.

## Where these run

The replacements are not a side library. Each one is called on the request path by the framework or the demo.

| Module | Call sites |
|---|---|
| `statuses` | `src/application.js` 404 and error bodies; `res.sendStatus()` and `res.redirect()` in `src/response.js` |
| `http-errors` | `src/body-parser.js` (413 over-limit, 400 malformed); `demo/validation.js` (422); route guards in `demo/app.js` (404) |
| `content-type` | `src/body-parser.js` media-type matching; `demo/app.js` text-versus-binary payload classification |
| `encodeurl` | the `Location` header built by `res.redirect()` in `src/response.js` |
| `cookie` | `src/cookies.js` middleware; `res.cookie()` and `res.clearCookie()` in `src/response.js`; captured cookie names in `demo/app.js` |
| `cookie-signature` | signed cookies in `src/cookies.js` and `res.cookie({ signed: true })`; HookLens remembers the last viewed channel with one |
| `etag` | `res.json()` and `res.send()` in `src/response.js`; every file response in `src/static.js` |
| `fresh` | the 304 path in `src/response.js` and `src/static.js`; the lazy `req.fresh` getter |
| `vary` | `res.vary()` in `src/response.js`; `Vary: Cookie` on `/api/session` in `demo/app.js` |
| `range-parser` | `Range` handling in `src/static.js`, and in `res.send()` for a handler that advertised `Accept-Ranges` |
| `content-disposition` | `res.attachment()` in `src/response.js`; the channel export and raw-body download in `demo/app.js` |

## Explicitly out of scope (and why)

`finalhandler`, `on-finished`, `proxy-addr`, `type-is`, `accepts`, `depd`, `debug`, nested-bracket `qs` parsing, `escape-html`, `merge-descriptors`, and `once` remain out of scope.

Those packages primarily cover content negotiation, proxy awareness, compatibility behavior, and internal plumbing that HookLens does not exercise. The narrower surface is deliberate: malformed input, body limits, raw capture, live streams, path traversal, error flow, persistence, redaction, signed-cookie basics, conditional requests, byte ranges, download naming, and concurrent requests are implemented and tested instead of claiming incomplete Express parity.
