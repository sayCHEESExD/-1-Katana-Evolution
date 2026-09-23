/**
 * The DERIVING facts of a player's progression: everything a session is
 * rebuilt from. Level, damage and speed are recomputed from these by the same
 * shared formulas a live session uses; `damage` is ALSO stored, as the
 * server's own figure at save time, only so the Total Damage board can rank
 * players who are offline.
 */
export interface PetRecord {
  /** Unique per player, never reused. */
  uid: number;
  petId: number;
}

export interface ProgressFields {
  /** XP toward the level curve, clamped at the rebirth cap. */
  xp: number;
  /** XP earned, ever. */
  lifetimeXp: number;
  wins: number;
  /** Wins earned, ever: the Total Wins board. */
  lifetimeWins: number;
  rebirths: number;
  /** Bitmask of katanas owned (slot 1 = bit 0, always owned). */
  ownedKatanas: number;
  /** The worn katana's slot. */
  katanaSlot: number;
  /** The best MASTERED training tier. */
  trainingTier: number;
  /** Hits banked toward each training tier. */
  trainingHits: number[];
  /** Forge bonus bought, in percent. */
  forgePercent: number;
  /** The forge rotation `forgeBought` counts against. */
  forgeRotation: number;
  /** Items bought per forge slot in that rotation. */
  forgeBought: number[];
  pets: PetRecord[];
  /** uids of the equipped pets. */
  equippedPets: number[];
  /** The next pet uid to hand out. */
  nextPetUid: number;
  /** Pets ever hatched. */
  petsHatched: number;
  /** Highest stage ever cleared: how far the Teleport menu reaches. */
  bestStage: number;
  /** Seconds played, lifetime. */
  playSeconds: number;
  /** The server's damage figure at save time. Derived; for the offline board only. */
  damage: number;
}

/** What one save writes. */
export interface ProfileFields extends ProgressFields {
  /** The portal's display name and portrait as last seen. Cleared when empty. */
  displayName: string;
  avatarUrl: string;
  /** Wall clock of the save. */
  updatedAt: number;
}

/**
 * The first-login migration's bookkeeping.
 *
 *   - An ACCOUNT profile created from a browser's guest progress carries
 *     `migratedFrom`, the guest key it came from.
 *   - That GUEST profile is then RETIRED: its progress is reset, it carries
 *     `migratedTo` (the account key), `migratedAt`, and `migratedSnapshot` -
 *     the progress it held at that moment, kept as a recovery copy.
 */
export interface MigrationFields {
  migratedFrom?: string;
  migratedTo?: string;
  migratedAt?: number;
  migratedSnapshot?: ProgressFields;
}

/**
 * A profile as READ from storage. Beyond the fields this build knows, it may
 * carry any field a newer or older build wrote: those are kept and written
 * back untouched, never dropped.
 */
export type StoredProfile = ProfileFields & MigrationFields & { [field: string]: unknown };

const NUMERIC_KEYS = [
  'xp',
  'lifetimeXp',
  'wins',
  'lifetimeWins',
  'rebirths',
  'ownedKatanas',
  'katanaSlot',
  'trainingTier',
  'forgePercent',
  'forgeRotation',
  'nextPetUid',
  'petsHatched',
  'bestStage',
  'playSeconds',
  'damage',
] as const satisfies readonly (keyof ProgressFields)[];

/** Optional string fields a save may CLEAR. The only fields ever $unset. */
export const CLEARABLE_FIELDS = ['displayName', 'avatarUrl'] as const;

const numeric = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

const numbers = (value: unknown, limit: number): number[] =>
  Array.isArray(value) ? value.slice(0, limit).map(numeric) : [];

const petRecords = (value: unknown): PetRecord[] => {
  if (!Array.isArray(value)) return [];
  const out: PetRecord[] = [];
  const seen = new Set<number>();
  for (const entry of value.slice(0, 64)) {
    if (!entry || typeof entry !== 'object') continue;
    const uid = numeric((entry as { uid?: unknown }).uid);
    const petId = numeric((entry as { petId?: unknown }).petId);
    if (uid <= 0 || petId <= 0 || seen.has(uid)) continue;
    seen.add(uid);
    out.push({ uid: Math.floor(uid), petId: Math.floor(petId) });
  }
  return out;
};

export const emptyProgress = (): ProgressFields => ({
  xp: 0,
  lifetimeXp: 0,
  wins: 0,
  lifetimeWins: 0,
  rebirths: 0,
  ownedKatanas: 1,
  katanaSlot: 1,
  trainingTier: 0,
  trainingHits: [],
  forgePercent: 0,
  forgeRotation: 0,
  forgeBought: [],
  pets: [],
  equippedPets: [],
  nextPetUid: 1,
  petsHatched: 0,
  bestStage: 0,
  playSeconds: 0,
  damage: 0,
});

/** Just the progression of a profile, coerced. */
export const progressOf = (source: Partial<ProgressFields>): ProgressFields => {
  const out = emptyProgress();
  for (const key of NUMERIC_KEYS) out[key] = numeric(source[key]);
  if (out.ownedKatanas === 0) out.ownedKatanas = 1;
  if (out.katanaSlot === 0) out.katanaSlot = 1;
  if (out.nextPetUid === 0) out.nextPetUid = 1;
  out.trainingHits = numbers(source.trainingHits, 16);
  out.forgeBought = numbers(source.forgeBought, 8);
  out.pets = petRecords(source.pets);
  out.equippedPets = numbers(source.equippedPets, 8).map(Math.floor);
  return out;
};

/**
 * Coerce whatever storage held into a profile, KEEPING every unknown field.
 */
export const coerceProfile = (raw: unknown): StoredProfile | null => {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const profile: StoredProfile = {
    ...source,
    ...progressOf(source as Partial<ProgressFields>),
    displayName: text(source['displayName']),
    avatarUrl: text(source['avatarUrl']),
    updatedAt: numeric(source['updatedAt']),
  };
  if (typeof source['migratedFrom'] !== 'string') delete profile.migratedFrom;
  if (typeof source['migratedTo'] !== 'string') delete profile.migratedTo;
  if (typeof source['migratedAt'] !== 'number') delete profile.migratedAt;
  if (source['migratedSnapshot'] && typeof source['migratedSnapshot'] === 'object') {
    profile.migratedSnapshot = progressOf(source['migratedSnapshot'] as Partial<ProgressFields>);
  } else {
    delete profile.migratedSnapshot;
  }
  return profile;
};

/**
 * Whether a profile holds anything worth carrying into an account. A player
 * who opened the game and stood still has nothing to migrate.
 */
export const hasProgress = (p: ProgressFields): boolean =>
  p.lifetimeXp > 0 ||
  p.xp > 0 ||
  p.wins > 0 ||
  p.lifetimeWins > 0 ||
  p.bestStage > 0 ||
  p.rebirths > 0 ||
  p.ownedKatanas > 1 ||
  p.trainingTier > 0 ||
  p.forgePercent > 0 ||
  p.pets.length > 0;
