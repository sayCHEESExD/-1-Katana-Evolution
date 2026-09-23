/**
 * PLAYER HEALTH. Server-authoritative, derived like damage: the health pool
 * grows with the player's own damage per click, so it keeps pace with the
 * enemies of the stages that damage is meant for (see `ENEMY_HIT_SHARE`).
 *
 * Health refills whenever the player is outside the stages, and a death or a
 * claim returns them to base at full health.
 */
export const HEALTH = {
  base: 100,
  perDamage: 5,
} as const;

export const maxHealthFor = (damage: number): number =>
  Math.floor(HEALTH.base + HEALTH.perDamage * Math.max(0, Number.isFinite(damage) ? damage : 0));
