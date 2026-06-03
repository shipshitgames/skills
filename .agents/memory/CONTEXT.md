# Working Context — Ship Shit Games Skills

last_verified: 2026-06-03

## You Are Working ON the Library

This is NOT a game that uses skills. You are editing/maintaining the game-dev skill
library itself. Skills here get installed by other projects and users.

## Owner Context

- **Vincent** (decod3rs / vincent@genfeed.ai) — solo founder, zero-code workflow.
  AI writes all code; Vincent architects and reviews.
- Direct communication — no fluff, no "would you like me to…".

## The Studio

Two GitHub orgs: **shipshitdev** (dev tooling — v0 scaffolder, shipcode, ui, skills) and
**shipshitgames** (the studio). Open-core: games + engine + these skills are MIT; the
paid layer is a one-time lifetime All Access pack. Default branch everywhere: `master`.

## Sibling Skill Libraries

- **shipshitgames/skills** (this repo) — game-dev skills (engine, genres, systems)
- **shipshitdev/skills** — general dev skills (TypeScript, React, Turborepo, shadcn,
  nextjs, testing, …). The studio **monorepo** pulls its working skills from here.

## Common Workflows

### Add a skill
`mkdir skills/<name>` → write `SKILL.md` (spec-compliant) → update root README → validate.

### Lint
Markdown via markdownlint (port the config from shipshitdev/skills when the build is added).
