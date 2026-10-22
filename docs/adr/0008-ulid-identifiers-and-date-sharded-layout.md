# ADR-0008: ULID identifiers and date-sharded layout

- **Status:** Accepted
- **Date:** 2026-10-22

## Context

Each intent, revision and prompt is a file in the ref. Directories must be sharded: every commit on the ref rewrites the tree object of each modified directory, so a single directory with 100,000 entries would be rewritten on every new intent. The sharding scheme depends on the identifier.

Time-ordered identifiers (ULID, UUID v7) start with a timestamp: sharding by their first characters would put every recent file in the same directory.

## Decision

- Use **ULID** for every identifier (intents, revisions, prompts). TypeScript library: `ulidx`.
- Shard by **year and month**, derived from the ULID timestamp:

```
refs/vermeil/intents
├── intents/
│   └── 2026/10/
│       ├── <intent-ulid>.json
│       └── <intent-ulid>/revisions/<revision-ulid>.json
├── prompts/
│   └── 2026/10/<prompt-ulid>.json
└── attributions/
    └── <commit-sha>.json
```

- Short forms in the CLI use the **end** of the ULID (random part), not the beginning.

## Consequences

- A file path is computable from its ID: no lookup needed.
- Listing is chronological for free.
- A new intent only rewrites the current month's tree; older trees stay identical and are reused by Git.
- If a month grows too large, switching to day sharding (`2026/10/22/`) does not break existing paths.
- A revision made in a later month writes into the intent's original month directory. Acceptable: revisions are rare.

## Alternatives considered

| Option | Why rejected |
|---|---|
| UUID v4 + 2-character prefix | Good distribution, but no embedded date, no chronological order. |
| UUID v7 | Valid alternative (RFC 9562, native DB support), but longer (36 chars) and less readable in filenames and terminals. Both are 128-bit, so this does not constrain the web app. |
