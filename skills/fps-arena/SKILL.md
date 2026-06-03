---
name: fps-arena
description: Build first-person arena shooters in the Ship Shit engine — DOOM-style billboard sprite enemies, PointerLockControls eye-height camera, hitscan + projectile weapons, AABB+radius collision, the wave/PvE director, boss ability cycles, and the Vampire-Survivors mode (XP draft, orbit/bolt/nova auto-weapons, run meta-progression). Use when adding or editing FPS combat, enemies, weapons, waves, bosses, or the survivors/level-up systems in a studio FPS game.
license: MIT
metadata:
  version: "0.1.0"
  tags: "fps, shooter, survivors, three.js, game-dev"
  author: Ship Shit Games
---

# FPS Arena

First-person arena shooter built on imperative Three.js. The canonical implementation is
`scourge-survivors`. Everything here is grounded in real code — read the cited file before changing it.

This skill assumes the engine conventions from **shipshit-engine** (GameContext + GameSystems
registry, `new XSystem(ctx, sys)`, siblings via `this.sys.<name>`, data-driven `constants.ts` +
`data/*.ts`, HUD pushed to React via a `StateListener`). Read that skill first if unfamiliar.

## File layout (combat slice)

```
src/game/
  context.ts             GameContext — shared world (renderer, camera, controls, enemies[],
                         raycastTargets[], obstacleBoxes[], stat* multipliers, ammo, status)
  systems.ts             GameSystems registry (type-only imports)
  constants.ts           ALL numeric tunables + WEAPONS table + WAVES table
  data/survivors.ts      UPGRADES draft table, xpForLevel(), SHOP_UPGRADES, surv tunables
  data/internalTypes.ts  ENEMY_COLORS, weapon view config, Projectile/Pickup/Tracer interfaces
  spriteAssets.ts        loaded THREE.Texture tables (front/side/back per enemy kind)
  render/RenderSystem.ts PerspectiveCamera(75) + PointerLockControls bootstrap
  render/ArenaSystem.ts  builds floor/walls/obstacles, fills solidMeshes + obstacleBoxes
  entities/Enemy.ts      pooled billboard-sprite enemy with melee/ranged/boss AI
  entities/WeaponSystem.ts   viewmodel + hitscan shoot() + reload + melee
  entities/ProjectilesSystem.ts  enemy/boss projectiles
  modes/PveDirectorSystem.ts wave state machine, spawns, onEnemyDeath, campaign advance
  modes/SurvivorsSystem.ts   XP/levels, 1-of-3 draft, orbit/bolt/nova, swarm, shop tiers
```

## Camera & controls (`render/RenderSystem.ts`)

```ts
this.ctx.camera = new THREE.PerspectiveCamera(75, w / h, 0.05, 500)
this.ctx.controls = new PointerLockControls(this.ctx.camera, renderer.domElement)
this.ctx.scene.add(this.ctx.camera) // weapon viewmodel is a CHILD of the camera
```

- Eye height is `PLAYER_HEIGHT` (1.8). Ground clamp lives in `PlayerSystem.updatePlayerMovement`:
  when `camera.position.y < PLAYER_HEIGHT` snap it back and set `canJump = true`.
- Move with `controls.moveRight()/moveForward()` driven by an accel/damping velocity, NOT by
  setting position directly. Movement speed scales by `ctx.statMoveMul` (1 outside Survivors).
- The viewmodel attaches to the camera at `(WEAPON_VIEW_X, WEAPON_VIEW_Y, WEAPON_VIEW_Z)` so it
  rides the view for free.

## Billboard sprite enemies (`entities/Enemy.ts`) — the heart of the look

DOOM-style: a flat `THREE.Sprite` always faces the camera, but we swap front/side/back textures
and horizontally flip based on the enemy's movement direction relative to the camera. Hitscan
hits invisible **box meshes** behind the sprite (so headshots and occlusion work).

Rules that MUST hold:
- Sprite is **feet-anchored**: `sprite.center.set(0.5, 0)` and `sprite.position.y = 0` so scaling
  grows it upward from the ground.
- `SpriteMaterial`: `alphaTest: 0.06`, `depthWrite: true`, `toneMapped: false`. depthWrite true is
  deliberate so enemies occlude each other; projectiles/FX use `depthWrite:false` + additive.
- The real colliders are separate invisible `Box` meshes (`legs`, `torso`, `head`) each with
  `userData = { enemy: this, part: 'body' | 'head' }`. Push them into `hitMeshes`; the director
  registers them into `ctx.raycastTargets` on first pool growth.
- Choose the view frame from the dot of (normalized move dir) vs (player dir):
  `dot > 0.5 → front`, `dot < -0.45 → back`, else `side` flipped by the 2D cross product sign.
- Health bar is a child plane group that copies `cameraQuat` each frame to face you.

`update(delta, elapsed, playerPos, peers, cameraQuat): EnemyTick` returns
`{ melee: number, shots: EnemyShot[] }` — the enemy never spawns projectiles itself; the director
does. AI: melee bots close when `dist > attackRange*0.85`; ranged bots **kite** (advance past
`preferredRange+1.5`, retreat under `preferredRange-2`, otherwise strafe perpendicular) and hold
fire while retreating. Always add **separation** steering against `peers` so they don't stack.
Clamp `pos` to `ARENA_HALF - 1.5`; obstacle collision is resolved by the director afterwards via
`this.sys.player.pushOutOfObstacles(enemy.position, enemy.radius)`.

Pooling: enemies are reused. `kill()` hides the group and sets `alive=false` (it does NOT splice
the array or unregister hit meshes — `isBoss` is intentionally left set so death handlers can
detect a boss). `spawnAt(x, z, cfg)` re-arms every field from the `SpawnConfig`. See
`reference/billboard-enemy.ts`.

## Hitscan weapons (`entities/WeaponSystem.ts`)

```ts
this.ctx.raycaster.set(origin, dir)
const hits = this.ctx.raycaster.intersectObjects(this.ctx.raycastTargets, false)
for (const h of hits) {
  const ud = h.object.userData as { enemy?: Enemy; part?: string; solid?: boolean; remoteId?: string }
  if (ud.remoteId) { /* PvP: net.sendHit, server is authoritative */ break }
  else if (ud.enemy) {
    if (!ud.enemy.alive) continue            // skip stale pooled hits
    const headshot = ud.part === 'head'
    const dmg = spec.damage * dmgMult * crit * (headshot ? HEADSHOT_MULTIPLIER : 1)
    const res = ud.enemy.takeDamage(dmg, headshot)
    if (res.blocked) { /* boss shield ping */ } else if (res.died) this.sys.pve.onEnemyDeath(ud.enemy, headshot)
    break
  } else if (ud.solid) { /* wall — tracer ends here */ break }
}
```

- Weapons are data: `WEAPONS[id]` (damage, fireInterval, magazineSize, pellets, spread, auto,
  ammoPerKill, reserveCap). Gameplay reads the spec; never hardcode a weapon stat.
- Shotgun = `pellets > 1` looping the raycast with per-pellet `spread`. In Survivors add
  `ctx.statMultishot` pellets.
- Fire cadence is `ctx.fireCooldown = spec.fireInterval / ctx.statFireRateMul`. Auto weapons fire
  while `ctx.firing`; semi-auto fire on a queued trigger. `tickFireReload` is the gate.
- Magazine depletes in **every** mode. Survivors has infinite *reserve* (reload always tops the
  mag) but you still reload — the cadence is part of the challenge.
- `damageMult = (damageBoostTimer > 0 ? DAMAGE_BOOST_MULT : 1) * ctx.statDamageMul`. Crit
  (`ctx.statCrit`) doubles. Push damage numbers to the HUD; emit a kill to `pve.onEnemyDeath`.
- The melee knife (`tryMelee` → `doMelee`) is ALWAYS available (no ammo): a frontal cone test
  (`MELEE_ARC_DOT`) hitting a small cluster — the guaranteed fallback when ammo runs dry.

## Projectiles (`entities/ProjectilesSystem.ts`)

Enemy/boss shots only. `spawnProjectile(shot, owner)` makes an additive `THREE.Sprite`
(`depthWrite:false`), velocity = `dir * speed`. Per frame: advance, pulse/spin the sprite, then
test in order — hit the player (`distanceTo < PROJECTILE_HIT_RADIUS` → `player.damagePlayer`),
expired/out-of-bounds/`y<0.05`, or blocked by an obstacle AABB (inflate the box by ~0.1). When an
enemy dies, `removeProjectilesFrom(enemy)` fizzles its in-flight shots — store `owner` for this.

## Collision (AABB + radius)

- World bounds + obstacles live in `ctx.obstacleBoxes: THREE.Box3[]` (filled by `ArenaSystem`).
- `PlayerSystem.pushOutOfObstacles(pos, radius)` inflates each box by `radius`, finds the
  shallowest of the four horizontal penetration depths, and snaps out along that axis. Reuse this
  for the player (`PLAYER_RADIUS`) AND every enemy (`enemy.radius`) — do not write a second one.
- Wall clamp: `±(ARENA_HALF - WALL_THICKNESS/2 - PLAYER_RADIUS)`.

## Wave / PvE director (`modes/PveDirectorSystem.ts`)

A small state machine driven each frame by `updateWaves(delta)`:
`waveBreakTimer` counts down → `startWave()` → spawn while
`spawnedThisWave < wave.count && aliveCount < wave.concurrent` on `WAVE_SPAWN_INTERVAL` →
`killsThisWave >= wave.count` → `completeWave()`. After `TOTAL_WAVES`, `startWave` spawns the boss
instead; the boss's death (in `onEnemyDeath`) ends the stage.

- `WAVES` is a data table (`count/concurrent/healthMul/speedMul`). Campaign difficulty multiplies
  by `stageMul() = 1 + STAGE_DIFFICULTY_STEP * campaignStage`.
- `getFreeEnemy()` finds a dead pooled enemy or grows the pool, adding new `hitMeshes` to
  `ctx.raycastTargets`. ALL spawners (waves, boss, survivors swarm) go through it.
- `onEnemyDeath(enemy, headshot)` is the single death hub. It branches: Survivors (drop XP gem,
  elites also drop pickups, no ammo), boss (score + reserve bonus + `advanceCampaignOrWin()`), or
  normal mob (score + ammo-per-kill + maybe a pickup). Read `enemy.isBoss` BEFORE `kill()` resets.

## Boss fights (`Enemy.updateBoss`)

The boss is a scaled enemy that does melee + ranged + an ability cycle on `BOSS_SKILL_INTERVAL`,
toggling shield ↔ barrage:
- **Shield**: `shielded = true` for `BOSS_SHIELD_DURATION`; `takeDamage` returns
  `{ blocked: true }` while up (weapon plays a ping, no damage).
- **Barrage**: fan `BOSS_BARRAGE_COUNT` shots across `BOSS_BARRAGE_SPREAD` radians around the
  player yaw.
- **Enrage**: once `health/maxHealth < BOSS_ENRAGE_HEALTH_FRAC`, raise speed and shorten intervals.

HUD shows the boss bar via `bossActive` + `bossEnemy.health / bossMaxHealth`.

## Survivors mode (`modes/SurvivorsSystem.ts`) — Vampire-Survivors loop

Endless escalating swarm + XP draft. The shape:
- **XP / levels**: `gainXp(v)` adds `v * statXpMul`, loops `xp -= xpToNext` (`xpForLevel(level)`)
  bumping `pendingLevels`. When a level lands during play → `triggerLevelUp()`:
  `status = 'levelup'`, unlock the pointer, `rollChoices()`, emit to React.
- **1-of-3 draft**: `rollChoices()` filters `UPGRADES` to those under `max`, shuffles, takes 3,
  maps to `UpgradeChoice` cards. React renders them; clicking calls `pickUpgrade(id)` which bumps
  `upgradeLevels[id]`, `recomputeStats()`, then re-rolls if `pendingLevels` remain or resumes play
  and re-locks the pointer. See `reference/levelup-draft.ts`.
- **recomputeStats()** is the ONLY writer of `ctx.stat*` multipliers — derived from draft levels
  AND persistent shop tiers. Outside Survivors these stay at neutral (1 / 0 / SURV_BASE_MAGNET) so
  campaign/MP are unaffected.
- **Auto-weapons** (data-tuned in `data/survivors.ts`):
  - *Orbiting Blades* — spheres on a ring around the player; per-enemy hit cooldown via
    `WeakMap<Enemy, number>` keyed off `survClock`.
  - *Seeker Bolts* — periodic homing projectiles at `nearestEnemy`, with pierce.
  - *Nova Pulse* — expanding ring; damages each enemy once (`Set<Enemy>`) as the radius reaches it.
  - All route damage through `autoDamageEnemy(enemy, dmg)` (applies `statDamageMul` + crit, posts a
    damage number, calls `pve.onEnemyDeath` on death). Never duplicate death handling.
- **Swarm**: `survSpawnTimer` interval shrinks with `survClock`; HP scales with time; spawn on a
  ring 26–36 units from the player (clamped to the arena). Elites on `eliteTimer`.
- **XP gems**: octahedron meshes; once within `ctx.statMagnet` they're pulled toward the player and
  collected under 1.3 units.
- **Meta-progression**: `SHOP_UPGRADES` bought with gold (`runGold(...)`) persist as `shopTiers`
  in localStorage; React passes them in via `setShopUpgrades(tiers)`. `runGold`/`shopCost` are
  data functions, not magic numbers in logic.

## Do

- Put EVERY tunable in `constants.ts`; put content tables (`WEAPONS`, `WAVES`, `UPGRADES`,
  `SHOP_UPGRADES`) in `constants.ts` / `data/*.ts`. Logic reads tables.
- Pool enemies and reuse via `getFreeEnemy()`; null-guard `if (!enemy.alive) continue` everywhere
  you iterate `ctx.enemies` (the array holds dead entries).
- Route all enemy death through `pve.onEnemyDeath`; route all stat changes through
  `recomputeStats`.
- Feet-anchor sprites (`center (0.5, 0)`), keep separate box hit-meshes, register them in
  `ctx.raycastTargets`.
- Read `isBoss` before calling `kill()`.
- `dispose()` geometry + material when removing transient meshes (bolts, novas, gems, projectiles,
  pops) — see `clearSurvivorsEntities`.

## Don't

- Don't use react-three-fiber. The game is imperative Three.js; React is only the HUD/menu shell.
- Don't hardcode weapon/enemy/wave/upgrade numbers in systems — that's what the tables are for.
- Don't `splice` dead enemies out of the pool, and don't re-add `hitMeshes` for a reused enemy.
- Don't move the player by writing `camera.position` directly — use the controls + velocity.
- Don't give projectiles/FX `depthWrite: true`; use additive + `depthWrite:false`. Conversely the
  enemy *sprite* keeps `depthWrite:true` so enemies occlude correctly.
- Don't write a second collision routine — reuse `pushOutOfObstacles`.

## Common bugs

- **Sprites sink into the floor / scale from the center**: you forgot `sprite.center.set(0.5, 0)`.
- **Headshots never register**: head box needs `userData.part === 'head'`, and the hit meshes must
  be in `ctx.raycastTargets`. `intersectObjects(..., false)` is non-recursive — register the
  meshes, not the parent group.
- **Bullets pass through enemies / hit dead ones**: stale pooled entries; `continue` on
  `!ud.enemy.alive`, and `break` only after a real hit so the tracer stops at the first solid.
- **Survivors stats leak into campaign**: a code path mutated `ctx.stat*` outside
  `recomputeStats`. Keep neutral defaults and one writer.
- **Level-up softlock**: forgetting to re-lock the pointer (`input.lockPointer()`) and reset
  `status = 'playing'` when `pendingLevels` hits 0.
- **Boss bar shows after victory**: clear `bossActive`/`bossEnemy` in `onEnemyDeath` before
  advancing the campaign.
- **Orbit/nova multi-hits per frame**: use the per-enemy cooldown `WeakMap` (orbit) or hit `Set`
  (nova) — without it a single tick deletes the whole swarm.
- **Leaked GPU memory after many runs**: transient meshes removed from the scene but never
  `dispose()`d. Always dispose geometry + material.

## Worked example — add a "Flamethrower" weapon

1. `constants.ts`: add `'flame'` to `WeaponId` and a `WEAPONS.flame` spec (high fireInterval-rate,
   low per-shot `damage`, big `magazineSize`, small `pellets` with wide `spread`, `auto: true`).
2. `data/internalTypes.ts`: add a `WEAPON_SPRITE_CONFIG.flame` entry (scale/offset/muzzle).
3. `spriteAssets.ts`: load the viewmodel texture (path comes from the asset manifest — see
   **game-asset-pipeline**).
4. No logic changes: `WeaponSystem.shoot()` already loops `spec.pellets` with `spec.spread`, and
   `unlockWeapon`/`switchWeapon` read the table. Add `'flame'` to `WEAPON_ORDER` and (optionally) a
   `'flame'` shop/pickup entry. Done — content, not code.

## Related skills

- **shipshit-engine** — GameContext/GameSystems registry, loop, StateListener conventions.
- **game-asset-pipeline** — `assets.json` manifest; how sprite/texture paths are loaded.
- **partykit-multiplayer** — authoritative PvP hits (`net.sendHit`, `remoteId` raycast targets).
- **playwright-game-testing** — driving the game headlessly to verify combat/waves.
- **vibe-game-workflow** — the studio's Claude Code + Codex build loop.
- Sibling genres: **tower-defense-3d**, **isometric-3d**.
