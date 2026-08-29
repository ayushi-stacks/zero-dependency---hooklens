# Rules Summary / Submission Checklist

Quick-reference distilled from docs/EVENT.md. Check this before submitting.

## Judging weights

- Functionality & Usefulness — **35%**
- Zero-Dependency Craft — **30%**
- Code Quality & Idiom — **25%**
- Innovation — **10%**

Read: testing and a real working demo matter more than anything else. Don't over-invest in polish at the expense of "does it actually work."

## Bonus points (add to score, not separate prizes)

- [ ] Single File (+5) — optional, likely skip, framework + demo app as one file hurts readability (Code Quality is 25%, conflicts with this bonus)
- [x] Reproducible Build (+5) — two builds are compared by `scripts/verify-build.js`
- [x] Package Killer (+3) — Express + its middleware stack, declared with download counts in STDLIB.md
- [x] STDLIB Log (+3) — 18 meaningful substitutions documented in STDLIB.md

## Submission checklist

- [x] Public GitHub repo
- [x] Working implementation
- [x] One-command build/run instructions in README
- [x] Empty dependency manifest (verified via scripts/verify-zero-deps.sh)
- [x] Dependency proof documented (DEPENDENCY_PROOF.md)
- [x] README.md
- [x] STDLIB.md with "Normally: X → Instead: Y" entries
- [x] `.zero-dep.toml` at repo root (track letter + one-line pitch)
- [x] Tests (`node --test` passes)
- [ ] 5-minute demo video
- [ ] Submitted via Discord before 31 Aug 2026, 11:30 PM IST

## Hard rules — do not violate

- **No project code committed before kickoff** (28 Aug 2026, 11:30 PM IST). Docs/scaffolding are fine before that; `src/` implementation is not.
- Zero third-party runtime dependencies in the final artifact — no exceptions, no "just this one small package."
- Repo must target exactly one of the six tracks (ours: Track C).
- Repo must be public at submission time.
- Any permitted dev-only tooling (if we end up using anything at all beyond Node itself) must be disclosed in STDLIB.md.
- Don't implement custom crypto (not relevant to us, we're not in Track E, but noting it as a hard rule for the event generally).

## AI usage — explicitly fine

AI assistance (Claude Code included) doesn't need to be hidden or minimized. It's judged on whether the team can explain and defend the resulting code, not on how much AI wrote. Be ready to walk through the router/middleware/body-parser logic line by line if asked.
