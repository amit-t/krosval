# Wayfinder map — krosval

**Label:** `wayfinder:map` · **Repo:** https://github.com/amit-t/krosval · **Tracker:** migrating from local-markdown to GitHub issues via [T02](tickets.md)

## Destination

A decision-complete v1 specification for krosval — the CLI app that convenes locally-installed AI CLI agents (and their wrapper profiles) into a full techniciti-style deliberating council — such that any CLI agent can execute the build (M1→v1.0 in the PID) with no discovery-level questions left open. The PID (`../PID.md`) is the living spec this map completes.

## Notes

- Domain: CLI tooling / multi-agent orchestration. Persona zero is Amit's own machine (macOS, zsh, Claude Code + wrapper functions `co`/`cf`, Gemini; terminals: tmux, iTerm2, Ghostty, cmux, herdr).
- Reference product: AI Council (ai.techniciti.eu) — four-stage pipeline (parallel gathering → anonymous peer review → chairman synthesis → confidence analysis) + four modes (Devil's Advocate, Expert Panel, Debate, Consensus Seeker). Full pipeline is in-scope for v1.
- Standing preferences: hybrid execution (headless engine, optional observatory panes); local-first, zero-server; engine testable against fake agents. Name is settled (**krosval**, T01) but the codebase stays name-agnostic — no branding in file/protocol formats.
- Skills/process: resolve HITL tickets via grilling/domain-modeling; one ticket per session; prototypes as cheap artifacts to react to.

## Decisions so far

Settled during charting (recorded in PID §10 Decisions log):

- **Full pipeline in v1** — all four deliberation stages plus modes at launch, not a cut-down core loop.
- **Hybrid execution model** — headless subprocess orchestration is the engine; observatory mode mirrors streams into terminal panes as presentation only.
- **v1 terminal targets confirmed** — tmux, iTerm2, Ghostty, cmux, herdr.
- **Members are CLI agents, not APIs** — no provider-key management in v1.

Settled by ticket:

- [T01 — Settle the final name](tickets.md) — **name is `krosval`** (binary `krosval`, optional alias `kv`). Reads as *cross-validation* — many folds cross-checking into one validated, confidence-scored result, matching the peer-review mechanism. Clear on npm + crates.io + GitHub (no dev/product collision). Repo created at github.com/amit-t/krosval. Chosen 2026-08-05 over `kroval` by Amit's veto on the cross-validation rationale. Unblocked T02; PID/map renamed from the working title `parallax`.

## Open tickets

*(GitHub issues once T02's import runs; frontier = open + unblocked + unclaimed.)*

| ID | Title | Type | Blocked by |
|---|---|---|---|
| [T02](tickets.md) | Create the GitHub repo and import this map as issues | task (HITL) | — (T01 resolved; repo already created) |
| [T03](tickets.md) | Choose implementation language, distribution, and CLI framework | grilling (HITL) | — |
| [T04](tickets.md) | Research: headless invocation contracts of target CLI agents | research (AFK) | — |
| [T05](tickets.md) | Research: automation surfaces of the five target terminals | research (AFK) | — |
| [T06](tickets.md) | Research: safe discovery of wrapper profiles and agent configs | research (AFK) | — |
| [T07](tickets.md) | Task: inventory persona-zero machine (agents, wrappers, terminals) | task (HITL) | — |
| [T08](tickets.md) | Design the deliberation protocol and transcript format | grilling (HITL) | T04 |
| [T09](tickets.md) | Prototype: end-to-end council session CLI UX | prototype (HITL) | — |
| [T10](tickets.md) | Design the discovery model, registry format, and first-run interview | grilling (HITL) | T06, T07 |
| [T11](tickets.md) | Design deliberation modes as declarative recipes | grilling (HITL) | T08 |
| [T12](tickets.md) | Design observatory mode and per-terminal integration tiers | grilling (HITL) | T05, T08 |

**Current frontier:** T02, T03, T04, T05, T06, T07, T09.

## Not yet specified

Fog — in scope, not yet sharp enough to ticket; graduates as the frontier advances:

- **Cost & latency budgeting** — per-seat token/cost caps, stage timeouts, what "quorum" means when seats fail or exceed budget. Sharpens after T04 and T08.
- **Persistence & recall** — transcript store format details, `history`/`show`/search UX, project workspaces with persistent context across deliberations. Sharpens after T08.
- **Interactive console mode** — the conversational REPL (vs one-shot `ask`): threading follow-ups through a council, context carry-over. Sharpens after T09.
- **Security posture of seats** — permission modes per seat (a Devil's Advocate probably shouldn't run `rm`), sandboxing, how wrapper-injected permission modes are honored/overridden. Sharpens after T06 + T08.
- **Adapter SDK & contribution model** — how third parties add agents; fixture/contract-test kit. Sharpens after T04 + T03.
- **Testing strategy** — fake-agent harness design, orchestration CI. Sharpens after T03 + T08.
- **Council chains** — multi-stage workflows (Research→Analyze→Report). Deliberately post-protocol; likely post-v1 scope call when T08 closes.
- **Evidence mode / citations** — reference-app feature; unclear semantics when members are tool-using agents that can actually browse. Revisit after T08.
- **Packaging & first-run polish** — install channels, shell completion, onboarding copy. Sharpens after T03.

## Out of scope

- **GUI / APK layer** — a later product on top of the v1 engine; the engine's `--json` and library boundaries are designed for it, but no UI work lives on this map.
- **Direct provider-API council seats** (the techniciti model) — v1 seats are CLI agents/wrappers only; API seats would be a fresh effort if the destination is redrawn post-v1.
- **Hosted/managed anything** — accounts, sync, billing, telemetry. Local-first is a product law, not a deferral.
- **Windows support** — macOS/Linux first; revisit post-v1.
