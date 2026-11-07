import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const S = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts");
const run = (script, args = [], opts = {}) =>
  execFileSync("node", [join(S, script), ...args], { encoding: "utf8", ...opts });
const tmp = () => mkdtempSync(join(tmpdir(), "handoff-test-"));
const git = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8" });

function repo() {
  const d = tmp();
  git(d, "init", "-q", "-b", "main");
  git(d, "config", "user.email", "t@example.com");
  git(d, "config", "user.name", "t");
  writeFileSync(join(d, "package.json"), JSON.stringify({ scripts: { test: "x", build: "y" } }));
  git(d, "add", "-A");
  git(d, "commit", "-qm", "first");
  return d;
}

test("collect-state reports git facts and commands, and names the file in the store", () => {
  const d = repo(), store = tmp();
  writeFileSync(join(d, "new.txt"), "x");
  const o = JSON.parse(run("collect-state.mjs", ["--cwd", d, "--topic", "My Topic!"], { env: { ...process.env, HANDOFF_DIR: store } }));
  assert.equal(o.branch, "main");
  assert.equal(o.last_commit.endsWith("first"), true);
  assert.deepEqual(o.dirty_files, ["?? new.txt"]);
  assert.deepEqual(o.commands, { build: "npm run build", test: "npm run test" });
  assert.equal(o.topic, "my-topic");
  assert.match(o.file_path, /\d{8}-\d{6}-my-topic\.md$/);
  assert.ok(o.file_path.startsWith(store));
  assert.ok(existsSync(join(store, o.project)));
});

test("collect-state keeps the leading space of an unstaged modification", () => {
  const d = repo();
  writeFileSync(join(d, "package.json"), "{}");
  const o = JSON.parse(run("collect-state.mjs", ["--cwd", d, "--check"]));
  assert.deepEqual(o.dirty_files, [" M package.json"]);
});

test("collect-state ignores an unsubstituted session placeholder and handles a repo with no commits", () => {
  const d = tmp();
  git(d, "init", "-q", "-b", "main");
  const o = JSON.parse(run("collect-state.mjs", ["--cwd", d, "--check", "--session", "${CLAUDE_SESSION_ID}", "--push"]));
  assert.equal(o.session_id, "unknown");
  assert.equal(o.branch, "unborn");
  assert.equal(o.push_status, "nothing to push: no commits yet");
});

test("find-handoffs --all survives a stray file in the store", () => {
  const d = repo(), store = tmp(), env = { ...process.env, HANDOFF_DIR: store };
  writeFileSync(join(store, "stray.txt"), "x");
  assert.equal(JSON.parse(run("find-handoffs.mjs", ["--cwd", d, "--all", "--limit", "abc"], { env })).count, 0);
});

test("collect-state --commit stages and commits only a dirty tree", () => {
  const d = repo();
  writeFileSync(join(d, "a.txt"), "a");
  const o = JSON.parse(run("collect-state.mjs", ["--cwd", d, "--check", "--commit", "stop for lunch"]));
  assert.equal(o.committed, true);
  assert.equal(git(d, "log", "-1", "--format=%s").trim(), "wip: handoff - stop for lunch");
  assert.equal(git(d, "status", "--porcelain").trim(), "");
});

test("collect-state --push without a remote reports failure and never forces", () => {
  const d = repo();
  const o = JSON.parse(run("collect-state.mjs", ["--cwd", d, "--check", "--push"]));
  assert.match(o.push_status, /^FAILED/);
});

test("collect-state --check creates nothing and gives no file_path; --repo targets .claude/handoffs", () => {
  const d = repo(), store = tmp(), env = { ...process.env, HANDOFF_DIR: join(store, "s") };
  const c = JSON.parse(run("collect-state.mjs", ["--cwd", d, "--check"], { env }));
  assert.equal(c.file_path, undefined);
  assert.equal(existsSync(join(store, "s")), false);
  const r = JSON.parse(run("collect-state.mjs", ["--cwd", d, "--repo"], { env }));
  assert.ok(r.file_path.includes(join(".claude", "handoffs")));
});

test("find-handoffs lists newest first, filters, and ignores done/", () => {
  const d = repo(), store = tmp(), env = { ...process.env, HANDOFF_DIR: store };
  const project = JSON.parse(run("collect-state.mjs", ["--cwd", d, "--check"], { env })).project;
  const dir = join(store, project);
  mkdirSync(join(dir, "done"), { recursive: true });
  const mk = (name, topic, age) => {
    const p = join(dir, name);
    writeFileSync(p, `---\nproject: ${project}\ntopic: ${topic}\nbranch: main\n---\n# x\n`);
    const t = new Date(Date.now() - age * 1000);
    utimesSync(p, t, t);
  };
  mk("20260101-000000-old.md", "old", 100);
  mk("20260102-000000-new.md", "new", 10);
  writeFileSync(join(dir, "done", "20250101-000000-gone.md"), "---\ntopic: gone\n---\n");
  const all = JSON.parse(run("find-handoffs.mjs", ["--cwd", d], { env }));
  assert.deepEqual(all.handoffs.map((h) => h.topic), ["new", "old"]);
  const f = JSON.parse(run("find-handoffs.mjs", ["--cwd", d, "--filter", "OLD"], { env }));
  assert.deepEqual(f.handoffs.map((h) => h.topic), ["old"]);
});

test("new-session --dry-run builds a quoted claude command that loads the handoff", () => {
  const d = tmp(), f = join(d, "h h.md");
  writeFileSync(f, "x");
  const o = JSON.parse(run("new-session.mjs", [f, "--cwd", d, "--title", "my work", "--dry-run"]));
  assert.equal(o.launched, false);
  assert.equal(o.command, `claude -n "my work" "/handoff:pickup ${f}"`);
  assert.throws(() => run("new-session.mjs", [join(d, "missing.md"), "--dry-run"], { stdio: "pipe" }));
});

test("session-start hook mentions a fresh handoff, stays silent for old ones and for resume", () => {
  const d = repo(), store = tmp(), env = { ...process.env, HANDOFF_DIR: store };
  const project = JSON.parse(run("collect-state.mjs", ["--cwd", d, "--check"], { env })).project;
  const dir = join(store, project);
  mkdirSync(dir, { recursive: true });
  const f = join(dir, "20260107-000000-demo.md");
  writeFileSync(f, `---\nproject: ${project}\ntopic: demo\n---\n`);
  const hook = (input) => run("session-start.mjs", [], { env, input: JSON.stringify(input) });

  const msg = JSON.parse(hook({ cwd: d, source: "startup" })).hookSpecificOutput.additionalContext;
  assert.match(msg, /20260107-000000-demo\.md/);
  assert.match(msg, /Do not load it/);
  assert.equal(hook({ cwd: d, source: "resume" }), "");

  const old = new Date(Date.now() - 5 * 24 * 3600 * 1000);
  utimesSync(f, old, old);
  assert.equal(hook({ cwd: d, source: "startup" }), "");
});
