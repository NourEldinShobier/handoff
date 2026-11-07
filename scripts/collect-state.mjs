#!/usr/bin/env node
// Prints the git/environment facts a handoff needs, as JSON. Read-only unless --commit or --push is given.
//
//   node collect-state.mjs [--cwd DIR] [--session ID] [--topic SLUG] [--repo]
//                          [--commit [MESSAGE]] [--push] [--check]
//
// --check  only report state: no directory is created and no file_path is given
// --repo   put the handoff file in <repo>/.claude/handoffs (travels with git) instead of the user store
// --commit stage everything and commit "wip: handoff - MESSAGE" (only when the tree is dirty)
// --push   push HEAD; falls back to --set-upstream, then to handoff/<branch>-<stamp>. Never forces.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolve } from "node:path";
import { git, isoLocal, projectSlug, repoRoot, stamp, storeDir, transcriptPath, worktreeRoot } from "./lib.mjs";

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const val = (n) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : null;
};

const cwd = resolve(val("--cwd") ?? process.cwd());
const topic = (val("--topic") ?? "session").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "session";
// An unsubstituted "${CLAUDE_SESSION_ID}" placeholder means the id is unknown.
const sessionId = /^[\w-]+$/.test(val("--session") ?? "") ? val("--session") : null;
const now = new Date();
const inGit = git(["rev-parse", "--is-inside-work-tree"], cwd) === "true";
const root = repoRoot(cwd);
const project = projectSlug(cwd);

const out = {
  project,
  topic,
  generated_at: isoLocal(now),
  cwd,
  repo_root: root,
  in_git: inGit,
  session_id: sessionId ?? "unknown",
  transcript_path: transcriptPath(cwd, sessionId) ?? "unknown",
  platform: process.platform,
  node: process.version,
};

if (inGit) {
  const hasCommit = git(["rev-parse", "--verify", "HEAD"], cwd) !== null;
  const abbrev = hasCommit ? git(["rev-parse", "--abbrev-ref", "HEAD"], cwd) : null;
  const detached = abbrev === "HEAD";
  const branch = !hasCommit ? "unborn" : detached ? "detached" : abbrev;
  let pushStatus = "not requested";

  if (flag("--commit") && git(["status", "--porcelain"], cwd)) {
    const msg = val("--commit") ?? "session handoff";
    git(["add", "-A"], cwd);
    out.committed = git(["commit", "-m", `wip: handoff - ${msg}`], cwd) !== null;
  }

  if (flag("--push")) {
    const named = hasCommit && !detached;
    const tries = [
      ...(named
        ? [
            [["push", "origin", "HEAD"], `pushed to origin/${branch}`],
            [["push", "--set-upstream", "origin", branch], `pushed to origin/${branch} (upstream set)`],
          ]
        : []),
      ...(hasCommit ? [[["push", "origin", `HEAD:handoff/${branch}-${stamp(now)}`], `pushed to fallback branch handoff/${branch}-${stamp(now)}`]] : []),
    ];
    pushStatus = hasCommit ? "FAILED: nothing pushed, changes are local only" : "nothing to push: no commits yet";
    for (const [args, ok] of tries) {
      if (git(args, cwd) !== null) {
        pushStatus = ok;
        break;
      }
    }
  }

  const upstream = git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], cwd);
  const counts = upstream ? git(["rev-list", "--left-right", "--count", `${upstream}...HEAD`], cwd) : null;
  const [behind, ahead] = counts ? counts.split(/\s+/).map(Number) : [null, null];
  const status = git(["status", "--porcelain"], cwd) ?? "";
  const stat = git(["diff", "--stat", "HEAD"], cwd) ?? "";

  Object.assign(out, {
    branch,
    head: git(["rev-parse", "HEAD"], cwd),
    last_commit: git(["log", "-1", "--oneline"], cwd),
    recent_commits: (git(["log", "-5", "--oneline"], cwd) ?? "").split("\n").filter(Boolean),
    remote: git(["remote", "get-url", "origin"], cwd),
    upstream,
    ahead,
    behind,
    stash_count: (git(["stash", "list"], cwd) ?? "").split("\n").filter(Boolean).length,
    dirty_files: status.split("\n").filter(Boolean),
    diff_stat: stat,
    push_status: pushStatus,
  });
}

// Commands the next session will want, read from the project files rather than guessed.
const commands = {};
const wt = worktreeRoot(cwd); // this checkout's files, not the main worktree's
const pkg = join(wt, "package.json");
if (existsSync(pkg)) {
  try {
    const scripts = JSON.parse(readFileSync(pkg, "utf8")).scripts ?? {};
    for (const k of ["dev", "start", "build", "test", "lint", "check"]) if (scripts[k]) commands[k] = `npm run ${k}`;
  } catch {}
}
const mk = join(wt, "Makefile");
if (existsSync(mk)) {
  const text = readFileSync(mk, "utf8");
  for (const k of ["build", "test", "run"]) if (new RegExp(`^${k}:`, "m").test(text)) commands[k] = `make ${k}`;
}
out.commands = commands;

// Where to write the document. Not created here; the skill writes it.
if (!flag("--check")) {
  const dir = flag("--repo") ? join(wt, ".claude", "handoffs") : join(storeDir(), project);
  mkdirSync(dir, { recursive: true });
  out.file_path = join(dir, `${stamp(now)}-${topic}.md`);
  out.location = flag("--repo") ? "repo" : "store";
}

console.log(JSON.stringify(out, null, 2));
