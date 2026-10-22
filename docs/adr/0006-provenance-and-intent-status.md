# ADR-0006: Provenance and intent status

- **Status:** Accepted
- **Date:** 2026-10-22

## Context

Not all code is written by the agent: humans edit by hand, formatters rewrite files, lockfiles change. Requiring an intent for every line is unrealistic, and the reviewer needs to know how much to trust each explanation.

## Decision

### Provenance

Every attributed line has a **provenance**: `ai` | `human` | `mixed`, detected from snapshots:

- changed during a tool call → `ai`;
- changed between tool calls or outside any session → `human`;
- written by the AI then edited by a human → `mixed`.

### Status

The **status** applies to the *line ↔ intent* link. It is **computed by the CLI, never self-declared** by the agent or the human.

```
For each line of the commit:
├─ No link to any intent? ─────────────────────────────────► none
├─ Link created by the same author, before the commit,
│  and the line is unchanged since? ───────────────────────► declared
└─ Otherwise ──────────────────────────────────────────────► inferred (+ source)
```

| `inferred` source | Missing condition |
|---|---|
| `commit-message` | The link is assumed, not declared |
| `explain` (LLM proposes an intent after the fact) | Not the same author |
| `other-session` | Not the same author |
| `modified-after-declaration` | Line changed after the intent was declared |

### Lines without intent

- Lines without intent are **allowed**. The review app flags them explicitly and falls back to classic line-by-line review.
- For human code, the **commit message** is used as a fallback intent (`inferred`, source `commit-message`) if it passes deterministic checks: minimum length, not generic (`wip`, `fix`, `update`, `tmp`, `.`), not auto-generated (`Merge branch …`, `Initial commit`, `Revert …`). Otherwise the status is `none`.
- The CLI does **not** judge whether a message is *relevant* to a line. That judgement belongs to the **AI-assisted review** in the app, which may downgrade an `inferred` link to "no intent". Displayed status = CLI status + optional AI review verdict.

## Consequences

- An agent cannot mark its own work as `declared`; trust levels are verifiable.
- Humans are never forced to use the CLI, but can (`vermeil intent add`) to reach `declared`.
- Coverage policy can later become configurable per repository (`strict` vs `lenient`).

## Alternatives considered

- **Every line must have an intent**: rejected, unrealistic for human and mechanical changes.
- **Self-declared status**: rejected, untrustworthy.
