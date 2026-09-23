/**
 * Katana combat tuning, shared so the client's swing and the server's
 * validation agree on the same numbers.
 *
 * A swing is a REQUEST. The client names what it swung at (a hint) and the
 * server decides: the target must exist, be alive, be attackable by this
 * player, and be within reach of the position the SERVER simulated. The
 * damage dealt is always the server's own `damageFor` figure.
 */
export const COMBAT = {
  /** Seconds between two swings the client plays. */
  swingInterval: 0.2,
  /** Auto-click swings at this interval. */
  autoInterval: 0.25,
  /**
   * The server's rate limit: a bucket of `burst` swings refilled one per
   * `refillSeconds`. Slightly looser than the client so network jitter never
   * eats an honest click; a macro gains nothing past it.
   */
  refillSeconds: 0.17,
  burst: 3,
  /** Reach from the player's centre to the target's edge, in world units. */
  reach: 5.5,
  /** Extra reach the server allows for latency: the client swings from a newer position. */
  reachSlack: 2.5,
  /** How long the katana stays drawn after the last swing, seconds. */
  drawnSeconds: 1.6,
} as const;

/**
 * A DEATH plays out before the respawn. The client's death animation runs
 * `DEATH_ANIMATION_SECONDS`; the server holds the fallen player where they
 * fell (no movement, no swings, no claims, no teleports) for
 * `DEATH_RESPAWN_SECONDS` - a little longer, so the animation always finishes
 * before the player is sent home.
 */
export const DEATH_ANIMATION_SECONDS = 2.1;
export const DEATH_RESPAWN_SECONDS = 2.4;

/** Swing targets: an enemy id, or a training dummy offset past it. */
export const DUMMY_TARGET_BASE = 1000;
export const NO_TARGET = -1;

export const dummyTarget = (tier: number): number => DUMMY_TARGET_BASE + tier;
export const isDummyTarget = (target: number): boolean => target >= DUMMY_TARGET_BASE;
