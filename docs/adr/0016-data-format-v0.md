# ADR-0016: Data format v0

- **Status:** Proposed — working hypothesis, to be validated by the capture prototype before acceptance
- **Date:** 2026-10-22

## Context

The data format is the contract between the CLI and the review app, and becomes permanent once intents are pushed to real repositories. Fields are derived from the [use cases](../use-cases.md). Intents and attributions are separate files (ADR-0014).

Before accepting this ADR:

1. build a throwaway capture prototype (hooks + journal + snapshots, no shared format) and use it on real Claude Code sessions for 1–2 weeks;
2. hand-write 5–10 realistic intents from those sessions, including hard cases (mixed code, `git add -p`, rebase, multiple sessions);
3. resolve the open questions below.

## Decision (draft)

### Intent — `intents/YYYY/MM/<ulid>.json`

```ts
type Intent = {
  schemaVersion: 0                     // C5
  id: ULID                             // embeds the creation date
  author: Author                       // R10

  title: string                        // R2
  request: {                           // R3
    promptRefs: ULID[]                 //   linked prompts (stored once, separately)
    quotes: { promptId: ULID; text: string }[]   // short, filtered excerpts
  }
  description: string                  // R4: what was done
  decisions: {                         // R4
    choice: string                     //   "offset-based pagination"
    reason: string                     //   "the existing API already uses offset"
    rejectedAlternatives?: string[]    //   "cursor-based pagination"
  }[]
  assumptions: string[]                // R5
  attentionPoints: string[]            // R6
  expectedBehaviors: string[]          // A1: "if limit > 100, it is clamped to 100"
  outOfScope: string[]                 // R7

  related?: { id: ULID; relation: "fixes" | "extends" | "reverts" }[]   // F2, optional
}

type Author =
  | { type: "ai"; model: string; tool: { name: string; version: string }; sessionId: string }
  | { type: "human"; name: string; email: string }
```

- Rejected alternatives belong to decisions: an alternative only makes sense against the choice made.
- No `createdAt`: the date is in the ULID, and a duplicate could become inconsistent.
- No ordering field (R1): chronological ULID order is the default.

### Revision — `intents/YYYY/MM/<ulid>/revisions/<revision-ulid>.json`

```ts
type IntentRevision = {
  schemaVersion: 0
  id: ULID
  intentId: ULID
  previous: ULID | null              // null = revises the original version
  type: "amend" | "correct" | "abandon"
  author: Author
  reason: string
  content?: IntentContent            // full copy of the content fields (title → outOfScope); absent for "abandon"
}
```

### Prompt — `prompts/YYYY/MM/<ulid>.json`

```ts
type Prompt = {
  schemaVersion: 0
  id: ULID
  sessionId: string
  author: Author                     // the human who wrote the prompt
  text?: string                      // only when share.prompts = "full", after filtering
}
```

### Attribution — `attributions/<sha>.json`

```ts
type Attribution = {
  schemaVersion: 0
  commit: string
  parent: string | null              // null for the repository's first commit
  files: {
    path: string
    oldPath?: string                 // when renamed
    operation: "added" | "modified" | "deleted" | "renamed"
    fileLink?: Link                  // intent of the file operation (deletion, rename)
    added: Range[]                   // commit coordinates
    removed: Range[]                 // parent coordinates
  }[]
}

type Range = {
  start: number
  end: number
  provenance: "ai" | "human" | "mixed"        // R8
  link: Link                                   // R1
  status: "declared" | "inferred" | "none"    // R8, computed by the CLI
  source?: "commit-message" | "explain" | "other-session" | "modified-after-declaration"
  fingerprint: string                          // content + context (ADR-0004)
}

type Link =
  | { type: "intent"; id: ULID }
  | { type: "commit-message" }      // the commit message serves as the intent
  | null                            // no intent
```

- Lines without intent are **recorded** (`link: null`, `status: "none"`) rather than omitted: coverage is explicit, and provenance is kept (an AI line without intent differs from a human one).
- The commit message is **not** turned into a synthetic `Intent` object; the link points to it.

## Open questions

| # | Question | Current recommendation |
|---|---|---|
| 1 | Does a revision store a **full copy** of the content or a **patch**? | Full copy: readers only need the latest revision, files are small. |
| 2 | `expectedBehaviors`: free text or structured (*Given / When / Then*)? | Free text in v0, with a phrasing guideline for the agent; structure later if the prototype shows the need. |
| 3 | How can an attention point refer to a code location, given intents hold no line references? | Optional `file` and `symbol` fields, no line numbers. |
| 4 | **Merge commits** (two parents) | Attribute against the **first parent**, like `git diff` by default. |
| 5 | **Length limits** per field | Yes: title ≤ 80, quotes ≤ 300, list items ≤ 300 characters (readability and leak reduction). |
| 6 | **Language** of the content | The agent writes in the user's language, with an optional `lang` field. To confirm. |

## Evolution rules (proposed)

- `schemaVersion: 0` is explicitly experimental and may break.
- From v1 on: only additions of optional fields; no removal, no change of meaning.
