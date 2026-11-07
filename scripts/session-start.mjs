#!/usr/bin/env node
// SessionStart hook: if this project has a recent unconsumed handoff, tell the model it exists.
// It never loads the handoff itself; the user decides with /handoff:pickup.
import { basename, resolve } from "node:path";
import { listHandoffs, projectSlug, repoRoot } from "./lib.mjs";

const MAX_AGE_MS = 3 * 24 * 3600 * 1000;

let input = {};
try {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  input = raw.trim() ? JSON.parse(raw) : {};
} catch {}

if (input.source && !["startup", "clear"].includes(input.source)) process.exit(0);

const cwd = resolve(input.cwd ?? process.cwd());
const newest = listHandoffs({ project: projectSlug(cwd), root: repoRoot(cwd) })[0];
if (!newest || Date.now() - newest.mtime > MAX_AGE_MS) process.exit(0);

const hours = Math.max(1, Math.round((Date.now() - newest.mtime) / 3600000));
const note =
  `A handoff for this project was saved ${hours}h ago: ${basename(newest.path)}` +
  (newest.topic ? ` (topic: ${newest.topic})` : "") +
  `. Mention it to the user in one line and offer /handoff:pickup. Do not load it or act on it unless they say so.`;

console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: note } }));
