#!/usr/bin/env node
// Writes a text-only, per-day transcript of a Claude Code session: user messages and assistant
// replies, no tool calls or results, split by UTC day, repeated turns removed.
//
//   node extract-transcript.mjs <session.jsonl | session-id> <outDir> [title]
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const [src, outDir, title = "Chat"] = process.argv.slice(2);
if (!src || !outDir) {
  console.error("usage: extract-transcript.mjs <session.jsonl | session-id> <outDir> [title]");
  process.exit(2);
}

function resolveSource(s) {
  if (existsSync(s)) return s;
  const base = join(homedir(), ".claude", "projects");
  if (existsSync(base)) {
    for (const d of readdirSync(base)) {
      const p = join(base, d, `${s.replace(/\.jsonl$/, "")}.jsonl`);
      if (existsSync(p)) return p;
    }
  }
  console.error(`extract-transcript: cannot find ${s}`);
  process.exit(1);
}

const textOf = (msg) => {
  const c = msg?.content;
  if (typeof c === "string") return c;
  if (!Array.isArray(c)) return "";
  return c.filter((b) => b?.type === "text" && typeof b.text === "string").map((b) => b.text).join("\n");
};

// Harness text injected into user turns.
const NOISE = /^(<system-reminder>|<command-(name|message)>|Caveat:|<local-command|<user-prompt-submit-hook)/;

const days = new Map();
const seen = new Set();
const stats = { user: 0, assistant: 0, skipped: 0, duplicates: 0 };

for (const line of readFileSync(resolveSource(src), "utf8").split(/\r?\n/)) {
  if (!line.trim()) continue;
  let o;
  try {
    o = JSON.parse(line);
  } catch {
    continue;
  }
  if ((o.type !== "user" && o.type !== "assistant") || o.isMeta || !o.timestamp) continue;
  if (o.type === "user" && Array.isArray(o.message?.content) && o.message.content.some((b) => b?.type === "tool_result")) continue;

  const text = textOf(o.message).replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "").trim();
  if (!text || NOISE.test(text)) {
    stats.skipped++;
    continue;
  }
  // A log can repeat turns after compaction: same uuid, or same role, minute and text.
  const key = o.uuid ?? `${o.type}|${o.timestamp.slice(0, 16)}|${text}`;
  if (seen.has(key)) {
    stats.duplicates++;
    continue;
  }
  seen.add(key);

  const day = o.timestamp.slice(0, 10);
  const hhmm = o.timestamp.slice(11, 16);
  const role = o.type === "user" ? "## USER" : "### ASSISTANT";
  stats[o.type]++;
  if (!days.has(day)) days.set(day, []);
  days.get(day).push(`\n${role} · ${day} ${hhmm}\n\n${text}\n`);
}

mkdirSync(outDir, { recursive: true });
for (const [day, parts] of [...days].sort()) {
  const header = `# ${title} · ${day}\n\nText only: user messages and assistant replies. Tool calls and results are left out.\n`;
  writeFileSync(join(outDir, `${day}.md`), header + parts.join("\n"), "utf8");
}
console.log(JSON.stringify({ ...stats, days: [...days.keys()].sort() }, null, 2));
