import type { Aabb } from '../types/math.js';
import { arenaEndZ, arenaStartZ } from './map.js';

/**
 * THE SCENERY, as data: where every tree, lantern, rock and house stands.
 * The client draws it; collision (both sides) stands its trunks and bases up
 * as solids, so a player runs AROUND a pine rather than through it.
 *
 * Arena scenery is generated per stage along the arena's EDGES, never in the
 * middle where the wave fights: the centre of every arena is open ground.
 */
export type DecorKind =
  | 'pine'
  | 'sakura'
  | 'bamboo'
  | 'stoneLantern'
  | 'lamp'
  | 'rock'
  | 'house'
  | 'barrel'
  | 'crate'
  | 'flag'
  | 'nobori'
  | 'bench'
  | 'jizo';

export interface Decor {
  readonly kind: DecorKind;
  readonly x: number;
  readonly z: number;
  /** Scale, or for a house its width. */
  readonly s: number;
  readonly yaw: number;
  /** A house's depth. */
  readonly d?: number;
}

/** Half-width of the solid a decor piece stands on the ground, or 0 for none. */
const SOLID_HALF: Readonly<Record<DecorKind, number>> = {
  pine: 0.7,
  sakura: 0.6,
  bamboo: 1.4,
  stoneLantern: 0.75,
  lamp: 0.3,
  rock: 1.3,
  house: 0,
  barrel: 0.75,
  crate: 0.85,
  flag: 0.2,
  nobori: 0.2,
  bench: 0,
  jizo: 0.55,
};

const d = (kind: DecorKind, x: number, z: number, s = 1, yaw = 0, depth?: number): Decor =>
  depth === undefined ? { kind, x, z, s, yaw } : { kind, x, z, s, yaw, d: depth };

/** The village. Clear of the stage, the training area, the forge, the eggs and every path. */
export const HUB_DECOR: readonly Decor[] = [
  // Spawn plaza: lanterns and lamps ringing the circle.
  d('stoneLantern', -12, -12), d('stoneLantern', 12, -12), d('stoneLantern', -12, 12), d('stoneLantern', 12, 12),
  d('lamp', -24, -24), d('lamp', 16, -30), d('lamp', -24, 26), d('lamp', 16, 30),
  d('sakura', -26, 14, 1.1), d('sakura', 26, 32, 1.1, 1), d('sakura', 24, -34, 1), d('sakura', -18, -28, 1.1, 2),
  d('flag', 12, 34, 1, Math.PI / 2), d('flag', -16, 32, 1, -Math.PI / 2),
  // Left of the spawn: a house and grove beyond the training pockets, a pond and a
  // sakura on the lawn before the Forge - the lawn itself stays open to walk up to its counter.
  d('house', 50, 35, 12, 0, 6), d('pine', 60, 36, 1.1), d('pine', 36, 36, 0.9),
  d('bamboo', 60, 31.5, 1), d('rock', 40, 32, 1),
  d('sakura', 46, -26, 1.1, 3), d('pine', 61, -36, 1),
  d('stoneLantern', 26, -26), d('lamp', 61.5, -46),
  // Right of the Katana Stage, against the cliff.
  d('pine', -84, 34, 1.1), d('pine', -84, -34, 1.1), d('bamboo', -76, 36, 1), d('bamboo', -76, -36, 1),
  // Back row: behind the eggs and the forge, against the cliff.
  d('pine', -80, -66, 1.2), d('lamp', -22, -46), d('lamp', 22, -46),
  d('stoneLantern', -34, -46), d('stoneLantern', -66, -46), d('stoneLantern', -78, -59), d('stoneLantern', -22, -59),
  d('bench', -20, 4, 1, Math.PI / 2),
];

const seeded = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** What a stage's arena is planted with, by its theme's dominant plants. */
const STAGE_PLANTS: readonly (readonly DecorKind[])[] = [
  ['bamboo', 'bamboo', 'pine', 'rock', 'sakura'],
  ['stoneLantern', 'sakura', 'pine', 'nobori', 'rock'],
  ['rock', 'crate', 'barrel', 'nobori', 'pine'],
  ['sakura', 'sakura', 'stoneLantern', 'pine', 'rock'],
  ['pine', 'rock', 'stoneLantern', 'pine', 'rock'],
  ['rock', 'barrel', 'crate', 'rock', 'nobori'],
  ['bamboo', 'rock', 'jizo', 'pine', 'bamboo'],
  ['rock', 'pine', 'nobori', 'rock', 'stoneLantern'],
  ['stoneLantern', 'pine', 'nobori', 'rock', 'crate'],
  ['nobori', 'stoneLantern', 'sakura', 'pine', 'nobori'],
];

/**
 * A stage's scenery: two rows down each side, 30 to 40 units off the centre
 * line, plus lanterns flanking the entrance. The middle stays open.
 */
export const stageDecor = (stage: number): Decor[] => {
  const random = seeded(stage * 7919 + 17);
  const plants = STAGE_PLANTS[(stage - 1) % STAGE_PLANTS.length]!;
  const out: Decor[] = [];
  const start = arenaStartZ(stage);
  const end = arenaEndZ(stage);
  for (let z = start + 10; z < end - 16; z += 9) {
    for (const side of [-1, 1]) {
      const kind = plants[Math.floor(random() * plants.length)]!;
      const x = side * (31 + random() * 8);
      out.push(d(kind, x, z + random() * 4, 0.9 + random() * 0.4, random() * Math.PI * 2));
    }
  }
  out.push(d('stoneLantern', -12, start + 3), d('stoneLantern', 12, start + 3));
  return out;
};

/** Every decor solid in the world, as boxes. */
export const decorSolids = (stageCount: number): Aabb[] => {
  const all: Decor[] = [...HUB_DECOR];
  for (let stage = 1; stage <= stageCount; stage += 1) all.push(...stageDecor(stage));
  const boxes: Aabb[] = [];
  for (const item of all) {
    if (item.kind === 'house') {
      const w = item.s / 2;
      const depth = (item.d ?? 8) / 2;
      const turned = Math.abs(Math.sin(item.yaw)) > 0.5;
      const hx = turned ? depth : w;
      const hz = turned ? w : depth;
      boxes.push({ minX: item.x - hx, maxX: item.x + hx, minY: 0, maxY: 8, minZ: item.z - hz, maxZ: item.z + hz });
      continue;
    }
    const half = SOLID_HALF[item.kind] * (item.kind === 'bamboo' ? 1 : Math.min(item.s, 1.4));
    if (half <= 0) continue;
    const height = item.kind === 'rock' ? 2.6 * item.s : 6;
    boxes.push({ minX: item.x - half, maxX: item.x + half, minY: 0, maxY: height, minZ: item.z - half, maxZ: item.z + half });
  }
  return boxes;
};
