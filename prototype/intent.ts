// Throwaway capture prototype: lets the agent declare the intent behind changes of its session.
// Usage: bun prototype/intent.ts --session <session-id>   (intent as JSON on stdin)

import { existsSync } from "node:fs";
import { join } from "node:path";
import { ulid } from "ulidx";
import { gitDir } from "./git";
import { appendEvent, changed, readEvents, sessionDir, toolCalls } from "./journal";

const MAX_TITLE = 80;
const LIST_FIELDS = ["assumptions", "attentionPoints", "expectedBehaviors", "outOfScope"] as const;

type Decision = { choice: string; reason: string; rejectedAlternatives?: string[] };

const isText = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";
const isTextList = (value: unknown): value is string[] => Array.isArray(value) && value.every(isText);

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const sessionId = args[args.indexOf("--session") + 1];
  if (!args.includes("--session") || !sessionId) fail("missing --session <session-id>");

  const dir = sessionDir(gitDir(process.cwd()), sessionId);
  if (!existsSync(join(dir, "events.jsonl"))) fail(`unknown session: ${sessionId}`);

  let declaration: Record<string, unknown>;
  try {
    declaration = JSON.parse(await Bun.stdin.text());
  } catch (error) {
    fail(`invalid JSON on stdin: ${(error as Error).message}`);
  }

  // Collect every problem at once, so the agent can fix them in a single retry.
  const errors: string[] = [];
  const { title, description, changes } = declaration;
  const decisions = declaration.decisions ?? [];

  if (!isText(title)) errors.push("title: required non-empty string");
  else if (title.length > MAX_TITLE) errors.push(`title: ${title.length} characters, max ${MAX_TITLE}`);
  if (!isText(description)) errors.push("description: required non-empty string");
  if (!isTextList(changes) || changes.length === 0) errors.push("changes: required non-empty list of change IDs");
  for (const field of LIST_FIELDS) {
    if (declaration[field] !== undefined && !isTextList(declaration[field])) {
      errors.push(`${field}: must be a list of non-empty strings`);
    }
  }
  const validDecision = (d: unknown) =>
    typeof d === "object" && d !== null && isText((d as Decision).choice) && isText((d as Decision).reason) &&
    ((d as Decision).rejectedAlternatives === undefined || isTextList((d as Decision).rejectedAlternatives));
  if (!Array.isArray(decisions) || !decisions.every(validDecision)) {
    errors.push("decisions: must be a list of { choice, reason, rejectedAlternatives? }");
  }

  // Change IDs are the short IDs listed by the Stop hook (or full tool_use_ids).
  const calls = toolCalls(readEvents(dir));
  const resolved: string[] = [];
  for (const id of isTextList(changes) ? changes : []) {
    const call = calls.find((c) => c.toolUseId === id || c.shortId === id);
    if (!call) errors.push(`changes: unknown change ID "${id}"`);
    else if (!changed(call)) errors.push(`changes: "${id}" did not modify any file`);
    else resolved.push(call.toolUseId);
  }

  if (errors.length > 0) fail(`Intent rejected:\n- ${errors.join("\n- ")}`);

  const intentId = ulid();
  appendEvent(dir, sessionId, "intent.declare", {
    intentId,
    title,
    description,
    changes: resolved,
    decisions,
    ...Object.fromEntries(LIST_FIELDS.map((field) => [field, declaration[field] ?? []])),
  });
  console.log(`Intent ${intentId} declared: "${title}" covers ${resolved.length} change(s).`);
}

await main();
