// Shared journal helpers for the capture prototype (ADR-0019).

import { appendFileSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { ulid } from "ulidx";
import { git } from "./git";

export type JournalEvent = {
  v: number;
  id: string;
  ts: string;
  type: string;
  sessionId: string;
  data: Record<string, unknown>;
  raw?: Record<string, unknown>;
};

export type ToolCall = {
  toolUseId: string;
  shortId: string; // what the agent uses to refer to a change
  tool: string;
  pre: JournalEvent;
  post?: JournalEvent;
};

export function sessionDir(gitDir: string, sessionId: string): string {
  return join(gitDir, "vermeil", "journal", "sessions", sessionId);
}

export function appendEvent(
  dir: string,
  sessionId: string,
  type: string,
  data: Record<string, unknown>,
  raw?: unknown,
): void {
  mkdirSync(dir, { recursive: true });
  const event = { v: 0, id: ulid(), ts: new Date().toISOString(), type, sessionId, data, raw };
  // One event = one write, so concurrent hooks never interleave lines.
  appendFileSync(join(dir, "events.jsonl"), JSON.stringify(event) + "\n");
}

// Events are read in file order, which is the order they were appended.
export function readEvents(dir: string): JournalEvent[] {
  let content: string;
  try {
    content = readFileSync(join(dir, "events.jsonl"), "utf8");
  } catch {
    return [];
  }
  const events: JournalEvent[] = [];
  for (const [index, line] of content.split("\n").entries()) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      console.error(`skipping corrupted journal line ${index + 1}`);
    }
  }
  return events;
}

export const shortId = (toolUseId: string) => toolUseId.slice(-8);

// Pairs each tool.pre with its tool.post, in execution order.
export function toolCalls(events: JournalEvent[]): ToolCall[] {
  const calls = new Map<string, ToolCall>();
  for (const event of events) {
    const toolUseId = String(event.data.toolUseId);
    if (event.type === "tool.pre") {
      calls.set(toolUseId, { toolUseId, shortId: shortId(toolUseId), tool: String(event.data.tool), pre: event });
    } else if (event.type === "tool.post") {
      const call = calls.get(toolUseId);
      if (call) call.post = event;
    }
  }
  return [...calls.values()];
}

export const changed = (call: ToolCall) =>
  call.post !== undefined && call.post.data.snapshot !== call.pre.data.snapshot;

// toolUseId → the intent declaration covering it. A later declaration wins (one change = one intent).
export function coverage(events: JournalEvent[]): Map<string, JournalEvent> {
  const covered = new Map<string, JournalEvent>();
  for (const event of events) {
    if (event.type !== "intent.declare") continue;
    for (const toolUseId of event.data.changes as string[]) covered.set(toolUseId, event);
  }
  return covered;
}

export function repoRoot(cwd: string): string {
  return realpathSync(git(["rev-parse", "--show-toplevel"], cwd));
}

export function oneLine(text: string, max = 80): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

// Paths are shown relative to the repository. Symlinks are resolved on both sides
// (on macOS, /var and /private/var are the same directory).
function relativePath(root: string, path: string): string {
  try {
    return relative(root, join(realpathSync(dirname(path)), basename(path)));
  } catch {
    return path; // the directory no longer exists
  }
}

// What a tool call was about: the targeted file, or the shell command.
export function describe(root: string, event: JournalEvent): string {
  const input = (event.raw?.tool_input ?? {}) as Record<string, unknown>;
  const file = input.file_path ?? input.notebook_path;
  if (typeof file === "string") return relativePath(root, file);
  return typeof input.command === "string" ? oneLine(input.command) : "";
}
