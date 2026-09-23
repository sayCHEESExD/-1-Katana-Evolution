import {
  MAX_SIM_DELTA,
  MOVING_SPEED,
  STRIDE_CREDIT_SLACK,
  STRIDE_DISTANCE,
  XP_PER_HIT,
  XP_PER_SWING,
  XP_PER_STRIDE,
  damageFor,
  describeDamage,
  jumpVelocityFor,
  maxHealthFor,
  maxLevelFor,
  moveSpeedFor,
  rebirthXpMultiplier,
  resolveLevel,
  speedStatFor,
  xpCeiling,
  type DamageInputs,
} from '@katana/shared';
import type { PlayerState } from '../rooms/state/PlayerState.js';
import { logger } from '../util/logger.js';

const SCOPE = 'progression';

interface Tracker {
  /** Distance banked toward the next stride. */
  banked: number;
  /** True until the first step after a placement, so a teleport pays nothing. */
  fresh: boolean;
  loggedDamage: number;
}

/** The equipped pets' kinds, in inventory order. */
export const equippedPetIds = (player: PlayerState): number[] => {
  const ids: number[] = [];
  for (const pet of player.pets) if (pet.equipped) ids.push(pet.petId);
  return ids;
};

export const damageInputsOf = (player: PlayerState): DamageInputs => ({
  katanaSlot: player.katanaSlot,
  ownedKatanas: player.ownedKatanas,
  trainingTier: player.trainingTier,
  level: player.level,
  forgePercent: player.forgePercent,
  equippedPetIds: equippedPetIds(player),
  rebirths: player.rebirths,
});

/**
 * Server authority over XP, levels, and every DERIVED stat.
 *
 * THE ONE PLACE XP IS GRANTED, and it is granted for exactly two things:
 *
 *   - STRIDES: every `STRIDE_DISTANCE` of ground the server's own simulation
 *     actually covered, on foot;
 *   - HITS: a katana swing the combat service accepted and landed.
 *
 * Both are multiplied by the rebirth XP multiplier and nothing else, so the
 * curve is deterministic. At the rebirth cap XP stops: the stored figure is
 * clamped, so a rebirth never carries a surplus.
 *
 * `syncDerived` is the one place level, damage and speed are written. Every
 * service that changes an input to them (a katana, a pet, a forge item, a
 * mastered dummy, a rebirth) calls it afterwards.
 */
export class ProgressionService {
  private readonly trackers = new Map<string, Tracker>();

  initialise(player: PlayerState): void {
    this.syncDerived(player);
    this.reset(player.sessionId);
  }

  forget(sessionId: string): void {
    this.trackers.delete(sessionId);
  }

  reset(sessionId: string): void {
    const existing = this.trackers.get(sessionId);
    this.trackers.set(sessionId, { banked: 0, fresh: true, loggedDamage: existing?.loggedDamage ?? -1 });
  }

  /**
   * Credit one simulated step of movement.
   *
   * @param distance horizontal distance the authoritative position moved
   * @param onGround true when the step began and ended grounded
   */
  creditMovement(sessionId: string, player: PlayerState, stepSeconds: number, distance: number, onGround: boolean): number {
    const tracker = this.trackers.get(sessionId);
    if (!tracker) {
      this.reset(sessionId);
      return 0;
    }
    const step = Number.isFinite(stepSeconds) ? Math.max(0, Math.min(stepSeconds, MAX_SIM_DELTA)) : 0;
    let travelled = 0;
    // Only a plausible walk counts: a teleport or a reconciliation jump pays nothing.
    const plausible = player.moveSpeed * step * STRIDE_CREDIT_SLACK + 0.2;
    if (!tracker.fresh && step > 0 && onGround && distance <= plausible && distance >= MOVING_SPEED * step) {
      travelled = distance;
    }
    tracker.fresh = false;
    if (travelled <= 0) return 0;

    tracker.banked += travelled;
    let strides = 0;
    while (tracker.banked + 1e-9 >= STRIDE_DISTANCE) {
      tracker.banked -= STRIDE_DISTANCE;
      strides += 1;
    }
    return strides > 0 ? this.grantXp(player, strides * XP_PER_STRIDE) : 0;
  }

  /** Credit one accepted swing, grounded or airborne. Returns the XP paid. */
  creditSwing(player: PlayerState): number {
    return this.grantXp(player, XP_PER_SWING);
  }

  /** Credit one landed hit on a target worth `factor`. Returns the XP paid. */
  creditHit(player: PlayerState, factor: number): number {
    return this.grantXp(player, XP_PER_HIT * Math.max(1, factor));
  }

  private grantXp(player: PlayerState, base: number): number {
    const ceiling = xpCeiling(player.maxLevel);
    if (player.xp >= ceiling) return 0;
    const gain = Math.min(base * rebirthXpMultiplier(player.rebirths), ceiling - player.xp);
    if (gain <= 0) return 0;
    player.xp += gain;
    player.lifetimeXp += gain;
    this.syncDerived(player);
    return gain;
  }

  /**
   * Re-derive level, damage and speed from the player's own server state.
   * THE ONLY WRITER of those fields (and of `maxHp`).
   */
  syncDerived(player: PlayerState): void {
    player.maxLevel = maxLevelFor(player.rebirths);
    const ceiling = xpCeiling(player.maxLevel);
    if (player.xp > ceiling) player.xp = ceiling;
    player.level = resolveLevel(player.xp, player.maxLevel).level;
    const inputs = damageInputsOf(player);
    player.damage = damageFor(inputs);
    player.speedStat = speedStatFor(player.level, player.rebirths);
    player.moveSpeed = moveSpeedFor(player.speedStat);
    player.jumpVelocity = jumpVelocityFor(player.rebirths);
    // Health follows damage. A bigger pool mid-fight adds its growth to what is left.
    const maxHp = maxHealthFor(player.damage);
    if (maxHp !== player.maxHp) {
      const grown = Math.max(0, maxHp - player.maxHp);
      player.maxHp = maxHp;
      player.hp = Math.min(maxHp, player.hp + grown);
    }

    const tracker = this.trackers.get(player.sessionId);
    if (tracker && tracker.loggedDamage !== player.damage) {
      tracker.loggedDamage = player.damage;
      logger.info(SCOPE, `${player.sessionId} L${player.level} damage: ${describeDamage(inputs)}`);
    }
  }
}
