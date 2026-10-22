import { resolve } from "node:path";

export function git(args: string[], cwd: string, env: Record<string, string> = {}): string {
  const result = Bun.spawnSync(["git", ...args], { cwd, env: { ...process.env, ...env } });
  if (result.exitCode !== 0) {
    throw new Error(`git ${args[0]} failed: ${result.stderr.toString().trim()}`);
  }
  return result.stdout.toString().trimEnd();
}

export function gitDir(cwd: string): string {
  return resolve(cwd, git(["rev-parse", "--git-dir"], cwd));
}
