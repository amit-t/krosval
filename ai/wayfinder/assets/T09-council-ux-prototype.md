# T09 — Council session CLI UX prototype

Ticket: [T09 / #10](https://github.com/amit-t/krosval/issues/10) · Status: **grill answered 2026-08-17, revised; Q3 (stage-header notes) pending** · Prototype: [`T09-prototype/demo.ts`](T09-prototype/demo.ts)

Fake-data walkthrough of the full krosval terminal experience — no engine, no agents, every byte scripted. Purpose: fix vocabulary and information hierarchy ahead of T12 (observatory) — T08 (protocol) resolved in parallel; this prototype matches its outcomes (ballots = rankings + scores, quorum configurable, chairman gathers too).

## Run it

```sh
cd ai/wayfinder/assets/T09-prototype
bun demo.ts                    # all five scenes, paced like a real run
bun demo.ts --scene ask        # first-run | ask | failure | observatory | json
bun demo.ts --fast --plain     # instant, no ANSI (what the captures below show)
```

Animated mode adds per-seat spinners, in-place seat-table redraws, and token-streaming synthesis — run it in a real terminal; captures below flatten that.

## UX decisions (grill `.grills/2026-08-11-1540-council-ux-deep.md`, answered 2026-08-17)

1. **Progress idiom: live seat table per stage** — one row per seat (spinner/state, tokens, elapsed), redrawn in place. No progress bars.
2. **Rolling preview per seat row** *(changed from hidden-by-default)* — working seats show a one-line dim snippet of their latest output; `-v` still interleaves full streams.
3. **Stage header `▶ n/4 <name>` + mechanics note** — always vs first-runs-only **pending (Q3)**; prototype shows always.
4. **Identity reveal in consensus card by default**; `--no-reveal` hides. Anonymity lifted only post-review.
5. **Peer scores: rank order + scores** — matches T08's ballot format (ranking + per-criterion 1–10).
6. **Confidence: word + number** (`HIGH 0.82`); computation per T08 (deterministic ballot math + synthesis agreement lists).
7. **Synthesis streams live**; prettified render in `krosval show`.
8. **Dropped seat: one card row + ⚠ banner at failure time**; partial output lives in the transcript.
9. **First-run: bulk confirm** `[Y]es/[e]dit/[s]kip`; wrappers registered, not auto-seated (provider diversity).
10. **Verbosity ladder: `-q` final-only · default seat tables · `-v` full streams.**
11. **Observatory: first-run consent question, then auto-on in Tier-1 terminals** *(changed from opt-in flag)* — per-run `--no-observe`, config flip `krosval config observatory off`. Panes close at end; `--keep-panes` retains.
12. **Deliberation id: `d-MMDD-xxxx`** date + short hash, prefix-matchable.
13. **`--json`: NDJSON event stream** — same vocabulary as transcript + observatory feed (schema fixed by T08).
14. **Trailer: transcript path + replay command + elapsed + honest cost line** (only claude reports cost — T04).

## Scene captures (`--fast --plain`)

<details>
<summary><strong>Scene 1 — first run: discovery interview + observatory consent</strong></summary>

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

Observatory — tmux detected (also supported: cmux, herdr, iTerm2, Ghostty)
  krosval can mirror each seat's live stream into panes while a council runs.
Mirror automatically in supported terminals? [Y/n]: y
  auto-on saved. Per-run opt-out: krosval ask --no-observe · flip later: krosval config observatory off

Ready. Try:  krosval ask "your question"

```

</details>

<details>
<summary><strong>Scene 2 — ask: full deliberation, happy path</strong></summary>

```text
$ krosval ask "Should krosval store transcripts as JSONL files or in SQLite?"

council quorum · mode consensus-seeker · 4 seats · chairman claude · deliberation d-0811-a3f2

▶ 1/4 gathering  4 seats, parallel, tools read-only
  ~ claude   working             0s  Reading question + context…
  ~ co       working             0s  Considering the audit-trail persona.
  ~ gemini   working             0s  Comparing: SQLite gives indexed
  ~ codex    working             0s  grep-ability matters: users will
  …
  ✓ claude   done    1.9k tok   41s
  ✓ co       done    1.2k tok   55s
  ✓ gemini   done    2.1k tok   34s
  ✓ codex    done    3.4k tok   62s

▶ 2/4 peer review  answers anonymized as Response A–D · reviewers see no names · tools off
  ~ claude   working             0s  Scoring Response A: accuracy 9…
  ~ co       working             0s  Response B strongest on audit needs…
  ~ gemini   working             0s  Response A cites jq pipelines — apt…
  ~ codex    working             0s  Comparing B and D on query power…
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
  ~ claude   working             0s  Reading question + context…
  ~ co       working             0s  Considering the audit-trail persona.
  ~ gemini   working             0s  Comparing: SQLite gives indexed
  ~ codex    working             0s  grep-ability matters: users will
  …
  ✓ claude   done    1.9k tok   41s
  ✓ co       done    1.2k tok   55s
  ✗ gemini   timeout 0.8k tok        budget 120s exhausted
  ✓ codex    done    3.4k tok   62s

  ⚠ gemini hit the 120s stage budget (recipe override) — seat dropped for this deliberation.
    quorum: this council sets min_seats 2 — 3/4 satisfies it, continuing. (default: all seats required — abort)

▶ 2/4 peer review  answers anonymized as Response A–C · reviewers see no names · tools off
  ~ claude   working             0s  Scoring Response A: accuracy 9…
  ~ co       working             0s  Response B strongest on audit needs…
  ~ codex    working             0s  Comparing B and D on query power…
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
<summary><strong>Scene 4 — observatory: faked tmux split (auto-on)</strong></summary>

```text
$ krosval ask "Should krosval store transcripts as JSONL files or in SQLite?"
  observatory auto-on (tmux, consented at first run) — 4 panes + status bar · opt out: --no-observe (presentation only; engine is headless)

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
