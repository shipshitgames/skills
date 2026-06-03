# Ship Shit Games — Skills — Agent Workspace

You are working **ON the skill library**, not in a game that uses it.

## Structure

```
.agents/
├── README.md     # you are here
├── memory/       # persistent repo memory — read MEMORY.md first
├── SYSTEM/       # skill-authoring standards (SKILL-STANDARDS, PLATFORM-ADAPTATIONS)
├── skills/       # meta-skills to maintain THIS repo (skill-validator, skill-auditor, readme-sync)
└── SESSIONS/     # dated session logs for continuity
```

## This repository

```
skills/   the published game-dev skills (the product)
```

## Adding a skill

1. `mkdir skills/<name>` and write `SKILL.md` with spec-compliant frontmatter
2. Update the root `README.md` skill table
3. Validate against `.agents/SYSTEM/SKILL-STANDARDS.md`

## Before ending a session

Document what changed in `SESSIONS/YYYY-MM-DD.md`.
