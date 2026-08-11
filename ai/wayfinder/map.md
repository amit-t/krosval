# Wayfinder map — krosval

**Label:** `wayfinder:map` · **Repo:** https://github.com/amit-t/krosval · **Tracker:** GitHub issues ([map = #1](https://github.com/amit-t/krosval/issues/1)); markdown in `wayfinder/` is seed/history (imported 2026-08-10 via T02)

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

- [T01 — Settle the final name](https://github.com/amit-t/krosval/issues/2) — **name is `krosval`** (binary `krosval`, optional alias `kv`). Reads as *cross-validation* — many folds cross-checking into one validated, confidence-scored result, matching the peer-review mechanism. Clear on npm + crates.io + GitHub (no dev/product collision). Repo created at github.com/amit-t/krosval. Chosen 2026-08-05 over `kroval` by Amit's veto on the cross-validation rationale. Unblocked T02; PID/map renamed from the working title `parallax`.
- [T02 — Create the GitHub repo and import this map as issues](https://github.com/amit-t/krosval/issues/3) — repo live, map + tickets imported as issues 2026-08-10; GitHub issues are now the canonical tracker.
- [T03 — Choose implementation language, distribution, and CLI framework](https://github.com/amit-t/krosval/issues/4) — **TypeScript on Bun** (Amit's call over the Rust recommendation; ~50–90 MB compiled-binary trade-off accepted). pnpm workspace (`packages/engine` + `packages/cli`), `commander`, `Bun.spawn`, `bun test`. Distribution: npm registry primary, `bun build --compile` binaries on GitHub releases + Homebrew tap secondary; `kv` as a second `bin` entry. License MIT OR Apache-2.0. Spawned [T13 — reserve krosval on npm](https://github.com/amit-t/krosval/issues/14); flagged `node-pty`-on-Bun compat as a T04 validation item.
- [T04 — Research: headless invocation contracts of target CLI agents](https://github.com/amit-t/krosval/issues/5) — all three primaries (Claude Code 2.1.227, Gemini CLI 0.44.0, Codex CLI 0.146.0) verified live: NDJSON streaming + headless session resume work everywhere, so two-stage gather-then-review pipelines are safe. Minimum common `SeatAdapter` contract proposed; tool-policy floor is read-only (Codex can't disable shell); success must be read from the parsed terminal event, never exit codes. Secondaries: Qwen Code trivial (Claude-shaped), opencode/Amp feasible, aider + Cursor CLI skip-for-v1. `node-pty` is broken on Bun — replaced by native `Bun.Terminal` (verified). Full matrix + contract: [assets/T04-agent-contracts.md](assets/T04-agent-contracts.md). Unblocked T08; graduated adapter-SDK fog into [T14](https://github.com/amit-t/krosval/issues/15). Resolved 2026-08-11.
- [T05 — Research: automation surfaces of the five target terminals](https://github.com/amit-t/krosval/issues/6) — **read-back is optional**: every terminal can spawn a pane running a krosval-owned viewer (`krosval observe --seat <id>` fed by engine IPC), so the universal adapter contract shrinks to *create pane with command + title + cleanup* — all five satisfy it. Tiers: **Tier 1 headless** (verified live end-to-end) = tmux 3.6a (reference), cmux 0.64.22, herdr 0.7.4 — both socket CLIs are agent-native (herdr `agent wait --status`, cmux `set-status`/`events`) → **integrate both** as first-class backends and borrow their status vocabulary. **Tier 2 one-time-consent** = iTerm2 3.6.11 (Python API, Tier-1-rich after consent dialog) and Ghostty 1.3.1 (AppleScript sdef covers create-with-command/title/input; no read-back; TCC Automation prompt blocks unattended first call — verified). Detection order matters: `CMUX_*` before `TERM_PROGRAM` (cmux masquerades as ghostty). Matrix + `ObservatoryAdapter` contract: [assets/T05-terminal-automation.md](assets/T05-terminal-automation.md). T12's terminal-side input ready (still blocked by T08). Resolved 2026-08-11.
- [T07 — Task: inventory persona-zero machine](https://github.com/amit-t/krosval/issues/8) — inventory captured live on the machine 2026-08-11. Agents: Claude Code 2.1.227, Codex 0.146.0, Gemini 0.44.0 (+ Devin, grok, aico); no T04 secondaries. Wrapper chain mapped end-to-end: 3 layers (greeting functions on bare names → `claudec` persona launcher → ~45-launcher mode-stack family), model pinned via `ANTHROPIC_MODEL` env (invisible to argv), every yolo launcher injects `--dangerously-skip-permissions`, first-run `git clone` side effect confirmed in source. Bare `claude` resolves 3 ways (function → cmux temp shim → real binary); `ZDOTDIR` indirection to git-managed `~/Profiles` with definitions across ~40 files in ≥6 repos. Gemini is the unwrapped control case. 13 discovery edge cases + expected-registry seed recorded as T10 fixtures: [assets/T07-persona-zero-inventory.md](assets/T07-persona-zero-inventory.md). Unblocked T10. Resolved 2026-08-11.
- [T08 — Design the deliberation protocol and transcript format](https://github.com/amit-t/krosval/issues/9) — protocol locked, spec at [docs/protocol.md](../../docs/protocol.md). Pipeline: preflight probe → gather ‖ → anonymize → review ‖ → synthesis → confidence; strict barriers; engine owns timeouts (10/5/5 min defaults). Gathering: context inlined in full (identical evidence), full process transparency, tool policy default `readOnly` (user config may set `auto`/locked; config > recipe > default), quorum default all-or-abort (config-relaxable to ≥2/majority). Review: **fresh invocation, never session resume**; self-review included; ballot = ranking + 4-criterion scores (accuracy/completeness/clarity/practicality, 1–10) + critiques; one repair reprompt then drop+annotate; ≥1 valid ballot proceeds. Chairman: fixed per council (config: rotating/strongest-ranked), also gathers and is reviewed, sees anonymous labels only, failure → fallback chain. Confidence: deterministic ballot math (Kendall's W) + agreement/dispute lists folded into the synthesis call. Transcript: JSONL, append-only, live-written, full granularity incl. raw payloads, resolved identities + label map. Ubiquitous-language sheet: [assets/T08-ubiquitous-language.md](assets/T08-ubiquitous-language.md). Unblocked T11/T12/T14; graduated fog into T15/T16/T17; council chains ruled out of scope. Resolved 2026-08-11.
- [T06 — Research: safe discovery of wrapper profiles and agent configs](https://github.com/amit-t/krosval/issues/7) — **three-ring trust model**: Ring 0 parse-only (default — PATH/dir scan, static rc-chain parsing, read-only config reads, provenance per fact), Ring 1 `--version` probes of known binaries (one-time confirm; even `--version` runs user hooks), Ring 2 `zsh -ic` introspection (per-run direnv-style consent bound to content hash); **never execute discovered wrappers** (persona-zero wrapper side-effects a `git clone` — verified). Static parse handles the real worst case: `ZDOTDIR` indirection + recursive wrapper chains (`co` → env-inject → persona function → flag/system-prompt injection → `claude`). cmux shims poison naive PATH scans — dedupe by realpath. Prior art: cmux intercept-and-record (argv in env), herdr cooperate-and-report, direnv's consent unit. zsh first-class in v1; bash/fish best-effort. Report + T10 open questions: [assets/T06-discovery-techniques.md](assets/T06-discovery-techniques.md). T10 now waits only on T07. Resolved 2026-08-11.

## Open tickets

*(Frontier = open + unblocked + unclaimed.)*

| ID | Issue | Title | Type | Blocked by |
|---|---|---|---|---|
| T09 | [#10](https://github.com/amit-t/krosval/issues/10) | Prototype: end-to-end council session CLI UX | prototype (HITL) | — |
| T10 | [#11](https://github.com/amit-t/krosval/issues/11) | Design the discovery model, registry format, and first-run interview | grilling (HITL) | — (T06+T07 done) |
| T11 | [#12](https://github.com/amit-t/krosval/issues/12) | Design deliberation modes as declarative recipes | grilling (HITL) | — (T08 done) |
| T12 | [#13](https://github.com/amit-t/krosval/issues/13) | Design observatory mode and per-terminal integration tiers | grilling (HITL) | — (T08+T05 done) |
| T13 | [#14](https://github.com/amit-t/krosval/issues/14) | Task: reserve krosval on the npm registry | task (HITL) | — |
| T14 | [#15](https://github.com/amit-t/krosval/issues/15) | Design the adapter SDK and contract-test kit | grilling (HITL) | — (T08 done) |
| T15 | [#16](https://github.com/amit-t/krosval/issues/16) | Design cost and latency budgeting | grilling (HITL) | — (T08 done) |
| T16 | [#17](https://github.com/amit-t/krosval/issues/17) | Design persistence, recall, and workspaces | grilling (HITL) | — (T08 done) |
| T17 | [#18](https://github.com/amit-t/krosval/issues/18) | Design the fake-agent harness and orchestration CI | grilling (HITL) | — (T08 done) |

**Current frontier:** T09, T10, T11, T12, T13, T14, T15, T16, T17 — nothing blocked. (T08 resolved 2026-08-11 — protocol locked; every remaining ticket is takeable.)

## Not yet specified

Fog — in scope, not yet sharp enough to ticket; graduates as the frontier advances:

- **Interactive console mode** — the conversational REPL (vs one-shot `ask`): threading follow-ups through a council, context carry-over. Sharpens after T09.
- **Security posture of seats** — narrowed by T08: gathering defaults `readOnly` with user-config override, review is tools-off floor, wrapper-injected `--dangerously-skip-permissions` is overridden down to the stage policy. Remaining — sandboxing depth and the honor/warn UX for yolo wrappers in the first-run interview — lands in T10 (interview) and T14 (adapter enforcement contract tests).
- **Evidence mode / citations** — reference-app feature; unclear semantics when members are tool-using agents that can actually browse. Revisit once T09's prototype shows what the output surface can carry.
- **Packaging & first-run polish** — shell completion, onboarding copy, Homebrew formula details (channels settled by T03: npm primary, binaries + tap secondary). Sharpens after T09.

## Out of scope

- **Council chains** (multi-stage workflows: Research→Analyze→Report) — ruled out 2026-08-11 by [T08](https://github.com/amit-t/krosval/issues/9) Q16: a workflow layer atop deliberations, not a protocol concern; nothing in the v1 protocol gets harder by deferring. Revisit post-v1 as a fresh effort.
- **GUI / APK layer** — a later product on top of the v1 engine; the engine's `--json` and library boundaries are designed for it, but no UI work lives on this map.
- **Direct provider-API council seats** (the techniciti model) — v1 seats are CLI agents/wrappers only; API seats would be a fresh effort if the destination is redrawn post-v1.
- **Hosted/managed anything** — accounts, sync, billing, telemetry. Local-first is a product law, not a deferral.
- **Windows support** — macOS/Linux first; revisit post-v1.

