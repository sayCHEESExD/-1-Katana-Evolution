import type { Aabb } from '../types/math.js';
import { KATANA_COUNT } from './katanas.js';
import { EGGS } from './pets.js';
import { TRAINING_TIERS, type TrainingZoneId } from './training.js';

/**
 * THE MAP, as pure data. Every coordinate in the game lives here; collision
 * (shared, both sides) and the client's visuals both read it, so the thing a
 * player walks on and the thing they see cannot drift apart.
 *
 * Axes: +Z runs from the village toward the enemy stages. The spawn faces +Z,
 * so the camera's RIGHT at the spawn is world -X: the Katana Stage (x ~ -58)
 * is to the player's right, the Training Area (x ~ 27) directly to their LEFT,
 * the scoreboards straight behind them on the back cliff, the Forge behind-left
 * and the Pets Shop behind-right.
 */

export interface Placement {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Facing, radians: 0 faces +Z, -PI/2 faces -X. */
  readonly yaw: number;
}

export const SPAWN: Placement = { x: 0, y: 0, z: 0, yaw: 0 };

/** The village plaza: the walkable rectangle inside the cliffs. */
export const HUB = { minX: -88, maxX: 64, minZ: -72, maxZ: 40 } as const;

/** Where the hub opens onto the stage road: the Stage 1 portal. */
export const HUB_GATE = { minX: -10, maxX: 10, z: 42 } as const;

// ------------------------------------------------------------ Katana Stage

/**
 * THE KATANA STAGE: three stepped storeys against a back wall, open toward
 * the spawn (+X). Five pads on the first storey, five on the second, four on
 * the third. Stairs climb both ends.
 */
export const KATANA_STAGE = {
  minZ: -24,
  maxZ: 24,
  frontX: -38,
  backX: -78,
  tiers: [
    { minX: -50, maxX: -38, top: 0.8, padX: -44 },
    { minX: -62, maxX: -50, top: 4.8, padX: -56 },
    { minX: -78, maxX: -62, top: 8.8, padX: -70 },
  ],
  /** z of the pads on each storey: +Z first, so seen from the spawn the ladder reads left to right. */
  padZ: [
    [16, 8, 0, -8, -16],
    [16, 8, 0, -8, -16],
    [12, 4, -4, -12],
  ],
  /** Two stair lanes, one at each end of the stage. */
  stairLanes: [
    [19.5, 24],
    [-24, -19.5],
  ],
  padHalf: 2.6,
} as const;

export interface KatanaPad {
  readonly slot: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly half: number;
}

export const KATANA_PADS: readonly KatanaPad[] = (() => {
  const pads: KatanaPad[] = [];
  let slot = 1;
  KATANA_STAGE.tiers.forEach((tier, index) => {
    for (const z of KATANA_STAGE.padZ[index] ?? []) {
      if (slot > KATANA_COUNT) break;
      pads.push({ slot, x: tier.padX, y: tier.top, z, half: KATANA_STAGE.padHalf });
      slot += 1;
    }
  });
  return pads;
})();

/** A stair: `steps` treads climbing from `fromY` to `toY` along -X. */
export interface Stair {
  readonly x0: number;
  readonly x1: number;
  readonly minZ: number;
  readonly maxZ: number;
  readonly fromY: number;
  readonly toY: number;
  readonly steps: number;
}

export const KATANA_STAIRS: readonly Stair[] = KATANA_STAGE.stairLanes.flatMap(([minZ, maxZ]) => [
  { x0: -44, x1: -50, minZ, maxZ, fromY: 0.8, toY: 4.8, steps: 4 },
  { x0: -56, x1: -62, minZ, maxZ, fromY: 4.8, toY: 8.8, steps: 4 },
]);

/** The boxes of one stair's treads, each resting on the storey below. */
export const stairBoxes = (stair: Stair): Aabb[] => {
  const boxes: Aabb[] = [];
  const run = (stair.x0 - stair.x1) / stair.steps;
  const rise = (stair.toY - stair.fromY) / (stair.steps + 1);
  for (let i = 1; i <= stair.steps; i += 1) {
    const maxX = stair.x0 - run * (i - 1);
    boxes.push({ minX: maxX - run, maxX, minY: stair.fromY, maxY: stair.fromY + rise * i, minZ: stair.minZ, maxZ: stair.maxZ });
  }
  return boxes;
};

// ---------------------------------------------------------------- Training

/**
 * THE TRAINING AREA, directly LEFT of the spawn: three small, crammed pocket
 * zones side by side, each open toward the spawn (-X). Seen from the spawn,
 * Cultist is on the left, Dojo in the middle, Basic on the right.
 *
 * Each pocket is a U of raised dressing beds (back and both sides) packed
 * with its own scenery, around a little floor with its two dummies. Low
 * walls part the pockets; a stepped hill closes them in behind.
 */
export const TRAINING = {
  frontX: 20,
  backX: 34,
  floorTop: 0.3,
  dummyX: 27,
  zones: [
    { id: 'basic' as TrainingZoneId, minZ: 12, maxZ: 28 },
    { id: 'dojo' as TrainingZoneId, minZ: -4, maxZ: 12 },
    { id: 'cultist' as TrainingZoneId, minZ: -20, maxZ: -4 },
  ],
  dividerThickness: 1.6,
  /** The low walls between the pockets. */
  wallHeight: 3.4,
  /** The dressing beds: raised, too high to walk up, just right to jump onto. */
  bedTop: 1.5,
  backBedDepth: 3.5,
  sideBedWidth: 2,
  /** Side beds start this far in from the open front. */
  sideBedFrom: 24.5,
  /** The stepped hill behind: a near step and a far one. */
  hill: [
    { minX: 34, maxX: 44, top: 9 },
    { minX: 44, maxX: 64, top: 16 },
  ],
} as const;

export interface DummyPlacement {
  readonly tier: number;
  readonly x: number;
  readonly z: number;
}

export const DUMMIES: readonly DummyPlacement[] = TRAINING_TIERS.map((tier) => {
  const zone = TRAINING.zones.find((entry) => entry.id === tier.zone)!;
  const centre = (zone.minZ + zone.maxZ) / 2;
  const first = TRAINING_TIERS.find((entry) => entry.zone === tier.zone)!.tier === tier.tier;
  return { tier: tier.tier, x: TRAINING.dummyX, z: centre + (first ? 3.4 : -3.4) };
});

/** Half-width of a dummy's solid post. */
export const DUMMY_HALF = 0.8;

// --------------------------------------------------------- Forge, Pets Shop

/**
 * THE FORGE: back-left of the spawn, against the back cliff, open toward the
 * plaza (+Z) with the whole lawn between it and the training pockets free to
 * walk up to its counter.
 */
export const FORGE = {
  minX: 27,
  maxX: 59,
  minZ: -72,
  maxZ: -52,
  counter: { minX: 31, maxX: 55, minZ: -58, maxZ: -56.4, top: 1.3 },
  anvil: { x: 43, z: -62 },
  smith: { x: 43, z: -65.5 },
  /** Standing here opens the shop. */
  trigger: { minX: 31, maxX: 55, minZ: -56.4, maxZ: -48 },
  /** A purchase is accepted from anywhere in here (server check, with slack). */
  serviceArea: { minX: 27, maxX: 59, minZ: -60, maxZ: -42 },
} as const;

export const PETS_SHOP = {
  eggZ: -64,
  padZ: -55,
  padHalf: 3,
  pedestalHalf: 3.2,
  pedestalTop: 1.4,
  /** A hatch is accepted within this distance of the egg's pad centre. */
  serviceRadius: 9,
  /** The great frame behind the eggs: its two pillars stand at these x, at this z. */
  frameXs: [-75, -25],
  frameZ: -69,
} as const;

export interface EggPlacement {
  readonly egg: number;
  readonly x: number;
}

export const EGG_PLACEMENTS: readonly EggPlacement[] = EGGS.map((egg, index) => ({ egg: egg.id, x: -32 - index * 12 }));

// --------------------------------------------------------------- Boards

/** The three scoreboards hang in the exact middle of the back cliff, straight behind the spawn. */
export const BOARDS = {
  z: -71.8,
  centreY: 12.5,
  width: 12,
  height: 16,
  /** Fifteen apart, centred on x = 0: a clear gap between frames, so each board reads alone. */
  xs: [-15, 0, 15],
} as const;

// ----------------------------------------------------------------- Stages

/** The stage road: arenas one after another along +Z, each behind a portal. */
export const ARENA = {
  halfWidth: 44,
  length: 96,
  /** A gate wall between two arenas. */
  gateDepth: 8,
  firstStartZ: 44,
  portalHalfWidth: 9,
  portalHeight: 14,
  wallHeight: 22,
} as const;

export const arenaStartZ = (stage: number): number => ARENA.firstStartZ + (stage - 1) * (ARENA.length + ARENA.gateDepth);
export const arenaEndZ = (stage: number): number => arenaStartZ(stage) + ARENA.length;
/** Centre z of the gate wall LEAVING a stage (into stage + 1). */
export const gateZ = (stage: number): number => arenaEndZ(stage) + ARENA.gateDepth / 2;

/** The reward pad of a stage: beside its forward gate. */
export const rewardPadOf = (stage: number): { x: number; z: number; half: number } => ({
  x: 22,
  z: arenaEndZ(stage) - 10,
  half: 4,
});

/**
 * THE WIN SHRINE around each reward pad: a low stone dais (one easy step up)
 * with a small torii behind it and a stone lantern at each front corner.
 * Offsets are from the pad's centre; the claim area is the pad itself.
 */
export const REWARD_SHRINE = {
  daisHalf: 4.6,
  daisTop: 0.45,
  toriiZ: 5.6,
  pillarX: 3.9,
  pillarHalf: 0.45,
  lanternX: 5.6,
  lanternZ: -3.6,
  lanternHalf: 0.6,
} as const;

// ---------------------------------------------------------------- Solids

/**
 * Every STATIC solid in the world, as boxes. Stage gates are separate
 * (`gateBoxes`) because whether they are solid depends on the player.
 */
export const buildStaticSolids = (stageCount: number): Aabb[] => {
  const boxes: Aabb[] = [];
  const box = (minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number): void => {
    boxes.push({ minX, maxX, minY, maxY, minZ, maxZ });
  };

  // The hub's cliffs: back, both sides, and the front wall with the portal gap.
  box(HUB.minX - 30, HUB.maxX + 30, -2, 40, HUB.minZ - 30, HUB.minZ);
  box(HUB.minX - 30, HUB.minX, -2, 40, HUB.minZ, HUB.maxZ + 4);
  box(HUB.maxX, HUB.maxX + 30, -2, 40, HUB.minZ, HUB.maxZ + 4);
  box(HUB.minX, HUB_GATE.minX, -2, 30, HUB.maxZ, HUB.maxZ + 4);
  box(HUB_GATE.maxX, HUB.maxX, -2, 30, HUB.maxZ, HUB.maxZ + 4);
  // Lintel over the Stage 1 portal.
  box(HUB_GATE.minX, HUB_GATE.maxX, ARENA.portalHeight, 30, HUB.maxZ, HUB.maxZ + 4);

  // Katana Stage: three storeys, the stairs, the back wall and end railings.
  for (const tier of KATANA_STAGE.tiers) box(tier.minX, tier.maxX, -1, tier.top, KATANA_STAGE.minZ, KATANA_STAGE.maxZ);
  for (const stair of KATANA_STAIRS) boxes.push(...stairBoxes(stair));
  box(KATANA_STAGE.backX - 3, KATANA_STAGE.backX, -1, 24, KATANA_STAGE.minZ - 3, KATANA_STAGE.maxZ + 3);
  for (const tier of KATANA_STAGE.tiers) {
    box(tier.minX, tier.maxX, tier.top, tier.top + 1.4, KATANA_STAGE.maxZ, KATANA_STAGE.maxZ + 1);
    box(tier.minX, tier.maxX, tier.top, tier.top + 1.4, KATANA_STAGE.minZ - 1, KATANA_STAGE.minZ);
  }

  // Training: the floor, the hill behind, the low walls and each pocket's dressing beds.
  const outerMin = TRAINING.zones[2]!.minZ;
  const outerMax = TRAINING.zones[0]!.maxZ;
  const half = TRAINING.dividerThickness / 2;
  box(TRAINING.frontX, TRAINING.backX, -1, TRAINING.floorTop, outerMin - half, outerMax + half);
  for (const step of TRAINING.hill) box(step.minX, step.maxX, -1, step.top, outerMin - half, outerMax + half);
  for (const z of [outerMin, TRAINING.zones[1]!.minZ, TRAINING.zones[1]!.maxZ, outerMax]) {
    box(TRAINING.frontX, TRAINING.backX, -1, TRAINING.wallHeight, z - half, z + half);
  }
  for (const zone of TRAINING.zones) {
    const bedBack = TRAINING.backX - TRAINING.backBedDepth;
    box(bedBack, TRAINING.backX, -1, TRAINING.bedTop, zone.minZ + half, zone.maxZ - half);
    box(TRAINING.sideBedFrom, bedBack, -1, TRAINING.bedTop, zone.minZ + half, zone.minZ + half + TRAINING.sideBedWidth);
    box(TRAINING.sideBedFrom, bedBack, -1, TRAINING.bedTop, zone.maxZ - half - TRAINING.sideBedWidth, zone.maxZ - half);
  }
  for (const dummy of DUMMIES) {
    box(dummy.x - DUMMY_HALF, dummy.x + DUMMY_HALF, 0, 4.2, dummy.z - DUMMY_HALF, dummy.z + DUMMY_HALF);
  }

  // Forge: the counter, the anvil block, and the four roof posts.
  const c = FORGE.counter;
  box(c.minX, c.maxX, 0, c.top, c.minZ, c.maxZ);
  box(FORGE.anvil.x - 1.6, FORGE.anvil.x + 1.6, 0, 2.2, FORGE.anvil.z - 1, FORGE.anvil.z + 1);
  for (const [x, z] of [[FORGE.minX + 0.8, FORGE.maxZ - 0.8], [FORGE.maxX - 0.8, FORGE.maxZ - 0.8], [FORGE.minX + 0.8, FORGE.minZ + 2], [FORGE.maxX - 0.8, FORGE.minZ + 2]] as const) {
    box(x - 0.7, x + 0.7, 0, 12, z - 0.7, z + 0.7);
  }

  // Pets Shop: the egg pedestals.
  for (const placement of EGG_PLACEMENTS) {
    const h = PETS_SHOP.pedestalHalf;
    box(placement.x - h, placement.x + h, 0, PETS_SHOP.pedestalTop, PETS_SHOP.eggZ - h, PETS_SHOP.eggZ + h);
  }

  for (const x of PETS_SHOP.frameXs) box(x - 0.9, x + 0.9, 0, 16, PETS_SHOP.frameZ - 0.9, PETS_SHOP.frameZ + 0.9);

  // The stage road: cliffs down both sides, the gate walls, the end wall.
  const roadStart = HUB.maxZ;
  const roadEnd = arenaEndZ(stageCount) + 14;
  box(ARENA.halfWidth, ARENA.halfWidth + 30, -2, 40, roadStart, roadEnd);
  box(-ARENA.halfWidth - 30, -ARENA.halfWidth, -2, 40, roadStart, roadEnd);
  for (let stage = 1; stage < stageCount; stage += 1) {
    const z0 = arenaEndZ(stage);
    const z1 = z0 + ARENA.gateDepth;
    box(-ARENA.halfWidth, -ARENA.portalHalfWidth, -2, ARENA.wallHeight, z0, z1);
    box(ARENA.portalHalfWidth, ARENA.halfWidth, -2, ARENA.wallHeight, z0, z1);
    box(-ARENA.portalHalfWidth, ARENA.portalHalfWidth, ARENA.portalHeight, ARENA.wallHeight, z0, z1);
  }
  box(-ARENA.halfWidth, ARENA.halfWidth, -2, 40, arenaEndZ(stageCount), roadEnd);

  // Each stage's win shrine: the dais, the torii's pillars, the two lanterns.
  const r = REWARD_SHRINE;
  for (let stage = 1; stage <= stageCount; stage += 1) {
    const pad = rewardPadOf(stage);
    box(pad.x - r.daisHalf, pad.x + r.daisHalf, -1, r.daisTop, pad.z - r.daisHalf, pad.z + r.daisHalf);
    for (const side of [-1, 1]) {
      const px = pad.x + side * r.pillarX;
      box(px - r.pillarHalf, px + r.pillarHalf, 0, 9, pad.z + r.toriiZ - r.pillarHalf, pad.z + r.toriiZ + r.pillarHalf);
      const lx = pad.x + side * r.lanternX;
      const lz = pad.z + r.lanternZ;
      box(lx - r.lanternHalf, lx + r.lanternHalf, 0, 3, lz - r.lanternHalf, lz + r.lanternHalf);
    }
  }

  return boxes;
};

/** The locked portal between stage `stage` and `stage + 1`: solid until the stage is cleared once. */
export const gateBox = (stage: number): Aabb => {
  const z = gateZ(stage);
  return {
    minX: -ARENA.portalHalfWidth,
    maxX: ARENA.portalHalfWidth,
    minY: -2,
    maxY: ARENA.portalHeight,
    minZ: z - 1,
    maxZ: z + 1,
  };
};

/** The whole walkable world, for a hard clamp that no displacement can tunnel. */
export const worldBounds = (stageCount: number): Aabb => ({
  minX: HUB.minX,
  maxX: HUB.maxX,
  minY: -5,
  maxY: 200,
  minZ: HUB.minZ,
  maxZ: arenaEndZ(stageCount),
});

// -------------------------------------------------------------- Teleports

export type TeleportId = 'spawn' | 'katanas' | 'training' | 'forge' | 'eggs' | `stage${number}`;

export const TELEPORTS: Readonly<Record<'spawn' | 'katanas' | 'training' | 'forge' | 'eggs', Placement>> = {
  spawn: SPAWN,
  katanas: { x: -33, y: 0, z: 0, yaw: -Math.PI / 2 },
  training: { x: 12, y: 0, z: 0, yaw: Math.PI / 2 },
  forge: { x: 43, y: 0, z: -40, yaw: Math.PI },
  eggs: { x: -50, y: 0, z: -44, yaw: Math.PI },
};

export const stageEntry = (stage: number): Placement => ({ x: 0, y: 0, z: arenaStartZ(stage) + 5, yaw: 0 });

/** Which stage arena a point is in, or 0 for the village / a gate. */
export const stageAt = (z: number, stageCount: number): number => {
  for (let stage = 1; stage <= stageCount; stage += 1) {
    if (z >= arenaStartZ(stage) && z < arenaEndZ(stage)) return stage;
  }
  return 0;
};

export const inRect = (
  x: number,
  z: number,
  rect: { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number },
): boolean => x >= rect.minX && x <= rect.maxX && z >= rect.minZ && z <= rect.maxZ;
