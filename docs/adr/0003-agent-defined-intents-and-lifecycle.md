# ADR-0003: Agent-defined intents and their lifecycle

- **Status:** Accepted
- **Date:** 2026-10-22

## Context

An "intent" could be bounded by a turn, a session, or a commit. None of these match how agents actually work: a session can produce several commits, a commit can mix several sessions, and the intent exists before any commit does.

## Decision

- **The agent decides** what constitutes an intent, and attaches code to it as many times as it wants.
- **Humans may also declare intents** (`vermeil intent add`). This is optional.
- An intent may span **several commits**: it stays *open* as long as code keeps being attached to it.
- Lifecycle:

```
draft ──(post-commit)──► attached ──(push)──► published
(local journal)          (local ref)          (remote ref)
```

- **One line belongs to exactly one intent.** If a line is rewritten, the last write wins.

## Consequences

- Intent granularity depends on the agent's judgement. Guardrails (warning on catch-all intents or micro-intents) will be calibrated from prototype data.
- Because an intent can span commits, its line attributions cannot live inside the intent file (see ADR-0014).
- Before the first push, drafts are freely mutable; after it, changes require revisions (ADR-0010).

## Alternatives considered

- **One intent per turn / per session / per commit**: rejected, too rigid.
- **Several intents per line**: rejected, harder to display and to verify.
