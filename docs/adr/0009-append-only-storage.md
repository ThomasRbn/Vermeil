# ADR-0009: Append-only storage and conflict-free merging

- **Status:** Accepted
- **Date:** 2026-10-22

## Context

Several people push to the same ref. Even with one file per intent, conflicts could appear if two people modified the same file: concurrent revisions of an intent, or an index written for the same commit after a cherry-pick or rebase.

## Decision

- Once published, a file is **never modified**: data is only **added**.
- Before the first push, drafts are freely mutable (they are local).
- Every shared file has a unique name: ULID for intents, revisions and prompts; commit SHA for attributions (ADR-0014). Revisions are separate files (ADR-0010).
- A rejected push (non-fast-forward) is handled automatically by the CLI: fetch → union of both trees → push.
- Two concurrent revisions of the same intent are both kept and flagged.

## Consequences

- File-level conflicts are impossible by construction.
- Merging two versions of the ref is a simple tree union.
- Data can only be removed by deliberately rewriting the ref history (e.g. privacy purge).
