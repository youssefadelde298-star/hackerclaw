# Skills

Skills are pre-authored playbooks the agent loads on demand. The format
follows the **Agent Skills** convention: a directory containing a `SKILL.md`
file with YAML frontmatter and a Markdown body.

```
skills/
  _template/ · csrf/ · deserialize/ · file-upload/ · graphql/ · jwt/
  path-traversal/ · race/ · recon/ · session-fixation/ · session-hijacking/
  sqli/ · ssrf/ · ssti/ · supabase/ · takeover/ · webvuln/
  week3-evidence-review/ · xss/
```

Some skills include auxiliary files under `payloads/` or a lab-cases file; those files contain the documented, scoped fixtures for that skill.

## SKILL.md frontmatter

| Field | Required | Notes |
| --- | --- | --- |
| `name` | yes | Lowercase-kebab (`[a-z0-9-]`), ≤64 chars. Should match the directory name. |
| `description` | yes | ≤1024 chars. **This is the only thing the model sees until it loads the skill** — include explicit "Use when …" trigger conditions so it knows when to invoke it. There is no separate `triggers` list (description-driven). |
| `allowed-tools` | no | List restricting which tools the skill may call (e.g. `http`, `shell`, `file_write`). Omit for no restriction. Legacy alias: `tools`. |
| `disable-model-invocation` | no | `true` = user-only: hidden from the model, invoked only via the `/<name>` slash command. |

Everything after the frontmatter is the playbook body, delivered to the
model verbatim when it calls `load_skill`. `${SKILL_DIR}` in the body is
replaced with the skill's absolute directory path.

## Where skills load from

Discovered automatically, in increasing precedence (later overrides earlier
on a name collision):

1. this built-in `skills/` directory
2. `./.hackerclaw/skills/` (project-local — scoped to the repo)
3. `~/.hackerclaw/builtin-skills/` (installer-managed shipped skills)
4. `~/.hackerclaw/skills/` (personal)
5. any dirs passed via `--skills <dir>` or the `skills_dirs` config

Use `~/.hackerclaw/skills/` for personal skills you want available
everywhere, or the project-local `./.hackerclaw/skills/` for skills
scoped to a single repo.

On first use, legacy `.pentesterflow` skill files are copied only when the
matching `.hackerclaw` file does not exist; the legacy tree is left untouched.

Just drop a `<name>/SKILL.md` into one of these — no config needed. Skills
**hot-reload** on save. Directories starting with `.` or `_` are ignored
(so `_template/` is not loaded as a skill).

## Creating a skill

- **Scaffold:** run `/skills new <name>` in the TUI — it writes a templated
  `./.hackerclaw/skills/<name>/SKILL.md` and loads it immediately.
- **By hand:** copy [`_template/SKILL.md`](_template/SKILL.md) into
  `<name>/SKILL.md` and edit.

## Managing skills

- `/skills` — interactive enable/disable picker.
- `/skills enable|disable <name>` — toggle from the prompt.
- `/<name>` — invoke a skill explicitly for your next turn.

All shipped skills are validated by `src/skills/conformance.test.ts`
(name/description/allowed-tools), so a malformed skill fails CI.

## Test fixture safety

Payload files are read-only references, not an instruction to send requests. The Member 3 bundle uses a plain-text canary and lab-scope checklists; it does not ship path-bypass strings, internal SSRF destinations, data-extraction probes, or active upload files. Runtime checks require an explicitly authorized lab and human review.

CSRF, XSS, and session playbooks are also limited to tester-owned training accounts and inert or metadata-only checks. They intentionally omit cross-user actions, token/session replay, and bypass procedures.

The Member 6 CSRF, session-fixation, session-hijacking, and XSS playbooks are covered by
`src/skills/member6.test.ts` and the shared conformance test.
