# Vermeil

**Review AI-generated code against the intent behind it.**

Reviewing code written by an AI agent usually means reading it line by line and reverse-engineering what it was supposed to do. Vermeil flips this around: it captures the agent's **intent while the code is being written**, so reviewers check whether the code *does what it claims to do* instead of guessing what it was meant to do.

> 🚧 **Status: design phase.** The architecture is documented in [`docs/adr/`](docs/adr/README.md). Implementation has not started yet.

## The idea

When an agent writes code, it knows *why*: what was asked, which choices it made, what it assumed, what it was unsure about. Today that knowledge is lost the moment the session ends. Vermeil keeps it, and ties it to the exact lines it explains.

A reviewer then sees a pull request **grouped by intent** rather than by file:

```
Intent: Add pagination to GET /users                    🟢 declared
  Requested:   "paginate the users endpoint, max 100 per page"
  Decisions:   offset-based (the API already uses offset), not cursor-based
  Assumptions: the frontend already sends limit and offset
  ⚠ Attention: behaviour when offset exceeds the total is untested
  Expected:    if limit > 100, it is clamped to 100
  → 3 hunks across src/users.ts, src/db/users.ts, test/users.test.ts

Intent: Log slow queries                                🟢 declared
  → 1 hunk in src/db/client.ts

No intent                                               🔴 classic review
  → 2 hunks in src/billing.ts
```

Every line carries its **provenance** (AI, human, or mixed) and a **trust level** for its explanation:

- 🟢 **declared**: explained by its own author, while writing it;
- 🟡 **inferred**: explained after the fact (commit message, later analysis, or edited since);
- 🔴 **none**: no explanation, so it gets a classic line-by-line review.

## Principles

- **Captured, not reconstructed.** Intent is recorded by the agent that wrote the code, at the moment it wrote it, through agent hooks. Not summarised later from a transcript.
- **Lives in your repository.** Everything is stored in Git itself, in a dedicated ref (`refs/vermeil/intents`, the *intent store*). No server, no account, no lock-in. Your branches and working tree stay untouched.
- **Private by default.** Raw prompts never leave your machine. What is shared is filtered for secrets, `.env` values and a user-defined denylist (client names, project codenames) before anything is pushed.
- **Honest about trust.** Trust levels are computed from verifiable facts, never self-declared by the agent. Code without intent is allowed, and clearly flagged.
- **Append-only.** Published intents are never modified; corrections are recorded as revisions, so reviewers always know what changed and why.
- **Humans welcome.** Hand-written code works too: declare an intent explicitly, or fall back on your commit message.

## Components

| Component | Role | Status |
|---|---|---|
| **CLI** (TypeScript, Bun) | Hooks into the agent and Git, attributes lines to intents, filters private data, syncs the intent store | Design done, prototype next |
| **Review app** (TypeScript) | Intent-grouped review, per-line provenance and trust, AI-assisted first pass, PR summary comment | Later |

The first supported agent is **Claude Code**.

Packages will be published on npm under the **[`@usevermeil`](https://www.npmjs.com/org/usevermeil)** scope.

## Documentation

- [Architecture Decision Records](docs/adr/README.md): every design decision, with its context and the alternatives considered.
- [Format use cases](docs/use-cases.md): what the data format must enable.

## License

Licensed under the [Apache License, Version 2.0](LICENSE). See [NOTICE](NOTICE).
