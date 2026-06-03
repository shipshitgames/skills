# Ship Shit Games — Skills Repo Memory

last_verified: 2026-06-03

## What This Repo Is

The game-dev skill library for **Ship Shit Games** — agent skills that teach Claude/Codex
to vibe-code 3D browser games in the studio's `@shipshit/engine` style. Installable via
`npx skills add shipshitgames/skills`. Sibling to the general-purpose `shipshitdev/skills`
library (TypeScript, React, Turborepo, shadcn, etc.), which the studio monorepo pulls from.

## Repo Identity

- **Owner:** Vincent (decod3rs / vincent@genfeed.ai) — solo founder, zero-code workflow
  (AI writes the code, Vincent architects/reviews)
- **Org:** shipshitgames · **Default branch:** master · **License:** MIT
- Built and streamed on the **shipshitshow** YouTube channel

## The Engine Canon (what every skill teaches)

- **Imperative Three.js** for the game; React + Tailwind/shadcn for the HUD/menu shell
  ONLY — deliberately **not** react-three-fiber.
- `Game` = a thin orchestrator owning a `GameContext` (shared mutable world) + a
  `GameSystems` registry; systems call siblings via `this.sys.<name>`; the registry uses
  type-only imports.
- **Data-driven** content: `constants.ts` + `data/*.ts`; logic never hardcodes content.
- `assets.json` manifest is the single source of truth for assets.
- **PartyKit** (Cloudflare) for multiplayer.
- Canonical reference implementation: `games/scourge-survivors` (first-person DOOM-like
  horde/survivors shooter).

## Skills (snapshot 2026-06-03)

| Skill | Role |
|-------|------|
| shipshit-engine | Foundation — load first; the Game/GameContext/GameSystems architecture |
| vibe-game-workflow | Methodology — idea → TinyPRD → build → test → ship |
| fps-arena | Genre — first-person DOOM-like horde/survivors shooter |
| tower-defense-3d | Genre — 3D tower defense on the same engine |
| isometric-3d | Genre — orthographic isometric games + A* |
| partykit-multiplayer | System — real-time multiplayer on PartyKit |
| game-asset-pipeline | System — assets.json + AI gen → optimize → register |
| sprite-concept-batches | System — lore-backed sprite concepts + prompt/history ledger |
| sprite-asset-promotion | System — approved draft cutouts -> runtime sprite assets |
| playwright-game-testing | System — agent-eyes visual test/self-fix loop |

## Architecture Decisions

### Single-source skills under `skills/` (2026-06-03)

Mirror `shipshitdev/skills`: one `skills/` directory; `.agents/` holds the operating
system; `.claude/` and `.codex/` symlink into `.agents/`.

### Imperative Three.js, not R3F (2026-06-03)

Preserve the `games/scourge-survivors` architecture. Imperative Three.js has the largest LLM training
corpus, and the system-registry already separates simulation from rendering.

### One-time lifetime access (2026-06-03)

These skills are free/MIT (the funnel). The paid layer is a one-time **lifetime All
Access** pack (premium templates, full game source, advanced skills, the desktop studio
app, community) — not a subscription. Skool/membership maybe later.
