# Chat handoff template

Write `HANDOFF.md` with these sections, in order. Skip a section only if it is truly empty and say `(none)`. Plain, dense, absolute paths, dates as `YYYY-MM-DD`.

```markdown
# <Project>: handoff <N> for the next AI agent (<what this chat covered>)

Written <date> from session `<short session id>` (<model>). Read this first; grep `transcript-by-day/` for detail.

## 1. The product / the work
What it is, who it is for, the stack, what exists now. Names of the main parts and where each lives.

## 2. How the user works (follow these)
Standing rules inferred from corrections and repeated requests: decide alone or ask, reply style, required tools and libraries, things the user banned, review habits, time limits on runs.

## 3. Where things are
| Place | What |
|---|---|
| `<absolute path or URL>` | <what it holds, which file to open first> |

## 4. State (<date>)
Branch and commit, test and build status, what is half done, what is waiting on the user (list as questions with a recommended answer), what only the user can do.

## 5. Decisions made in this chat
Decision, then the reason. Mark any that replaced an earlier decision.

## 6. Open items / next steps
Ordered. Each names files and commands.

## 7. Things that went wrong (avoid)
Mistakes, dead ends, tools that failed, with the cause.

## 8. Environment
OS, shell, runtime versions, accounts or services involved (names only, never secrets), commands to start things.

## 9. Chat timeline
One line per phase with the date: what happened and where the detail is in `transcript-by-day/`.
```
