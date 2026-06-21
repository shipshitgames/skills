---
name: fighting-arena
description: Build a trench-brawler / battlefield fighting game — character select, 1v1 Duels and 2-4 player Arenas, light/heavy/special combos with cooldown gating, guard + damage-percent knockback, and Warline result banking. Canonical game: Brawl.
license: MIT
metadata:
  version: "0.1.0"
  gameType: fighting
  tags: "fighting, brawler, platform-fighter, three.js, game-dev"
  author: Ship Shit Games
when_to_use: "building a fighting game / brawler / platform fighter, brawl, trench brawler, what does a fighting game need"
disable-model-invocation: true
---

# Build a Fighting / Brawler Game

Trench-brawler **fighting game** — Duels + Arenas. Canonical game: **Brawl**.
Machine-readable companion: `blueprint.json` (read by the Build Plan engine to
match genre + order the MVP worklist).

## Required asset classes (★ = MVP)
- ★ **Sprites** — 4 fighters (Pyre Duelist / Warden Bastion / Render / Trucebreaker) with full pose sheets (idle/walk/jump/crouch/guard/attack/hurt/knockback/KO/win).
- ★ **UI** — health bars, damage percent, stock pips, KO timer, fighter-select cards. Later: main menu, results, mode toggle.
- ★ **VFX** — hit-flash, screen-shake, sparks, knockback dust.
- ★ **Music/SFX** — combat loop + light/heavy/special hit SFX + guard-block tone. Later: menu theme, victory sting.

## MVP slice
4 fighters with pose sheets → select UI + Duel/Arena toggle → Duel (1v1 KO, timer, AI) → Arena (damage%-knockback, stocks, ring-outs) → light/heavy/special with cooldown gating + guard → knockback physics → hit feedback (flash/shake/sparks) → win/loss result + Warline telemetry; HUD (health, damage%, stocks).

## Workflow
1. `assetgen build-plan --game <slug>` selects this blueprint; read the MVP-first worklist.
2. `assetgen generate` the fighter pose sheets first; renders land in the project's assets.
3. `assetgen check --game <slug>` to validate; fix anything broken.
4. Re-plan; repeat until `summary.mvpTasks` is 0.

## Related Skills
- **shipshit-engine** — the core architecture every game follows.
- **warline** runtime (`@shipshitgames/warline`) — where match results bank into the cross-game war.
