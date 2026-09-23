/**
 * THE FORGE SHOP: a rotating stock of permanent damage upgrades.
 *
 * Every RESTOCK_SECONDS the stock rolls again: one item per rarity, drawn
 * from that rarity's pool, some of them rolled as PERFECT (a quarter more
 * bonus). The roll is a pure function of the rotation number, so every room
 * on every pod shows the same stock at the same moment and the server can
 * re-derive what any rotation offered.
 *
 * Buying adds the item's bonus to the player's forge total permanently. The
 * total is ADDITIVE: forge factor = 1 + total% / 100, the fourth factor of
 * the one damage formula. Each slot has a per-player stock, reset with the
 * rotation.
 *
 * TO ADD AN ITEM: append it to FORGE_ITEMS with a new id. Nothing else.
 */
export type ForgeRarity = 'common' | 'rare' | 'legendary' | 'mythic';

export interface ForgeItem {
  /** Stable id. Never reuse one. */
  readonly id: number;
  readonly name: string;
  readonly rarity: ForgeRarity;
  /** Damage bonus in percent. */
  readonly bonus: number;
  /** Wins price. */
  readonly cost: number;
  /** How many a player may buy per rotation. */
  readonly stock: number;
  /** Which drawn icon the shop card shows. */
  readonly icon: 'bar' | 'orb' | 'flame' | 'rune' | 'ingot' | 'stone' | 'scale' | 'seal' | 'oil' | 'silk' | 'ember' | 'moon';
}

export const FORGE_RARITIES: readonly { readonly id: ForgeRarity; readonly label: string; readonly color: string }[] = [
  { id: 'common', label: 'Common', color: '#c9a86a' },
  { id: 'rare', label: 'Rare', color: '#5ed64f' },
  { id: 'legendary', label: 'Legendary', color: '#3fb6ff' },
  { id: 'mythic', label: 'Mythic', color: '#ff4fd8' },
];

export const FORGE_ITEMS: readonly ForgeItem[] = [
  { id: 1, name: 'Iron Bar', rarity: 'common', bonus: 7, cost: 500, stock: 5, icon: 'bar' },
  { id: 2, name: 'Copper Ingot', rarity: 'common', bonus: 6, cost: 400, stock: 5, icon: 'ingot' },
  { id: 3, name: 'Tamahagane Shard', rarity: 'common', bonus: 9, cost: 750, stock: 5, icon: 'stone' },
  { id: 4, name: 'River Whetstone', rarity: 'common', bonus: 5, cost: 300, stock: 5, icon: 'stone' },
  { id: 5, name: 'Carmine Extract', rarity: 'rare', bonus: 22.4, cost: 40_300, stock: 3, icon: 'orb' },
  { id: 6, name: 'Jade Temper Oil', rarity: 'rare', bonus: 20, cost: 35_000, stock: 3, icon: 'oil' },
  { id: 7, name: 'Crimson Silk Wrap', rarity: 'rare', bonus: 26, cost: 52_000, stock: 3, icon: 'silk' },
  { id: 8, name: 'Blue Flame', rarity: 'legendary', bonus: 45, cost: 569_000, stock: 2, icon: 'flame' },
  { id: 9, name: 'Dragon Scale Flux', rarity: 'legendary', bonus: 50, cost: 700_000, stock: 2, icon: 'scale' },
  { id: 10, name: 'Moonsteel Ingot', rarity: 'legendary', bonus: 40, cost: 480_000, stock: 2, icon: 'moon' },
  { id: 11, name: "Sensei's Rune", rarity: 'mythic', bonus: 43, cost: 2_700_000, stock: 1, icon: 'rune' },
  { id: 12, name: "Kami's Ember", rarity: 'mythic', bonus: 60, cost: 4_500_000, stock: 1, icon: 'ember' },
  { id: 13, name: 'Shogun Seal', rarity: 'mythic', bonus: 75, cost: 7_000_000, stock: 1, icon: 'seal' },
];

/** Seconds between restocks. */
export const RESTOCK_SECONDS = 5 * 60;

/** Chance a slot rolls PERFECT, and what that is worth. */
export const PERFECT_CHANCE = 0.2;
export const PERFECT_BONUS_SCALE = 1.25;

/** The number of the stock rotation in effect at a wall-clock time. */
export const forgeRotationAt = (epochMs: number): number => Math.floor(epochMs / 1000 / RESTOCK_SECONDS);

/** Seconds until the rotation after the one in effect at a wall-clock time. */
export const forgeSecondsLeftAt = (epochMs: number): number =>
  RESTOCK_SECONDS - (Math.floor(epochMs / 1000) % RESTOCK_SECONDS);

/** One slot of a rotation's stock. */
export interface ForgeOffer {
  /** 0..3, one per rarity in FORGE_RARITIES order. */
  readonly slot: number;
  readonly item: ForgeItem;
  readonly perfect: boolean;
  /** The bonus as rolled, in percent (Perfect included). */
  readonly bonus: number;
}

/** mulberry32: a tiny deterministic PRNG, identical on every machine. */
const rng = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** The stock a rotation offers. Pure: the same rotation always offers the same four. */
export const forgeOffers = (rotation: number): ForgeOffer[] => {
  const random = rng(Math.imul(Math.floor(rotation) + 7919, 2654435761));
  return FORGE_RARITIES.map((rarity, slot) => {
    const pool = FORGE_ITEMS.filter((item) => item.rarity === rarity.id);
    const item = pool[Math.floor(random() * pool.length) % pool.length] as ForgeItem;
    const perfect = random() < PERFECT_CHANCE;
    const bonus = Math.round(item.bonus * (perfect ? PERFECT_BONUS_SCALE : 1) * 10) / 10;
    return { slot, item, perfect, bonus };
  });
};

/** The forge factor of the damage formula. */
export const forgeMultiplier = (forgePercent: number): number =>
  1 + Math.max(0, Number.isFinite(forgePercent) ? forgePercent : 0) / 100;
