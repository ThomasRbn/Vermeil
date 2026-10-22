# ADR-0002: Capture intent with agent hooks, Claude Code first

- **Status:** Accepted
- **Date:** 2026-10-22

## Context

Vermeil needs to know, for every change made by a coding agent, *what* changed and *why*. Three capture strategies exist:

1. **Passive**: parse agent transcripts after the fact. Zero friction, but noisy, and a transcript is not an intent.
2. **Active**: the agent explicitly declares its intent through a CLI or tool. Structured, but relies on the agent remembering to do it.
3. **Hooks**: the agent runtime calls Vermeil at well-defined events. Automatic and precise.

## Decision

Capture through **agent hooks**, starting with **Claude Code only**, combined with Git hooks.

### Claude Code hooks

| Hook | Role |
|---|---|
| `UserPromptSubmit` | Record the prompt in the local journal. |
| `PreToolUse` / `PostToolUse` | Snapshot the working tree before and after each tool call, using a temporary index (`GIT_INDEX_FILE=… git add -A && git write-tree`). The diff between the two snapshots is exactly what the tool call changed, whatever the tool (`Edit`, `Write`, `Bash`, …). |
| `Stop` | Check that the changes of the turn are covered by intents. If not, block the stop (`decision: "block"`) and ask the agent to declare its intents through the CLI. |

The `Stop` hook makes the agent that wrote the code describe it while it still has the full context, with no separate LLM call and no API key.

### Git hooks

| Hook | Role |
|---|---|
| `post-commit` | Project draft attributions onto the commit and write data to the ref (see ADR-0005, ADR-0007). |
| `post-rewrite` | Remap commit SHAs after `rebase` / `amend`. |
| `post-checkout` | Recompute draft positions after a branch switch (see ADR-0012). |
| `pre-push` | Re-run privacy filtering (ADR-0011) and push `refs/vermeil/*`. |

## Consequences

- Snapshot diffs capture changes made through `Bash` (sed, codegen, package managers), which tool-input inspection alone would miss.
- Hooks run on **every** tool call: CLI start-up time is critical. Candidate: a single compiled binary (e.g. `bun build --compile`) rather than `npx`.
- Each new agent requires its own adapter (see ADR-0015).
- Git operations are performed by spawning the `git` binary, which respects the user's configuration.

## Alternatives considered

- **Transcript parsing only**: rejected as the primary mechanism (noisy, lossy). Transcripts remain available in the local journal.
- **Inspecting `Edit`/`Write` tool inputs only**: rejected, misses `Bash`-driven changes.
