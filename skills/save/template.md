# Handoff document template

Write the file below. Keep all sections in order. An empty section keeps its header with `(none)` as the body. Use absolute paths. Write for an agent, not a person.

```markdown
---
project: <project slug from the script>
topic: <topic slug>
written_at: <generated_at from the script>
cwd: <cwd>
repo_root: <repo_root>
branch: <branch, or "none">
head: <full commit hash, or "none">
session_id: <session id or "unknown">
session_name: <name other sessions use to message this one, or "unknown">
transcript_path: <path or "unknown">
delivered_to: none
file_path: <file_path from the script>
sensitive_items: []   # names of secrets deliberately left out, never their values
---

# Handoff: <one line: what this work is>

## 0 Protocol (receiving agent: do this first)
1. Read this whole file, then every file under "12 Read first".
2. Check drift: compare the current branch, HEAD, ahead/behind, stash and working tree with "3 State". Note differences; do not fix them yet.
3. Tell the user, in their language: the objective, Priority 1, the drift, and anything under "8 Open questions". Ask whether to take over.
4. Take no action that changes anything until the user says yes. Reading is fine.
5. If this file is unclear, ask the source session if it is still running, then read `transcript_path` (JSON Lines; user messages are entries with "type":"user"), then ask the user. Use these to look things up, not to replace this file.

## 1 Orientation
- Language: user-facing = <language>; messages to other agents = <language or "same">
- User: <name or handle, role, timezone if relevant>
- How the user works: <standing rules observed this session: decide alone vs ask, reply style, tools or libraries to use or avoid, review habits>
- Environment: <OS, shell, runtime versions that matter>

## 2 Mission
- Goal: <what the work is for, in one or two sentences>
- Latest request (verbatim): "<the user's own words>"
- Done when: <acceptance criteria>

## 3 State
- Done: <item: files, result>
- In progress: <item: files, what is done, exactly where it stopped>
- Not started: <item: planned approach>
- Git: branch `<branch>`, HEAD `<short hash>`, <ahead/behind>, <dirty files or "clean">, push: <push_status>
- Files touched: <path: created | modified | deleted, complete | partial>
- External state: <running servers, deployed things, remote resources, with a command to re-check each>

## 4 Priorities and next actions
1. <specific action: file, function, command, expected result>
2. <...>
3. <...>

## 5 Decisions made this session
- <decision>: <reason>. Do not reopen unless the user does.

## 6 Constraints
- <the user's instructions and prohibitions, quoted>
- <technical limits discovered: versions, API behaviour, platform quirks>

## 7 Dead ends
- <approach tried>: <why it failed or was dropped>. Do not retry.

## 8 Open questions (for the user)
- <question>. Recommended answer: <yours>.

## 9 Verification
- <command or check>: expect <result>

## 10 Locations
- <label>: <absolute path, URL or id>

## 11 Commands
- build: `<cmd>`   test: `<cmd>`   run: `<cmd>`   (from the script's detected commands, plus anything else needed)

## 12 Read first
1. <path>: <why>
```
