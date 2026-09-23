import { STAGE_COUNT } from './stages.js';

/**
 * WHAT A STAGE TELEPORT COSTS, in Wins - spent by the server when the
 * teleport happens, refused when the player cannot pay.
 *
 * The table runs as specified up to Stage 19; the Teleport menu never goes past
 * Stage 20. Only stages that exist in the game (`STAGE_COUNT`) get an entry:
 * a stage added later picks up its price from here with no other change. A
 * stage with no listed price (Stage 20) cannot be teleported to.
 */
export const STAGE_TELEPORT_COSTS: readonly number[] = [
  2, // Stage 1
  6,
  20,
  50,
  200, // Stage 5
  800,
  3_000,
  10_000,
  40_000,
  100_000, // Stage 10
  300_000,
  1_000_000,
  3_000_000,
  10_000_000,
  70_000_000, // Stage 15
  100_000_000,
  150_000_000,
  220_000_000,
  320_000_000, // Stage 19
];

/** The Teleport menu stops here, whatever else is ever added. */
export const MAX_TELEPORT_STAGE = 20;

/** Stages the Teleport menu lists: the game's own, never past Stage 20. */
export const TELEPORT_STAGE_COUNT = Math.min(STAGE_COUNT, MAX_TELEPORT_STAGE);

/** The Wins a teleport to this stage costs, or null when it cannot be teleported to. */
export const stageTeleportCost = (stage: number): number | null => {
  const index = Math.floor(stage);
  if (!Number.isFinite(index) || index < 1 || index > TELEPORT_STAGE_COUNT) return null;
  return STAGE_TELEPORT_COSTS[index - 1] ?? null;
};
