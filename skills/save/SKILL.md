---
name: save
description: Write a handoff document that lets a fresh Claude session (cold context, any model) continue the current work. Captures the mission, the user's latest request verbatim, state, decisions, dead ends, constraints, open questions and exact next steps, plus git state read from the repo. Optionally commits and pushes first, or puts the file in the repo so another account or machine can pull it. Use when the user says "handoff", "hand off", "save progress", "wrap up this session", "I'm running out of context", "pass this to a new session", or types /handoff:save.
when_to_use: The context window is filling (about 70-80%), the user is stopping for the day, or work should move to another session, account, machine or agent. Do not use to resume work; that is /handoff:pickup.
argument-hint: "[topic: slug] [repo] [commit] [push] [to NAME | new] [focus text]"
---

# /handoff:save

Write one file a different agent can act on with no memory of this session. Optimise it for a machine reader: dense, specific, absolute paths, no narrative.

Arguments: $ARGUMENTS
Session id: `${CLAUDE_SESSION_ID}` (if this still reads as a literal placeholder, the id is unknown; pass nothing).

## Steps

1. **Parse the arguments.**
   - `topic: slug` names the file. Otherwise derive a 2-4 word slug from the work.
   - `repo` writes into `<repo>/.claude/handoffs/` so the file travels with git (another account, machine or teammate). Default is the private user store `~/.claude/handoffs/<project>/`.
   - `commit` / `push` allow the script to stage everything, commit `wip: handoff - ...` and push. Without them nothing is committed or pushed. If `repo` is set and the tree is dirty, ask once (choice question: commit and push, commit only, neither) because the other side only sees what is pushed.
   - `to NAME` / `new` means deliver afterwards: finish this skill, then follow `/handoff:new`.
   - Anything else is a focus: weight the document towards it.

2. **Collect facts** (read-only, nothing committed yet):
   ```
   node "${CLAUDE_PLUGIN_ROOT}/scripts/collect-state.mjs" --session "${CLAUDE_SESSION_ID}" --topic <slug> [--repo]
   ```
   It prints JSON: project, branch, head, ahead/behind, dirty files, recent commits, detected commands, transcript path and `file_path` (where to write). An unsubstituted session placeholder is ignored (session_id becomes "unknown"). Do not run git by hand to repeat it.

3. **Gather the rest from the conversation**, not from tool output: the goal, the user's latest request word for word, every instruction or prohibition the user gave, what is done, what is half done, what was tried and failed, decisions with reasons, what is waiting on the user, how to verify.

4. **Route durable knowledge elsewhere.** Facts that stay true across sessions (conventions, architecture, build workflow) belong in the project's memory or CLAUDE.md. If the project has a memory index, save new durable facts there and leave a one-line pointer in the handoff. The handoff holds transient state only.

5. **Write the file** to `file_path` using `${CLAUDE_SKILL_DIR}/template.md`. Keep every section header; write `(none)` for an empty one so the reader knows it was considered. Fill the frontmatter from the script output.

6. **Privacy check.** Re-read what you wrote. Never include secret values (tokens, passwords, keys, private URLs with credentials, personal data the task does not need). Write the name of the secret and where it lives instead. List what you left out by name in `sensitive_items`.

7. **Commit and push, only if step 1 allowed it** (so the handoff file is in the commit in `repo` mode):
   ```
   node "${CLAUDE_PLUGIN_ROOT}/scripts/collect-state.mjs" --check --commit "handoff: <topic>" [--push]
   ```
   Then edit the file's "3 State" Git line with the printed `push_status`, `head` and `committed` values. In `repo` mode with `push`, the file edit itself stays uncommitted; that is fine, the pushed copy already says the commit hash. Never force-push.

8. **Report in at most five lines:** the file path, topic, branch and push status, the top 2-3 next actions, and how to resume: `/handoff:pickup <path>` in any new session, or `claude "/handoff:pickup <path>"` from a shell. Do not replay the document.

## Rules

- Hand off early. The writing needs headroom; do it at 70-80% context, not at the limit.
- Never force-push or switch branches. Stay on the current branch.
- Next actions must name files, functions and commands. "Continue the refactor" is useless; "finish `parseConfig` in `src/config.ts:40`, then run `npm test -- config`" is not.
- Record hypotheses you already ruled out. They save the next session the most time.
- Quote the user for requests and constraints; paraphrase only your own conclusions.
