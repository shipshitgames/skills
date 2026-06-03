// Condensed pattern from games/scourge-survivors src/game/modes/SurvivorsSystem.ts — the
// Vampire-Survivors XP loop + 1-of-3 level-up draft. React renders the cards from
// the HUD snapshot and calls pickUpgrade(id) when the player clicks one.
import type { GameContext } from '../context'
import type { GameSystems } from '../systems'
import { UPGRADES, UPGRADE_BY_ID, xpForLevel, type UpgradeId } from '../data/survivors'
import type { UpgradeChoice } from '../types'

export class SurvivorsDraft {
  level = 1
  xp = 0
  xpToNext = xpForLevel(1)
  pendingLevels = 0
  choices: UpgradeChoice[] = []
  upgradeLevels: Partial<Record<UpgradeId, number>> = {}

  constructor(private ctx: GameContext, private sys: GameSystems) {}

  gainXp(v: number) {
    this.xp += v * this.ctx.statXpMul // statXpMul folds in draft + shop bonuses
    let leveled = false
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext
      this.level++
      this.xpToNext = xpForLevel(this.level)
      this.pendingLevels++
      leveled = true
    }
    if (leveled && this.ctx.status === 'playing') this.triggerLevelUp()
  }

  triggerLevelUp() {
    this.ctx.status = 'levelup'          //! React shows the draft overlay off this status
    this.rollChoices()
    if (this.ctx.controls.isLocked) this.ctx.controls.unlock() // free the cursor to click a card
    this.sys.hud.emit()
  }

  rollChoices() {
    const eligible = UPGRADES.filter((u) => (this.upgradeLevels[u.id] ?? 0) < u.max) //! respect per-upgrade max
    for (let i = eligible.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[eligible[i], eligible[j]] = [eligible[j], eligible[i]]
    }
    this.choices = eligible.slice(0, 3).map((u) => ({
      id: u.id, name: u.name, desc: u.desc, icon: u.icon,
      level: this.upgradeLevels[u.id] ?? 0, max: u.max,
    }))
  }

  // Called by the React draft UI when a card is chosen.
  pickUpgrade(id: string) {
    if (this.ctx.status !== 'levelup') return
    const uid = id as UpgradeId
    if (UPGRADE_BY_ID[uid]) {
      this.upgradeLevels[uid] = (this.upgradeLevels[uid] ?? 0) + 1
      this.recomputeStats() //! single writer of ctx.stat* — keeps campaign/MP unaffected
    }
    this.pendingLevels = Math.max(0, this.pendingLevels - 1)
    if (this.pendingLevels > 0) {
      this.rollChoices() // stacked level-ups: draft again
      this.sys.hud.emit()
    } else {
      this.choices = []
      this.ctx.status = 'playing'
      this.sys.hud.emit()
      this.sys.input.lockPointer() //! re-lock the pointer or you softlock
    }
  }

  // Derive ALL gameplay multipliers from draft levels (+ shop tiers in the real impl).
  recomputeStats() {
    const lv = (k: UpgradeId) => this.upgradeLevels[k] ?? 0
    this.ctx.statDamageMul = 1 + 0.25 * lv('dmg')
    this.ctx.statFireRateMul = 1 + 0.18 * lv('rate')
    this.ctx.statMoveMul = 1 + 0.12 * lv('speed')
    this.ctx.statCrit = 0.12 * lv('crit')
    this.ctx.statMultishot = lv('multishot')
    // ...maxhp/regen/magnet/xpgain + orbit/bolt/nova weapon levels
  }
}
