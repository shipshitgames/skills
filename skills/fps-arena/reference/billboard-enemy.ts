// Condensed pattern from games/scourge-survivors src/game/entities/Enemy.ts — a pooled DOOM-style
// billboard-sprite enemy. Front/side/back textures swap by movement-vs-camera
// angle; invisible box meshes are the real hitscan colliders (headshots work).
//
// NOT a drop-in: trim to your tunables. The load-bearing details are marked //!.
import * as THREE from 'three'
import { ENEMY_SPRITE_TEXTURES } from '../spriteAssets'
import { ARENA_HALF, ENEMY_RADIUS } from '../constants'

type View = 'front' | 'side' | 'back'
export interface DamageResult { died: boolean; headshot: boolean; blocked: boolean }
export interface EnemyShot { origin: THREE.Vector3; dir: THREE.Vector3; damage: number; speed: number; fromBoss: boolean }
export interface EnemyTick { melee: number; shots: EnemyShot[] } //! enemy never spawns its own projectiles

export class Enemy {
  readonly group = new THREE.Group()
  readonly hitMeshes: THREE.Mesh[] = [] //! registered into ctx.raycastTargets by the director
  alive = false
  isBoss = false
  ranged = false
  radius = ENEMY_RADIUS
  health = 100
  maxHealth = 100
  speed = 3
  private view: View = 'front'
  private flip = 1
  private mat: THREE.SpriteMaterial
  private sprite: THREE.Sprite

  constructor() {
    // invisible box colliders — these, not the sprite, are raycast
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff5a3c })
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.75, 0.6), bodyMat)
    torso.position.y = 1.08
    torso.userData = { enemy: this, part: 'body' } //! userData.enemy + part drives hitscan
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), bodyMat)
    head.position.y = 1.78
    head.userData = { enemy: this, part: 'head' } //! part === 'head' => headshot multiplier
    for (const m of [torso, head]) m.visible = false
    this.group.add(torso, head)
    this.hitMeshes.push(torso, head)

    this.mat = new THREE.SpriteMaterial({
      map: ENEMY_SPRITE_TEXTURES.melee.front,
      transparent: true, alphaTest: 0.06, depthWrite: true, toneMapped: false, //! depthWrite:true so enemies occlude
    })
    this.sprite = new THREE.Sprite(this.mat)
    this.sprite.center.set(0.5, 0) //! feet-anchored: scale grows upward from the ground
    this.group.add(this.sprite)
    this.group.visible = false
    this.group.position.y = -100 // parked offscreen while dead
  }

  spawnAt(x: number, z: number, hp: number, ranged: boolean) {
    this.maxHealth = this.health = hp
    this.alive = true
    this.ranged = ranged
    this.group.position.set(x, 0, z)
    this.group.visible = true
  }

  get position() { return this.group.position }

  update(delta: number, elapsed: number, playerPos: THREE.Vector3, peers: Enemy[], cameraQuat: THREE.Quaternion): EnemyTick {
    const tick: EnemyTick = { melee: 0, shots: [] }
    if (!this.alive) return tick
    const pos = this.group.position
    const dx = playerPos.x - pos.x, dz = playerPos.z - pos.z
    const dist = Math.hypot(dx, dz) || 1e-4
    const dirX = dx / dist, dirZ = dz / dist

    // separation so they don't stack
    let sepX = 0, sepZ = 0
    for (const o of peers) {
      if (o === this || !o.alive) continue
      const ox = pos.x - o.group.position.x, oz = pos.z - o.group.position.z
      const od = Math.hypot(ox, oz)
      if (od > 1e-4 && od < 1.4) { const p = (1.4 - od) / 1.4; sepX += (ox / od) * p; sepZ += (oz / od) * p }
    }
    let moveX = sepX * this.speed * 0.6, moveZ = sepZ * this.speed * 0.6
    if (this.ranged) {
      // kite: hold ~12u, strafe in the band
      if (dist > 13.5) { moveX += dirX * this.speed; moveZ += dirZ * this.speed }
      else if (dist > 10) { moveX += -dirZ * this.speed * 0.7; moveZ += dirX * this.speed * 0.7 }
    } else if (dist > 1.9) { moveX += dirX * this.speed; moveZ += dirZ * this.speed }
    pos.x += moveX * delta; pos.z += moveZ * delta
    const lim = ARENA_HALF - 1.5
    pos.x = Math.max(-lim, Math.min(lim, pos.x)); pos.z = Math.max(-lim, Math.min(lim, pos.z))
    // (obstacle push is done by the director: player.pushOutOfObstacles(this.position, this.radius))

    this.applyFrame(moveX, moveZ, dirX, dirZ)
    return tick
  }

  // choose front/side/back + horizontal flip from movement relative to the player
  private applyFrame(moveX: number, moveZ: number, dirX: number, dirZ: number) {
    const len = Math.hypot(moveX, moveZ)
    if (len >= 0.05) {
      const mx = moveX / len, mz = moveZ / len
      const dot = mx * dirX + mz * dirZ
      if (dot > 0.5) { this.view = 'front'; this.flip = 1 }
      else if (dot < -0.45) { this.view = 'back'; this.flip = 1 }
      else { this.view = 'side'; this.flip = (dirX * mz - dirZ * mx) >= 0 ? 1 : -1 } //! 2D cross => which side
    }
    const kind = this.isBoss ? 'boss' : this.ranged ? 'ranged' : 'melee'
    const tex = ENEMY_SPRITE_TEXTURES[kind][this.view]
    if (this.mat.map !== tex) { this.mat.map = tex; this.mat.needsUpdate = true }
    this.sprite.scale.set(1.65 * this.flip, 2.18, 1) // flip via negative X scale
  }

  takeDamage(amount: number, headshot: boolean): DamageResult {
    if (!this.alive) return { died: false, headshot, blocked: false }
    this.health = Math.max(0, this.health - amount)
    if (this.health <= 0) { this.kill(); return { died: true, headshot, blocked: false } }
    return { died: false, headshot, blocked: false }
  }

  kill() {
    this.alive = false //! isBoss intentionally NOT reset — death handler reads it; spawnAt re-arms
    this.group.visible = false
    this.group.position.y = -100
  }
}
