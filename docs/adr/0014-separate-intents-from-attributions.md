# ADR-0014: Separate intents from attributions

- **Status:** Accepted
- **Date:** 2026-10-22

## Context

Two decisions conflict if line references are stored inside intent files:

- an intent can span several commits (ADR-0003);
- a published file is never modified (ADR-0009).

If intent A is pushed with commit 1 and new lines are attached to A in commit 2, A's file would have to change.

## Decision

Store two kinds of data, related by intent ID (like a foreign key):

| Data | Content | Written | File |
|---|---|---|---|
| **Intent** | The *why*: request, description, decisions, assumptions… **No line references.** | At creation, then through revisions | `intents/YYYY/MM/<ulid>.json` |
| **Attribution** | The *where*: added lines (commit coordinates) and deleted lines (parent coordinates) → intent, provenance, status | Once, at `post-commit` | `attributions/<sha>.json` |

- Draft attributions live in the local journal (snapshot coordinates) and are projected at `post-commit` (ADR-0005).
- Local state (open, dormant) stays in the journal.

## Consequences

- New lines on an existing intent → a new attribution file; the intent is untouched.
- A rebase → new attribution files (new SHAs); intents are untouched.
- A revision does not touch attributions, and a commit does not touch intents.
- Reviewing a PR: list its commits → read their attributions → group lines by intent → load the intents. Fast, since a PR has few commits.
- The reverse question over the whole history ("where are all the lines of intent A?", needed for an intent blame) requires scanning attributions; a **recomputable local cache** will serve it, outside the published format.
- An intent file alone does not say where its code is.
