# handoff

Hand a Claude Code task to a fresh session without losing context.

Claude Code has no single built-in "hand off" command. It has pieces: resume, fork, cross-session messaging, cloud sessions. This plugin adds the missing part, a handoff document a cold session can act on, and wires the pieces around it.

| Command | What it does |
|---|---|
| `/handoff:save` | Writes a handoff document: mission, your latest request verbatim, state, decisions, dead ends, constraints, open questions, exact next steps. Git facts come from a script, not from memory. Optional `commit`, `push`, `repo`. |
| `/handoff:pickup` | Loads a handoff in a new session, checks the repo for drift, reports the objective and first priority, and starts only after you confirm. |
| `/handoff:new` | Saves (if needed) and starts the new session for you: through the Claude desktop app's session tool, by messaging an idle running session, or by opening a terminal window with `claude`. |

A `SessionStart` hook adds one line when the project has a handoff saved in the last three days, so the next session offers `/handoff:pickup`. It never loads one by itself.

## Install

```bash
claude plugin marketplace add NourEldinShobier/handoff
claude plugin install handoff@handoff
```

Restart Claude Code. Needs Node 18 or newer and git on `PATH`.

## Use

```text
/handoff:save                      write a handoff for this session
/handoff:save topic: auth-rewrite push repo
/handoff:new                       save, then start a new session on it
/handoff:new to api-worker         send it to a running idle session
/handoff:pickup                    in the new session: list this project's handoffs
/handoff:pickup <path>             load a specific file
```

Hand off at 70-80% context, not at the limit; the writing needs room.

## Where files go

- Default: `~/.claude/handoffs/<project>/<timestamp>-<topic>.md`, private to your machine. `HANDOFF_DIR` overrides the folder.
- `repo`: `<repo>/.claude/handoffs/`. The file travels with git, so another account, machine or teammate can pull it. Add `push` to push it. Nothing is committed or pushed unless you say so.
- Picked-up files move to `done/` (or are deleted, your choice at pickup).

## How a handoff stays honest

- The receiver reads, compares the repo with the file, and tells you what it found. It changes nothing until you say yes.
- When delivered by message, the receiver sends the sender `PICKUP ... | P1: ... | drift: ...`, then `CONFIRMED` after your yes. The sender stays open until then and checks that Priority 1 matches.
- A message from another session is information, not your approval.
- Secret values are never written; the file lists the names left out.

## Scripts

All in `scripts/`, plain Node, no dependencies, usable without Claude:

- `collect-state.mjs`: git/env facts as JSON; optional commit and push (never forces; falls back to `handoff/<branch>-<stamp>`).
- `find-handoffs.mjs`: lists a project's handoffs, newest first.
- `new-session.mjs`: opens a terminal window with `claude` loading a handoff (Windows Terminal or cmd; prints the command elsewhere).
- `session-start.mjs`: the hook.

## Not included

Hold-the-peers messaging and watcher transfer (from howar31/handoff), and the macOS-only `claude --desktop` seeding script (from desktop-handoff). The Claude desktop app's own session tool covers that case here. See [CREDITS.md](CREDITS.md).

## Development

```bash
npm test
claude plugin validate .
```

MIT licensed.
