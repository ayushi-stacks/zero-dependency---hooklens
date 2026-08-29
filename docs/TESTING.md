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
  router.test.js       # path matching, :param extraction, method dispatch
  middleware.test.js   # execution order, next(), error middleware
  body-parser.test.js  # JSON + urlencoded parsing, malformed input, size limits
  static.test.js       # file serving, MIME types, 404s, path traversal
  integration.test.js  # real HTTP requests against a running server instance
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
