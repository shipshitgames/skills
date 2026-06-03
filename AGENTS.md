# Ship Shit Games — Skills — Agent Instructions

This is the `shipshitgames/skills` repo: AI agent skills for vibe-coding **3D browser
games** with Claude Code + Codex. Battle-tested live on the **shipshitshow** YouTube channel.

## Repo Structure

- `skills/` — the published game-dev skills (`SKILL.md` + optional `reference/`)
- `.agents/` — repo operating system (memory, meta-skills, system docs, sessions)
- `.claude/`, `.codex/` — symlinks into `.agents/` (`memory` + `skills`)

## Rules

- Follow the Agent Skills spec: `.agents/SYSTEM/SKILL-STANDARDS.md`
- `name` must match the directory; `description` states WHAT + WHEN (front-load the use case)
- `version`/`tags` go inside the `metadata:` block as quoted strings, never top-level
- No `auto_activate`, `auto_trigger`, or `risk` fields
- Every skill teaches the `@shipshit/engine` conventions (imperative Three.js + the
  `GameContext`/`GameSystems` registry), grounded in the canonical `fpsdemo`
- Conventional commits (`feat:`, `fix:`, `refactor:`, `chore:`); never commit secrets

## Before editing skills

1. Read the `SKILL.md` you'll modify
2. Read `.agents/memory/MEMORY.md` for repo decisions + the engine canon
3. Find a sibling skill and match its patterns
