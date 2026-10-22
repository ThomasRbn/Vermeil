# ADR-0013: Author identity

- **Status:** Accepted
- **Date:** 2026-10-22

## Context

The reviewer needs to know who wrote an intent or a revision, and the status computation (ADR-0006) needs to know whether a link was created by the same author as the code.

## Decision

| Author | Recorded fields |
|---|---|
| Human | Git `user.name` and `user.email` |
| AI | Model, session ID, tool name and version (e.g. `claude-code 2.x`) |

## Consequences

- Human emails are already public in commits; no new exposure.
- Recording the tool now costs nothing and is required once other agents are supported.
