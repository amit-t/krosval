# krosval — Project Initiation Document (PID)

> **Name settled.** `krosval` is the final project name, chosen 2026-08-05 via naming ticket [T01](wayfinder/tickets.md). It reads as *cross-validation* — many independent folds cross-checking into one validated, confidence-scored result, which is exactly the deliberation mechanism. The codebase stays name-agnostic: no branding baked into protocol formats, transcript schemas, or file layouts, so the name lives as a single replaceable constant.

**Version:** 0.2 · **Date:** 2026-08-05 · **Owner:** Amit Tiwari · **Repo:** https://github.com/amit-t/krosval · **Status:** Draft — discovery in progress via the Wayfinder map

---

## 1. Executive summary

krosval is a CLI-first application that convenes the AI coding agents **already installed on your machine** — Claude Code, Gemini CLI, Codex CLI, and any user-defined wrapper profiles around them — into a deliberating **council**. A question goes to every seated agent in parallel; the answers are anonymized and peer-reviewed by the agents themselves; a chairman agent synthesizes a final answer with a confidence/consensus analysis showing exactly where the models agree and where they diverge.

The inspiration is [AI Council (ai.techniciti.eu)](https://ai.techniciti.eu/), a macOS/iOS app that does this over provider **APIs**. krosval's differentiation is that the council members are **local CLI agents** — subscription-backed, tool-capable, workspace-aware processes — orchestrated headlessly, with an optional **observatory mode** that mirrors the live deliberation into panes of the user's terminal multiplexer (tmux, iTerm2, Ghostty, cmux, herdr).

A GUI layer (desktop/mobile app) is explicitly deferred: v1 is the CLI engine plus terminal experience, built so a UI can later sit on top of the same engine.

## 2. Background and reference analysis

The reference app's deliberation pipeline, which v1 replicates in full (decision: **Full pipeline in v1**):

1. **Parallel gathering** — the question is routed to all members simultaneously; no member sees another's answer.
2. **Anonymous peer review** — each member ranks/critiques all responses under anonymous labels (Response A/B/C…), preventing brand bias.
3. **Chairman synthesis** — a designated chairman aggregates answers + peer rankings into one integrated response.
4. **Confidence analysis** — a consensus card surfaces where members agreed (high confidence) vs. disagreed (investigate further).

Reference-app deliberation modes to support as configurable recipes: **Devil's Advocate**, **Expert Panel** (assigned specialist roles), **Debate**, **Consensus Seeker**.

What changes when members are CLI agents rather than APIs:

- Members can **use tools** (read the repo, run tests, search the web) during gathering — a council seat is an *agent*, not a completion endpoint.
- Members carry the user's **subscriptions and configurations** — no separate API-key management for v1.
- Wrapper profiles (e.g. shell functions `co`, `cf` that wrap `claude` with injected system prompts and permission modes) are first-class **personas** that can hold council seats.
- Sessions run in the user's real terminal environment, making live observation (observatory mode) natural.

## 3. Problem statement

Every single-model answer is a single point of failure: blind spots, training-data gaps, provider-specific bias, and no signal for *how much to trust the answer*. Engineers who already pay for 2–4 CLI agents compensate manually — asking the same question in multiple tools and eyeballing the differences. That workflow is slow, unstructured, loses the comparison the moment the terminal scrolls, and produces no confidence signal. krosval automates it into a repeatable, auditable deliberation.

## 4. Core concepts (glossary)

| Term | Definition |
|---|---|
| **Agent** | An installed CLI AI tool that can be invoked non-interactively (e.g. `claude`, `gemini`, `codex`). |
| **Profile** | A named configuration of an agent — either native (a Claude Code settings profile) or a **wrapper** (shell function/alias like `co`, `cf` injecting system prompts/permission modes). |
| **Registry** | krosval's local record of discovered agents and profiles, built at first run and refreshable. |
| **Seat** | A slot in a council occupied by one agent+profile combination, optionally with a role (e.g. Security expert, Devil's Advocate). |
| **Council** | A named, reusable configuration of seats + a recipe + a chairman assignment. |
| **Recipe** | The deliberation pipeline configuration: which stages run, which mode governs them. |
| **Chairman** | The seat that performs synthesis. |
| **Deliberation** | One full run of the pipeline for one question. |
| **Consensus card** | The structured agreement/disagreement analysis rendered at the end. |
| **Transcript** | The complete audit record of a deliberation: every prompt, response, ballot, and synthesis, with member identities both anonymized (as reviewed) and resolved (as stored). |
| **Observatory mode** | Optional live mirroring of each seat's activity into panes/tabs of a supported terminal environment. |

## 5. Personas and primary use cases

- **The multi-agent engineer** (primary; Amit is persona zero): has Claude Code + at least one other agent, plus wrapper profiles; wants peer-reviewed answers for consequential decisions (architecture choices, tricky debugging, review of a design doc) without leaving the terminal.
- **The cautious tech lead**: uses deliberations to pressure-test decisions and keeps transcripts as decision audit trails.
- **The tinkerer**: builds custom councils/recipes, adds new agent adapters, scripts krosval in CI or editor workflows.

Representative invocations (illustrative, pre-design):

```
krosval                       # first run → discovery interview; later → interactive console
krosval ask "Should service X move from SQS to Kinesis?"          # default council
krosval ask -c security-panel --mode debate -f design.md "Review this"
krosval council new           # define seats, roles, chairman, recipe
krosval agents                # show registry; krosval agents rescan
krosval observe               # attach observatory panes to a running deliberation
krosval history / show <id>   # transcripts
```

A short alias `kv` is reserved as an optional convenience for daily use (`kv ask "…"`); the canonical binary is `krosval`.

## 6. Scope

### 6.1 In scope (v1)

1. **First-run discovery**: auto-discover installed agents and wrapper profiles; interactive confirm/edit interview; persisted registry.
2. **Full deliberation pipeline**: parallel gathering → anonymous peer review → chairman synthesis → confidence analysis, with streaming progress.
3. **Deliberation modes**: the four reference modes, expressed as built-in recipes over a configurable pipeline.
4. **Councils**: named, persistent council configurations; a sensible auto-generated default council from the registry.
5. **Observatory mode** on the five target terminal environments: **tmux, iTerm2, Ghostty, cmux, herdr** (depth of integration per terminal is a design ticket — capabilities differ).
6. **Transcripts**: local, private, append-only deliberation records with resolved identities; basic `history`/`show`.
7. **Context input**: pass files/stdin as shared context to all seats.
8. **Local-first privacy**: no server component; nothing leaves the machine except the agents' own provider traffic.

### 6.2 Out of scope (v1) — see also the map's Out of scope section

- GUI/APK/desktop app (later layer on top of the engine).
- Direct provider-API integration with user-managed keys (the techniciti model) — members are CLI agents only.
- Any hosted/managed service, accounts, billing, telemetry.
- Windows support (macOS + Linux first; Windows revisited post-v1).

## 7. Functional requirements

**Discovery & registry**
- FR-1: On first run, scan `PATH` and known install locations for a curated + extensible list of known agents (Claude Code, Gemini CLI, Codex CLI, opencode, aider, …).
- FR-2: Discover wrapper profiles: shell functions/aliases in bash/zsh/fish rc files that wrap known agents (e.g. `co`, `cf`), capturing their injected flags/system prompts/permission modes where parseable.
- FR-3: Discover agent-native profile/config variants (e.g. Claude Code settings, model selection, MCP configs) to the extent each agent exposes them.
- FR-4: Present findings in an interactive interview: confirm, edit, add manually, exclude. Persist as the registry; support `rescan` diffing.
- FR-5: Registry is a human-readable file the user can edit directly.

**Deliberation engine**
- FR-6: Invoke each seat headlessly via an **agent adapter** implementing a common contract (send prompt+context, stream output, structured result, cost/usage metadata where available).
- FR-7: Stage 1 runs all seats concurrently with shared question+context; per-seat timeout and failure isolation (council proceeds with quorum if a seat fails).
- FR-8: Stage 2 anonymizes responses (stable within a deliberation) and collects structured ballots (rankings + critiques) from each seat about all responses including handling of self-review.
- FR-9: Stage 3 prompts the chairman with responses + ballots to produce the synthesis.
- FR-10: Stage 4 computes and renders the consensus card: agreement points, disputes, per-response peer scores, overall confidence.
- FR-11: Modes alter stage prompts/roles/ordering via recipes; ship the four reference modes as built-ins.
- FR-12: Full transcript persisted for every deliberation.

**Interface**
- FR-13: Non-interactive CLI (`krosval ask …`) with streaming progress and final rendered output; `--json` for scripting.
- FR-14: Interactive console mode for conversational use of a council.
- FR-15: Observatory mode: when enabled and a supported terminal environment is present, mirror each seat's live stream into a pane/tab; degrade gracefully to inline progress otherwise.

**Extensibility**
- FR-16: Agent adapters are pluggable — adding a new CLI agent must not require touching engine code.
- FR-17: Recipes are declarative and user-definable.

## 8. Non-functional requirements

- **NFR-1 Privacy**: local-only state; transcripts stored under the user's config/data dir; no telemetry.
- **NFR-2 Latency honesty**: deliberations are minutes-scale (agents think); the UX must stream progress and never appear hung.
- **NFR-3 Cost transparency**: surface per-seat usage/cost metadata when the agent reports it.
- **NFR-4 Robustness**: any single agent hanging/crashing must not wedge the deliberation.
- **NFR-5 Testability**: the engine must run against **fake agents** (scripted executables) in CI — no live model calls needed for orchestration tests.
- **NFR-6 Portability**: macOS and Linux for the engine; terminal integrations degrade per-platform.

## 9. Architecture sketch (pre-design; refined by map tickets)

```
┌─────────────────────────────────────────────────────┐
│  CLI / Interactive console (ask, council, agents…)  │
├─────────────────────────────────────────────────────┤
│  Renderer: streaming progress, consensus card, --json│
├──────────────────────────────┬──────────────────────┤
│  Deliberation engine          │  Observatory driver  │
│  (stages, recipes, quorum,    │  (tmux / iTerm2 /    │
│   anonymization, transcripts) │   Ghostty / cmux /   │
├──────────────────────────────┤   herdr backends)    │
│  Agent adapter layer          ├──────────────────────┤
│  (claude / gemini / codex /   │  Discovery & registry│
│   wrapper-profile adapters)   │  (scan, interview)   │
├──────────────────────────────┴──────────────────────┤
│  Local state: registry, councils, recipes, transcripts│
└─────────────────────────────────────────────────────┘
```

Key architectural bets already made: **hybrid execution** — headless subprocess orchestration is the engine of record; observatory mode is a presentation layer over the same streams, never the mechanism of orchestration. This keeps the engine scriptable, testable (NFR-5), and GUI-ready.

## 10. Decisions log

| # | Decision | Rationale |
|---|---|---|
| D1 | Full four-stage pipeline in v1, not a cut-down core loop | User decision during charting; parity with reference app is the point |
| D2 | Hybrid execution: headless engine + optional observatory panes | Testable engine, spectacle preserved, GUI-ready |
| D3 | v1 terminal targets: tmux, iTerm2, Ghostty, cmux, herdr | User-confirmed list |
| D4 | Council members are CLI agents/wrappers, not raw provider APIs | The product's differentiation; avoids key management |
| D5 | **Name settled: `krosval`** (binary `krosval`, optional alias `kv`) — T01 resolved 2026-08-05 | Reads as *cross-validation* (folds cross-checking → one validated, confidence-scored result), matching the peer-review mechanism; clear on npm + crates.io + GitHub, no dev/product collision; repo live at github.com/amit-t/krosval |

## 11. Open questions

Held on the Wayfinder map (`wayfinder/map.md`) as tickets and fog — notably: implementation language/stack (T03), the per-agent headless invocation contracts (T04), per-terminal automation depth (T05), wrapper discovery technique and its security posture (T06), the deliberation protocol's structured-ballot format (T08), and everything listed under *Not yet specified*. Naming (T01) is resolved; repo creation + issue import (T02) is in progress.

## 12. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Agent CLIs change flags/output formats between releases | Adapters break silently | Adapter contract tests against recorded fixtures; version detection per agent |
| Peer review with tool-capable agents is slow/expensive | Deliberations feel unusable | Recipe-level controls: review-only prompts with tools disabled where the agent supports it; per-stage timeouts; cost display (NFR-3) |
| Wrapper-profile parsing (shell rc files) is fragile and security-sensitive | Wrong/dangerous invocations | Treat parsed wrappers as *candidates* requiring user confirmation in the interview; never execute rc files to introspect (T06) |
| Terminal automation surfaces vary wildly (Ghostty especially) | Observatory mode inconsistent | Capability-tiered integration: full panes where possible, tab-spawn or none elsewhere; tmux as the reference implementation (T05) |
| herdr/cmux overlap with krosval's own value | Confused positioning | Position as *host environments*, not competitors: they multiplex agents; krosval makes them deliberate (T05 assesses integrate-vs-inspire) |
| Chairman quality bottlenecks the product | Weak syntheses | Chairman is a seat like any other — swappable; synthesis prompt engineering gets its own attention in T08 |

## 13. Milestones (indicative; sequencing firms up as the map resolves)

- **M0 — Way found**: Wayfinder map exhausted; name final (**done: krosval**); repo live with issues imported; stack chosen; protocol + discovery designs locked.
- **M1 — Skeleton council**: registry (manual entries only) + adapters for Claude Code and one other agent + stage-1 parallel gathering with streaming; fake-agent test harness.
- **M2 — Full pipeline**: peer review, chairman synthesis, consensus card, transcripts; the four modes as recipes.
- **M3 — Discovery**: auto-discovery + first-run interview + wrapper profiles.
- **M4 — Observatory**: tmux reference implementation, then iTerm2/cmux/Ghostty/herdr per T05 findings.
- **v1.0 — Launch**: docs, packaging (per T03), demo recording.
- **Post-v1**: GUI layer, Windows, provider-API seats, council chains, evidence mode.

## 14. Ways of working

Discovery runs on the Wayfinder method: the map (`wayfinder/map.md`) is the canonical index of decisions; each ticket is one agent-session-sized question; one ticket per session; tickets migrate to GitHub issues once the repo exists (T02 includes a ready import script, `wayfinder/import-to-github.sh`). Build-phase work (M1+) begins only when the map says the way is clear.
