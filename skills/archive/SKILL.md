---
name: archive
description: Archive a whole chat as a durable handoff folder - a project-level HANDOFF.md for the next agent, a README, and a text-only transcript split by day - so a project can be picked up months later. Use when the user says "archive this chat", "save the whole chat for the next agent", "chat handoff", "close out this project chat", or types /handoff:archive. Different from /handoff:save, which is a short-lived baton for the next session.
when_to_use: A long chat is finishing and its decisions, user preferences and layout of the work must survive for any future agent. For continuing right now, use /handoff:save or /handoff:new.
argument-hint: "[session-id | transcript.jsonl] [to DIR] [title]"
---

# /handoff:archive

Arguments: $ARGUMENTS
Current session id: `${CLAUDE_SESSION_ID}`

Result: a folder `<project>-chat-handoff-N/` holding
```
README.md                         three lines: read HANDOFF.md first, grep the transcripts, where the raw log is
HANDOFF.md                        the whole project for the next agent
transcript-by-day/YYYY-MM-DD.md   user messages and assistant replies only
memory-notes/                     optional copies of memory files this chat wrote
```

## Steps

1. **Find the source.** The argument may be a session id or a `.jsonl` path; default is the current session.
   - Current session: run `node "${CLAUDE_PLUGIN_ROOT}/scripts/collect-state.mjs" --check --session "${CLAUDE_SESSION_ID}"` for the project name and `transcript_path`.
   - Another session: use the argument as the source. Take the project from the `cwd` field of the first entry in that `.jsonl` (run collect-state with `--cwd` set to it), and do not use `transcript_path` from the current session.

2. **Choose the destination.**
   - `to DIR` if given.
   - Else, if the working directory sits inside an optional workspace layout (a parent holding both `WORKSPACE.md` and a `drive/` folder): use `drive/ai-chat-history/` (create it) and say so in the report.
   - Else `~/.claude/handoffs/<project>/archive/`.
   Number the folder: the next unused `N` for `<project>-chat-handoff-N`.

3. **Extract the transcript:**
   ```
   node "${CLAUDE_PLUGIN_ROOT}/scripts/extract-transcript.mjs" <source> <folder>/transcript-by-day "<title>"
   ```
   Report the stats it prints (user and assistant message counts, days).

4. **Write `HANDOFF.md`** from `${CLAUDE_SKILL_DIR}/project-handoff.md`, drawn from the conversation and the transcript. It must stand alone: an agent that has never seen this chat reads it first and can continue. Skim the transcript with grep for decisions, corrections and anything the user repeated; repeated corrections are the user's rules.

5. **Write `README.md`** (three numbered lines as above, with the raw log path and the session id). If the chat wrote memory files, copy them to `memory-notes/` and note it in the README.

6. **Update the index.** Only if the destination was found through that workspace layout, add one line for the new folder to the "Handoffs" list in `WORKSPACE.md` (create the list if missing).

7. **Privacy check** as in `/handoff:save`: no secret values anywhere in HANDOFF.md or the README. The transcript is raw text of the chat; tell the user it may contain whatever was said in it.

8. **Report** the folder path, the file list, and the first line to give a new agent: `Read <folder>/HANDOFF.md first.`
