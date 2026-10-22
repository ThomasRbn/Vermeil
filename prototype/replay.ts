// Throwaway capture prototype (ADR-0019): replays a session journal and shows what each tool call
// changed, and which intent covers it.
// Usage: bun prototype/replay.ts [session-id] [--patch]

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { git, gitDir } from "./git";
import { coverage, describe, oneLine, readEvents, repoRoot, type JournalEvent } from "./journal";

const cwd = process.cwd();
const root = repoRoot(cwd);
const color = process.stdout.isTTY;
const dim = (text: string) => (color ? `\x1b[2m${text}\x1b[0m` : text);
const bold = (text: string) => (color ? `\x1b[1m${text}\x1b[0m` : text);
const yellow = (text: string) => (color ? `\x1b[33m${text}\x1b[0m` : text);
const cyan = (text: string) => (color ? `\x1b[36m${text}\x1b[0m` : text);

function latestSession(sessionsDir: string): string {
  const sessions = readdirSync(sessionsDir)
    .filter((name) => existsSync(join(sessionsDir, name, "events.jsonl")))
    .map((name) => ({ name, mtime: statSync(join(sessionsDir, name, "events.jsonl")).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (sessions.length === 0) throw new Error(`no session in ${sessionsDir}`);
  return sessions[0]!.name;
}

const time = (event: JournalEvent) => event.ts.slice(11, 19);

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
  const events = readEvents(join(sessionsDir, sessionId));
  const covered = coverage(events);

  console.log(bold(`Session ${sessionId}`) + dim(` (${events.length} events)`));

  const pending = new Map<string, JournalEvent>(); // tool.pre events waiting for their tool.post
  let lastSnapshot: string | undefined; // most recent known state of the working tree
  const stats = { prompts: 0, toolCalls: 0, changingToolCalls: 0, outsideChanges: 0, intents: 0, uncovered: 0 };

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
        const failed = event.data.failed ? yellow(" (failed)") : "";
        console.log(`  ● ${event.data.tool}${failed} ${dim(time(event))} ${dim(toolUseId.slice(-8))}  ${describe(root, event)}`);
        if (!pre) {
          console.log(yellow("      no matching tool.pre"));
        } else if (printDiff(String(pre.data.snapshot), snapshot, patch)) {
          stats.changingToolCalls++;
          const intent = covered.get(toolUseId);
          if (intent) console.log(cyan(`      → intent: ${intent.data.title}`));
          else {
            stats.uncovered++;
            console.log(yellow("      → no intent"));
          }
        }
        lastSnapshot = snapshot;
        break;
      }
      case "intent.declare": {
        stats.intents++;
        const changes = event.data.changes as string[];
        console.log(`  ${cyan("◆ intent")} ${dim(time(event))}  "${event.data.title}"`);
        console.log(dim(`      covers ${changes.map((id) => id.slice(-8)).join(", ")}`));
        break;
      }
      case "stop": {
        const uncovered = (event.data.uncovered as string[] | undefined) ?? [];
        const detail = event.data.blocked
          ? `blocked, intents requested for ${uncovered.length} change(s)`
          : uncovered.length > 0
            ? `allowed with ${uncovered.length} uncovered change(s)`
            : "allowed";
        console.log(dim(`  ■ stop ${time(event)}  ${detail}`));
        break;
      }
    }
  }

  // A tool.pre without tool.post: the tool failed, was denied, or the session was interrupted.
  for (const pre of pending.values()) {
    console.log(yellow(`  ✗ ${pre.data.tool} ${time(pre)} has no tool.post (failed or interrupted): ${describe(root, pre)}`));
  }

  console.log(
    dim(
      `\nprompts: ${stats.prompts} · tool calls: ${stats.toolCalls} (with changes: ${stats.changingToolCalls}) · ` +
        `intents: ${stats.intents} · changes without intent: ${stats.uncovered} · ` +
        `changes outside the agent: ${stats.outsideChanges}`,
    ),
  );
}

try {
  main();
} catch (error) {
  console.error(`[vermeil replay] ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
