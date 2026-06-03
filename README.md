# Ship Shit Games — Skills

AI agent skills for vibe-coding **3D browser games** with Claude Code (Opus) + Codex.
Built and battle-tested live on the **shipshitshow** YouTube channel.

## Install

```bash
npx skills add shipshitgames/skills
```

Or drop any skill folder into your project's `.claude/skills/` (and `.codex/skills/`).

## What's in here

These are the same skills we use to ship our open-source games. They teach the agent
*our* architecture — imperative Three.js + a `GameContext` / `GameSystems` registry,
data-driven content, PartyKit multiplayer, and an `assets.json`-driven pipeline — so it
generates code that fits the `@shipshit/engine` conventions instead of generic
Three.js spaghetti.

### Foundation
- **[shipshit-engine](./shipshit-engine)** — the core architecture every game follows. Load this first.
- **[vibe-game-workflow](./vibe-game-workflow)** — idea → TinyPRD → build feature-by-feature → test → ship.

### Genres
- **[fps-arena](./fps-arena)** — first-person, DOOM-like horde / survivors shooter.
- **[tower-defense-3d](./tower-defense-3d)** — 3D tower defense on the same engine.
- **[isometric-3d](./isometric-3d)** — orthographic isometric games (tactics, builders, crawlers).

### Systems
- **[partykit-multiplayer](./partykit-multiplayer)** — real-time multiplayer on PartyKit / Cloudflare.
- **[game-asset-pipeline](./game-asset-pipeline)** — `assets.json` manifest + AI gen → optimize → register.
- **[playwright-game-testing](./playwright-game-testing)** — give the agent eyes: screenshot, assert, self-fix.

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
