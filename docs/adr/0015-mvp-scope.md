# ADR-0015: MVP scope exclusions

- **Status:** Accepted
- **Date:** 2026-10-22

## Context

The MVP must stay small enough to validate the core idea: capturing intent while code is written, and reviewing code against it.

## Decision

The MVP focuses on the **CLI** (capture, construction, filtering, storage, sync). The review web app comes afterwards.

Explicitly out of scope:

- **Squash merge and rebase-and-merge on GitHub.** They create new commits server-side, where no local hook runs, so attributions keyed by the PR's SHAs do not match the merged commit. Review is unaffected (it happens before merge). Future direction: recover attributions on `main` through fingerprints and the PR number in the commit message.
- **Agents other than Claude Code.**
- **Review data** (approvals, comments): will probably live in a separate ref (`refs/vermeil/reviews`), to be designed later.

## Consequences

- Line fingerprints are kept in the format from day one, so squash-merge support can be added without a format break.
