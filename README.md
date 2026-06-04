# Ship Shit Games — Skills

AI agent skills for vibe-coding **3D browser games** with Claude Code (Opus) + Codex.
Built and battle-tested live on the **shipshitshow** YouTube channel.

## Install

```bash
npx skills add shipshitgames/skills              # all of them
npx skills add shipshitgames/skills --skill fps-arena   # just one
```

Or copy a skill folder from `skills/` into your project's `.claude/skills/` (and `.codex/skills/`).

## What's in here

These are the same skills we use to ship our open-source games. They teach the agent
*our* architecture — imperative Three.js + a `GameContext` / `GameSystems` registry,
data-driven content, PartyKit multiplayer, and an `assets.json`-driven pipeline — so it
generates code that fits the `@shipshitgames/engine` conventions instead of generic
Three.js spaghetti.

### Foundation
- **[shipshit-engine](./skills/shipshit-engine)** — the core architecture every game follows. Load this first.
- **[vibe-game-workflow](./skills/vibe-game-workflow)** — idea → TinyPRD → build feature-by-feature → test → ship.

### Genres
- **[fps-arena](./skills/fps-arena)** — first-person, DOOM-like horde / survivors shooter.
- **[tower-defense-3d](./skills/tower-defense-3d)** — 3D tower defense on the same engine.
- **[isometric-3d](./skills/isometric-3d)** — orthographic isometric games (tactics, builders, crawlers).

### Systems
- **[partykit-multiplayer](./skills/partykit-multiplayer)** — real-time multiplayer on PartyKit / Cloudflare.
- **[game-asset-pipeline](./skills/game-asset-pipeline)** — `assets.json` manifest + AI gen → optimize → register.
- **[sprite-concept-batches](./skills/sprite-concept-batches)** — lore-backed concept batches + prompt/history ledger.
- **[sprite-asset-promotion](./skills/sprite-asset-promotion)** — promote approved sprite drafts into game-ready assets.
- **[sprite-animation-gyms](./skills/sprite-animation-gyms)** — video-gen animation (1s-clip rule), pixel-snapping, and the gym QA harness + level-editor pattern.
- **[playwright-game-testing](./skills/playwright-game-testing)** — give the agent eyes: screenshot, assert, self-fix.

## Repo layout

```
skills/     the published game-dev skills (SKILL.md + optional reference/)
.agents/    operating system for working on this repo (memory, standards, meta-skills)
.claude/    symlinks → .agents/{memory,skills}
.codex/     symlinks → .agents/{memory,skills} + instructions.md
```

For general-purpose dev skills (TypeScript, React, Turborepo, shadcn, Next.js, testing),
see the sibling library **[shipshitdev/skills](https://github.com/shipshitdev/skills)** —
the studio repo pulls its working skills from there.

## Open core

These skills are **free and MIT-licensed** — fork them, ship games, send PRs.

The full studio workflow — premium genre templates, complete commented game source, the
advanced build playbooks, the desktop studio app, and the private community — is the
one-time **lifetime All Access** pack at [games.shipshit.dev](https://games.shipshit.dev).
Buy once, keep forever.

## Games built with these

See the open-source gallery at [games.shipshit.dev](https://games.shipshit.dev).

## License

MIT — see [LICENSE](./LICENSE).
