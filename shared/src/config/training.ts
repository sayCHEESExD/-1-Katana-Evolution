/**
 * THE TRAINING AREA: three themed pocket zones, two dummies each.
 *
 * Every dummy carries a DAMAGE MULTIPLIER and a REBIRTH REQUIREMENT. Hitting a
 * dummy the player has the rebirths for trains toward it; once its hit count is
 * reached the dummy is MASTERED and its multiplier becomes the player's
 * training multiplier - the second factor of the one damage formula. Only the
 * best mastered dummy counts; multipliers never stack.
 *
 * The rebirth requirement is enforced on the SERVER, per hit, against the
 * server's own rebirth count. A locked dummy takes the swing and pays nothing.
 */
export type TrainingZoneId = 'basic' | 'dojo' | 'cultist';

export interface TrainingTier {
  /** 0-based tier, and the dummy's index. Tier 0 is mastered by everyone. */
  readonly tier: number;
  readonly zone: TrainingZoneId;
  readonly name: string;
  readonly multiplier: number;
  readonly rebirthsRequired: number;
  /** Hits on this dummy that master it. */
  readonly hitsToMaster: number;
}

export const TRAINING_TIERS: readonly TrainingTier[] = [
  { tier: 0, zone: 'basic', name: 'Straw Dummy', multiplier: 1, rebirthsRequired: 0, hitsToMaster: 0 },
  { tier: 1, zone: 'basic', name: 'Iron-Bound Dummy', multiplier: 2, rebirthsRequired: 1, hitsToMaster: 20 },
  { tier: 2, zone: 'dojo', name: 'Dojo Makiwara', multiplier: 3, rebirthsRequired: 2, hitsToMaster: 30 },
  { tier: 3, zone: 'dojo', name: 'Sensei Dummy', multiplier: 5, rebirthsRequired: 3, hitsToMaster: 45 },
  { tier: 4, zone: 'cultist', name: 'Cursed Effigy', multiplier: 10, rebirthsRequired: 9, hitsToMaster: 70 },
  { tier: 5, zone: 'cultist', name: 'Blood Moon Idol', multiplier: 25, rebirthsRequired: 15, hitsToMaster: 100 },
];

export const TRAINING_ZONES: readonly { readonly id: TrainingZoneId; readonly name: string }[] = [
  { id: 'basic', name: 'BASIC ZONE' },
  { id: 'dojo', name: 'DOJO ZONE' },
  { id: 'cultist', name: 'CULTIST ZONE' },
];

export const trainingTier = (tier: number): TrainingTier | undefined => TRAINING_TIERS[Math.floor(tier)];

/** The damage multiplier of the best MASTERED tier. */
export const trainingMultiplier = (masteredTier: number): number =>
  (trainingTier(Math.max(0, Math.min(masteredTier, TRAINING_TIERS.length - 1))) ?? TRAINING_TIERS[0]!).multiplier;

export const canTrainOn = (tier: number, rebirths: number): boolean => {
  const t = trainingTier(tier);
  return !!t && Math.floor(rebirths) >= t.rebirthsRequired;
};
