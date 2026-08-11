# Deliberation protocol — v1

Canonical record of how a council deliberates and what gets written down. Resolves [T08 / #9](https://github.com/amit-t/krosval/issues/9); grounded in the adapter contract ([T04](../ai/wayfinder/assets/T04-agent-contracts.md)). Decision provenance: `.grills/2026-08-11-1459-deliberation-protocol-deep.md`.

Name-agnostic: no product branding in schemas, record types, or file formats. Schemas are TypeScript interfaces; the transcript is the compatibility surface and carries its own `format`/`version`.

## 1. Glossary (protocol terms)

| Term | Definition |
|---|---|
| Seat | One occupied council slot: member (agent + profile) + optional role + per-seat policy. Atomic unit of invocation, anonymization, failure isolation, and cost accounting. |
| Envelope | The complete prompt payload one seat receives for one stage invocation. Always prompt-embedded (no portable system-prompt flag exists across agents). |
| Recipe | Declarative pipeline config filling the protocol's slots: per-stage prompt template, seat roles/filter, tool policy, timeout. Modes are shipped recipes (T11). |
| Ballot | One reviewer's structured judgment of all anonymized answers: ranking + per-criterion scores + critiques. |
| Label | A seat's anonymous handle within one deliberation (`Response A`, `B`, …). |
| Quorum | Minimum valid outputs for a stage barrier to pass. |
| Consensus card | End-of-run agreement/dispute/confidence artifact. |
| Transcript | Append-only JSONL record of one deliberation. |

## 2. Pipeline shape

```
preflight → gather ‖ → [anonymize] → review ‖ → synthesis → confidence → render
```

- Stages are strict barriers: review needs all answers, synthesis needs all ballots.
- Within gather and review, seats run in parallel (uncapped by default; configurable cap).
- Anonymize and confidence are engine computations, not seat invocations.
- The engine enforces every timeout and budget — no target CLI has a reliable wall-clock flag.
- Seat success is read from the parsed terminal event, never exit codes. Missing terminal event = aborted.

### Configuration precedence

`user config (if set) > recipe/seat value > built-in default`. A set user-config key overrides recipe and seat values (decision Q2/Q4/Q10). Keys defined in §10.

## 3. Preflight

Every seat is probed before stage 1 (`probe()` per adapter contract): binary present, version parsed, auth healthy — under a timeout (Gemini blocks forever on expired auth). A seat failing probe is benched before the deliberation starts, not mid-run. Benching triggers the gather quorum rule (§4) immediately.

## 4. Stage 1 — Gathering

Every seat answers the question independently; no seat sees another's output.

- **Envelope** (assembled from the recipe's gather template):
  1. Role framing — the seat's hat ("You are the security expert on…").
  2. Process framing — full transparency: the seat is told it sits on a multi-agent council and its answer will be anonymously peer-reviewed (Q3).
  3. Identity rule — "do not identify your vendor, model, or product in the answer."
  4. Shared context — file/stdin content **inlined in full**; identical bytes to every seat (Q1). No paths-only delivery: evidence must survive into the tools-off review stage.
  5. The question.
- **Tool policy:** default `readOnly` (Q2). Config may set `auto` (full agentic) or pin hard `readOnly`. Wrapper-injected permission flags (e.g. `--dangerously-skip-permissions`) are overridden down to the effective stage policy by the adapter.
- **Timeout:** 10 min per seat (recipe-overridable; user config wins).
- **Sessions:** each seat's session id is captured from its earliest event and recorded; review does not resume it (§6) but the id remains in the transcript for audit.
- **Quorum (barrier):** default **all seated answers or abort** (Q4). Config may relax to `atLeast: 2` or `majority`. On abort, the transcript records everything gathered plus the abort reason; partial results render with a prominent failure notice. When relaxed, failures are annotated in output, card, and transcript.

## 5. Anonymization

Engine computation between gather and review.

- **Labels:** uniform random permutation of seats → `Response A…N`, drawn per deliberation, stable through stages 2–4. Mapping recorded in the transcript header (resolved storage, §9).
- **Scrub:** deterministic regex pass over gathered answers removing vendor/model/product names (curated list: agent names, model families, product strings), applied before any answer enters a review or synthesis envelope. Scrub hits are recorded as annotations. No LLM scrub pass in v1 — style-level tells are out of scope.
- Self-identifying text that survives regex (writing style) is accepted residual risk; fresh-invocation review (§6) keeps the self-recognition surface small.

## 6. Stage 2 — Review

Anonymous peer cross-examination. Each reviewer judges **all** answers, own included (Q7).

- **Invocation:** fresh call per reviewer — never a resumed gathering session (Q6). Anonymity beats retained context; failed gatherers may still review (reviewer set = seats healthy at stage-2 start).
- **Reviewer set:** all seats, chairman included (Q11 — chairman gathers and reviews like any member).
- **Envelope:** reviewer framing + identity rule + shared context (same inlined bytes) + all labeled, scrubbed answers + ballot schema instructions.
- **Tool policy:** `none` where supported (claude `--tools ""`, gemini policy deny-all); `readOnly` floor on codex (cannot disable shell) with a transcript annotation.
- **Timeout:** 5 min per reviewer.
- **Ballot capture:** native structured output where available (claude `--json-schema`, codex `--output-schema`); prompt-embedded JSON schema elsewhere. Extraction: parse terminal-event text → fenced-JSON scan → exactly one repair reprompt with the parse error. Still unparseable → drop ballot, annotate seat (Q9).
- **Quorum (barrier):** ≥1 valid ballot proceeds; ballot coverage is disclosed on the card. Zero valid ballots → synthesis still runs, card marked `unreviewed`.

### Ballot schema (Q8 = ranking + scores + critique; Q8a criteria)

```ts
interface Ballot {
  reviewer: string;                  // label of the reviewing seat ("A"), resolved via transcript map
  ranking: string[];                 // labels, best first, covering every response incl. self
  responses: Array<{
    label: string;                   // "A" | "B" | …
    scores: {                        // integers 1–10
      accuracy: number;
      completeness: number;
      clarity: number;
      practicality: number;
    };
    critique: string;                // free text, per response
  }>;
}
```

Validation: ranking must be a permutation of all labels; every label must appear in `responses`; scores clamp to 1–10. Violations count as parse failures (repair path).

## 7. Stage 3 — Synthesis

The chairman aggregates answers + ballots into the final integrated answer.

- **Chairman selection:** fixed per council config (Q10). Config may switch policy to `rotating` (round-robin across deliberations) or `strongestRanked` (winner of §8 peer ranking synthesizes — adds a review→chairman dependency).
- **Inputs — anonymized only** (Q12): question + shared context + labeled scrubbed answers (chairman's own among them, unmarked) + all valid ballots. Identities resolve only at render time.
- **Output contract (Q14 = C):** the synthesis call returns structured output:

```ts
interface SynthesisOutput {
  synthesis: string;                 // the integrated final answer (markdown)
  agreements: string[];             // semantic points where responses concur
  disputes: Array<{
    point: string;                   // what is contested
    positions: Array<{labels: string[]; stance: string}>;
  }>;
}
```

  Captured with the same native-schema / fenced-JSON / one-repair strategy as ballots. If structure fails after repair, the raw text is kept as `synthesis` and `agreements`/`disputes` fall back to score-divergence flags from §8 math (annotated).
- **Timeout:** 5 min.
- **Failure (Q13):** fallback chain — next healthy seat in council order becomes chairman, annotated in card and transcript. Chain exhausted → render answers + ballots + card without synthesis, marked `unsynthesized`.

## 8. Stage 4 — Confidence

Engine computation; no seat invocation beyond §7's structured output.

Deterministic math over valid ballots:

- **Per-response:** mean and standard deviation per criterion and overall; full score matrix retained (self-diagonal identifiable via the label map, so it can be discounted in later tuning).
- **Rank agreement:** Kendall's W across reviewer rankings.
- **Confidence level (v1 heuristic):** `high` W ≥ 0.7, `medium` 0.4 ≤ W < 0.7, `low` W < 0.4; degraded one level when ballot coverage < 100% of reviewers. Thresholds are constants in the card, not hidden.

### Consensus card schema

```ts
interface ConsensusCard {
  confidence: "high" | "medium" | "low";
  rankAgreement: number;             // Kendall's W, 0–1
  coverage: {
    seatsConfigured: number; answered: number; ballotsValid: number;
    annotations: string[];           // benched seats, dropped ballots, degradations, scrub hits
  };
  perResponse: Array<{
    label: string;
    seat: string;                    // resolved seat name (render-time join from transcript map)
    meanScores: {accuracy: number; completeness: number; clarity: number; practicality: number; overall: number};
    stdDev: number;
    rankPositions: number[];         // position per reviewer ranking
  }>;
  agreements: string[];              // from SynthesisOutput
  disputes: Array<{point: string; positions: Array<{labels: string[]; stance: string}>}>;
  flags: Array<"unreviewed" | "unsynthesized" | "quorumRelaxed" | "fallbackChairman" | "toolPolicyFloor">;
}
```

## 9. Transcript

Append-only JSONL, one file per deliberation, written live — a crash leaves a valid replayable prefix. Full granularity (Q15): envelopes, every normalized seat event including tool use, raw terminal payloads, ballots, synthesis, card.

Identities are stored **resolved**; anonymized views are derived at read time via the header's label map. `show`/replay renders purely from the file — no engine state.

### Record types

Every line: `{seq, ts, type, ...}` — monotonic `seq`, ISO-8601 `ts`.

```ts
type TranscriptRecord =
  | {type: "header"; format: "council-transcript"; version: 1;
     deliberationId: string;         // ULID
     question: string; contextDigest: {files: Array<{path: string; bytes: number; sha256: string}>};
     council: {name: string; seats: SeatSnapshot[]; chairman: string; recipe: string};
     labelMap: Record<string, string>;      // label → seat id (resolved storage)
     config: Record<string, unknown>}       // effective config incl. precedence source per key
  | {type: "envelope"; stage: Stage; seat: string; body: string}
  | {type: "seat_event"; stage: Stage; seat: string; event: SeatEvent}   // normalized adapter event (T04)
  | {type: "answer"; seat: string; label: string; text: string; scrubbed: string;
     usage?: Usage; costUsd?: number; sessionId: string}
  | {type: "ballot"; seat: string; ballot: Ballot; repairUsed: boolean}
  | {type: "synthesis"; seat: string; output: SynthesisOutput; fallbackDepth: number}
  | {type: "card"; card: ConsensusCard}
  | {type: "annotation"; stage: Stage; seat?: string;
     kind: "benched" | "timeout" | "ballotDropped" | "scrubHit" | "toolPolicyFloor"
         | "quorumRelaxed" | "fallbackChairman" | "aborted"; detail: string}
  | {type: "end"; outcome: "completed" | "aborted"; durationMs: number;
     totals: {usage: Usage; costUsd?: number}};

type Stage = "preflight" | "gather" | "review" | "synthesis";
interface SeatSnapshot {id: string; agent: string; version: string; profile?: string;
                        role?: string; toolPolicy: string}
interface Usage {inputTokens: number; outputTokens: number; cachedTokens?: number}
```

`seat_event` records embed the adapter's `raw` terminal payload inside `SeatEvent.result` untouched — forensic ground truth per T04.

Schema evolution: `version` bumps on breaking change; readers must ignore unknown record types and unknown fields (same forward-compat rule adapters apply to agent streams).

## 10. Configuration keys (protocol-owned)

| Key | Default | Values |
|---|---|---|
| `gather.toolPolicy` | `readOnly` | `auto` \| `readOnly` \| `readOnlyLocked` |
| `gather.quorum` | `all` | `all` \| `majority` \| `{atLeast: n}` (n ≥ 2) |
| `timeout.gatherMs` | 600 000 | int |
| `timeout.reviewMs` | 300 000 | int |
| `timeout.synthesisMs` | 300 000 | int |
| `chairman.selection` | `fixed` | `fixed` \| `rotating` \| `strongestRanked` |
| `concurrency.maxSeats` | unlimited | int |

Set keys override recipe/seat values; unset keys defer to recipe, then defaults (§2).

## 11. Failure model summary

| Failure | Detection | Handling |
|---|---|---|
| Seat fails probe | probe timeout/error | Benched pre-run; counts against gather quorum |
| Seat fails/times out in gather | terminal event / engine timer | Default: abort (quorum `all`); relaxed: proceed + annotate |
| Seat fails in review | terminal event / timer | Ballot dropped, annotated; ≥1 valid ballot proceeds |
| Ballot unparseable | schema validation | One repair reprompt → drop + annotate |
| Zero valid ballots | barrier check | Synthesis runs; card flagged `unreviewed` |
| Chairman fails | terminal event / timer | Fallback chain in council order; exhausted → `unsynthesized` |
| Engine crash mid-run | — | Transcript prefix valid; deliberation not resumable in v1 |
| Cancellation (user) | SIGTERM→grace→SIGKILL per adapter | Partial results recovered where the agent flushes (claude); transcript `end.outcome: "aborted"` |

## 12. Feeds forward

- **T11 (modes):** recipes fill the slots defined here (per-stage template, roles, tool policy, timeout). Open item inherited from FR-11: whether Debate needs stage repetition — the v1 spine is rigid; T11 decides if a `rounds` slot is worth a protocol amendment.
- **T12 (observatory):** presentation layer over `seat_event` records; nothing here depends on it.
- **T14 (adapter SDK):** ballot/synthesis structured-output capture and the scrub/override behaviors in §4–§7 become contract-test cases.
- **T10 (registry):** `SeatSnapshot` fields are the registry's per-seat minimum.
- Cost/latency budgeting, persistence/recall UX, security posture details: graduated to their own tickets on the map.
