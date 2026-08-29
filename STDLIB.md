# STDLIB.md

Required submission doc. Format: `Normally: <package> -> Instead: <stdlib approach>`, with a short note on what the substitution cost or what edge case it made painful.

Target: 10+ entries for the STDLIB Log bonus (+3). Delivered: 23.

## Package Killer target

Bonus claim (+3): `express` plus the middleware stack a typical Express JSON API installs alongside it. Every package below is replaced by first-party code in this repository. Nothing is wrapped, shimmed, or vendored.

| Package | Weekly downloads | Replaced by |
|---|---|---|
| `mime-types` | 263,397,438 | entry 6 |
| `qs` | 183,294,367 | entry 8 |
| `body-parser` | 139,359,839 | entry 3 |
| `serve-static` | 139,292,633 | entry 4 |
| `express` | 132,906,522 | entry 1 |
| `morgan` | 13,313,269 | entry 7 |

Counts are npm `last-week` point figures for 22-28 Aug 2026.

This is a clean reimplementation of the surface a JSON API actually exercises, not a claim of Express parity. The "Explicitly out of scope" section at the end names every Express sub-package deliberately left unimplemented, and why.

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
   Edge: the default app path still hides internal 500 messages from clients while preserving the real error for debugging.
11. Normally: `statuses` -> Instead: a local HTTP status table exposes numeric code lookups and friendly message strings.
   Gap: the implementation covers the common status catalog used by the framework and the demo, not every RFC edge-case alias.
12. Normally: `content-type` -> Instead: a lightweight parser/formatter handles media-type names and parameter strings such as `charset=utf-8`.
   Edge: quoted parameter values are decoded, but this is intentionally not a full RFC-7231 parser.
13. Normally: `encodeurl` -> Instead: `encodeURI()` is applied with bracket preservation for safe path formatting.
   Gap: the helper intentionally avoids broad URL rewriting and does not manage query-string escaping semantics.
14. Normally: `cookie` -> Instead: `serialize()` and `parse()` handle basic cookie attributes such as `Max-Age`, `Path`, `HttpOnly`, and `SameSite`.
   Edge: this is a focused utility layer rather than a full set-cookie compliance library.
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

## Explicitly out of scope (and why)

`finalhandler`, `on-finished`, `fresh`, `vary`, `proxy-addr`, `range-parser`, `type-is`, `accepts`, `depd`, `debug`, nested-bracket `qs` parsing, `etag`, `content-disposition`, `escape-html`, `merge-descriptors`, and `once` remain out of scope.

Those packages primarily cover content negotiation, proxy awareness, caching, range requests, compatibility behavior, and internal plumbing that HookLens does not exercise. The narrower surface is deliberate: malformed input, body limits, raw capture, live streams, path traversal, error flow, persistence, redaction, signed-cookie basics, and concurrent requests are implemented and tested instead of claiming incomplete Express parity.
