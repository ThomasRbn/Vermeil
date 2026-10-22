// Throwaway capture prototype (ADR-0019): replays a session journal and shows what each tool call changed.
// Usage: bun prototype/replay.ts [session-id] [--patch]

import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { git, gitDir } from "./git";

type JournalEvent = {
  id: string;
  ts: string;
  type: string;
  data: Record<string, unknown>;
  raw: Record<string, unknown>;
};

const cwd = process.cwd();
const root = realpathSync(git(["rev-parse", "--show-toplevel"], cwd));
const color = process.stdout.isTTY;
const dim = (text: string) => (color ? `\x1b[2m${text}\x1b[0m` : text);
const bold = (text: string) => (color ? `\x1b[1m${text}\x1b[0m` : text);
const yellow = (text: string) => (color ? `\x1b[33m${text}\x1b[0m` : text);

function latestSession(sessionsDir: string): string {
  const sessions = readdirSync(sessionsDir)
    .filter((name) => existsSync(join(sessionsDir, name, "events.jsonl")))
    .map((name) => ({ name, mtime: statSync(join(sessionsDir, name, "events.jsonl")).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (sessions.length === 0) throw new Error(`no session in ${sessionsDir}`);
  return sessions[0]!.name;
}

// Events are read in file order, which is the order the hooks appended them.
function readEvents(file: string): JournalEvent[] {
  const events: JournalEvent[] = [];
  for (const [index, line] of readFileSync(file, "utf8").split("\n").entries()) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      console.error(yellow(`skipping corrupted line ${index + 1}`));
    }
  }
  return events;
}

const time = (event: JournalEvent) => event.ts.slice(11, 19);
const oneLine = (text: string, max = 80) => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

// Paths are shown relative to the repository. Symlinks are resolved on both sides
// (on macOS, /var and /private/var are the same directory).
function relativePath(path: string): string {
  try {
    return relative(root, join(realpathSync(dirname(path)), basename(path)));
  } catch {
    return path; // the directory no longer exists
  }
}

// What the tool call was about: the targeted file, or the shell command.
function describe(event: JournalEvent): string {
  const input = (event.raw.tool_input ?? {}) as Record<string, unknown>;
  const file = input.file_path ?? input.notebook_path;
  if (typeof file === "string") return relativePath(file);
  return typeof input.command === "string" ? oneLine(input.command) : "";
}

function printDiff(from: string, to: string, patch: boolean): boolean {
  if (from === to) {
    console.log(dim("      (no changes)"));
    return false;
  }
  try {
    const args = ["diff", patch ? "--patch" : "--stat", `--color=${color ? "always" : "never"}`, from, to];
    const output = git(args, cwd);
    console.log(output.replace(/^/gm, "      "));
  } catch (error) {
    // Snapshots are unreachable objects and may have been garbage-collected (ADR-0019).
    console.log(yellow(`      cannot diff ${from.slice(0, 8)}..${to.slice(0, 8)}: ${(error as Error).message}`));
  }
  return true;
}

function main(): void {
  const args = process.argv.slice(2);
  const patch = args.includes("--patch");
  const sessionsDir = join(gitDir(cwd), "vermeil", "journal", "sessions");
  const sessionId = args.find((arg) => !arg.startsWith("--")) ?? latestSession(sessionsDir);
  const events = readEvents(join(sessionsDir, sessionId, "events.jsonl"));

  console.log(bold(`Session ${sessionId}`) + dim(` (${events.length} events)`));

  const pending = new Map<string, JournalEvent>(); // tool.pre events waiting for their tool.post
  let lastSnapshot: string | undefined; // most recent known state of the working tree
  const stats = { prompts: 0, toolCalls: 0, changingToolCalls: 0, outsideChanges: 0 };

  for (const event of events) {
    switch (event.type) {
      case "prompt": {
        stats.prompts++;
        console.log(`\n${bold("▶ prompt")} ${dim(time(event))}  "${oneLine(String(event.data.prompt ?? ""))}"`);
        break;
      }
      case "tool.pre": {
        const snapshot = String(event.data.snapshot);
        // post(N) != pre(N+1): something outside the agent changed the working tree in between.
        if (lastSnapshot && snapshot !== lastSnapshot) {
          stats.outsideChanges++;
          console.log(`  ${yellow("⚠ changed outside the agent")} ${dim(`before ${time(event)}`)}`);
          printDiff(lastSnapshot, snapshot, patch);
        }
        pending.set(String(event.data.toolUseId), event);
        lastSnapshot = snapshot;
        break;
      }
      case "tool.post": {
        const snapshot = String(event.data.snapshot);
        const toolUseId = String(event.data.toolUseId);
        const pre = pending.get(toolUseId);
        pending.delete(toolUseId);
        stats.toolCalls++;
        console.log(`  ● ${event.data.tool} ${dim(time(event))}  ${describe(event)}`);
        if (!pre) {
          console.log(yellow("      no matching tool.pre"));
        } else if (printDiff(String(pre.data.snapshot), snapshot, patch)) {
          stats.changingToolCalls++;
        }
        lastSnapshot = snapshot;
        break;
      }
    }
  }

  // A tool.pre without tool.post: the tool failed, was denied, or the session was interrupted.
  for (const pre of pending.values()) {
    console.log(yellow(`  ✗ ${pre.data.tool} ${time(pre)} has no tool.post (failed or interrupted): ${describe(pre)}`));
  }

  console.log(
    dim(
      `\nprompts: ${stats.prompts} · tool calls: ${stats.toolCalls} ` +
        `(with changes: ${stats.changingToolCalls}) · changes outside the agent: ${stats.outsideChanges}`,
    ),
  );
}

try {
  main();
} catch (error) {
  console.error(`[vermeil replay] ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
