# Architecture Decision Records

This directory records the significant design decisions of Vermeil, using the ADR format described in [ADR-0001](0001-record-architecture-decisions.md).

| ADR | Title | Status |
|---|---|---|
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | Accepted |
| [0002](0002-capture-intent-with-agent-hooks.md) | Capture intent with agent hooks, Claude Code first | Accepted |
| [0003](0003-agent-defined-intents-and-lifecycle.md) | Agent-defined intents and their lifecycle | Accepted |
| [0004](0004-line-level-attribution.md) | Line-level attribution | Accepted |
| [0005](0005-coordinate-systems-for-additions-and-deletions.md) | Coordinate systems for additions and deletions | Accepted |
| [0006](0006-provenance-and-intent-status.md) | Provenance and intent status | Accepted |
| [0007](0007-store-data-in-a-custom-git-ref.md) | Store data in a custom Git ref | Accepted |
| [0008](0008-ulid-identifiers-and-date-sharded-layout.md) | ULID identifiers and date-sharded layout | Accepted |
| [0009](0009-append-only-storage.md) | Append-only storage and conflict-free merging | Accepted |
| [0010](0010-intent-revisions.md) | Intent revisions | Accepted |
| [0011](0011-privacy-filtering.md) | Privacy filtering and user denylist | Accepted |
| [0012](0012-dormant-drafts.md) | Drafts across branch switches and stashes | Accepted |
| [0013](0013-author-identity.md) | Author identity | Accepted |
| [0014](0014-separate-intents-from-attributions.md) | Separate intents from attributions | Accepted |
| [0015](0015-mvp-scope.md) | MVP scope exclusions | Accepted |
| [0016](0016-data-format-v0.md) | Data format v0 | Proposed |
| [0017](0017-terminology-journal-and-intent-store.md) | Terminology: journal and intent store | Accepted |
| [0018](0018-bun-runtime.md) | Bun as the CLI runtime | Accepted |
| [0019](0019-journal-format.md) | Journal format | Proposed |

Supporting documents:

- [Format use cases](../use-cases.md): the needs every field of the data format must serve.

## Writing a new ADR

1. Copy [`template.md`](template.md) to `NNNN-short-title.md` (next free number).
2. Start with status `Proposed`; switch to `Accepted` once decided.
3. Never rewrite an accepted ADR to change the decision: write a new ADR and mark the old one `Superseded by ADR-NNNN`.
4. Add it to the table above.
