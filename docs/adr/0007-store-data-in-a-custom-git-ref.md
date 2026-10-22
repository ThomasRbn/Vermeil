# ADR-0007: Store data in a custom Git ref

- **Status:** Accepted
- **Date:** 2026-10-22

## Context

Intents must live with the repository, with **no dependency on any external service**. Options:

- files committed in the working tree (`.vermeil/`): pollute diffs and PRs;
- `git notes`: native tooling and rewrite support, but strictly one note per commit, while intents exist before commits and span several of them;
- a custom ref with its own history: flexible, invisible in the working tree.

## Decision

- All shared data lives in **`refs/vermeil/intents`**, a ref outside `refs/heads` and `refs/tags`, pointing to its own commit history whose tree is organised by Vermeil (ADR-0008).
- The ref is written with Git plumbing (`hash-object`, `mktree`, `commit-tree`, `update-ref`); the CLI owns every interaction with it.
- **One ref for the whole repository**, not one per branch: intents are tied to commits, which are independent of branches. The intents of a branch or PR are found by listing its commits (`git log base..branch`) and reading their attributions (ADR-0014).
- `vermeil init` adds the fetch refspec `+refs/vermeil/*:refs/vermeil/*` and installs a `pre-push` hook that pushes `refs/vermeil/*`. It must **not** set `remote.origin.push`, which would replace the default behaviour of `git push`.
- The raw journal lives in `.git/vermeil/journal/` and is never pushed (ADR-0011).

## Consequences

Verified on GitHub on 2026-10-22 with a throwaway private repository:

| Check | Result |
|---|---|
| Push to `refs/vermeil/intents` | Accepted |
| `git ls-remote` | Ref listed |
| REST API `git/matching-refs`, trees, blobs | Readable |
| GitHub UI branch list | Not shown |
| Plain `git clone` | Ref not fetched |
| Fetch with the refspec | Ref fetched |

- The future web app reads data through the GitHub Git Data API; "sending to the server" is just `git push`.
- Because the history is separate, it can be rewritten (e.g. to purge leaked data) without touching code history.

Storage volume was measured on 2026-10-22: 10,000 simulated intents (~2.7 KB of JSON each, ~27 MB raw) take **~11 MB** in `.git` after `git gc` (zlib compression, content deduplication, delta compression in packfiles). Storage size is not a concern provided directories are sharded, line ranges are used instead of single lines, and files are small and never rewritten (ADR-0008, ADR-0009).

## Alternatives considered

- **Files in the working tree**: rejected, pollute diffs.
- **`git notes`**: rejected, one-note-per-commit model does not fit.
- **External server**: rejected, violates the no-service constraint.
- **One ref per branch**: rejected, complicates branch switches and offers no benefit.
