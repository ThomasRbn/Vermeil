# Data format use cases

Every field of the data format (ADR-0016) must serve at least one of these needs.

## Review app

| # | The reviewer wants to… | Data needed |
|---|---|---|
| R1 | See the diff grouped by intent, in a logical order | Line → intent attribution, intent ordering |
| R2 | Understand an intent in 10 seconds | Short title |
| R3 | Know what was originally requested | Prompt quotes (filtered) |
| R4 | Know what was done and why | Description, decisions, rejected alternatives |
| R5 | Know what the agent bet on | Assumptions |
| R6 | Know where to look first | Attention points flagged by the agent itself |
| R7 | Know what was deliberately not done | Out of scope |
| R8 | See who wrote each line and how trustworthy its explanation is | Provenance + status (attribution) |
| R9 | See the history of an intent | Revisions |
| R10 | Know who the author is | Human / AI identity |

## AI-assisted review

| # | Need | Data needed |
|---|---|---|
| A1 | Check the code against the intent | Expected behaviours stated as verifiable assertions |

## CLI

| # | Need | Data needed |
|---|---|---|
| C1 | Check coverage (`vermeil check`) | Attribution |
| C2 | List open / dormant intents (`vermeil status`) | Local state (journal) |
| C3 | Filter private data | List of free-text fields |
| C4 | Generate the PR comment | Title + coverage statistics |
| C5 | Evolve the format | `schemaVersion` |

## Later (must not be blocked)

| # | Need |
|---|---|
| F1 | Intent blame on `main` after merge |
| F2 | Links between intents ("B fixes a bug introduced by A") |
| F3 | Agents other than Claude Code |
