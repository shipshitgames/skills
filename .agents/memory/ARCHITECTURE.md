# `.agents/` Architecture

The `.agents/` folder is the **operating system** for working in this repo. It is
platform-neutral; `.claude/` and `.codex/` are thin symlinks into it so both agents share
the same memory and maintenance skills.

## Layout

- `memory/` — persistent context (`MEMORY`, `CONTEXT`, `ARCHITECTURE`, `DO-AND-DONT`). Read first.
- `SYSTEM/` — authoring standards (`SKILL-STANDARDS`, `PLATFORM-ADAPTATIONS`).
- `skills/` — meta-skills that maintain THIS repo (`skill-validator`, `skill-auditor`,
  `readme-sync`). Loaded via the `.claude/skills` + `.codex/skills` symlinks.
- `SESSIONS/` — dated session logs for continuity.

## Why symlinks

`.claude/skills -> ../.agents/skills` and `.codex/skills -> ../.agents/skills` so both
agents load the same maintenance skills and memory. The **published game skills** live
separately under `skills/` (the product) and are not auto-loaded while working on the repo.

## Replicating in project repos

Every studio repo gets its own `.agents/memory/` (its decisions/context) plus the curated
working skills for that project. See the studio project memory for the per-repo skill
distribution (games pull engine + genre + system skills from `shipshitgames/skills`; the
monorepo pulls TypeScript/React/Turborepo/shadcn skills from `shipshitdev/skills`).
