# Vermeil

Vermeil helps humans review AI-generated code by checking **whether the code matches the intent the AI declared while writing it**, instead of reconstructing the intent from the code line by line.

## Components

1. **CLI** (current focus, TypeScript): captures agent intent through hooks, attributes lines of code to intents, filters private data, and stores everything in the **intent store**, a custom Git ref. No external service.
2. **Review web app** (later, TypeScript): shows diffs grouped by intent, with per-line provenance and status, plus an AI-assisted first review pass. Posts a summary as a PR comment.

## Current phase

Design is done. A throwaway **capture prototype** lives in `prototype/` (see ADR-0019 for its findings):

- `hook.ts`: Claude Code hooks (`UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `Stop`) writing to the journal (event-sourced JSON Lines) with working-tree snapshots; `Stop` blocks until changes of the turn are covered by intents.
- `intent.ts`: command the agent runs to declare an intent.
- `replay.ts`: replays a session (`bun prototype/replay.ts [session-id] [--patch]`).
- Hooks are enabled for this repository in `.claude/settings.local.json` (not committed).

Next steps:

1. Use the prototype on real sessions for 1–2 weeks.
2. Study **git-ai** (prior art for line-level attribution in Git).
3. Hand-write realistic intents from real sessions, then finalise the data format (ADR-0016, still *Proposed*).

## Design decisions

All decisions live in [`docs/adr/`](docs/adr/README.md). Read the relevant ADRs before working on a topic. Key points:

- **Capture**: Claude Code hooks (`UserPromptSubmit`, `Pre/PostToolUse` snapshots via a temporary `GIT_INDEX_FILE`, `Stop` makes the agent declare its intents) + Git hooks (`post-commit`, `post-rewrite`, `post-checkout`, `pre-push`). ADR-0002.
- **Intent**: defined by the agent, can span several commits; lifecycle draft → attached → published. One line = one intent. ADR-0003.
- **Attribution** is per line (position tracking + context fingerprints); hunks are only a display unit. Additions in commit coordinates, deletions in parent coordinates. ADR-0004, ADR-0005.
- **Status** (`declared` / `inferred` / `none`) is computed by the CLI, never self-declared. Lines without intent are allowed. ADR-0006.
- **Storage**: the intent store, a single ref `refs/vermeil/intents`, written with Git plumbing; ULIDs, year/month sharding; strictly append-only once published; revisions as separate files; intents (the *why*) separated from attributions (the *where*). ADR-0007 to ADR-0010, ADR-0014.
- **Privacy**: raw journal never leaves `.git/vermeil/`; layered filtering (secrets, `.env` values, user denylist) at write time and at `pre-push`. ADR-0011.

## Conventions

- Language: TypeScript everywhere. CLI runtime: **Bun**, shipped as a compiled binary (ADR-0018). Planned monorepo with a shared `core` package (format types, ref access) used by the CLI and the web app.
- npm scope **`@usevermeil`** is reserved: all published packages use it (e.g. `@usevermeil/core`, `@usevermeil/cli`).
- Git is driven by spawning the `git` binary, not a JS reimplementation.
- Hooks run on every tool call: keep CLI start-up fast.
- Code, comments, docs, ADRs and commit messages are written in **English**.
- A changed decision gets a **new ADR** that supersedes the old one; accepted ADRs are not rewritten.

## Glossary

| Term | Meaning |
|---|---|
| Intent | The *why* behind a set of changes, declared by its author |
| Attribution | The *where*: which lines of a commit belong to which intent |
| Provenance | Who wrote a line: `ai`, `human`, `mixed` |
| Status | Trust level of a line ↔ intent link: `declared`, `inferred`, `none` |
| Journal | Local, unshared raw capture in `.git/vermeil/journal/` (holds drafts) |
| Intent store | Shared, filtered, append-only storage: the ref `refs/vermeil/intents` (ADR-0017) |
| Draft / attached / published | Intent states: in the journal / in the local intent store / in the remote intent store |
| Dormant draft | A draft whose code disappeared (stash, reset); wakes up if the code returns |
