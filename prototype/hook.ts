// Throwaway capture prototype (ADR-0019): appends Claude Code hook events to the journal.
// Usage, from a Claude Code hook: bun prototype/hook.ts  (hook payload on stdin)

import { appendFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { ulid } from "ulidx";

type HookInput = {
  session_id: string;
  transcript_path: string;
  cwd: string;
  hook_event_name: string;
  [key: string]: unknown;
};

// Maps Claude Code hook names to journal event types.
const EVENT_TYPES: Record<string, string> = {
  UserPromptSubmit: "prompt",
};

function gitDir(cwd: string): string {
  const result = Bun.spawnSync(["git", "rev-parse", "--git-dir"], { cwd });
  if (result.exitCode !== 0) {
    throw new Error(`not a git repository: ${cwd}`);
  }
  return resolve(cwd, result.stdout.toString().trim());
}

function eventData(input: HookInput): Record<string, unknown> {
  switch (input.hook_event_name) {
    case "UserPromptSubmit":
      return { prompt: input.prompt };
    default:
      return {};
  }
}

async function main(): Promise<void> {
  const input = JSON.parse(await Bun.stdin.text()) as HookInput;
  const type = EVENT_TYPES[input.hook_event_name];
  if (!type) return;

  const sessionDir = join(gitDir(input.cwd), "vermeil", "journal", "sessions", input.session_id);
  mkdirSync(sessionDir, { recursive: true });

  const event = {
    v: 0,
    id: ulid(),
    ts: new Date().toISOString(),
    type,
    sessionId: input.session_id,
    data: eventData(input),
    raw: input,
  };

  // One event = one write, so concurrent hooks never interleave lines.
  appendFileSync(join(sessionDir, "events.jsonl"), JSON.stringify(event) + "\n");
}

// The prototype must never disturb the Claude Code session: log errors, always exit 0.
try {
  await main();
} catch (error) {
  console.error(`[vermeil prototype] ${error instanceof Error ? error.message : error}`);
}
process.exit(0);
