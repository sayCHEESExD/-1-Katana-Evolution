import { forgeMultiplier } from './forge.js';
import { katanaDamageOf } from './katanas.js';
import { baseSpeedFor, levelDamageFactor } from './leveling.js';
import { petMultiplier } from './pets.js';
import { rebirthDamageMultiplier, rebirthSpeedMultiplier } from './rebirth.js';
import { trainingMultiplier } from './training.js';

/**
 * THE ONE DAMAGE FORMULA.
 *
 *   damage per click =
 *       katana base damage
 *     x training multiplier   (best MASTERED dummy)
 *     x level factor          (12.3 x level^1.84)
 *     x forge factor          (1 + forge % / 100)
 *     x pet factor            (1 + equipped pets' % / 100)
 *     x rebirth factor        (1 + 10% per rebirth)
 *
 * floored to a whole number. There is no other multiplier anywhere: the
 * server deals exactly this per landed hit, the HUD shows exactly this, and
 * the leaderboard ranks exactly this. `describeDamage` prints the breakdown.
 */
export interface DamageInputs {
  readonly katanaSlot: number;
  readonly ownedKatanas: number;
  readonly trainingTier: number;
  readonly level: number;
  readonly forgePercent: number;
  readonly equippedPetIds: readonly number[];
  readonly rebirths: number;
}

export interface DamageBreakdown {
  readonly katana: number;
  readonly training: number;
  readonly level: number;
  readonly forge: number;
  readonly pets: number;
  readonly rebirth: number;
  readonly total: number;
}

export const damageBreakdown = (inputs: DamageInputs): DamageBreakdown => {
  const katana = katanaDamageOf(inputs.katanaSlot, inputs.ownedKatanas);
  const training = trainingMultiplier(inputs.trainingTier);
  const level = levelDamageFactor(inputs.level);
  const forge = forgeMultiplier(inputs.forgePercent);
  const pets = petMultiplier(inputs.equippedPetIds);
  const rebirth = rebirthDamageMultiplier(inputs.rebirths);
  const total = Math.max(1, Math.floor(katana * training * level * forge * pets * rebirth));
  return { katana, training, level, forge, pets, rebirth, total };
};

export const damageFor = (inputs: DamageInputs): number => damageBreakdown(inputs).total;

export const describeDamage = (inputs: DamageInputs): string => {
  const b = damageBreakdown(inputs);
  const f = (value: number): string => (Math.round(value * 1000) / 1000).toString();
  return `katana ${f(b.katana)} x training ${f(b.training)} x level ${f(b.level)} x forge ${f(b.forge)} x pets ${f(b.pets)} x rebirth ${f(b.rebirth)} = ${b.total}`;
};

/** THE SPEED STAT the HUD shows: level speed x rebirth speed multiplier. */
export const speedStatFor = (level: number, rebirths: number): number =>
  baseSpeedFor(level) * rebirthSpeedMultiplier(rebirths);

/**
 * World units per second per point of Speed.
 *
 * The character is 3.2 units tall and a Roblox character five studs, so a unit
 * is ~1.56 studs: Speed 25 walks at 16 units a second, which is Roblox's
 * 16-ish studs of walk scaled to this world.
 */
export const UNITS_PER_SPEED = 0.64;

/**
 * The fastest a player is ever SIMULATED to move, in world units per second.
 *
 * A safety rail rather than a design ceiling: the Speed stat keeps growing and
 * keeps showing, but past this the character stays controllable and the
 * collision substeps stay cheap. Reached around Speed 125 (a few rebirths in).
 */
export const MAX_MOVE_SPEED = 80;

export const moveSpeedFor = (speedStat: number): number =>
  Math.min(Math.max(speedStat, 1) * UNITS_PER_SPEED, MAX_MOVE_SPEED);

/** Jump take-off velocity. Rebirths add a little height ("Speed // Height"), capped. */
export const JUMP_VELOCITY = 24;
export const jumpVelocityFor = (rebirths: number): number =>
  JUMP_VELOCITY * Math.min(1 + 0.12 * Math.max(0, Math.floor(rebirths)), 1.5);
