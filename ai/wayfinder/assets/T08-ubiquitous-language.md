# T08 — Ubiquitous language sheet

Working glossary for the deliberation protocol ([T08 / #9](https://github.com/amit-t/krosval/issues/9)). T08 resolved 2026-08-11 — canonical definitions now live in [`docs/protocol.md`](../../../docs/protocol.md) §1; this sheet is the session record. All terms settled.

## Cast

- **Agent** — an installed CLI binary invocable headlessly (`claude`, `gemini`, `codex`). The executable, nothing more.
- **Profile** — a reusable, named configuration of an agent: a wrapper (`co`, `cf` — argv prefix + env map, per T04) or a native config variant. Lives in the registry (T10). Not yet placed anywhere.
- **Seat** — **one occupied slot in a council**: member (agent + profile) + optional role + per-seat policy (tools, timeouts). Atomic unit of invocation (one subprocess per stage, owns its session id), anonymization (one label), failure isolation/quorum, and cost accounting. Same agent can hold multiple seats via different profiles; same profile can sit in many councils. Parliament analogy: person = agent, party card = profile, chair in chamber = seat.
- **Role** — the framing attached to a seat ("Security expert", "Devil's Advocate"). Prompt-level hat, not a config change.
- **Chairman** — the distinguished seat that performs synthesis. Fixed per council, config-switchable to rotating/strongest-ranked (Q10=A+config); gathers and is reviewed like any member (Q11=A); sees anonymous labels only (Q12=A); failure → fallback chain (Q13=A).
- **Council** — named, persistent set of seats + recipe + chairman assignment.

## Process

- **Deliberation** — one full pipeline run for one question.
- **Recipe** — **declarative pipeline configuration**: which stages run, and per stage — prompt template, seat roles/filter, tool policy, timeout. Recipe controls the slots; protocol fixes the invariants (stage skeleton + barriers, ballot schema, anonymization rules, transcript schema, quorum semantics). T08 defines the slots, T11 the file format; user-definable (FR-17).
- **Mode** — **a named, shipped recipe** — content written in the recipe format, zero special engine code. Built-ins = the four reference flavors: Devil's Advocate (one seat attacks all answers), Expert Panel (assigned specialist roles), Debate (adversarial framing), Consensus Seeker (push toward agreement). `--mode debate` = load built-in recipe "debate". Open T11 tension: FR-11 mentions stage *ordering* changes (Debate rounds?) vs the rigid four-stage spine assumed in grill auto 15.
- **Stage** — one barrier-separated pipeline step: gather ‖ → review ‖ → synthesis → confidence.
- **Envelope** — **the complete prompt payload one seat receives for one stage invocation.** Assembled from recipe template slots: role framing + process framing + shared context + stage content (question / anonymized answers + ballot schema / answers + ballots). One envelope per seat per stage; within a stage, envelopes differ only in role framing — identical evidence for all. Always prompt-embedded, never system-prompt flags (Gemini has none — T04). Stored verbatim in transcript. Not the `InvokeRequest`: envelope = what the seat reads; InvokeRequest = envelope + launch params (cwd, env, session, toolPolicy, timeout).
- **Review** — **stage 2: anonymous peer cross-examination.** Each reviewer seat judges all gathered answers under labels and returns a ballot. Fresh invocation, never session resume (Q6=A); self-review included (Q7=A); chairman reviews too (Q11=A); failed gatherers may still review. Tools off where supported (readOnly floor on codex).
- **Reviewer** — a seat acting in its stage-2 capacity.
- **Ballot** — one reviewer's structured judgment covering the whole answer set, self included (Q7=A): ranking + per-criterion scores (accuracy, completeness, clarity, practicality, 1–10) + per-response critique (Q8=C, Q8a=A). Native structured output where available, one repair reprompt, drop + annotate on failure (Q9=A).
- **Critique** — the per-answer free-text component inside a ballot.
- **Label** — a seat's anonymous handle within one deliberation (Response A/B/…); random permutation, stable stages 2–4; map stored in transcript header.
- **Quorum** — minimum valid outputs for a stage barrier to pass. Gather: all-or-abort default, config-relaxable to ≥2/majority (Q4=C+config). Review: ≥1 valid ballot, card discloses coverage (Q9=A).
- **Consensus card** — end-of-run artifact: deterministic ballot math (per-response score stats, Kendall's-W rank agreement, confidence level) + semantic agreement/dispute lists from the synthesis call (Q14=C). Schema: protocol.md §8.
- **Transcript** — append-only JSONL record of one deliberation, written live; full granularity incl. tool events and raw payloads (Q15=A); stores resolved identities + label map, anonymized views derived. Schema: protocol.md §9.

## Runtime

- **Session** — an agent-side conversation id a seat carries across stages (resume/fork semantics per T04).
- **Registry** — local record of discovered agents + profiles (T10's design).
- **Member** — informal shorthand for the agent+profile pair occupying a seat; prefer "seat" in spec text.
