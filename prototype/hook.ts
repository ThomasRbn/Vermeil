// Throwaway capture prototype (ADR-0019): appends Claude Code hook events to the journal.
// Usage, from a Claude Code hook: bun prototype/hook.ts  (hook payload on stdin)

import { appendFileSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { ulid } from "ulidx";

type HookInput = {
  session_id: string;
  transcript_path: string;
  cwd: string;
  hook_event_name: string;
  [key: string]: unknown;
};

type Context = {
  input: HookInput;
  gitDir: string;
  sessionDir: string;
};

// Maps Claude Code hook names to journal event types.
const EVENT_TYPES: Record<string, string> = {
  UserPromptSubmit: "prompt",
  PreToolUse: "tool.pre",
  PostToolUse: "tool.post",
};

// Parallel tool calls snapshot concurrently and contend for the session index lock.
const LOCK_RETRIES = 40;
const LOCK_RETRY_DELAY_MS = 25;

function git(args: string[], cwd: string, env: Record<string, string> = {}): string {
  const result = Bun.spawnSync(["git", ...args], { cwd, env: { ...process.env, ...env } });
  if (result.exitCode !== 0) {
    throw new Error(`git ${args[0]} failed: ${result.stderr.toString().trim()}`);
  }
  return result.stdout.toString().trim();
}

function gitDir(cwd: string): string {
  return resolve(cwd, git(["rev-parse", "--git-dir"], cwd));
}

// Records the whole working tree as a Git tree object, without touching the user's index.
// Returns the tree SHA.
function snapshot({ input, gitDir, sessionDir }: Context): string {
  const index = join(sessionDir, "index");
  // Seeding from the user's index reuses its stat cache: only changed files get re-hashed.
  if (!existsSync(index) && existsSync(join(gitDir, "index"))) {
    copyFileSync(join(gitDir, "index"), index);
  }
  const env = { GIT_INDEX_FILE: index };

  for (let attempt = 1; ; attempt++) {
    try {
      git(["add", "--all"], input.cwd, env);
      return git(["write-tree"], input.cwd, env);
    } catch (error) {
      const locked = error instanceof Error && error.message.includes(".lock': File exists");
      if (!locked || attempt >= LOCK_RETRIES) throw error;
      Bun.sleepSync(LOCK_RETRY_DELAY_MS);
    }
  }
}

function eventData(context: Context): Record<string, unknown> {
  const { input } = context;
  switch (input.hook_event_name) {
    case "UserPromptSubmit":
      return { prompt: input.prompt, promptId: input.prompt_id };
    case "PreToolUse":
    case "PostToolUse":
      return { tool: input.tool_name, toolUseId: input.tool_use_id, snapshot: snapshot(context) };
    default:
      return {};
  }
}

async function main(): Promise<void> {
  const input = JSON.parse(await Bun.stdin.text()) as HookInput;
  const type = EVENT_TYPES[input.hook_event_name];
  if (!type) return;

  const dir = gitDir(input.cwd);
  const sessionDir = join(dir, "vermeil", "journal", "sessions", input.session_id);
  mkdirSync(sessionDir, { recursive: true });

  const event = {
    v: 0,
    id: ulid(),
    ts: new Date().toISOString(),
    type,
    sessionId: input.session_id,
    data: eventData({ input, gitDir: dir, sessionDir }),
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
