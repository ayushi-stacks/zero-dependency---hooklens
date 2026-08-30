# Dependency Proof

`expressless` has zero third-party runtime or development dependencies.

## Automated proof

Run from the repository root:

```bash
node scripts/verify-zero-deps.js
```

The verifier exits non-zero if any of these claims becomes false:

1. `dependencies`, `devDependencies`, `optionalDependencies`, and `peerDependencies` are empty.
2. No `node_modules` directory is present.
3. No npm, Yarn, or pnpm lockfile is present.
4. Every JavaScript import under `src`, `demo`, `public`, `scripts`, and `test` is either `node:`-prefixed or relative.

The POSIX wrapper `scripts/verify-zero-deps.sh` runs the same cross-platform Node verifier.

## Verified output

Captured 30 Aug 2026 on Windows 11, Node 22.14.0, from a clean checkout with no `node_modules` present.

```console
$ node --version
v22.14.0

$ node scripts/lint.js
Lint passed: syntax, whitespace, and import boundaries are clean.

$ node --test
# tests 34
# suites 0
# pass 34
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 237.5509

$ node scripts/verify-zero-deps.js
Zero-dependency verification passed.
Manifest empty; no install artifacts; all imports are built-in or relative.
```

The reproducible-build hashes are recorded separately in [BUILD_PROOF.md](BUILD_PROOF.md). They are deliberately not pasted here: `scripts/build.js` copies `docs/` into the release directory and hashes it, so a build hash written into this file would invalidate itself on the next build. `BUILD_PROOF.md` is excluded from the copy for exactly that reason.

## Standard library surface

Runtime code uses these built-ins:

- `node:http` for servers and test clients
- WHATWG `URL` for paths and query strings
- `node:fs` and `node:path` for static files and persistence
- `node:crypto` for UUIDs and build hashes
- `Buffer`, streams, `ServerResponse.write()`, and process timing primitives supplied by Node
- Browser-native `EventSource`, `fetch`, `URLSearchParams`, and clipboard APIs for the HookLens UI

No browser asset loads code, fonts, styles, or images from a CDN.

## Reproducible build

```bash
node scripts/verify-build.js
```

The verifier builds `dist/expressless` twice, hashes the sorted content manifest after each build, and fails unless both SHA-256 values are identical. Paths and content hashes are included; timestamps and host-specific absolute paths are excluded.

The latest recorded pair is kept in `docs/BUILD_PROOF.md`, which is intentionally excluded from the release manifest so recording a hash does not recursively change that hash.

## Full release gate

```bash
npm run check
```

This runs lint, all tests, dependency proof, and the reproducible-build check. npm is used only as the script runner built into the Node distribution; no install command is needed.
