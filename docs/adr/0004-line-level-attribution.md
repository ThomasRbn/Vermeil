# ADR-0004: Line-level attribution

- **Status:** Accepted
- **Date:** 2026-10-22

## Context

Changes are captured edit by edit during a session, but Git splits them into hunks at commit time. The two do not match:

- several edits (possibly from different intents) merge into a single commit hunk;
- an AI edit and a human edit next to each other form one mixed hunk;
- `git add -p` splits a session edit across several commits.

Example: Claude writes two lines for intent A and one line for intent B, then the user tweaks one of A's lines. `git diff` shows a single hunk. Attaching one intent and one status to that hunk is necessarily wrong.

## Decision

- The unit of attribution is the **line**. The hunk is only a **display unit** in the review app.
- Primary mechanism: **position tracking**, like `git blame`. The CLI keeps a per-file map *line → author + intent*, updated by applying the diff between consecutive snapshots.
- Complement: a **content fingerprint with context** (the line plus its neighbours), used to check consistency and to recover lines after rebase or stash (ADR-0012).
- Attributions are stored as **ranges** of consecutive lines, not line by line.

## Consequences

- Mixed hunks and `git add -p` are handled correctly.
- Position tracking is the most delicate part of the CLI (line shifts on every edit).
- Word-level diffs (e.g. "only `100 → 50` was changed by the human") can be computed on the fly by the app; they are not stored.
- Prior art worth studying before implementation: **git-ai** (line-level attribution of AI code stored in Git).

## Alternatives considered

| Option | Why rejected |
|---|---|
| Hunk-level attribution | Wrong as soon as code is mixed or partially staged. |
| Content matching only at commit time | Ambiguous on repetitive code (`}`, `return null;`). Kept as a complement (fingerprints). |
| Symbol-level (tree-sitter) | Language-specific, misses code outside symbols. May be used later as a visual grouping. |
| Character/word-level storage | Overkill for storage; done at display time instead. |
