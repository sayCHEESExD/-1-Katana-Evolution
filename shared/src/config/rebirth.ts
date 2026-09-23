/**
 * Rebirth: the prestige ladder, and the permanent SPEED progression.
 *
 * As in the reference menu: Rebirth 0 caps at Level 15 with x1 speed; Rebirth
 * 1 caps at Level 30 with x2 speed. Every later rebirth adds another fifteen
 * levels and another x1 of speed, so the ladder continues without edits.
 *
 * A rebirth needs the CURRENT cap (you must reach Level 15 to take Rebirth 1),
 * resets level and XP, and keeps Wins, katanas, training, forge upgrades and
 * pets. It also adds a modest permanent damage bonus (+10% per rebirth) - the
 * only rebirth damage effect, and it is one named factor of the one formula.
 */

export const LEVELS_PER_REBIRTH = 15;

/** Highest level reachable with `rebirths` completed. */
export const maxLevelFor = (rebirths: number): number => LEVELS_PER_REBIRTH * (Math.max(0, Math.floor(rebirths)) + 1);

/** Level the NEXT rebirth needs: the current cap. */
export const rebirthRequiredLevel = (rebirths: number): number => maxLevelFor(rebirths);

/** Speed multiplier from `rebirths` completed: x1, x2, x3 ... */
export const rebirthSpeedMultiplier = (rebirths: number): number => 1 + Math.max(0, Math.floor(rebirths));

/** XP gain multiplier from rebirths: it tracks the speed multiplier, so each longer climb stays reachable. */
export const rebirthXpMultiplier = (rebirths: number): number => rebirthSpeedMultiplier(rebirths);

/** The only rebirth DAMAGE effect: +10% per rebirth. */
export const REBIRTH_DAMAGE_PER = 0.1;
export const rebirthDamageMultiplier = (rebirths: number): number => 1 + REBIRTH_DAMAGE_PER * Math.max(0, Math.floor(rebirths));

export const canRebirth = (level: number, rebirths: number): boolean =>
  Math.floor(level) >= rebirthRequiredLevel(rebirths);
