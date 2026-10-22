// Throwaway capture prototype (ADR-0019): appends Claude Code hook events to the journal,
// and asks the agent to declare its intents before it stops (ADR-0002).
// Usage, from a Claude Code hook: bun prototype/hook.ts  (hook payload on stdin)

import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { git, gitDir } from "./git";
import {
  appendEvent,
  changed,
  coverage,
  describe,
  readEvents,
  repoRoot,
  sessionDir,
  toolCalls,
  type ToolCall,
} from "./journal";

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
  // A failed tool call fires PostToolUseFailure instead of PostToolUse, yet may have changed files.
  PostToolUseFailure: "tool.post",
  Stop: "stop",
};

// Parallel tool calls snapshot concurrently and contend for the session index lock.
const LOCK_RETRIES = 40;
const LOCK_RETRY_DELAY_MS = 25;

const INTENT_COMMAND = join(import.meta.dir, "intent.ts");

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

// "src/a.ts (+4 -1), src/b.ts (+2 -0)"
function diffSummary(cwd: string, call: ToolCall): string {
  const numstat = git(["diff", "--numstat", String(call.pre.data.snapshot), String(call.post!.data.snapshot)], cwd);
  return numstat
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [added, deleted, path] = line.split("\t");
      return `${path} (+${added} -${deleted})`;
    })
    .join(", ");
}

// The message Claude receives when its stop is blocked.
function declarationRequest({ input }: Context, uncovered: ToolCall[]): string {
  const root = repoRoot(input.cwd);
  const changes = uncovered.map(
    (call) => `- ${call.shortId}  ${call.tool}  ${describe(root, call.pre)}  →  ${diffSummary(input.cwd, call)}`,
  );
  return [
    "Vermeil: before finishing, declare the intent behind the changes you made in this turn.",
    "",
    "Changes without an intent:",
    ...changes,
    "",
    "Group them into one or more intents (each change belongs to exactly one intent).",
    "Declare each intent by running this command with the Bash tool:",
    "",
    `bun "${INTENT_COMMAND}" --session ${input.session_id} <<'JSON'`,
    "{",
    '  "title": "short summary, max 80 characters",',
    '  "description": "what was done",',
    `  "changes": [${uncovered.map((call) => `"${call.shortId}"`).join(", ")}],`,
    '  "decisions": [{ "choice": "what you chose", "reason": "why", "rejectedAlternatives": ["what you did not choose"] }],',
    '  "assumptions": ["what you assumed without checking"],',
    '  "attentionPoints": ["where a reviewer should look first, and why"],',
    '  "expectedBehaviors": ["verifiable statement, e.g. if limit > 100 then it is clamped to 100"],',
    '  "outOfScope": ["what you deliberately did not do"]',
    "}",
    "JSON",
    "",
    "Only title, description and changes are required; omit empty lists.",
    "Write in the language the user writes in. Be specific and honest: these notes are what the reviewer reads instead of your code.",
    "Quote only technical requirements: never include secrets, credentials, personal data or configuration values.",
  ].join("\n");
}

// Blocks the stop while changes of the current turn are not covered by an intent.
function stop(context: Context): Record<string, unknown> {
  const events = readEvents(context.sessionDir);
  const turn = events.slice(events.findLastIndex((event) => event.type === "prompt") + 1);
  const covered = coverage(events);
  const uncovered = toolCalls(turn).filter((call) => changed(call) && !covered.has(call.toolUseId));

  // stop_hook_active: Claude is already continuing because of this hook. Never block twice,
  // otherwise an agent that cannot or will not comply would loop forever.
  const blocked = uncovered.length > 0 && !context.input.stop_hook_active;
  if (blocked) {
    // For Stop hooks, a JSON decision on stdout (with exit code 0) is read by Claude Code.
    console.log(JSON.stringify({ decision: "block", reason: declarationRequest(context, uncovered) }));
  }
  return { uncovered: uncovered.map((call) => call.toolUseId), blocked };
}

function eventData(context: Context): Record<string, unknown> {
  const { input } = context;
  switch (input.hook_event_name) {
    case "UserPromptSubmit":
      return { prompt: input.prompt, promptId: input.prompt_id };
    case "PreToolUse":
    case "PostToolUse":
      return { tool: input.tool_name, toolUseId: input.tool_use_id, snapshot: snapshot(context) };
    case "PostToolUseFailure":
      return {
        tool: input.tool_name,
        toolUseId: input.tool_use_id,
        snapshot: snapshot(context),
        failed: true,
        error: input.error,
      };
    case "Stop":
      return stop(context);
    default:
      return {};
  }
}

async function main(): Promise<void> {
  const input = JSON.parse(await Bun.stdin.text()) as HookInput;
  const type = EVENT_TYPES[input.hook_event_name];
  if (!type) return;

  const dir = gitDir(input.cwd);
  const session = sessionDir(dir, input.session_id);
  mkdirSync(session, { recursive: true });

  const data = eventData({ input, gitDir: dir, sessionDir: session });
  appendEvent(session, input.session_id, type, data, input);
}

// The prototype must never disturb the Claude Code session: log errors, always exit 0.
try {
  await main();
} catch (error) {
  console.error(`[vermeil prototype] ${error instanceof Error ? error.message : error}`);
}
process.exit(0);
