# ADR-0011: Privacy filtering and user denylist

- **Status:** Accepted
- **Date:** 2026-10-22

## Context

Prompts and agent explanations can contain secrets (tokens, keys), personal data, and business-sensitive names (clients, projects). Once pushed, data must be considered leaked, even if later removed.

## Decision

Principle: **nothing leaves the machine unfiltered, and the first push is the only irreversible step.**

### Layer 1 — The raw journal stays local

- The raw journal (`.git/vermeil/journal/`) holds full prompts and hook events, including file contents the agent read (e.g. `.env`). It is never pushed and can be purged automatically.

### Layer 2 — Minimisation at the source

- The `Stop` hook instructs the agent to quote only technical requirements, never personal data, identifiers or configuration values.
- Quotes are **short** (length limits in the format).
- Prompt sharing is configurable:

```
share.prompts = none     # the agent rephrases the request, no user text
              | quotes   # short verbatim excerpts (default)
              | full     # full prompt, filtered (explicit opt-in)
```

- Prompts are stored **once** (`prompts/`) and referenced by ID from intents.

### Layer 3 — Deterministic filtering

Applied to **all text fields** (the agent's own explanations can leak too), when writing to the ref **and again at `pre-push`** (so denylist entries added in between still apply):

- known secret formats (gitleaks-style rules) and high-entropy strings;
- values found in the repository's `.env` files (exact match);
- local paths (`/Users/<name>/…` → `~/…`), emails, IP addresses;
- the **user denylist**.

### Layer 4 — Review before publishing

- `vermeil push --preview` shows what will be published; `vermeil redact <id>` fixes drafts before the push.

### User denylist

```bash
vermeil deny add "Acme Corp" --category client
vermeil deny add --regex "PRJ-\d{4}" --category ticket
vermeil deny import clients.txt --category client
vermeil deny list
vermeil deny remove "Acme Corp"
vermeil scan          # re-scan local, unpushed drafts
```

| Scope | Location | Shared |
|---|---|---|
| `--global` | `~/.config/vermeil/deny` | No |
| `--local` (default) | `.git/vermeil/deny` | No |
| `--shared` | in the ref, **hashed** | Yes |

- Storing a team denylist in clear text would publish the very names it protects. The shared scope stores hashes of normalised terms; the scanner hashes word n-grams of the text and compares.
- Normalisation: case- and accent-insensitive, simple variants (`Acme Corp`, `ACME`, `acme-corp`), user-defined aliases.
- Matches are replaced by **stable placeholders** within an intent (`<client-1>`), keeping the text readable.
- Mode: `replace` (automatic) or `block` (refuse the push until fixed).
- Adding a term warns if it already appears in published intents (which then require a ref rewrite).
- Only intent data is filtered, not code: names already in the code are already in the repository.

## Consequences

- A secret that was pushed must be **revoked**, not just deleted.
- Filtering is fully local, no service involved.
