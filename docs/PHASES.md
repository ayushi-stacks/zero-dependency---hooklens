# 72-Hour Phase Plan

Kickoff: 28 Aug 2026, 6:30 PM IST. Submission closes: 31 Aug 2026, 11:30 PM IST.
All times below are elapsed hours from kickoff, IST wall-clock in brackets for reference.

## Phase 0 — Pre-kickoff (now → kickoff)

Allowed: planning, reading docs, prepping AI prompts, repo scaffolding, deciding architecture. **Not allowed: writing project code.**

- [x] Scaffold repo, docs, AGENTS.md, empty structure.
- [x] Decide demo app concept: HookLens webhook inspector.
- [ ] Sketch router matcher algorithm and middleware execution model on paper/in IMPLEMENTATION.md.
- [ ] Register on Unstop before 11:00 PM IST deadline.
- [ ] Join Discord — all real-time rule clarifications happen there.

## Phase 1 — Core framework (Hour 0–24) [kickoff → 29 Aug, 6:30 PM IST]

Goal: `expressless` core is functional and testable in isolation, no demo app yet.

- Hour 0–4: HTTP server bootstrap, route registration API (`app.get/post/...`), path matcher + `:param` extraction.
- Hour 4–8: Middleware chain (`app.use`, `next()`, ordering), response helpers (`res.json`, `res.status`, `res.send`).
- Hour 8–14: Body parsing (JSON + urlencoded), manual stream buffering, malformed-input handling.
- Hour 14–20: Static file serving, MIME table, path traversal protection, 404 fallback.
- Hour 20–24: Dev logger middleware. Core framework code-freeze for the day — commit, write initial unit tests.

## Phase 2 — Demo app + integration (Hour 24–48) [29 Aug 6:30 PM → 30 Aug, 6:30 PM IST]

Goal: a real, working app running on `expressless` end to end.

- Hour 24–32: Build the demo API on top of the framework — routes, JSON storage, static landing page.
- Hour 32–40: Integration tests — real HTTP requests against a running server (`node:http` client + `node:test`).
- Hour 40–46: Edge case sweep — malformed JSON bodies, missing params, path traversal attempts, concurrent connections.
- Hour 46–48: Fix whatever integration testing surfaces. Second commit checkpoint.

## Phase 3 — Docs, proof, polish (Hour 48–68) [30 Aug 6:30 PM → 31 Aug, 2:30 PM IST]

Goal: everything the submission checklist requires exists and is correct.

- Hour 48–54: Write STDLIB.md properly — every substitution, "Normally: X → Instead: Y" format, aim for 10+ entries (STDLIB Log bonus, +3).
- Hour 54–58: README.md final pass — one-command build/run instructions, quickstart that actually works from a clean clone.
- Hour 58–62: Dependency proof — verify empty `package.json` deps, no `node_modules`, no lockfile; write/run `scripts/verify-zero-deps.sh`.
- Hour 62–66: Attempt reproducible build bonus (+5) if time allows — build twice, diff hashes, publish both in DEPENDENCY_PROOF.md.
- Hour 66–68: Code cleanup pass — naming, comments only where non-obvious, consistent style.

## Phase 4 — Demo video + submission (Hour 68–72) [31 Aug 2:30 PM → 6:30 PM IST]

- Hour 68–70: Record 5-minute demo video — what it does, live requests against the server, quick STDLIB.md walkthrough.
- Hour 70–71: Make GitHub repo public if not already, final push, tag a release.
- Hour 71–72: Submit via Discord per official instructions. Confirm submission acknowledged, leaving the remaining five hours before the 11:30 PM IST deadline as contingency.

## Buffer discipline

Each phase has slack built in (~10-15% of its window). If a phase runs over, cut scope from the bottom of the feature list in EXPRESS_CLONE_IDEA.md first — never cut testing or STDLIB.md, since those are directly graded (Zero-Dependency Craft 30%, and testing feeds Functionality 35%).
