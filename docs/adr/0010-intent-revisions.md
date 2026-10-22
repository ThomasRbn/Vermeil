# ADR-0010: Intent revisions

- **Status:** Accepted
- **Date:** 2026-10-22

## Context

An agent can be wrong about its own intent, abandon it, or need to refine it. Once an intent is published, someone may already have reviewed or approved it, so silent changes are unacceptable.

## Decision

- An intent can never be modified without creating a **revision**.
- Revisions are required **only after the first push**. Before that, drafts are freely editable: nobody has seen them, and the agent's trial and error does not need to be recorded.
- Each revision is a separate file (ADR-0009) and records:
  - its **type**: `amend` (refinement), `correct` (the agent was wrong), `abandon`;
  - its **author** and **reason**;
  - a reference to the **previous revision**.

## Consequences

- An abandoned intent whose lines still exist is an inconsistency that the CLI reports: the code must be removed or reattached to another intent.
- A review approval applies to a **specific revision**; a new revision invalidates it (to be detailed with the review data design).
- Whether a revision stores a full copy of the content or a patch is decided in ADR-0016.
