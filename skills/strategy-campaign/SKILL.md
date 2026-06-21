---
name: strategy-campaign
description: Build a strategy-lite persistent campaign layer — a 3D portal-deck lobby, an SVG war-map command table, four-resource economy, Fortify/Muster/Deploy/Recon commands, faction pressure rings, and a LOCAL tick-loop that upgrades to LIVE PartyKit. Canonical game: Warline.
license: MIT
metadata:
  version: "0.1.0"
  gameType: strategy-campaign
  tags: "strategy, campaign, meta-layer, partykit, three.js, game-dev"
  author: Ship Shit Games
when_to_use: "building a strategy campaign / meta-layer / war hub, warline, command table, what does a strategy-lite campaign layer need"
disable-model-invocation: true
---

# Build a Strategy-Campaign Layer

Strategy-lite **persistent campaign hub** that ties the other games together.
Canonical game: **Warline**. Machine-readable companion: `blueprint.json` (read
by the Build Plan engine to match genre + order the MVP worklist).

## Required asset classes (★ = MVP)
- ★ **Sprites/3D** — 3D portal-deck lobby (PBR floor/wall/block/column/decal), portal-bay billboards.
- ★ **UI** — header HUD (threat/epoch/tick), ResourceBar (4 resources + army), CommandPanel (Fortify/Muster/Deploy/Recon), OpsPanel, Legend, SVG region/lane/breach overlays, faction badges. Later: title splash, settings.
- ★ **VFX** — pressure rings (dithered/concentric), faction color coding (Pyre/Warden/Scourge/neutral).
- ★ **Music/SFX** — ambient lobby loop. Later: alert sting.

## MVP slice
3D portal-deck lobby (5 PBR textures, portal bays) → ambient lighting → Command Table hologram (SVG war map: regions/lanes/breaches) → pressure rings + faction colors → header HUD + ResourceBar (4 resources) → CommandPanel (Fortify/Muster/Deploy/Recon with costs) → dual-runtime (LOCAL tick-loop + LIVE PartyKit-ready) → title screen.

## Workflow
1. `assetgen build-plan --game <slug>` selects this blueprint; read the MVP-first worklist.
2. `assetgen generate` the portal-deck textures + UI first; renders land in the project's assets.
3. `assetgen check --game <slug>` to validate; fix anything broken.
4. Re-plan; repeat until `summary.mvpTasks` is 0.

## Related Skills
- **partykit-multiplayer** — the LIVE runtime the LOCAL tick-loop upgrades to.
- **shipshit-engine** — the core architecture every game follows.
