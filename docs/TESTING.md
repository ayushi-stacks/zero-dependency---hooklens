# Testing Guide

Zero-dep constraint applies to tests too — no Jest, no Mocha, no Supertest. Node 18+ ships `node:test` and `node:assert` in the standard library, which is more than enough for this scope.

## Running tests

```bash
node --test
```

Runs every `*.test.js` file under `test/`. No config file needed for the basic case.

## Test layout

```
test/
  router.test.js           # path matching, :param extraction, method dispatch
  middleware.test.js       # execution order, next(), error middleware
  body-parser.test.js      # JSON + urlencoded parsing, malformed input, size limits
  static.test.js           # file serving, MIME types, 404s, path traversal
  http-caching.test.js     # etag, fresh, vary, and the 304 path
  range-downloads.test.js  # range-parser, content-disposition, 206/416, exports
  logger.test.js           # completion-time log line
  framework-wiring.test.js # cookies, redirects, error expose flag on real requests
  stdlib-utilities.test.js # the standalone utility modules
  integration.test.js      # real HTTP requests against a running server instance
```

## What each layer covers

### Unit: router
- Exact path match.
- `:param` extraction with correct decoding.
- Method mismatch does not match (GET route doesn't respond to POST on same path).
- No match falls through to 404 handler.

### Unit: middleware
- Middlewares run in registration order.
- `next()` with no arg proceeds to the next middleware/route handler.
- `next(err)` skips straight to error-handling middleware (4-arg signature).
- A middleware that never calls `next()` correctly halts the chain (request hangs on purpose — assert it doesn't crash, and use a timeout in the test).

### Unit: body parser
- Valid JSON body parses to the expected object.
- Malformed JSON triggers `next(err)`, not a thrown exception that kills the process.
- Empty body doesn't throw.
- Body larger than the configured limit is rejected with the right status code.
- `application/x-www-form-urlencoded` decodes correctly, including `%`-encoded characters.

### Unit: static serving
- Existing file serves with the correct `Content-Type` from the MIME table.
- Missing file returns 404, not a crash.
- `../../../etc/passwd`-style traversal attempts are blocked (resolved path must stay inside the static root — this is the one test that most directly proves the security-relevant part of the `serve-static` reimplementation).

### Unit: conditional requests
- A GET answered by `res.json()` carries an ETag; the same request with a matching `If-None-Match` comes back 304 with an empty body and no `Content-Type`.
- A POST and an error response carry no ETag, because neither is a cacheable representation.
- Weak comparison works both directions (`W/"x"` against `"x"` and the reverse), and `*` matches.
- A request `Cache-Control: no-cache` forces a 200 even when the validator matches.
- `If-Modified-Since` is ignored when `If-None-Match` is present, per RFC 9110.
- Static files carry `ETag`, `Last-Modified`, and `Accept-Ranges`, and revalidate by either validator.
- `res.vary()` deduplicates case-insensitively and collapses on `*`.

### Unit: ranges and downloads
- Explicit, open, and suffix ranges resolve; an over-long end clamps to the last byte.
- An unsatisfiable range returns 416 with `Content-Range: bytes */N`; a malformed one, an unknown unit, and a multi-range ask all fall back to a full 200 rather than failing.
- `If-Range` against a stale validator restarts the transfer as a full 200.
- `res.send()` ignores `Range` unless the handler advertised `Accept-Ranges: bytes`.
- `content-disposition` escapes quotes, keeps only the basename, and emits `filename*` for a non-ASCII name — with the CR/LF case asserted to produce no line break in the header, since channel names come from user input.

### Integration
- Spin up the demo app on an ephemeral port (`app.listen(0)`, read the assigned port back).
- HookLens flow: create a channel, capture webhook traffic at `/hooks/:channelId`, inspect stored events, clear events, and assert status codes and response bodies using `node:http`'s own client.
- Live stream flow: open `/api/channels/:channelId/stream`, receive an SSE `captured` event, and close the stream cleanly.
- Concurrent requests: fire several webhook captures in parallel (`Promise.all` of `http.request` calls) and assert none of them corrupt shared state or crash the server — this is what the "should handle concurrent connections" line in the Track C description is checking for.

## Edge cases worth deliberately testing (judges reward this)

- Trailing slashes (`/items/` vs `/items`).
- Query strings on routes with params (`/items/5?verbose=true`).
- Very large `:param` values (don't let path matching regex/logic choke).
- Two middlewares both calling `res.end()` — should not double-send / crash (guard against `ERR_HTTP_HEADERS_SENT`).

## What "done" looks like for this doc's purpose

Every test file above exists, `node --test` exits 0, and the STDLIB Log bonus in the submission notes which package's usual test-coverage story (e.g. supertest for HTTP assertions) we replaced and how.
