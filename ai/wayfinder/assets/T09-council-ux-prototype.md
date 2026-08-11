# T09 — Council session CLI UX prototype

Ticket: [T09 / #10](https://github.com/amit-t/krosval/issues/10) · Status: **awaiting Amit's reaction** · Prototype: [`T09-prototype/demo.ts`](T09-prototype/demo.ts)

Fake-data walkthrough of the full krosval terminal experience — no engine, no agents, every byte scripted. Purpose: fix vocabulary and information hierarchy ahead of T08 (protocol) and T12 (observatory).

## Run it

```sh
cd ai/wayfinder/assets/T09-prototype
bun demo.ts                    # all five scenes, paced like a real run
bun demo.ts --scene ask        # first-run | ask | failure | observatory | json
bun demo.ts --fast --plain     # instant, no ANSI (what the captures below show)
```

Animated mode adds per-seat spinners, in-place seat-table redraws, and token-streaming synthesis — run it in a real terminal; captures below flatten that.

## UX proposals embodied (react via the grill)

Each is a proposal, not a decision — veto/adjust in [`.grills/`](../../../.grills/) grill `council-ux` or by reacting on the issue.

1. **Progress idiom: live seat table per stage** — one row per seat (spinner/state, tokens, elapsed), redrawn in place. No progress bars — token count + elapsed is the honest signal (NFR-2).
2. **Stage header `▶ n/4 <name>`** with a one-line mechanics note (who sees what, tools on/off) — teaches the pipeline while it runs.
3. **Seat states**: `queued · working · done · timeout · failed` — borrows herdr's `working` vocabulary (T05).
4. **Consensus card**: single box — confidence word+number, agreed (with N/M tallies), disputed (labels), peer scores, label→seat reveal, dropped seats. Anonymity is only lifted here, after review.
5. **Failure texture**: timeout turns the seat row `✗`, one ⚠ banner names the budget and the quorum rule, later stages shrink label range (A–C), card records the dropped seat. No stack traces, no scrolling errors.
6. **First-run**: three scan lines → agents table → wrappers table (with source `file:line` provenance) → one security warning for `--dangerously-skip-permissions` wrappers → single confirm → proposed default council. Wrappers registered but not auto-seated.
7. **Observatory**: `--observe` flag; 2×2 panes titled `<seat> [state]`, krosval-owned status bar at bottom; absent integration falls back to the inline seat table. Presentation only.
8. **`--json`**: NDJSON event stream (`deliberation.start`, `stage.start/end`, `seat.status/delta/result`, `ballot.received`, `synthesis.delta`, `consensus`, `deliberation.end`) — same vocabulary as transcript and observatory feed.
9. **Trailer**: transcript path + replay command + elapsed + honest cost line (only claude reports cost — T04).

## Scene captures (`--fast --plain`)

<details>
<summary><strong>Scene 1 — first run: discovery interview</strong></summary>

```text
$ krosval

No registry found — first run. Scanning this machine (read-only, nothing executed)…

  ✓ PATH + install dirs    3 agents found
  ✓ zsh config chain       2 wrapper profiles traced (~/Profiles, 6 files)
  ✓ agent configs          claude: 2 settings profiles, 1 pinned model env

Agents
  NAME     BINARY                     VERSION   VIA
  claude   ~/.local/bin/claude        2.1.227   PATH
  gemini   /opt/homebrew/bin/gemini   0.44.0    PATH
  codex    ~/.cargo/bin/codex         0.146.0   PATH

Wrapper profiles  (parsed from zsh source — never executed)
  NAME  WRAPS    INJECTS                                SOURCE
  co    claude   model opus, skip-permissions           ~/Profiles/functions/co.zsh:12
  cf    claude   persona "fast", model sonnet           ~/Profiles/functions/cf.zsh:8

  ⚠ co injects --dangerously-skip-permissions. Council seats run read-only by default; this flag is stripped in council runs unless you opt in per-council.

Keep all 5? [Y]es / [e]dit / [s]kip some: y

Registry written to ~/.config/krosval/registry.toml  (plain file — edit any time)

Default council quorum proposed
  seats: claude · gemini · codex        chairman: claude
  (wrappers co/cf registered but not seated — add with `krosval council edit quorum`)
Accept? [Y/n]: y

Ready. Try:  krosval ask "your question"

```

</details>

<details>
<summary><strong>Scene 2 — ask: full deliberation, happy path</strong></summary>

```text
$ krosval ask "Should krosval store transcripts as JSONL files or in SQLite?"

council quorum · mode consensus-seeker · 4 seats · chairman claude · deliberation d-0811-a3f2

▶ 1/4 gathering  4 seats, parallel, tools read-only
  ~ claude   working             0s
  ~ co       working             0s
  ~ gemini   working             0s
  ~ codex    working             0s
  …
  ✓ claude   done    1.9k tok   41s
  ✓ co       done    1.2k tok   55s
  ✓ gemini   done    2.1k tok   34s
  ✓ codex    done    3.4k tok   62s

▶ 2/4 peer review  answers anonymized as Response A–D · reviewers see no names · tools off
  ~ claude   working             0s
  ~ co       working             0s
  ~ gemini   working             0s
  ~ codex    working             0s
  …
  ✓ claude   done    1.9k tok   31s
  ✓ co       done    1.2k tok   31s
  ✓ gemini   done    2.1k tok   24s
  ✓ codex    done    3.4k tok   24s
  4/4 ballots in — rankings + per-answer critiques, self-review included

▶ 3/4 synthesis  chairman claude · inputs: all answers + all ballots, still anonymized

  Store transcripts as append-only JSONL, one file per deliberation. Every
  reviewer independently valued crash-safety of an appendable log over
  query power; the strongest dissent (Response D) wants SQLite for
  history search — satisfiable later as a derived index without changing
  the record format. Recommendation: JSONL now, optional index post-v1.

▶ 4/4 confidence  computed from ballots — no extra model pass

┌─ consensus ────────────────────────────────────────────────────────────────┐
│ confidence   HIGH  0.82                                                    │
│                                                                            │
│ agreed       JSONL append-only record        4/4                           │
│              one file per deliberation       4/4                           │
│ disputed     search needs SQLite index       D vs rest                     │
│                                                                            │
│ peer scores  A 8.7 · B 7.9 · C 6.4 · D 8.1   (mean of others' ballots)     │
│ seats        A=codex B=claude C=co D=gemini  revealed post-review          │
└────────────────────────────────────────────────────────────────────────────┘

transcript ~/.local/share/krosval/transcripts/d-0811-a3f2.jsonl   replay: krosval show d-0811-a3f2
elapsed 3m12s · est. cost $0.14 (claude seats only — others don't report cost)

```

</details>

<details>
<summary><strong>Scene 3 — one seat times out mid-council</strong></summary>

```text
$ krosval ask "Should krosval store transcripts as JSONL files or in SQLite?"

council quorum · mode consensus-seeker · 4 seats · chairman claude · deliberation d-0811-a3f2

▶ 1/4 gathering  4 seats, parallel, tools read-only
  ~ claude   working             0s
  ~ co       working             0s
  ~ gemini   working             0s
  ~ codex    working             0s
  …
  ✓ claude   done    1.9k tok   41s
  ✓ co       done    1.2k tok   55s
  ✗ gemini   timeout 0.8k tok        budget 120s exhausted
  ✓ codex    done    3.4k tok   62s

  ⚠ gemini hit the 120s stage budget — seat dropped for this deliberation.
    quorum rule: 3 of 4 seats ≥ minimum 2 — council continues without it.

▶ 2/4 peer review  answers anonymized as Response A–C · reviewers see no names · tools off
  ~ claude   working             0s
  ~ co       working             0s
  ~ codex    working             0s
  …
  ✓ claude   done    1.9k tok   31s
  ✓ co       done    1.2k tok   31s
  ✓ codex    done    3.4k tok   24s
  3/3 ballots in — rankings + per-answer critiques, self-review included

▶ 3/4 synthesis  chairman claude · inputs: all answers + all ballots, still anonymized

  Store transcripts as append-only JSONL, one file per deliberation. Every
  reviewer independently valued crash-safety of an appendable log over
  query power; the strongest dissent (Response C) wants SQLite for
  history search — satisfiable later as a derived index without changing
  the record format. Recommendation: JSONL now, optional index post-v1.

▶ 4/4 confidence  computed from ballots — no extra model pass

┌─ consensus ────────────────────────────────────────────────────────────────┐
│ confidence   HIGH  0.84   (3 seats — quorum, not full council)             │
│                                                                            │
│ agreed       JSONL append-only record        3/3                           │
│              one file per deliberation       3/3                           │
│ disputed     search needs SQLite index       C vs A,B                      │
│                                                                            │
│ peer scores  A 8.7 · B 8.1 · C 6.9           (mean of others' ballots)     │
│ seats        A=codex  B=claude  C=co         revealed post-review          │
│ dropped      gemini — timeout in gathering   ✗                             │
└────────────────────────────────────────────────────────────────────────────┘

transcript ~/.local/share/krosval/transcripts/d-0811-a3f2.jsonl   replay: krosval show d-0811-a3f2
elapsed 3m12s · est. cost $0.14 (claude seats only — others don't report cost)

```

</details>

<details>
<summary><strong>Scene 4 — observatory: faked tmux split</strong></summary>

```text
$ krosval ask --observe "Should krosval store transcripts as JSONL files or in SQLite?"
  observatory: tmux detected — 4 panes + status bar (presentation only; engine is headless)

┌───────────────────────────────────────┬───────────────────────────────────────┐
│ claude [working] ·····················│ co [working] ·························│
│ Reading question + context…           │ Considering the audit-trail persona.  │
│ JSONL: append-only, crash-safe,       │ A cautious tech lead wants records    │
│ greppable. SQLite adds query power    │ that survive partial writes. JSONL    │
│ but a binary format for an audit      │ prefix stays valid after a crash.     │
│                                       │                                       │
├───────────────────────────────────────┼───────────────────────────────────────┤
│ gemini [working] ·····················│ codex [done] ·························│
│ Comparing: SQLite gives indexed       │ grep-ability matters: users will      │
│ history search and concurrent reads.  │ pipe transcripts into jq. One file    │
│ JSONL needs a scan per query. For     │ per deliberation keeps blast radius   │
│ v1 volume (<10k records) scan is fine.│ small. Recommend JSONL + index later. │
│                                       │                                       │
└───────────────────────────────────────┴───────────────────────────────────────┘
[krosval] d-0811-a3f2 · stage 1/4 gathering · 3 working 1 done · 0:52

panes close when the deliberation ends; add --keep-panes to leave them for scrollback.
same run, no terminal integration → falls back to the inline seat table (scene: ask).

```

</details>

<details>
<summary><strong>Scene 5 — --json event stream sketch</strong></summary>

```text
$ krosval ask --json "Should krosval store transcripts as JSONL files or in SQLite?" | jq -c .event
  (NDJSON on stdout, one event per line — sketch of the machine interface)

  {"event":"deliberation.start","id":"d-0811-a3f2","council":"quorum","mode":"consensus-seeker","seats":4}
  {"event":"stage.start","stage":"gather","n":1,"of":4}
  {"event":"seat.status","seat":"gemini","status":"working"}
  {"event":"seat.delta","seat":"gemini","text":"Comparing: SQLite gives indexed…"}
  {"event":"seat.result","seat":"gemini","status":"done","tokens":2140,"duration_s":34}
  {"event":"stage.end","stage":"gather","ok":4,"failed":0}
  {"event":"stage.start","stage":"review","n":2,"of":4}
  {"event":"ballot.received","reviewer_label":"B","ranking":["A","B","D","C"]}
  {"event":"stage.start","stage":"synthesize","n":3,"of":4,"chairman":"claude"}
  {"event":"synthesis.delta","text":"Store transcripts as append-only…"}
  {"event":"stage.start","stage":"confidence","n":4,"of":4}
  {"event":"consensus","confidence":0.82,"band":"high","agreed":2,"disputed":1}
  {"event":"deliberation.end","id":"d-0811-a3f2","transcript":"~/.local/share/krosval/transcripts/d-0811-a3f2.jsonl"}

same event stream feeds observatory panes and the transcript — one vocabulary everywhere.

```

</details>
