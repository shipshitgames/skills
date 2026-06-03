# <Game Name> — TinyPRD

Keep this to one screen. If it doesn't fit, the scope is too big for v1.

- **Genre:** fps-arena | tower-defense-3d | isometric-3d
- **Core loop (one sentence):** 
- **Win condition:** 
- **Lose condition:** 
- **Controls:** WASD move, mouse look (pointer lock), LMB fire, R reload, 1-4 weapons, Esc pause.
- **Mode for v1 (exactly ONE):** 
- **Juice budget:** muzzle flash, hit markers, damage numbers, screen-relative banners.

## Scope cut list (explicitly NOT in v1)

- [ ] additional modes (Survivors / Multiplayer)
- [ ] shop / meta-progression
- [ ] more than one map
- [ ] audio polish beyond core sfx

## Feature checklist (dependency order — playtest after each)

- [ ] 1. Arena (RenderSystem + ArenaSystem from data/maps.ts)
- [ ] 2. Camera / Input (pointer lock, key/mouse state)
- [ ] 3. Player movement + collisions
- [ ] 4. Enemies (entity + director/spawner)
- [ ] 5. Combat (raycast/projectiles, damage, death)
- [ ] 6. HUD (HudSystem.emit -> HUD.tsx)
- [ ] 7. Juice (FxSystem)
- [ ] 8. Audio (AudioEngine sfx hooks)
- [ ] 9. Multiplayer (only if in v1 scope)

## Status (update after each compaction)

- Working: 
- Next: 
