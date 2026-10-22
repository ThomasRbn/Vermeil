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

## Prototype findings

Observations from the capture prototype (2026-10-22), to feed the final decision and ADR-0016:

- **Hook payloads.** Every event carries `session_id`, `prompt_id`, `cwd`, `transcript_path`, `permission_mode` and `effort`. The **model is not included** (to be found in the transcript or another hook). Tool events add `tool_name`, `tool_input` and `tool_use_id`; `PostToolUse` adds `tool_response` and `duration_ms`.
- **`prompt_id` is present on tool events**, so every tool call can be linked to the prompt that triggered it, without generating our own IDs.
- **`tool_response` for `Edit`** includes `structuredPatch`, `userModified` (possible signal that the user edited the proposed change) and `originalFile` (the **full file content**: raw events can get large).
- **Writing tools run sequentially**, even when the agent issues them in parallel. Lock contention on the session index is therefore rare; the retry loop stays as a safety net.
- **`post(N) == pre(N+1)`** when nothing else touched the working tree between two tool calls: a difference reveals a change made outside the agent (ADR-0006).
- **Concurrent changes are misattributed.** An editor created `.vscode/settings.json` while a `Bash` tool call was running; the snapshot diff attributed it to that tool call. For `Edit`/`Write`, attribution can be restricted to `tool_input.file_path`; for `Bash`, the window remains ambiguous.
- **Performance** on the Vermeil repository: ~150 ms for the first snapshot of a session (seeding the session index from the user's index), ~50 ms afterwards.
- **Hooks reload mid-session** and fire in any harness built on the Claude Code engine (verified with an Agent SDK-based app).
- **Load-time failures lose events.** While the hook script itself was being edited, it briefly failed to load (duplicate declarations between two edits). Import and syntax errors happen before the top-level `try/catch`, so the event is simply not written: the replay then shows a `tool.pre` without `tool.post` and vice versa. A compiled binary for the real CLI avoids this class of failure.
- **Outside changes are detected in practice.** A manual edit to `.gitignore` between two tool calls showed up as `post(N) != pre(N+1)` in the replay.
- **Failed tool calls fire `PostToolUseFailure`**, not `PostToolUse` (payload adds `error` and `is_interrupt`). A failing command can still change files (`echo hello > a.txt; false`), so this hook must be captured too; otherwise the change is misreported as an outside change at the next tool call.
- **Intent declaration through the `Stop` hook works.** Blocking the stop with a list of uncovered changes and a JSON template makes the agent declare rich intents on its own: concrete decisions with rejected alternatives, honest assumptions (e.g. an ambiguous request interpreted one way), precise attention points and verifiable expected behaviours, in the user's language.
- **A single `Bash` call can change several files** (e.g. two heredocs in one command). In the prototype an intent covers whole tool calls, so such files cannot be split across intents; line-level attribution (ADR-0004) is needed for that.
