// handoff for OpenCode 2: registers /handoff save and pickup. "new" starts a Claude terminal or desktop session, so it stays Claude-only.
// The SessionStart notice (hooks/hooks.json) has no OpenCode equivalent here yet.
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const skillsDir = join(root, "skills")
const OPENCODE_SKILLS = new Set(["save", "pickup"])

/** `{name, description, body}` of a SKILL.md; the front matter holds only those two keys. */
function parseSkill(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text)
  if (!m) return { name: "", description: "", body: text }
  const field = (key) => {
    const line = new RegExp(`^${key}:\\s*(.*)$`, "m").exec(m[1])
    return line ? line[1].trim().replace(/^["']|["']$/g, "") : ""
  }
  return { name: field("name"), description: field("description"), body: m[2] }
}

function loadSkills() {
  const out = []
  if (!existsSync(skillsDir)) return out
  for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
    const path = join(skillsDir, entry.name, "SKILL.md")
    if (!entry.isDirectory() || !OPENCODE_SKILLS.has(entry.name) || !existsSync(path)) continue
    const { name, description, body } = parseSkill(readFileSync(path, "utf8"))
    if (!description) continue
    // Fill the Claude Code variables; ${CLAUDE_SESSION_ID} stays literal, which the skills read as "id unknown".
    const skillDir = dirname(path)
    const content = body.replaceAll("${CLAUDE_PLUGIN_ROOT}", root.replaceAll("\\", "/")).replaceAll("${CLAUDE_SKILL_DIR}", skillDir.replaceAll("\\", "/"))
    out.push({ id: `handoff-${entry.name}`, name: name || `handoff-${entry.name}`, description, path, content })
  }
  return out
}

export default {
  id: "handoff",
  async setup(ctx) {
    if (ctx.options?.skills === false) return
    const skills = loadSkills()
    const registration = await ctx.skill.transform((editor) => {
      for (const skill of skills) {
        if (editor.get(skill.id)) continue // a skill the user already defined wins
        editor.add({ ...skill, autoinvoke: true })
      }
    })
    return () => void registration.dispose()
  },
}
