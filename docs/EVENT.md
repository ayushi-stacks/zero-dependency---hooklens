# Event: Zero Dependency | 72-Hour Hackathon

Source: https://unstop.com/hackathons/zero-dependency-72-hour-hackathon-hackathon-raptors-1733673
Organizer: Hackathon Raptors
Discord (official comms + submission channel): https://discord.gg/XPfcH7VT2H
Scraped: 2026-08-28

Team size: 1–4 members. Solo allowed. Prize pool: ₹1,80,000.

## Dates & Deadlines

| Milestone | Time (EDT) | Time (IST) |
|---|---|---|
| Registration deadline | 28 Aug 26, 1:30 PM | 28 Aug 26, 11:00 PM |
| Hackathon kickoff | 28 Aug 26, 2:00 PM | 28 Aug 26, 11:30 PM |
| Project submission closes | 31 Aug 26, 2:00 PM | 31 Aug 26, 11:30 PM |
| Write-up submission closes | 8 Sep 26, 2:00 PM | 8 Sep 26, 11:30 PM |
| Winners announced (Discord) | 11 Sep 26, 2:00 PM | 11 Sep 26, 11:30 PM |

## About the Hackathon

Zero Dependency 2026 is a 72-hour online hackathon built around one rule: your dependency manifest must be empty. No third-party runtime packages, no frameworks, no external libraries — just your language's standard library and your engineering skills.

The goal isn't to prove packages are bad; it's to prove you understand what sits underneath them. Every submission must be a working, useful program that builds with a single command and runs with zero third-party runtime dependencies. You must also document what packages you'd normally use and how you replaced them with stdlib.

## Why Participate (organizer framing)

- Build real software from first principles.
- Deepen understanding of your language's standard library.
- Practice engineering without frameworks or third-party packages.
- Work with networking, parsing, storage, security, algorithms, or dev tooling.
- Demonstrate technical depth and engineering judgment.

## AI Tools — explicitly allowed

> AI coding assistants are allowed — including Claude Code, Cursor, Aider, GitHub Copilot, local AI models, and others. AI usage itself is not scored. We score whether the final implementation works, whether it follows the zero-dependency constraint, and whether the team can explain and defend the code.

## Eligibility

Open to students, software developers, engineers, researchers, professionals, open-source contributors — anyone, any country.

## Team Size

1–4 members. Solo allowed. Teams of 2–3 recommended. Cross-college and cross-disciplinary teams allowed.

## Event Format

72 hours, fully online. Teams pick one of six tracks and build a working project using only their language's standard library. Expected to:

- Choose a track and define a real problem.
- Design and implement using stdlib only.
- Test against edge cases.
- Document technical decisions and trade-offs.
- Verify zero third-party runtime dependencies.
- Prepare a working demo.
- Submit project documentation + dependency proof.

## Tracks

- **Track A — Developer Tools & CLI:** Linters, formatters, task runners, Git utilities, file utilities, CLI automation. Clean CLI with sensible args, exit codes, stdout/stderr behavior.
- **Track B — Parsers & Data Formats:** JSON/CSV/Markdown/config parsers, template engines, regex engines, serializers. Edge cases, correctness, useful errors, nesting, escaping, malformed-input handling matter.
- **Track C — Web & Network** *(our track)*: HTTP servers, routers, clients, static-site servers, DNS utilities, raw TCP apps, network diagnostics. Must handle concurrent connections and real clients/servers.
- **Track D — Data & Storage:** Key-value stores, embedded DBs, caches, log-structured stores, search indexes. Persistence, retrieval, durability/consistency, crash/concurrent-access handling.
- **Track E — Security & Crypto Utilities:** Password managers, TOTP/2FA generators, file encryption, hashing utilities, secrets scanners. Do NOT implement your own crypto algorithms — compose trusted stdlib primitives, document threat model.
- **Track F — Open / Wildcard:** Games, visualizers, interpreters, compression tools, schedulers, simulations. README must justify track fit and explain zero-dep approach.

## What Counts as Zero Dependency

Core rule: zero third-party runtime dependencies. Final project uses only the standard library of the chosen language.

- **JavaScript/TypeScript:** Node.js, Deno, or Bun built-ins only. No npm runtime packages. *(our language)*
- **Python:** stdlib only, no pip runtime deps.
- **Go:** stdlib only, no `require` block in go.mod.
- **Rust:** stdlib only, empty `[dependencies]` in Cargo.toml.
- **C/C++:** libc and POSIX only.
- **Java/Kotlin/C#:** platform stdlib only, no Maven/NuGet runtime deps.

## What You Need to Submit

- Public GitHub repository.
- Working implementation.
- One-command build instructions.
- Empty dependency manifest.
- Dependency proof.
- README.md.
- STDLIB.md (format: `Normally: requests → Instead: Python urllib + http.client`).
- Tests.
- 5-minute demo video.

## Judging Criteria

| Criterion | Weight |
|---|---|
| Functionality & Usefulness | 35% |
| Zero-Dependency Craft | 30% |
| Code Quality & Idiom | 25% |
| Innovation | 10% |

## Bonus Challenges (score points, not separate cash)

- **Single File (+5):** entire project as one genuinely useful source file.
- **Reproducible Build (+5):** build artifact twice, byte-identical output, publish both hashes.
- **Package Killer (+3):** reimplement a package people actually use, document the replacement.
- **STDLIB Log (+3):** document 10+ meaningful stdlib-for-package substitutions in STDLIB.md.

## Rules

- Teams: 1–4 members.
- All project code must be written during the official 72-hour window.
- Planning, research, documentation reading, and AI prompt prep are allowed beforehand.
- **No project code may be committed before kickoff.**
- Final artifact must have zero third-party runtime dependencies.
- Must build using a single documented command.
- Third-party source code cannot be copy-pasted in to fake an empty manifest.
- Submitted GitHub repo must be public at submission time.
- Project must target one of the six official tracks.
- Open-source licensing requirements must be respected.
- AI coding assistants are allowed.
- Any permitted development-only dependency must be disclosed in STDLIB.md.
- Project must be genuinely useful — hello-world/trivial implementations score poorly.

## Prizes

| Place | Prize |
|---|---|
| 1st — Grand Prize | ₹80,000 cash + certificate |
| 2nd — Runner Up | ₹40,000 cash + certificate |
| 3rd — Third Place | ₹20,000 cash + certificate |
| Package Killer — Best Reimplementation | ₹10,000 cash + certificate |
| Side Quest — The Write-Up (top 3, ₹10,000 each) | ₹30,000 total + certificates |
| Participation | Certificate |

Prizes/certificates released within 4 days of event end.

## About Hackathon Raptors

Community Interest Company running online hackathons for working engineers. 40+ events run, 2,500+ Discord members, 1,500+ builders, 300+ projects shipped, participants from 30+ countries; past builders from Google, Microsoft, Amazon, Meta, NVIDIA, Tesla.
