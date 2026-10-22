# ADR-0012: Drafts across branch switches and stashes

- **Status:** Accepted
- **Date:** 2026-10-22

## Context

Draft intents (not yet committed) follow the working tree. Users switch branches with uncommitted changes, stash them, or discard them. Git has a `post-checkout` hook but **no hook for `git stash`**.

## Decision

- **Branch switch with uncommitted changes**: Git carries the changes to the new branch, so drafts follow naturally. The CLI recomputes positions against the new `HEAD` (`post-checkout`).
- **A draft is never deleted because its code disappeared.** It becomes **dormant**, and wakes up when the code comes back, matched through content fingerprints (ADR-0004).
  - `git stash` → lines disappear → next CLI run marks the draft dormant.
  - `git stash pop` → lines reappear → fingerprints match → the draft is active again.
  - Optional precision: a stash is a commit pointed to by `refs/stash`; the CLI can detect new stash entries and record which stash holds a dormant draft.
- **Destructive operations** (`git reset --hard`, `git checkout -- <file>`): the draft stays dormant, then is purged after a delay or by `vermeil gc`.

## Consequences

- No wrapper command (`vermeil stash`) is needed.
- Dormant/open states are local journal state, not part of the published format.
