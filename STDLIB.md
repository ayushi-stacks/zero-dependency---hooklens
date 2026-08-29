# STDLIB.md

Required submission doc. Format: `Normally: <package> -> Instead: <stdlib approach>`, with a short note on what the substitution cost or what edge case it made painful.

Target: 10+ entries for the STDLIB Log bonus (+3).

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
10. Normally: `http-errors` -> Instead: ordinary `Error` objects carry a numeric `status` consumed by the default/error middleware path.
    Edge: unexpected 500-level errors hide their internal messages from clients.
11. Normally: `lowdb` -> Instead: `node:fs` loads and persists HookLens channels and captured events as JSON.
    Cost: this is intentionally a single-process store; mutation serialization protects concurrent requests, not multiple server processes.
12. Normally: `write-file-atomic` -> Instead: each mutation writes a uniquely named temporary file and renames it over the data file.
    Edge: failed writes remove their temporary file and leave the last complete dataset in place.
13. Normally: `uuid` -> Instead: `node:crypto.randomUUID()` creates channel-safe event identifiers.
    Gap: identifiers are opaque UUIDs without sortable timestamp semantics.
14. Normally: `eventsource` / `sse` -> Instead: `ServerResponse.writeHead()` and chunked `res.write()` emit Server-Sent Events frames directly.
    Edge: long-lived responses must be cleaned up on `close`, or tests and shutdown can hang.
15. Normally: `raw-body` -> Instead: HookLens reads `IncomingMessage` buffers directly for webhook captures before JSON middleware runs.
    Edge: binary-ish payloads are stored as base64 while common text, JSON, XML, and form bodies remain inspectable as UTF-8.
16. Normally: `helmet`-style sensitive-header helpers -> Instead: a small explicit denylist redacts auth, cookie, API key, signature, and webhook-secret headers.
    Gap: application-specific secret names still need to be added deliberately rather than inferred.
17. Normally: `eslint` -> Instead: `node:vm` parses every JavaScript file and a local script enforces whitespace and import-boundary rules.
    Gap: this focused lint does not attempt ESLint's semantic rule ecosystem.
18. Normally: `shx` / `cpy-cli` -> Instead: `node:fs` recursively creates a deterministic release directory and `node:crypto` hashes its manifest.
    Edge: the build sorts every path and excludes timestamps so two builds from identical source have identical manifest hashes.

## Explicitly out of scope (and why)

`finalhandler`, `on-finished`, `fresh`, `vary`, `proxy-addr`, `range-parser`, `type-is`, `accepts`, `depd`, `debug`, nested-bracket `qs` parsing, `etag`, cookies and signatures, `content-disposition`, `content-type`, `encodeurl`, `escape-html`, `merge-descriptors`, `once`, and the full `statuses` catalog remain out of scope.

Those packages primarily cover content negotiation, proxy awareness, caching, range requests, cookies, compatibility behavior, and internal plumbing that HookLens does not exercise. The narrower surface is deliberate: malformed input, body limits, raw capture, live streams, path traversal, error flow, persistence, redaction, and concurrent requests are implemented and tested instead of claiming incomplete Express parity.
