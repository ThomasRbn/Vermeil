# ADR-0019: Journal format

- **Status:** Proposed — used by the capture prototype, to be confirmed afterwards
- **Date:** 2026-10-22

## Context

The journal (ADR-0017) is the local, never-shared raw capture. It receives events from separate hook processes, possibly concurrently (Claude Code can run tool calls in parallel), and must support recomputing local state (open intents, line maps, dormant drafts) as the logic evolves.

## Decision

### Event sourcing

The journal stores **events only**, appended in order and never modified. All state is **derived** by replaying events.

### Layout

```
.git/vermeil/journal/
└── sessions/
    └── <session-id>/
        ├── meta.json        # model, tool, start date, cwd
        └── events.jsonl     # one event per line, append-only
```

- **One directory per session**: every hook receives the Claude Code `session_id`; parallel sessions never share a file; purging a session means deleting its directory.
- **JSON Lines**: appending is a single write at the end of the file; readable with `jq`; a corrupted line does not affect the others.

### Event envelope

```json
{"v":0,"id":"<ulid>","ts":"2026-10-22T14:03:12.481Z","type":"tool.post","sessionId":"…","data":{}}
```

| Type | Source | Main content |
|---|---|---|
| `prompt` | `UserPromptSubmit` | Prompt text |
| `tool.pre` | `PreToolUse` | Tool, `tool_use_id`, SHA of the "before" snapshot |
| `tool.post` | `PostToolUse` | Tool, `tool_use_id`, SHA of the "after" snapshot |
| `stop` | `Stop` | Coverage check result |
| `intent.declare` | CLI command called by the agent | Intent content, attached lines |

During the prototype, events also keep the **raw hook input** (`raw` field) to observe what Claude Code actually sends.

## Consequences

- **Snapshots are not stored in the journal**: a snapshot is a Git tree object in `.git/objects`; the journal only stores its SHA. Git deduplicates unchanged files between snapshots.
- **Unreachable objects are garbage-collected** (`gc.pruneExpire`, about two weeks by default). Acceptable for the prototype; the real implementation must keep snapshots reachable (e.g. a local, never-pushed ref per session).
- **Concurrent writes**: each event must be written in a **single** append call. Fine for short lines on a local disk; large payloads need care.
- **Worktrees**: `.git` can be a file. Whether the journal lives under `git rev-parse --git-dir` (per worktree) or `--git-common-dir` (shared) is still to be decided; snapshots are tied to a specific working tree.
