# ADR-0017: Terminology — journal and intent store

- **Status:** Accepted
- **Date:** 2026-10-22

## Context

The local raw capture already has a name (the *journal*), but the shared storage was only referred to as "the ref" (`refs/vermeil/intents`), which is technical and unclear. Earlier ADRs also mix storage locations with intent states.

## Decision

Name the shared storage the **intent store**, and keep storage locations distinct from intent states.

### Storage locations

| Name | What it is | Shared |
|---|---|---|
| **Journal** | Local raw capture in `.git/vermeil/journal/`: prompts, hook events, snapshots, draft intents and draft attributions | Never |
| **Intent store** | The ref `refs/vermeil/intents`: filtered, append-only data (intents, revisions, prompts, attributions). Exists locally and on the remote | Yes, once pushed |

### Intent states (ADR-0003)

| State | Lives in |
|---|---|
| **draft** | Journal |
| **attached** | Local intent store |
| **published** | Remote intent store |

## Consequences

- "The ref" in ADR-0007 to ADR-0016 means the intent store.
- CLI commands and docs use "intent store" from now on.

## Alternatives considered

`ledger`, `codex`, `register`, `chronicle`, `logbook`, `manifest`, `vault`: rejected in favour of the most explicit, self-describing name. Names colliding with Git vocabulary (`log`, `index`) were excluded.
