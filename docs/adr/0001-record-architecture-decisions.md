# ADR-0001: Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-10-22

## Context

Vermeil's data format becomes a long-lived contract once intents are pushed to real repositories. Design choices are interdependent (storage, attribution, privacy, format), and the reasoning behind them must survive beyond the brainstorming conversations they came from.

## Decision

Record every significant design decision as an Architecture Decision Record (ADR) in `docs/adr/`, written in English, following the template in [`template.md`](template.md).

Accepted ADRs are immutable: a changed decision gets a new ADR that supersedes the old one.

## Consequences

- The reasoning behind each decision stays discoverable.
- Changing a decision has a small, deliberate cost (writing a superseding ADR).
