import {
  COMBAT,
  DUMMIES,
  DUMMY_HALF,
  ENEMIES,
  NO_TARGET,
  TRAINING_TIERS,
  canTrainOn,
  dummyTarget,
  isDummyTarget,
  stageAt,
  stageByIndex,
  STAGE_COUNT,
} from '@katana/shared';
import type { NetEnemyState, NetPlayerState } from '../net/netTypes.js';

/** What the top-centre HUD shows about the thing being fought. */
export interface FocusTarget {
  readonly kind: 'enemy' | 'dummy';
  readonly target: number;
  readonly name: string;
  /** Enemies: current and maximum health. Dummies: hits toward mastery and the hits needed. */
  readonly value: number;
  readonly max: number;
  readonly boss: boolean;
  /** A boss the player cannot fight yet, or a dummy they lack the rebirths for. */
  readonly locked: boolean;
  readonly lockText: string;
  readonly x: number;
  readonly z: number;
}

/** How long a target stays in focus after the last hit on it. */
const FOCUS_HOLD = 5;
/** Enemies this close come into focus even before they are hit. */
const FOCUS_RADIUS = 16;

/**
 * Chooses what a swing is aimed at, and what the HUD shows.
 *
 * The AIM is only a hint to the server - the nearest thing in reach, weighted
 * toward what the player is facing. The FOCUS is presentation: the thing last
 * hit, or the nearest enemy in the arena.
 */
export class TargetSelector {
  private focusId = NO_TARGET;
  private focusFor = 0;

  /** Remember what was just hit, so it stays in focus. */
  noteHit(target: number): void {
    this.focusId = target;
    this.focusFor = FOCUS_HOLD;
  }

  tick(delta: number): void {
    this.focusFor = Math.max(0, this.focusFor - delta);
  }

  /** The best thing to swing at from here, or NO_TARGET. */
  aim(x: number, z: number, yaw: number, enemies: ArrayLike<NetEnemyState> | null, me: NetPlayerState | null): number {
    const reach = COMBAT.reach + 0.5;
    let best = NO_TARGET;
    let bestScore = Number.POSITIVE_INFINITY;
    const consider = (id: number, tx: number, tz: number, radius: number): void => {
      const dx = tx - x;
      const dz = tz - z;
      const distance = Math.hypot(dx, dz) - radius;
      if (distance > reach) return;
      let off = Math.atan2(dx, dz) - yaw;
      off -= Math.round(off / (Math.PI * 2)) * Math.PI * 2;
      const score = distance + Math.abs(off) * 2.2;
      if (score < bestScore) {
        bestScore = score;
        best = id;
      }
    };
    if (enemies) {
      for (const def of ENEMIES) {
        const enemy = enemies[def.id];
        if (!enemy || !enemy.alive || !this.canAttack(def.id, me)) continue;
        consider(def.id, enemy.x, enemy.z, def.radius);
      }
    }
    // Locked dummies are aimed at too, so the server can say why the swing paid nothing.
    for (const dummy of DUMMIES) consider(dummyTarget(dummy.tier), dummy.x, dummy.z, DUMMY_HALF);
    return best;
  }

  /** What the HUD should show right now, or null. */
  focus(x: number, z: number, enemies: ArrayLike<NetEnemyState> | null, me: NetPlayerState | null): FocusTarget | null {
    if (this.focusFor > 0 && this.focusId !== NO_TARGET) {
      const held = this.describe(this.focusId, enemies, me);
      if (held && (held.kind === 'dummy' || held.value > 0) && Math.hypot(held.x - x, held.z - z) < 30) return held;
    }
    // Nothing recently hit: the nearest enemy of the arena the player stands in.
    const stage = stageAt(z, STAGE_COUNT);
    if (stage === 0 || !enemies) return null;
    let bestId = NO_TARGET;
    let bestDistance = FOCUS_RADIUS;
    for (const def of stageByIndex(stage)?.enemies ?? []) {
      const enemy = enemies[def.id];
      if (!enemy || !enemy.alive) continue;
      const d = Math.hypot(enemy.x - x, enemy.z - z) - def.radius;
      if (d < bestDistance) {
        bestDistance = d;
        bestId = def.id;
      }
    }
    return bestId === NO_TARGET ? null : this.describe(bestId, enemies, me);
  }

  private canAttack(id: number, me: NetPlayerState | null): boolean {
    const def = ENEMIES[id];
    if (!def) return false;
    if (!def.boss) return true;
    const stage = stageByIndex(def.stage);
    const mask = me?.killMasks[def.stage - 1] ?? 0;
    return !!stage && (mask & stage.waveMask) === stage.waveMask;
  }

  private describe(target: number, enemies: ArrayLike<NetEnemyState> | null, me: NetPlayerState | null): FocusTarget | null {
    if (isDummyTarget(target)) {
      const tier = TRAINING_TIERS[target - 1000];
      const dummy = DUMMIES[target - 1000];
      if (!tier || !dummy) return null;
      const locked = !!me && !canTrainOn(tier.tier, me.rebirths);
      const mastered = !!me && me.trainingTier >= tier.tier;
      const hits = mastered ? tier.hitsToMaster : (me?.trainingHits[tier.tier] ?? 0);
      return {
        kind: 'dummy',
        target,
        name: `${tier.name}  x${tier.multiplier} Damage`,
        value: hits,
        max: Math.max(1, tier.hitsToMaster),
        boss: false,
        locked,
        lockText: locked ? `Needs ${tier.rebirthsRequired} Rebirth${tier.rebirthsRequired === 1 ? '' : 's'}` : mastered ? 'MASTERED' : '',
        x: dummy.x,
        z: dummy.z,
      };
    }
    const def = ENEMIES[target];
    const enemy = enemies?.[target];
    if (!def || !enemy) return null;
    const locked = !this.canAttack(target, me);
    return {
      kind: 'enemy',
      target,
      name: def.name,
      value: enemy.alive ? enemy.hp : 0,
      max: def.maxHp,
      boss: def.boss,
      locked,
      lockText: locked ? 'SEALED - defeat the wave first' : '',
      x: enemy.x,
      z: enemy.z,
    };
  }
}
