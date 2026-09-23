/**
 * THE LEVEL CURVE, and what a level is worth.
 *
 * Every figure here is SERVER-AUTHORITATIVE and deterministic. The client
 * displays what was replicated and never decides any of it.
 *
 * Pinned reference points (asserted by `verify:progression`):
 *
 *   Level 9  -> 520 XP to the next level, ~1.4K damage with Katana 2, 25 speed
 *   Level 10 -> 799 XP to the next level, ~1.7K damage with Katana 2, 26 speed
 */

/**
 * XP needed to advance FROM `level` to the next one.
 *
 * Two smooth curves joined at Level 10. Below it the curve starts at an 18 XP
 * first level, rises by a small linear step plus a steep power term (exponent
 * 3.83) so that it passes through exactly 520 at Level 9 and 799 at Level 10. Past Level 10 the exponent
 * relaxes to 2.3 so the later rebirth caps (30, 45, 60 ...) stay a long climb
 * rather than an impossible one. Both pieces give exactly 799 at Level 10 and
 * are strictly increasing, so the whole curve is.
 */
export const xpForNextLevel = (level: number): number => {
  const l = Math.max(1, Math.floor(level));
  if (l <= 10) return Math.round(18 + 2 * (l - 1) + 0.169065 * (l - 1) ** 3.8298);
  return Math.round(799 * (l / 10) ** 2.3);
};

/** Cumulative XP to have REACHED each level, grown on demand. Level 1 is 0 XP. */
const CUMULATIVE: number[] = [0, 0];

const extendTo = (level: number): void => {
  while (CUMULATIVE.length <= level) {
    const last = CUMULATIVE.length - 1;
    CUMULATIVE.push((CUMULATIVE[last] as number) + xpForNextLevel(last));
  }
};

/** Total XP a player holds on first reaching `level`. */
export const totalXpToReach = (level: number): number => {
  const target = Math.max(1, Math.min(Math.floor(level), 100_000));
  extendTo(target);
  return CUMULATIVE[target] ?? 0;
};

export interface LevelProgress {
  readonly level: number;
  /** XP earned toward the next level. */
  readonly into: number;
  /** XP needed for the next level. */
  readonly required: number;
  /** 0..1 fill for the level bar. */
  readonly fraction: number;
  /** True when the level is the rebirth cap: the bar is full and XP stops. */
  readonly capped: boolean;
}

/**
 * Resolve an XP total into a level, clamped at `maxLevel`.
 *
 * At the cap the bar reads full and no further XP is kept - the server clamps
 * the stored figure too, so a rebirth never carries a surplus.
 */
export const resolveLevel = (xp: number, maxLevel: number): LevelProgress => {
  const total = Number.isFinite(xp) ? Math.max(0, xp) : 0;
  const cap = Math.max(1, Math.floor(maxLevel));
  extendTo(cap + 1);
  let low = 1;
  let high = cap;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if ((CUMULATIVE[mid] as number) <= total) low = mid;
    else high = mid - 1;
  }
  const required = xpForNextLevel(low);
  if (low >= cap) return { level: cap, into: required, required, fraction: 1, capped: true };
  const into = total - (CUMULATIVE[low] as number);
  return { level: low, into, required, fraction: Math.min(Math.max(into / required, 0), 1), capped: false };
};

/** The most XP a player at this cap may hold: exactly the cap level's start. */
export const xpCeiling = (maxLevel: number): number => totalXpToReach(maxLevel);

/**
 * THE LEVEL'S DAMAGE FACTOR: a smooth power curve, 12.3 x level^1.84.
 *
 * Chosen through the two reference points: with Katana 2 (+2) and nothing
 * else, Level 9 deals 2 x 701 = 1.4K and Level 10 deals 2 x 851 = 1.7K.
 * Level 1 is x12.3, so a brand-new player with the bamboo starter hits for 12.
 */
export const LEVEL_DAMAGE = { scale: 12.3, exponent: 1.84 } as const;

export const levelDamageFactor = (level: number): number =>
  LEVEL_DAMAGE.scale * Math.max(1, Math.floor(level)) ** LEVEL_DAMAGE.exponent;

/**
 * THE SPEED STAT, before the rebirth multiplier: small readable integers.
 *
 * +1 per level up to Level 30 (Level 9 = 25, Level 10 = 26, as in the
 * reference), then +1 every third level. Speed deliberately grows far slower
 * than damage.
 */
export const baseSpeedFor = (level: number): number => {
  const l = Math.max(1, Math.floor(level));
  if (l <= 30) return 16 + l;
  return 46 + Math.floor((l - 30) / 3);
};

/** XP for one step of ground covered, before the rebirth XP multiplier. */
export const XP_PER_STRIDE = 1;
/** World units of ground travel that make one stride. */
export const STRIDE_DISTANCE = 3.2;
/** Slack on the largest distance one simulated step may honestly cover. */
export const STRIDE_CREDIT_SLACK = 1.6;
/** Ground speed below which the player counts as NOT MOVING. */
export const MOVING_SPEED = 1.5;

/**
 * XP for one katana SWING, landed or not, on the ground or in the air. Paid by
 * the server for every swing its rate limit accepts, so attacking always
 * advances the level bar; a landed hit adds `XP_PER_HIT` on top.
 */
export const XP_PER_SWING = 1;

/** XP for one landed katana hit, before the target's factor and the rebirth XP multiplier. */
export const XP_PER_HIT = 4;
