/**
 * The gameplay signals the animator consumes each frame. It reads these and
 * never writes back. The local player fills it from its prediction and every
 * remote from replicated state, so both run the exact same animation code.
 */
export interface AnimationInput {
  grounded: boolean;
  /** Horizontal speed in world units per second. */
  horizontalSpeed: number;
  verticalVelocity: number;
  /** -1..1 steering, for the lean. */
  turn: number;
  landed: boolean;
  /** Seconds since the current swing began, or -1 when not swinging. */
  swingTime: number;
  /** Which of the two mirrored swings: 0 forehand, 1 backhand. */
  swingVariant: number;
  /** True while the katana is drawn (just after swinging). */
  drawn: boolean;
}

export const createAnimationInput = (): AnimationInput => ({
  grounded: true,
  horizontalSpeed: 0,
  verticalVelocity: 0,
  turn: 0,
  landed: false,
  swingTime: -1,
  swingVariant: 0,
  drawn: false,
});
