---
name: space-shooter
description: Build a top-down arcade-pilot "survivors" space shooter — mouse-follow flight, an auto-escalating Scourge horde, stacking auto-fire weapons, XP-gem drafts, a multi-phase boss, and drydock meta-progression. Canonical game — Starblight.
license: MIT
metadata:
  version: "0.1.0"
  gameType: space-shooter
  tags: "space-shooter, survivors, twin-stick, three.js, game-dev"
  author: Ship Shit Games
when_to_use: "building a top-down space shooter / arcade-pilot survivors game, starblight, twin-stick flight, what does a space survivor game need"
disable-model-invocation: true
---

# Build a Space-Shooter Game

Top-down arcade-pilot **survivors** game — Vampire-Survivors loop with twin-stick flight.
Canonical game: **Starblight**. The machine-readable companion is `blueprint.json`
(the Build Plan engine reads it to match a game's genre and order the MVP worklist).

## Required asset classes (★ = MVP)
- ★ **Sprites** — player interceptor ship, 5 enemy types (grunt/swarmling/weaver/spitter/elite), 1 three-phase boss.
- ★ **UI** — XP bar, integrity/HP bar, upgrade cards, boss health bar. Later: main menu, drydock shop, results.
- ★ **VFX** — kill-pop particles, screen-shake trauma, thruster trails, boss-phase bursts, parallax starfield.
- ★ **Music/SFX** — ambience loop + weapon-fire/hit SFX. Later: victory + boss themes.

## MVP slice
Mouse-follow ship + top-down camera (parallax starfield) → 5 escalating enemy types → 5 auto-fire weapons (tier-1) → enemy→XP-gem→magnet loop → level-up draft (1-of-3) → 3-phase boss on a run timer → drydock meta-shop → HUD (XP, integrity, cards, boss health).

## Workflow
1. `assetgen build-plan --game <slug>` selects this blueprint by genre; read the MVP-first worklist.
2. `assetgen generate` the top item (ship + enemies first); renders land in the project's assets.
3. `assetgen check --game <slug>` to validate; fix anything broken.
4. Re-plan; repeat until `summary.mvpTasks` is 0.

## Related Skills
- **fps-arena** — first-person survivors sibling (different camera, hitscan combat).
- **shipshit-engine** — the core Three.js + GameContext architecture every game follows.
