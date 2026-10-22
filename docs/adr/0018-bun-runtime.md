# ADR-0018: Bun as the CLI runtime

- **Status:** Accepted
- **Date:** 2026-10-22

## Context

The CLI is invoked by Claude Code hooks on **every** tool call (ADR-0002). Start-up latency is directly felt by the user. The project is written in TypeScript.

## Decision

Use **Bun** as the runtime for the CLI, and distribute it as a single compiled binary (`bun build --compile`).

## Consequences

- TypeScript runs without a separate build step during development.
- Fast start-up, no `npx` resolution on each hook call.
- Node APIs (`node:fs`, `node:child_process`) remain available through Bun's Node compatibility.

## Alternatives considered

- **Node.js** (+ `npx`): slower start-up on every hook invocation.
