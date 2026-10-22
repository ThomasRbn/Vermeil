# ADR-0005: Coordinate systems for additions and deletions

- **Status:** Accepted
- **Date:** 2026-10-22

## Context

Line-level attribution (ADR-0004) works for added lines, but a deleted line no longer exists in the file: it has no position to attach an intent to. Yet deletions ("removed this function because it was duplicated") are among the changes most in need of an explanation.

## Decision

Mirror the unified diff format, where each hunk header carries two coordinate systems (`@@ -20,8 +20,3 @@`):

| Line type | Coordinates |
|---|---|
| Added | Position in the **commit** |
| Deleted | Position in the **parent commit** (immutable) |
| Modified | A deletion plus an addition, usually the same intent; displayed as a modification |
| Deleted / renamed file | A file-level entry with its own intent (renames detected with `git diff -M`) |

- During a session, the CLI works in snapshot coordinates; at `post-commit` it **projects** attributions onto the parent and commit coordinates. Each commit is projected against its own parent, which also covers commits made mid-session.
- Code added then deleted within the same session never appears in the final diff and is not attributed.

## Consequences

- The parent commit never changes, so deletions need no fragile "between line 14 and 15" anchor.
- Deletions get intents, statuses and fingerprints exactly like additions.
- Deletion-only hunks are displayed with their intent in the review app.

## Alternatives considered

- **Anchor deletions between lines of the new file**: rejected, the anchor moves whenever surrounding code changes.
