// Shared helpers for the handoff scripts. Node >= 18, no dependencies.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";

export function git(args, cwd) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).replace(/\s+$/, ""); // keep leading spaces: " M file"
  } catch {
    return null;
  }
}

/** Main worktree root (same for every linked worktree), or cwd outside git. */
export function repoRoot(cwd) {
  const common = git(["rev-parse", "--path-format=absolute", "--git-common-dir"], cwd);
  if (common && basename(common) === ".git") return dirname(common);
  return git(["rev-parse", "--show-toplevel"], cwd) ?? cwd;
}

/** Root of the current worktree (differs from repoRoot in a linked worktree). */
export const worktreeRoot = (cwd) => git(["rev-parse", "--show-toplevel"], cwd) ?? cwd;

/** Project name: origin repo name, else the repo root folder name. */
export function projectSlug(cwd) {
  const root = repoRoot(cwd);
  const remote = git(["config", "--get", "remote.origin.url"], cwd);
  let name = remote ? basename(remote.replace(/[\\/]+$/, ""), ".git") : basename(root);
  const bad = !name || name.startsWith("_") || name === ".claude" || name === basename(homedir());
  if (bad) name = basename(cwd) || "general";
  return name.replace(/[^A-Za-z0-9._-]/g, "-");
}

/** Where handoffs live unless the repo mode is used. HANDOFF_DIR overrides it. */
export const storeDir = () => process.env.HANDOFF_DIR || join(homedir(), ".claude", "handoffs");

/** Claude Code names a project's transcript folder after the cwd with every non-alphanumeric as "-". */
export const encodeCwd = (p) => p.replace(/[^A-Za-z0-9]/g, "-");

export function transcriptPath(cwd, sessionId) {
  if (!sessionId) return null;
  const p = join(homedir(), ".claude", "projects", encodeCwd(cwd), `${sessionId}.jsonl`);
  return existsSync(p) ? p : null;
}

/** ISO 8601 with the local UTC offset, e.g. 2026-11-07T14:30:52+02:00. */
export function isoLocal(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`
  );
}

export const stamp = (d = new Date()) => isoLocal(d).slice(0, 19).replace(/[-:]/g, "").replace("T", "-");

/** Reads the leading --- block as flat key: value pairs. */
export function frontmatter(file) {
  const text = readFileSync(file, "utf8");
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const out = {};
  if (!m) return out;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

function scan(dir, source) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const path = join(dir, f);
      return { path, source, mtime: statSync(path).mtimeMs, ...frontmatter(path) };
    });
}

/** Handoffs for a project (global store + the repo's .claude/handoffs), newest first. `done/` is ignored. */
export function listHandoffs({ project, root, all = false }) {
  let found = [];
  if (all) {
    const base = storeDir();
    if (existsSync(base)) for (const d of readdirSync(base)) found.push(...scan(join(base, d), "store")); // scan skips non-directories
  } else {
    found.push(...scan(join(storeDir(), project), "store"));
  }
  if (root) found.push(...scan(join(root, ".claude", "handoffs"), "repo"));
  return found.sort((a, b) => b.mtime - a.mtime);
}
