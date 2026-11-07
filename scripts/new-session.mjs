#!/usr/bin/env node
// Opens a new terminal window running `claude` that starts by loading a handoff.
// Use it when the desktop app's session tool and SendMessage are not available.
//
//   node new-session.mjs <handoff.md> [--cwd DIR] [--title NAME] [--model ID] [--effort LEVEL] [--permission-mode MODE] [--dry-run]
//
// Windows opens Windows Terminal (or cmd). macOS and Linux print the command to paste.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const argv = process.argv.slice(2);
const val = (n) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : null;
};
const file = argv.find((a, i) => !a.startsWith("--") && !["--cwd", "--title", "--model", "--effort", "--permission-mode"].includes(argv[i - 1]));
if (!file) {
  console.error("usage: new-session.mjs <handoff.md> [--cwd DIR] [--title NAME] [--model ID] [--effort LEVEL] [--permission-mode MODE] [--dry-run]");
  process.exit(2);
}
const path = resolve(file);
if (!existsSync(path)) {
  console.error(`new-session: ${path} does not exist`);
  process.exit(1);
}
const cwd = resolve(val("--cwd") ?? process.cwd());
const title = val("--title") ?? "handoff";
const model = val("--model");
const effort = val("--effort");
const mode = val("--permission-mode");
// Mirroring never raises privilege: bypassPermissions is refused, start it by hand if wanted.
const EFFORTS = ["low", "medium", "high", "xhigh", "max"];
const MODES = ["acceptEdits", "auto", "manual", "dontAsk", "plan"];
if (effort && !EFFORTS.includes(effort)) {
  console.error(`new-session: --effort must be one of ${EFFORTS.join(", ")}`);
  process.exit(2);
}
if (mode && !MODES.includes(mode)) {
  console.error(`new-session: --permission-mode must be one of ${MODES.join(", ")} (bypassPermissions is not mirrored)`);
  process.exit(2);
}

const args = ["-n", title, ...(model ? ["--model", model] : []), ...(effort ? ["--effort", effort] : []), ...(mode ? ["--permission-mode", mode] : []), `/handoff:pickup ${path}`];
const q = (s) => `"${s.replace(/"/g, '\\"')}"`;
const command = `claude ${args.map((a) => (/[\s"]/.test(a) ? q(a) : a)).join(" ")}`;

if (argv.includes("--dry-run") || process.platform !== "win32") {
  console.log(JSON.stringify({ cwd, command, launched: false }, null, 2));
  process.exit(0);
}

// Windows Terminal if present, else a plain cmd window. Both start in cwd and keep the window open.
// `cmd /k` keeps the window up even if `claude` fails to start, so the error stays visible.
const done = (launcher) => {
  console.log(JSON.stringify({ cwd, command, launched: true, launcher }, null, 2));
  process.exit(0);
};
const wt = spawn("wt", ["-d", cwd, "cmd", "/k", command], { detached: true, stdio: "ignore", windowsVerbatimArguments: true });
wt.on("spawn", () => {
  wt.unref();
  done("wt");
});
wt.on("error", () => {
  // windowsVerbatimArguments: pass our own quotes to cmd.exe untouched
  const c = spawn("cmd", ["/c", "start", '""', "/D", `"${cwd}"`, "cmd", "/k", `"${command}"`], { detached: true, stdio: "ignore", windowsVerbatimArguments: true });
  c.on("spawn", () => {
    c.unref();
    done("cmd");
  });
  c.on("error", (e) => {
    console.error(`new-session: could not open a window (${e.message}). Run this yourself in ${cwd}:\n${command}`);
    process.exit(1);
  });
});
