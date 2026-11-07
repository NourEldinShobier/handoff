#!/usr/bin/env node
// Lists handoff files for the current project, newest first, as JSON.
//   node find-handoffs.mjs [--cwd DIR] [--all] [--filter TEXT] [--limit N]
import { basename, resolve } from "node:path";
import { listHandoffs, projectSlug, repoRoot } from "./lib.mjs";

const argv = process.argv.slice(2);
const val = (n) => {
  const i = argv.indexOf(n);
  return i >= 0 ? argv[i + 1] : null;
};
const cwd = resolve(val("--cwd") ?? process.cwd());
const filter = (val("--filter") ?? "").toLowerCase();
const limit = Number(val("--limit")) > 0 ? Number(val("--limit")) : 10;

const project = projectSlug(cwd);
let rows = listHandoffs({ project, root: repoRoot(cwd), all: argv.includes("--all") });
if (filter) rows = rows.filter((r) => basename(r.path).toLowerCase().includes(filter));

console.log(
  JSON.stringify(
    {
      project,
      count: rows.length,
      handoffs: rows.slice(0, limit).map((r) => ({
        path: r.path,
        source: r.source,
        modified: new Date(r.mtime).toISOString(),
        project: r.project,
        topic: r.topic,
        written_at: r.written_at,
        branch: r.branch,
        head: r.head,
        delivered_to: r.delivered_to,
      })),
    },
    null,
    2,
  ),
);
