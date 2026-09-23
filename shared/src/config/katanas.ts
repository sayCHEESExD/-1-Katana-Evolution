/**
 * THE FOURTEEN KATANAS on the Katana Stage.
 *
 * `damage` is the katana's BASE DAMAGE PER CLICK - the first factor of the one
 * damage formula (`damage.ts`). `cost` is a Wins PRICE: walking onto the pad
 * with enough Wins buys it (the Wins are spent) and equips it; walking onto an
 * owned katana's pad equips it. Slot 1, the Bamboo Starter, is owned by
 * everyone from the start.
 *
 * Order is the stage order and the pad order. Values are pinned by the spec
 * and asserted by `verify:progression`.
 */
export interface KatanaTier {
  /** 1-based slot, and the pad number on the stage. */
  readonly slot: number;
  readonly name: string;
  /** Base damage per click. */
  readonly damage: number;
  /** Wins price. */
  readonly cost: number;
  /** The label colour on the stage and in the HUD. */
  readonly color: string;
}

export const KATANAS: readonly KatanaTier[] = [
  { slot: 1, name: 'Bamboo Starter', damage: 1, cost: 0, color: '#7ddc4a' },
  { slot: 2, name: 'Ashigaru Blade', damage: 2, cost: 1, color: '#e8eef5' },
  { slot: 3, name: 'Sakura Edge', damage: 5, cost: 25, color: '#ff8fc7' },
  { slot: 4, name: 'Jade Serpent', damage: 12, cost: 100, color: '#37e0a0' },
  { slot: 5, name: 'Crimson Oni', damage: 50, cost: 750, color: '#ff4040' },
  { slot: 6, name: 'Frostbite Tachi', damage: 125, cost: 3_500, color: '#7fe3ff' },
  { slot: 7, name: 'Raijin Thunder', damage: 250, cost: 18_000, color: '#ffe23a' },
  { slot: 8, name: 'Moonlit Kitsune', damage: 500, cost: 90_000, color: '#c7b8ff' },
  { slot: 9, name: 'Dragonfire Muramasa', damage: 850, cost: 450_000, color: '#ff8a1c' },
  { slot: 10, name: 'Shadow Ninjato', damage: 3_000, cost: 3_500_000, color: '#b16bff' },
  { slot: 11, name: 'Toxic Yokai Fang', damage: 7_000, cost: 25_000_000, color: '#8dff3a' },
  { slot: 12, name: 'Celestial Masamune', damage: 35_000, cost: 115_000_000, color: '#fff3b0' },
  { slot: 13, name: 'Demon King Nodachi', damage: 135_000, cost: 500_000_000, color: '#ff2e6a' },
  { slot: 14, name: 'Kusanagi, Heaven Blade', damage: 500_000, cost: 1_000_000_000_000, color: '#6ff7ff' },
];

export const KATANA_COUNT = KATANAS.length;

/** Every katana bit, for sanitising a stored mask. Slot 1 is bit 0. */
export const ALL_KATANA_BITS = (1 << KATANA_COUNT) - 1;

/** The starter is always owned. */
export const STARTER_KATANA_BITS = 1;

export const katanaBySlot = (slot: number): KatanaTier | undefined => KATANAS[Math.floor(slot) - 1];

export const ownsKatana = (owned: number, slot: number): boolean =>
  slot >= 1 && slot <= KATANA_COUNT && ((owned | STARTER_KATANA_BITS) & (1 << (slot - 1))) !== 0;

/** Base damage of the worn katana; an unowned or unknown slot falls back to the starter. */
export const katanaDamageOf = (slot: number, owned: number): number => {
  const tier = katanaBySlot(slot);
  if (!tier || !ownsKatana(owned, slot)) return KATANAS[0]!.damage;
  return tier.damage;
};
