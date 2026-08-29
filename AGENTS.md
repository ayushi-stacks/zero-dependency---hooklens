# AGENTS.md

Instructions for any AI coding assistant (Claude Code, Cursor, Copilot, etc.) working in this repo. AI assistance is explicitly permitted by the hackathon rules — see docs/EVENT.md, "AI Tools" section. This file exists so the human on this team can defend every line, per the judging criteria ("whether the team can explain and defend the code").

## The one rule that overrides everything else

**Zero third-party runtime dependencies.** Never run `npm install <anything>`. Never add a package to `dependencies` or `devDependencies` in package.json. If you find yourself wanting a package, that's the signal to write the stdlib equivalent instead — check docs/IMPLEMENTATION.md first, the approach is probably already documented there.

Only `node:`-prefixed built-in imports are allowed (`require('node:http')`, `require('node:fs')`, etc.). No bare specifiers.

## Timing constraint

**Do not write or commit files under `src/` or `test/` before the hackathon officially starts** (28 Aug 2026, 11:30 PM IST — check docs/EVENT.md for the authoritative timestamp). Before kickoff, only docs, planning, and empty scaffolding are allowed per the rules. If asked to implement something before that time, push back and point to this constraint instead of writing the code.

## Where to look before writing code

1. `docs/EXPRESS_CLONE_IDEA.md` — what we're building and the explicit scope boundary (what's in, what's deliberately left out).
2. `docs/IMPLEMENTATION.md` — the specific stdlib APIs and approach for each feature. Follow this unless there's a good reason to deviate, and if you deviate, update the doc.
3. `docs/PHASES.md` — the time budget. Don't gold-plate a Phase 1 feature while Phase 2 is still unstarted.
4. `docs/TESTING.md` — what needs test coverage and why. Write tests alongside implementation, not after.

## Every time a stdlib substitution gets built

Immediately add an entry to `STDLIB.md` in the format `Normally: <package> → Instead: <what we did>`, plus one line on the edge case or gap that made the substitution non-trivial. This is a required submission doc and a scored bonus (+3 for 10+ entries) — don't leave it for the end, the specific reasoning is easy to forget under time pressure.

## Code style

- No comments explaining *what* the code does — names should carry that. Comments only for non-obvious *why* (a workaround, a deliberately skipped edge case, a security-relevant decision like the static-file path-traversal guard).
- Prefer plain functions and closures over classes unless state genuinely warrants an object — this is meant to read as "here's what Express does under the hood," not an over-engineered mini-framework.
- Keep files small and named after what they implement (`router.js`, `middleware.js`, `body-parser.js`, `static.js`, `logger.js`), not one giant `framework.js`, unless deliberately going for the Single File bonus (currently not planned — see docs/RULES_SUMMARY.md).

## Verification before considering anything "done"

- `node --test` passes.
- `scripts/verify-zero-deps.sh` (once written, Phase 3) passes.
- The relevant STDLIB.md entry exists.
- The human on the team can explain the code without you in the room — if an approach is too clever to explain in a few sentences, simplify it.
