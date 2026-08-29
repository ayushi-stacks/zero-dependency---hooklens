# Five-Minute Demo Script

## 0:00-0:35 - Problem and constraint

- Show HookLens already running.
- Explain that the useful app and the framework use an empty dependency manifest.
- State the Track C goal: real HTTP clients, concurrent requests, streaming browser updates, static serving, and persistence.

## 0:35-1:35 - Browser workflow

- Create or select the `demo` channel.
- Copy the generated `/hooks/demo` endpoint.
- Keep the browser visible so the live stream status reads `Live`.
- Send a webhook from the terminal and show the event appear without refreshing.

## 1:35-2:35 - API workflow

- Request `GET /api/health` and `GET /api/channels`.
- Send `POST`, `PUT`, and `PATCH` requests to `/hooks/demo`.
- Include an `Authorization` header and show that it is stored as `[redacted]`.
- Use the browser search and method filter to find the captured event.

## 2:35-3:35 - Framework internals

- Open `src/application.js`: one ordered stack handles routes, middleware, and error flow.
- Open `src/router.js`: paths are matched segment by segment and parameters are decoded.
- Open `src/body-parser.js`: request chunks are buffered with a byte limit.
- Open `src/static.js`: canonical paths stay inside the static root before streaming.

## 3:35-4:25 - Storage, streaming, and concurrency

- Open `demo/app.js` and show raw webhook capture happens before JSON middleware.
- Show SSE frames written with `ServerResponse.write()` and cleaned up on `close`.
- Open `demo/store.js` and explain the mutation queue plus temporary-file rename.
- Point to the integration test that launches 24 concurrent captures and checks valid persisted JSON.

## 4:25-5:00 - Proof

- Run `npm run check`.
- Show passing lint/tests, the zero-dependency proof, and matching reproducible-build hash.
- Finish on `STDLIB.md`, highlighting 18 package substitutions and the explicit scope boundary.

Keep terminal text large enough to read and use a clean dataset before recording.
