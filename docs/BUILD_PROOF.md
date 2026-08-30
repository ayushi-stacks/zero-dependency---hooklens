# Reproducible Build Proof

Verification command: `node scripts/verify-build.js`

- First build: `e547c19d5705ee12927cd6cbbdd5f696ede3c1a9128aa315ace7cfbdee488654`
- Second build: `e547c19d5705ee12927cd6cbbdd5f696ede3c1a9128aa315ace7cfbdee488654`

Result: byte-identical sorted content manifests from two consecutive builds, covering 53 files.

Recorded 30 Aug 2026 on Node 22.14.0. The hash covers the sorted path-and-content manifest of `dist/expressless`, excluding timestamps and host-specific absolute paths.

## Why this hash reproduces on any machine

Line endings are pinned to LF for every tracked file by `.gitattributes` (`* text=auto eol=lf`). Without that, a Windows checkout would produce CRLF source files and a Linux checkout LF, yielding two different manifest hashes from identical source. Any clone on any platform now hashes the same bytes.

The hash is still tied to the tracked content itself: `scripts/build.js` copies `docs/`, `README.md`, `STDLIB.md`, `package.json`, `.zero-dep.toml`, and `.gitattributes` into the release directory, so editing any tracked file — documentation included — changes it. Re-run the command above and update this file after any change before submission. `BUILD_PROOF.md` is itself excluded from the copy so that recording a hash here does not alter the hash.
