# krosval

> Convene the AI coding agents already on your machine into a deliberating council. One question fans out to every agent in parallel; the answers are anonymized and peer-reviewed by the agents themselves; a chairman synthesizes one answer with a confidence/consensus readout of where they agree and where they diverge.

**Why the name?** krosval reads as *cross-validation* — many independent folds cross-checking into one validated, confidence-scored result. That's the council in a word.

**Status:** Pre-build discovery. The product is being specced with the [Wayfinder](https://github.com/mattpocock) method — a shared map of investigation tickets resolved one at a time until the way to a decision-complete v1 spec is clear.

- **[PID.md](PID.md)** — Project Initiation Document: the living v1 spec (vision, scope, requirements, architecture, decisions log).
- **[wayfinder/map.md](wayfinder/map.md)** — the canonical index of decisions made and open tickets.
- **[wayfinder/tickets.md](wayfinder/tickets.md)** — the ticket bodies (T01–T12).
- **[wayfinder/naming-history.md](wayfinder/naming-history.md)** — how the name was chosen.

## Tracker

Discovery tickets live as GitHub issues on this repo (labels `wayfinder:map`, `wayfinder:{research,prototype,grilling,task}`). To (re)generate them from the markdown, run:

```bash
cd wayfinder
gh auth status                      # ensure gh is authenticated
./import-to-github.sh amit-t/krosval
```

Once issues exist, they are the tracker of record; the markdown in `wayfinder/` is the seed/history.

## What krosval is not (v1)

No GUI (a later layer sits on this engine), no provider-API keys (members are your local CLI agents), no server/accounts/telemetry (local-first), no Windows yet (macOS + Linux first).

---

*Discovery in progress. Build (M1+) begins when the map says the way is clear.*
