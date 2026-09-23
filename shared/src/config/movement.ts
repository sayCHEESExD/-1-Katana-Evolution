/**
 * Movement tuning for a running samurai: walk, run and jump. There is NO
 * sprint key - how fast a player runs is their Speed stat, nothing else.
 *
 * The client predicts with these numbers and the server simulates with them,
 * so there is exactly one copy. The run SPEED itself is a per-player
 * parameter (`SimParams.moveSpeed`), derived by the server from level and
 * rebirths.
 */
export interface MovementConfig {
  readonly acceleration: number;
  readonly deceleration: number;
  /** Fraction of ground acceleration retained in the air. */
  readonly airControl: number;
  /** Downward acceleration, world units per second squared. */
  readonly gravity: number;
  /** Turn rate toward the movement direction, radians per second. */
  readonly turnSpeed: number;
  /** Largest distance one substep may integrate. */
  readonly maxSubstepDistance: number;
  readonly maxSubsteps: number;
  /** Height the character steps up without jumping: stair treads and floor slabs. */
  readonly stepHeight: number;
  /** Fastest fall, so a long drop cannot tunnel a floor. */
  readonly terminalVelocity: number;
}

export const MOVEMENT: MovementConfig = {
  acceleration: 120,
  deceleration: 110,
  airControl: 0.55,
  gravity: 70,
  turnSpeed: 12,
  maxSubstepDistance: 0.5,
  maxSubsteps: 40,
  stepHeight: 1.05,
  terminalVelocity: 90,
};
