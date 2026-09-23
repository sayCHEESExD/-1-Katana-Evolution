/**
 * YOKAI PETS and the four eggs they hatch from.
 *
 * Every egg has its own pool and its own chances (they sum to 100). Hatching
 * spends Wins and rolls on the SERVER; the client only ever asks. A pet's
 * bonus is a small damage percentage; the equipped pets' bonuses ADD, and the
 * pet factor of the damage formula is 1 + sum / 100.
 *
 * Inventory: at most PET_INVENTORY_MAX owned and PET_EQUIP_MAX equipped.
 */
export type PetRarity = 'rare' | 'epic' | 'legendary';

export interface PetKind {
  /** Stable id. Never reuse one. */
  readonly id: number;
  readonly name: string;
  readonly rarity: PetRarity;
  /** Damage bonus in percent while equipped. */
  readonly bonus: number;
  /** Which procedural Yokai model the client builds. */
  readonly model:
    | 'chochin'
    | 'karakasa'
    | 'tanuki'
    | 'kitsune'
    | 'kappa'
    | 'tengu'
    | 'bakeneko'
    | 'hannya'
    | 'hitodama'
    | 'jorogumo'
    | 'nurikabe'
    | 'ryu'
    | 'gashadokuro'
    | 'raiju'
    | 'baku'
    | 'nue';
}

export interface EggKind {
  /** 1..4, and the pedestal order in the Pets Shop. */
  readonly id: number;
  readonly name: string;
  readonly cost: number;
  /** [petId, chance %] - the chances sum to 100. */
  readonly pool: readonly (readonly [number, number])[];
}

export const PETS: readonly PetKind[] = [
  { id: 1, name: 'Chochin Lantern', rarity: 'rare', bonus: 3, model: 'chochin' },
  { id: 2, name: 'Karakasa', rarity: 'epic', bonus: 6, model: 'karakasa' },
  { id: 3, name: 'Tanuki Spirit', rarity: 'epic', bonus: 8, model: 'tanuki' },
  { id: 4, name: 'Kitsune', rarity: 'legendary', bonus: 15, model: 'kitsune' },
  { id: 5, name: 'Kappa', rarity: 'rare', bonus: 10, model: 'kappa' },
  { id: 6, name: 'Karasu Tengu', rarity: 'epic', bonus: 18, model: 'tengu' },
  { id: 7, name: 'Bakeneko', rarity: 'epic', bonus: 22, model: 'bakeneko' },
  { id: 8, name: 'Hannya Mask', rarity: 'legendary', bonus: 40, model: 'hannya' },
  { id: 9, name: 'Hitodama Wisp', rarity: 'rare', bonus: 25, model: 'hitodama' },
  { id: 10, name: 'Jorogumo', rarity: 'epic', bonus: 45, model: 'jorogumo' },
  { id: 11, name: 'Nurikabe', rarity: 'epic', bonus: 50, model: 'nurikabe' },
  { id: 12, name: 'Ryujin Dragon', rarity: 'legendary', bonus: 90, model: 'ryu' },
  { id: 13, name: 'Gashadokuro', rarity: 'rare', bonus: 60, model: 'gashadokuro' },
  { id: 14, name: 'Raiju', rarity: 'epic', bonus: 100, model: 'raiju' },
  { id: 15, name: 'Baku', rarity: 'epic', bonus: 120, model: 'baku' },
  { id: 16, name: 'Nue', rarity: 'legendary', bonus: 200, model: 'nue' },
];

export const EGGS: readonly EggKind[] = [
  { id: 1, name: 'Bamboo Egg', cost: 500, pool: [[1, 60], [2, 15], [3, 15], [4, 10]] },
  { id: 2, name: 'Magma Egg', cost: 35_000, pool: [[5, 60], [6, 15], [7, 15], [8, 10]] },
  { id: 3, name: 'Frost Egg', cost: 2_000_000, pool: [[9, 60], [10, 15], [11, 15], [12, 10]] },
  { id: 4, name: 'Spirit Egg', cost: 350_000_000, pool: [[13, 60], [14, 15], [15, 15], [16, 10]] },
];

export const PET_RARITY_COLORS: Readonly<Record<PetRarity, string>> = {
  rare: '#5ed64f',
  epic: '#ff5a3c',
  legendary: '#3fd6ff',
};

export const PET_INVENTORY_MAX = 30;
export const PET_EQUIP_MAX = 3;
/** Most eggs one Hatch press opens. */
export const HATCH_MULTI = 3;

export const petById = (id: number): PetKind | undefined => PETS.find((pet) => pet.id === id);
export const eggById = (id: number): EggKind | undefined => EGGS.find((egg) => egg.id === Math.floor(id));

/**
 * Roll one pet from an egg, given a uniform random number in [0, 1). The
 * randomness is supplied, so the server owns it and the roll itself is testable.
 */
export const rollEgg = (egg: EggKind, random01: number): PetKind => {
  let at = Math.min(Math.max(random01, 0), 0.999999) * 100;
  for (const [petId, chance] of egg.pool) {
    if (at < chance) return petById(petId) as PetKind;
    at -= chance;
  }
  return petById(egg.pool[0]![0]) as PetKind;
};

/** The pet factor of the damage formula, from the EQUIPPED pets' ids. */
export const petMultiplier = (equippedPetIds: readonly number[]): number => {
  let sum = 0;
  for (const id of equippedPetIds.slice(0, PET_EQUIP_MAX)) sum += petById(id)?.bonus ?? 0;
  return 1 + sum / 100;
};
