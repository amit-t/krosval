# T01 — Settle the final name and clear registries

**Labels:** `wayfinder:grilling` · **Blocked by:** — · **Blocks:** T02 · **Status:** ✅ RESOLVED 2026-08-05

## Question

What is the project's final name — for the GitHub repo, the CLI binary, and eventual package registries?

## Resolution

**Name: `krosval`.** Binary/command `krosval`, with an optional short alias `kv` for daily use. Repo live at https://github.com/amit-t/krosval.

Rationale: `krosval` reads as *cross-validation* — many independent folds cross-checking into one validated, confidence-scored result, which is precisely the peer-review-and-synthesize mechanism of the council. Chosen by Amit's veto over the runner-up `kroval` (which was cleaner to type but carried no meaning hook).

Path to the decision: ~25 rejected candidates across sessions — Sanskrit/council-literal names, physics/astronomy/mythology deep cuts, legible council words, mechanism coinages, a six-model Devin brainstorm (recommended `talvane`), and a meaning-first pivot (`mosaic` and its tile family). Every legible single word in the "many views → one answer" space proved taken, frequently by rival multi-agent tools (`tessera`, `terrazzo`, `stipple`; `mosaic` collides with Databricks' Mosaic AI). Amit then proposed two coined finalists and picked `krosval`.

Clearance (checked 2026-08-05): npm `krosval` → free; crates.io `krosval` → free; GitHub `/krosval` → free (repo created under `amit-t`); PyPI no collision surfaced. Deferred/optional for a personal OSS CLI: USPTO/EUIPO trademark search, `.dev`/`.sh`/`.io` domains.

Follow-through: swept PID + map + tickets from working title `parallax` → `krosval`. Unblocked T02.

---

# T02 — Create the GitHub repo and import this map as issues

**Labels:** `wayfinder:task` · **Blocked by:** — (T01 resolved) · **Blocks:** — · **Status:** ✅ RESOLVED 2026-08-10

## Question

Task, not decision: stand up the canonical home and migrate the map so GitHub issues become the tracker of record.

Checklist:

1. ✅ Repo `amit-t/krosval` created and cloned locally (`KrosvalHq/krosval`).
2. Commit the seed: `PID.md`, `wayfinder/` (map + tickets + naming-history), `README.md`.
3. Run `wayfinder/import-to-github.sh` with `gh` authenticated: creates labels (`wayfinder:map`, `wayfinder:research|prototype|grilling|task`), the map issue, one issue per ticket (T01 imported pre-closed; T02–T12 open), and records blocking via each issue body's "Blocked by" line + a tracking checklist on blockers (GitHub's native issue-dependencies API is not exposed through `gh` on all plans).
4. Verify the frontier reads correctly in the GitHub UI; update `map.md` links from `tickets.md` to issue URLs.
5. Retire the local-markdown tracker: note in the README that issues are now the tracker of record.

Answer records: repo URL (done: github.com/amit-t/krosval), issue numbers per ticket, any import-script deviations.

**Answer (2026-08-10):** Import complete. Map = [#1](https://github.com/amit-t/krosval/issues/1); tickets T01–T12 = issues #2–#13 in order (T01 → #2 closed as resolved, T02 → #3, … T12 → #13). Blockers recorded as comments on #9, #11, #12, #13. Deviations: first run died at `declare -A` (macOS ships bash 3.2, no associative arrays) after creating only the map issue; script rewritten to a tab-separated-file id→number map and made idempotent (existing issues matched by exact title and reused; blocker comments/closes applied only to newly created issues).

---

# T03 — Choose implementation language, distribution, and CLI framework

**Labels:** `wayfinder:grilling` · **Blocked by:** — · **Blocks:** — (informs fog: adapter SDK, testing, packaging)

## Question

What is v1 built in, and how does it reach users' machines?

Dimensions to settle with Amit:

- **Language.** Live candidates: **Rust** (Amit's gitlore stack — ratatui for console mode; strong single-binary story), **Go** (fastest path for subprocess orchestration + single binary), **TypeScript/Bun or Node** (closest to the agents' own ecosystem, npm distribution, weakest binary story). Weigh: subprocess/PTY control quality, streaming multiplexing ergonomics, TUI library maturity, Amit's own velocity and joy — he is the sole builder-operator initially, and CLI agents do much of the writing.
- **PTY question feeding in from T04/T05:** if observatory mode requires allocating PTYs per seat, PTY library maturity matters (portable-pty in Rust, creack/pty in Go, node-pty).
- **CLI framework + TUI library** consistent with the language pick.
- **Distribution:** Homebrew tap, cargo/npm, install script, GitHub releases — pick primary + secondary channels.
- **Repo layout:** single binary vs engine-library + CLI split (GUI later wants the library boundary).

Answer records: language, key libraries, distribution channels, repo layout skeleton.

---

# T04 — Research: headless invocation contracts of target CLI agents

**Labels:** `wayfinder:research` · **Blocked by:** — · **Blocks:** T08

## Question

For each launch-relevant CLI agent — Claude Code, Gemini CLI, Codex CLI, and secondaries worth cataloguing (opencode, aider, Qwen Code, etc.) — what exactly is the non-interactive invocation contract?

Per agent, document:

- Headless/print flags (`claude -p`, `--output-format stream-json`, gemini/codex equivalents), stdin handling, file/context passing.
- Streaming behavior: what arrives on stdout/stderr, in what framing; JSON-stream schemas.
- Session semantics: resume/continue support, session IDs — matters for multi-stage pipelines (a seat is prompted at least twice: gather, then review).
- Tool use in headless mode: what tools run, how permission modes are expressed, can tools be constrained per invocation (review stage may want tools off).
- Usage/cost metadata reported, exit codes, timeout/cancellation behavior (SIGINT/SIGTERM handling).
- Version detection and flag stability across recent releases.

Deliverable: a comparison matrix + per-agent notes as a markdown asset, with a proposed **minimum common adapter contract**. Verify against installed binaries where possible (pairs with T07), else official docs.

---

# T05 — Research: automation surfaces of the five target terminals

**Labels:** `wayfinder:research` · **Blocked by:** — · **Blocks:** T12

## Question

For each v1 terminal target — **tmux, iTerm2, Ghostty, cmux, herdr** — what can an external process actually do, and therefore what tier of observatory-mode integration is achievable?

Per terminal, document:

- Programmatic control surface: tmux CLI (`new-window`, `split-window`, `send-keys`, `pipe-pane`, control mode `-CC`); iTerm2 Python API / AppleScript; Ghostty's current CLI/IPC story (historically thin — verify what exists in 2026); cmux's automation hooks; herdr's CLI/config model.
- Can we: create panes/tabs, write a live stream into one, title it, detect the host terminal we're running inside, clean up on completion?
- Read-back: is one-way display mirroring enough (yes for observatory), or is any control loop possible/needed?
- Platform constraints (iTerm2/cmux/Ghostty = macOS; tmux/herdr cross-platform).

Also resolve the **herdr/cmux positioning question**: assess integrate (drive them as observatory backends), inspire (borrow UX), or ignore per tool.

Deliverable: capability matrix + recommended integration tier per terminal. tmux is presumptively the reference implementation.

---

# T06 — Research: safe discovery of wrapper profiles and agent configs

**Labels:** `wayfinder:research` · **Blocked by:** — · **Blocks:** T10

## Question

How does krosval discover, without executing untrusted code, (a) installed agents, (b) shell wrapper profiles like `co`/`cf`, and (c) agent-native configuration variants?

Investigate:

- **Binary discovery:** PATH scanning, common install dirs (npm global, Homebrew, cargo), version probing (`--version` is an execution — define the trust line).
- **Wrapper discovery:** locating function/alias definitions across zsh/bash/fish (rc files, `.zshrc` sourcing chains, fpath autoload); *static parsing* vs `zsh -ic 'functions'` interactive-shell introspection (which executes rc files — security/side-effect tradeoffs); recognizing a function wraps a known agent; extracting injected flags/system-prompt files/permission modes; handling wrappers that are scripts on PATH.
- **Agent-native configs:** Claude Code `~/.claude` (settings.json, CLAUDE.md, MCP servers, output styles), Gemini/Codex equivalents — which are worth surfacing as profile dimensions vs noise.
- **Prior art:** how herdr, cmux, aider, mise, direnv handle shell integration and discovery consent.

Deliverable: a discovery-techniques report with a recommended approach per category, an explicit security posture (parsed vs executed, what always needs confirmation), and open questions for T10. Pairs with T07's ground-truth inventory.

---

# T07 — Task: inventory persona-zero machine

**Labels:** `wayfinder:task` · **Blocked by:** — · **Blocks:** T10

## Question

Task, not decision: capture the ground truth of Amit's own machine(s) — the concrete dataset the discovery design (T10) must handle on day one.

Checklist (agent drives via a session with machine access, or hands Amit a paste-ready script):

1. Installed agents: which CLI agents exist, versions, install method (`which claude gemini codex …`, brew/npm listings).
2. Wrapper profiles: full definitions of `co`, `cf`, and any other agent-wrapping functions/aliases — including injected system prompts and permission modes.
3. Claude Code config surface: profiles/settings, MCP servers, CLAUDE.md locations, output styles in use.
4. Shell + terminal reality: login shell, rc-file structure, which of tmux/iTerm2/Ghostty/cmux/herdr are installed and actually used, multiplexer config.
5. Anything surprising — the discovery design's edge cases live here.

Answer records: the sanitized inventory (secrets stripped) as a markdown asset. Persona-zero test data for T10 and fixture material for discovery tests.

---

# T08 — Design the deliberation protocol and transcript format

**Labels:** `wayfinder:grilling` · **Blocked by:** T04 · **Blocks:** T11, T12

## Question

Precisely how do the four stages execute over CLI-agent seats, and what is the canonical record of a deliberation?

Design with Amit (domain-modeling), grounded in T04's adapter contract:

- **Gathering:** prompt envelope (question + shared context + role framing); per-seat tool policy; concurrency, timeouts, quorum rule when seats fail.
- **Anonymization:** stable label assignment (Response A/B/…), scrubbing self-identifying tells before review, whether a seat reviews its own answer (reference app: yes, anonymously — confirm stance).
- **Peer review ballots:** structured format (rankings? scores per criterion? critiques?) — must be parseable from agents that don't guarantee JSON; define the coercion/repair strategy and unparseable-ballot handling.
- **Chairman synthesis:** chairman selection (fixed vs rotating vs strongest-ranked), synthesis prompt inputs, whether the chairman's own gathering answer is included.
- **Confidence analysis:** how agreement is computed (from ballots vs a dedicated pass), consensus-card schema.
- **Two-invocation seats:** whether review reuses the gathering session (resume) or is a fresh invocation with transplanted context — per T04's per-agent findings.
- **Transcript:** append-only record schema (JSONL?), stored resolved vs anonymized, replay/inspection affordances. Name-agnostic format.

Answer records: protocol spec (likely `docs/protocol.md`) + consensus-card and transcript schemas. Graduates fog: cost budgeting, persistence, security posture, council-chains scope call.

---

# T09 — Prototype: end-to-end council session CLI UX

**Labels:** `wayfinder:prototype` · **Blocked by:** — · **Blocks:** — (informs fog: interactive console)

## Question

What should a deliberation *look and feel like* in the terminal, end to end — before any engine exists?

Build a cheap, fake-data prototype (script or recorded mock — no real agents) covering:

1. **First run:** discovery interview flow — findings presented, confirm/edit, default council proposed.
2. **`ask` run:** streaming progress through the four stages (what does "5 agents thinking" look like? per-seat spinners? incremental text?), the synthesis render, and the **consensus card** (agreements, disputes, peer scores, confidence) in terminal form.
3. **Failure texture:** one seat timing out mid-council — how it reads.
4. **Observatory glimpse:** a faked tmux split showing seats streaming in panes.

React-and-revise with Amit until the shape feels right. Value: fixes vocabulary and information hierarchy ahead of T08/T12.

Answer records: linked prototype asset + the UX decisions it settled (progress idiom, consensus-card layout, verbosity levels, `--json` shape sketch).

---

# T10 — Design the discovery model, registry format, and first-run interview

**Labels:** `wayfinder:grilling` · **Blocked by:** T06, T07 · **Blocks:** —

## Question

What exactly is the domain model for agents/profiles/registry, and how does first-run discovery behave?

Design with Amit (domain-modeling), grounded in T06's techniques report and T07's ground-truth inventory:

- **Model:** Agent vs Profile vs Seat relationships; is a wrapper (`co`) a profile of agent `claude` or a standalone entry? How are native config variants (model choice, MCP set) represented — profile dimensions or distinct profiles?
- **Registry file:** format (TOML/YAML/JSON), location (XDG), schema, hand-editability (FR-5), what discovery writes vs what only the user writes.
- **Known-agents catalog:** the curated scan list — shaped so adding an agent is data, not code (FR-16).
- **First-run interview:** exact flow — auto-discover then confirm, or ask-then-verify; how wrapper candidates from rc-parsing get confirmed (security posture from T06); manual-add path for undetected agents.
- **Rescan:** diffing behavior, removed/upgraded agents, drift between registry and reality at deliberation time.
- **Trust:** what the registry records about a wrapper's injected permission mode, and how that surfaces when the seat is used.

Answer records: discovery design doc + registry schema (likely `docs/discovery.md`). Graduates fog: packaging/first-run polish.

---

# T11 — Design deliberation modes as declarative recipes

**Labels:** `wayfinder:grilling` · **Blocked by:** T08 · **Blocks:** —

## Question

How are the four reference modes — Devil's Advocate, Expert Panel, Debate, Consensus Seeker — expressed as declarative recipes over the T08 protocol, and what is the recipe format users author their own with?

Settle:

- **Recipe schema:** which pipeline knobs a recipe may turn — stage on/off, stage prompt templates, role assignments per seat, extra stages (a Debate round is arguably an added stage), review criteria, chairman instructions.
- **The four built-ins:** full recipe definition for each, including stage prompts (prompt-engineering-heavy — expect iteration).
- **Expert Panel roles:** where role definitions live (recipe vs council vs seat), reference roles to ship (Security, UX, Architecture).
- **Authoring UX:** file-based recipes discovered from a directory? `krosval recipe new` scaffold? Validation.
- **Cost interaction:** Debate multiplies invocations — how recipes declare expected invocation counts so cost expectations render up front.

Answer records: recipe schema + four built-in recipe definitions (config assets in-repo).

---

# T12 — Design observatory mode and per-terminal integration tiers

**Labels:** `wayfinder:grilling` · **Blocked by:** T05, T08 · **Blocks:** —

## Question

Given T05's capability matrix and T08's stream/protocol design, what exactly does observatory mode do in each terminal tier, and how is it wired?

Settle:

- **Attachment model:** does `ask --observe` create panes at deliberation start, or does `krosval observe` attach to a running deliberation from another terminal? Both?
- **Stream plumbing:** how engine streams reach panes (FIFOs? `tmux pipe-pane`? tail of transcript?) without observatory becoming load-bearing for orchestration (D2 law).
- **Layout:** pane arrangement per council size, stage-transition signaling, the chairman's pane, cleanup on completion/abort.
- **Per-terminal behavior:** concrete design for the Tier 1 reference (tmux) and degraded designs for iTerm2 / Ghostty / cmux / herdr per their T05 tiers; detection of the host terminal.
- **Intervention question:** v1 stance on interacting *with* a seat through its pane (likely read-only in v1 — confirm and record).

Answer records: observatory design doc (likely `docs/observatory.md`). May sharpen the interactive-console fog.
