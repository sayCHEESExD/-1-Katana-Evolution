import { ConeGeometry, CylinderGeometry, SphereGeometry, TorusGeometry } from 'three';
import { PALETTE } from '../config/worldVisuals.js';
import type { PartBuilder } from '../render/PartBuilder.js';

/**
 * THE PROP LIBRARY: every piece of Japanese scenery, as calls that add
 * primitives to a batch. Toy-block proportions - stacked studded boxes for
 * pines, chunky cube clusters for sakura, fat vermilion pillars for a torii -
 * so the world reads as a Roblox place with a strong Japanese identity.
 *
 * Every function takes a world position and a yaw and never allocates a mesh.
 */

/** Rotate a local (lx, lz) offset by yaw and add the origin. */
const place = (x: number, z: number, yaw: number, lx: number, lz: number): [number, number] => {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [x + lx * c + lz * s, z - lx * s + lz * c];
};

/** A TORII: two vermilion pillars, a black-capped curved lintel, a tie beam and a name plaque. */
export const torii = (b: PartBuilder, x: number, y: number, z: number, width: number, height: number, yaw = 0): void => {
  const pillar = Math.max(0.7, width * 0.07);
  for (const side of [-1, 1]) {
    const [px, pz] = place(x, z, yaw, side * width * 0.42, 0);
    b.add(new CylinderGeometry(pillar * 0.5, pillar * 0.56, height, 12), PALETTE.vermilion, 'smooth', { x: px, y: y + height / 2, z: pz });
    b.add(new CylinderGeometry(pillar * 0.66, pillar * 0.7, height * 0.08, 12), 0x1f1f24, 'smooth', { x: px, y: y + height * 0.04, z: pz });
  }
  // Nuki: the tie beam.
  b.box(width * 1.0, height * 0.07, pillar * 0.6, PALETTE.vermilion, 'smooth', { x, y: y + height * 0.72, z, ry: yaw });
  // Kasagi: the lintel, its ends swept up, capped in black.
  b.box(width * 1.12, height * 0.08, pillar * 0.9, PALETTE.vermilion, 'smooth', { x, y: y + height * 0.9, z, ry: yaw });
  b.box(width * 1.22, height * 0.06, pillar * 1.05, 0x22252e, 'smooth', { x, y: y + height * 0.97, z, ry: yaw });
  for (const side of [-1, 1]) {
    const [ex, ez] = place(x, z, yaw, side * width * 0.6, 0);
    b.box(width * 0.14, height * 0.06, pillar * 1.05, 0x22252e, 'smooth', { x: ex, y: y + height * 1.0, z: ez, ry: yaw, rz: side * 0.18 });
  }
  // Gakuzuka and its plaque.
  b.box(pillar * 0.5, height * 0.18, pillar * 0.5, PALETTE.vermilion, 'smooth', { x, y: y + height * 0.81, z, ry: yaw });
  b.box(width * 0.16, height * 0.12, pillar * 0.7, 0x1f1f24, 'smooth', { x, y: y + height * 0.81, z, ry: yaw });
};

/** A STONE LANTERN (toro): plinth, post, a lit fire box, a stone hat. */
export const stoneLantern = (b: PartBuilder, x: number, y: number, z: number, s = 1): void => {
  b.box(1.4 * s, 0.5 * s, 1.4 * s, PALETTE.stoneDark, 'stud', { x, y: y + 0.25 * s, z });
  b.add(new CylinderGeometry(0.28 * s, 0.34 * s, 1.6 * s, 8), PALETTE.stone, 'smooth', { x, y: y + 1.3 * s, z });
  b.box(1.1 * s, 0.25 * s, 1.1 * s, PALETTE.stone, 'smooth', { x, y: y + 2.2 * s, z });
  b.box(0.8 * s, 0.75 * s, 0.8 * s, PALETTE.lanternGlow, 'glow', { x, y: y + 2.7 * s, z });
  b.box(0.95 * s, 0.1 * s, 0.95 * s, PALETTE.stoneDark, 'smooth', { x, y: y + 3.1 * s, z });
  b.add(new ConeGeometry(1.05 * s, 0.75 * s, 4), PALETTE.stone, 'smooth', { x, y: y + 3.5 * s, z, ry: Math.PI / 4 });
  b.add(new SphereGeometry(0.18 * s, 8, 6), PALETTE.stoneDark, 'smooth', { x, y: y + 3.95 * s, z });
};

/** A red paper lantern (chochin), lit. */
export const paperLantern = (b: PartBuilder, x: number, y: number, z: number, s = 1, color = 0xff5a3c): void => {
  b.add(new CylinderGeometry(0.4 * s, 0.4 * s, 0.9 * s, 12), color, 'glow', { x, y, z });
  b.add(new CylinderGeometry(0.28 * s, 0.28 * s, 0.1 * s, 10), 0x22252e, 'smooth', { x, y: y + 0.5 * s, z });
  b.add(new CylinderGeometry(0.28 * s, 0.28 * s, 0.1 * s, 10), 0x22252e, 'smooth', { x, y: y - 0.5 * s, z });
};

/** A tall lamp post with a lit lantern, like the plaza lights in the reference. */
export const lampPost = (b: PartBuilder, x: number, y: number, z: number, s = 1): void => {
  b.add(new CylinderGeometry(0.16 * s, 0.2 * s, 5.2 * s, 8), 0x3a2a1c, 'smooth', { x, y: y + 2.6 * s, z });
  b.box(1.1 * s, 1.1 * s, 1.1 * s, PALETTE.lanternGlow, 'glow', { x, y: y + 5.6 * s, z });
  b.add(new ConeGeometry(0.95 * s, 0.6 * s, 4), 0x2b2f3d, 'smooth', { x, y: y + 6.45 * s, z, ry: Math.PI / 4 });
};

/** A BLOCKY PINE: a trunk and three stacked, shrinking, studded green tiers. */
export const pineTree = (b: PartBuilder, x: number, y: number, z: number, s = 1): void => {
  b.box(1.1 * s, 2.4 * s, 1.1 * s, PALETTE.trunk, 'stud', { x, y: y + 1.2 * s, z });
  const tiers = [
    [5.6, 2.2, 3.0],
    [4.2, 2.0, 5.0],
    [2.8, 1.8, 6.8],
    [1.4, 1.2, 8.2],
  ] as const;
  tiers.forEach(([w, h, at], i) => {
    b.box(w * s, h * s, w * s, i % 2 ? PALETTE.pineDark : PALETTE.pine, 'stud', { x, y: y + at * s, z });
  });
};

/** A SAKURA: a dark trunk that forks, crowned in chunky pink cube clusters. */
export const sakuraTree = (b: PartBuilder, x: number, y: number, z: number, s = 1, seed = 1): void => {
  b.box(0.9 * s, 4 * s, 0.9 * s, 0x5e3b20, 'stud', { x, y: y + 2 * s, z });
  b.box(0.5 * s, 2.4 * s, 0.5 * s, 0x5e3b20, 'smooth', { x: x + 0.8 * s, y: y + 4.3 * s, z, rz: -0.6 });
  b.box(0.5 * s, 2.4 * s, 0.5 * s, 0x5e3b20, 'smooth', { x: x - 0.8 * s, y: y + 4.1 * s, z: z + 0.3 * s, rz: 0.6 });
  const clusters = [
    [0, 6.2, 0, 3.4],
    [1.9, 5.4, 0.6, 2.6],
    [-1.8, 5.3, -0.4, 2.7],
    [0.4, 5.6, -1.7, 2.4],
    [-0.5, 5.8, 1.8, 2.3],
  ] as const;
  clusters.forEach(([cx, cy, cz, size], i) => {
    const color = (i + seed) % 3 === 0 ? PALETTE.sakuraDark : PALETTE.sakura;
    b.box(size * s, size * 0.8 * s, size * s, color, 'stud', { x: x + cx * s, y: y + cy * s, z: z + cz * s, ry: (i + seed) * 0.4 });
  });
};

/** A BAMBOO CLUMP: tall jointed green stalks with a few leaf sprays. */
export const bambooClump = (b: PartBuilder, x: number, y: number, z: number, count = 5, height = 9, seed = 1): void => {
  let r = seed * 9301 + 49297;
  const rand = (): number => {
    r = (r * 9301 + 49297) % 233280;
    return r / 233280;
  };
  for (let i = 0; i < count; i += 1) {
    const ox = (rand() - 0.5) * 2.4;
    const oz = (rand() - 0.5) * 2.4;
    const h = height * (0.75 + rand() * 0.45);
    const lean = (rand() - 0.5) * 0.12;
    b.add(new CylinderGeometry(0.16, 0.2, h, 7), i % 2 ? PALETTE.bamboo : PALETTE.bambooDark, 'smooth', { x: x + ox, y: y + h / 2, z: z + oz, rz: lean });
    for (let k = 1; k < h / 1.6; k += 1) {
      b.add(new CylinderGeometry(0.22, 0.22, 0.12, 7), PALETTE.bambooDark, 'smooth', { x: x + ox - lean * k * 1.6, y: y + k * 1.6, z: z + oz });
    }
    b.add(new ConeGeometry(0.5, 1.6, 4), PALETTE.bamboo, 'smooth', { x: x + ox + 0.4 - lean * h, y: y + h - 0.6, z: z + oz, rz: -1.1 });
  }
};

/** A ROCK: a few grey studded blocks. */
export const rock = (b: PartBuilder, x: number, y: number, z: number, s = 1, yaw = 0): void => {
  b.box(2.4 * s, 1.4 * s, 2 * s, PALETTE.stoneDark, 'stud', { x, y: y + 0.7 * s, z, ry: yaw });
  b.box(1.6 * s, 1.1 * s, 1.5 * s, PALETTE.stone, 'stud', { x: x + 0.6 * s, y: y + 1.6 * s, z: z + 0.2 * s, ry: yaw + 0.4 });
};

/** A WOODEN FENCE from (x0, z0) to (x1, z1). */
export const fence = (b: PartBuilder, x0: number, z0: number, x1: number, z1: number, y = 0, color: number = PALETTE.wood): void => {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const length = Math.hypot(dx, dz);
  const yaw = Math.atan2(dx, dz);
  const posts = Math.max(2, Math.round(length / 3) + 1);
  for (let i = 0; i < posts; i += 1) {
    const t = i / (posts - 1);
    b.box(0.35, 1.8, 0.35, color, 'smooth', { x: x0 + dx * t, y: y + 0.9, z: z0 + dz * t });
  }
  for (const h of [0.8, 1.5]) b.box(0.18, 0.2, length, color, 'smooth', { x: (x0 + x1) / 2, y: y + h, z: (z0 + z1) / 2, ry: yaw });
};

/**
 * A MACHIYA: white plaster walls on a timber frame, paper windows, a dark
 * tiled roof with deep eaves.
 */
export const house = (b: PartBuilder, x: number, y: number, z: number, w: number, d: number, h: number, yaw = 0, roof: number = PALETTE.roof): void => {
  b.box(w, h, d, PALETTE.plaster, 'smooth', { x, y: y + h / 2, z, ry: yaw });
  // Timber corner posts and a sill beam.
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const [px, pz] = place(x, z, yaw, sx * w / 2, sz * d / 2);
    b.box(0.5, h, 0.5, PALETTE.woodDark, 'smooth', { x: px, y: y + h / 2, z: pz, ry: yaw });
  }
  b.box(w + 0.2, 0.4, d + 0.2, PALETTE.woodDark, 'smooth', { x, y: y + h * 0.55, z, ry: yaw });
  // Paper windows on the front.
  const [fx, fz] = place(x, z, yaw, 0, d / 2 + 0.05);
  b.box(w * 0.6, h * 0.3, 0.1, PALETTE.paper, 'glow', { x: fx, y: y + h * 0.75, z: fz, ry: yaw });
  b.box(w * 0.3, h * 0.45, 0.12, PALETTE.woodDark, 'smooth', { x: fx, y: y + h * 0.23, z: fz, ry: yaw });
  // The gabled roof, two slabs.
  const slope = 0.55;
  const half = (d / 2 + 1.2) / Math.cos(slope);
  for (const side of [-1, 1]) {
    const [rx, rz] = place(x, z, yaw, 0, side * (d / 4 + 0.3));
    b.box(w + 2.4, 0.5, half, roof, 'stud', { x: rx, y: y + h + Math.tan(slope) * (d / 4) + 0.2, z: rz, ry: yaw, rx: side * slope });
  }
  b.box(w + 2.6, 0.5, 0.8, PALETTE.roofEdge, 'smooth', { x, y: y + h + Math.tan(slope) * (d / 2) + 0.35, z, ry: yaw });
};

/** A PAGODA: three storeys, each with a flared roof, a spire on top. */
export const pagoda = (b: PartBuilder, x: number, y: number, z: number, s = 1): void => {
  b.box(14 * s, 1.2 * s, 14 * s, PALETTE.stone, 'stud', { x, y: y + 0.6 * s, z });
  let at = y + 1.2 * s;
  const levels = [
    [9, 5.5, 14],
    [7.4, 4.5, 11.5],
    [6, 4, 9.5],
  ] as const;
  for (const [w, h, roof] of levels) {
    b.box(w * s, h * s, w * s, PALETTE.vermilion, 'smooth', { x, y: at + (h * s) / 2, z });
    b.box(w * 0.7 * s, h * 0.5 * s, w * 1.01 * s, PALETTE.plaster, 'smooth', { x, y: at + h * 0.55 * s, z });
    at += h * s;
    b.box(roof * s, 0.6 * s, roof * s, PALETTE.roof, 'stud', { x, y: at + 0.3 * s, z });
    b.add(new ConeGeometry(roof * 0.72 * s, 1.6 * s, 4), PALETTE.roof, 'smooth', { x, y: at + 1.3 * s, z, ry: Math.PI / 4 });
    for (const [cx, cz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
      b.box(0.9 * s, 0.4 * s, 0.9 * s, PALETTE.gold, 'smooth', { x: x + cx * roof * 0.48 * s, y: at + 0.7 * s, z: z + cz * roof * 0.48 * s });
    }
    at += 1.4 * s;
  }
  b.add(new CylinderGeometry(0.2 * s, 0.3 * s, 6 * s, 8), PALETTE.gold, 'smooth', { x, y: at + 3 * s, z });
  for (let i = 0; i < 5; i += 1) b.add(new TorusGeometry(0.55 * s, 0.1 * s, 5, 12), PALETTE.gold, 'smooth', { x, y: at + (1 + i * 0.9) * s, z, rx: Math.PI / 2 });
};

/** A flag pole with the rising-sun disc. */
export const sunFlag = (b: PartBuilder, x: number, y: number, z: number, yaw = 0): void => {
  b.add(new CylinderGeometry(0.1, 0.12, 6, 6), 0xdddddd, 'smooth', { x, y: y + 3, z });
  const [fx, fz] = place(x, z, yaw, 1.3, 0);
  b.box(2.4, 1.6, 0.05, 0xffffff, 'smooth', { x: fx, y: y + 5.1, z: fz, ry: yaw });
  const [dx, dz] = place(x, z, yaw, 1.3, 0.04);
  b.add(new CylinderGeometry(0.45, 0.45, 0.06, 16), 0xe0342b, 'smooth', { x: dx, y: y + 5.1, z: dz, rx: Math.PI / 2, ry: yaw });
};

/** A tall nobori banner on a pole. */
export const nobori = (b: PartBuilder, x: number, y: number, z: number, color: number, yaw = 0): void => {
  b.add(new CylinderGeometry(0.08, 0.1, 7, 6), 0x3a2a1c, 'smooth', { x, y: y + 3.5, z });
  const [fx, fz] = place(x, z, yaw, 0.55, 0);
  b.box(1.0, 4.6, 0.05, color, 'smooth', { x: fx, y: y + 4.2, z: fz, ry: yaw });
  b.box(1.2, 0.1, 0.1, 0x3a2a1c, 'smooth', { x: fx, y: y + 6.6, z: fz, ry: yaw });
};

/** A wooden barrel (taru). */
export const barrel = (b: PartBuilder, x: number, y: number, z: number, s = 1): void => {
  b.add(new CylinderGeometry(0.7 * s, 0.7 * s, 1.4 * s, 10), 0xa87a4a, 'smooth', { x, y: y + 0.7 * s, z });
  for (const h of [0.25, 1.15]) b.add(new CylinderGeometry(0.73 * s, 0.73 * s, 0.12 * s, 10), 0x3a2a1c, 'smooth', { x, y: y + h * s, z });
};

/** A wooden crate. */
export const crate = (b: PartBuilder, x: number, y: number, z: number, s = 1, yaw = 0): void => {
  b.box(1.6 * s, 1.6 * s, 1.6 * s, 0xb8864f, 'stud', { x, y: y + 0.8 * s, z, ry: yaw });
};

/** A KOI POND: a stone rim around still blue water, a few koi. */
export const koiPond = (b: PartBuilder, x: number, y: number, z: number, w: number, d: number): void => {
  b.box(w, 0.16, d, PALETTE.water, 'smooth', { x, y: y + 0.08, z });
  for (const side of [-1, 1]) {
    b.box(w + 1.2, 0.6, 0.6, PALETTE.stoneDark, 'stud', { x, y: y + 0.3, z: z + side * (d / 2 + 0.3) });
    b.box(0.6, 0.6, d, PALETTE.stoneDark, 'stud', { x: x + side * (w / 2 + 0.3), y: y + 0.3, z });
  }
  for (const [kx, kz, c] of [[-0.25, 0.1, 0xff8a1c], [0.2, -0.2, 0xffffff], [0.05, 0.3, 0xff5a3c]] as const) {
    b.add(new SphereGeometry(0.35, 8, 6), c, 'smooth', { x: x + kx * w, y: y + 0.18, z: z + kz * d, sz: 2, sy: 0.4 });
  }
};

/** An arched vermilion bridge along +X. */
export const archBridge = (b: PartBuilder, x: number, y: number, z: number, length: number, width: number): void => {
  const segments = 7;
  for (let i = 0; i < segments; i += 1) {
    const t = (i + 0.5) / segments - 0.5;
    const rise = Math.cos(t * Math.PI) * 1.4;
    b.box(length / segments + 0.05, 0.3, width, PALETTE.wood, 'stud', { x: x + t * length, y: y + rise, z, rz: -Math.sin(t * Math.PI) * 0.35 });
    for (const side of [-1, 1]) b.box(0.25, 1.1, 0.25, PALETTE.vermilion, 'smooth', { x: x + t * length, y: y + rise + 0.6, z: z + side * width * 0.46 });
  }
  for (const side of [-1, 1]) b.box(length, 0.18, 0.2, PALETTE.vermilion, 'smooth', { x, y: y + 2.1, z: z + side * width * 0.46 });
};

/** A low wooden bench. */
export const bench = (b: PartBuilder, x: number, y: number, z: number, yaw = 0): void => {
  b.box(3, 0.25, 1, PALETTE.wood, 'smooth', { x, y: y + 0.8, z, ry: yaw });
  for (const side of [-1, 1]) {
    const [lx, lz] = place(x, z, yaw, side * 1.2, 0);
    b.box(0.25, 0.8, 0.8, PALETTE.woodDark, 'smooth', { x: lx, y: y + 0.4, z: lz, ry: yaw });
  }
};

/** A weapon rack with a few spears and a naginata. */
export const weaponRack = (b: PartBuilder, x: number, y: number, z: number, yaw = 0): void => {
  b.box(3.4, 0.25, 0.5, PALETTE.woodDark, 'smooth', { x, y: y + 0.6, z, ry: yaw });
  b.box(3.4, 0.25, 0.5, PALETTE.woodDark, 'smooth', { x, y: y + 2.6, z, ry: yaw });
  for (const side of [-1, 1]) {
    const [px, pz] = place(x, z, yaw, side * 1.6, 0);
    b.box(0.25, 3.2, 0.4, PALETTE.woodDark, 'smooth', { x: px, y: y + 1.6, z: pz, ry: yaw });
  }
  for (let i = 0; i < 4; i += 1) {
    const [sx, sz] = place(x, z, yaw, -1.1 + i * 0.75, 0.25);
    b.add(new CylinderGeometry(0.05, 0.05, 3.6, 5), 0x6b4a2a, 'smooth', { x: sx, y: y + 1.9, z: sz });
    b.add(new ConeGeometry(0.1, 0.5, 5), 0xdfe6ee, 'smooth', { x: sx, y: y + 3.95, z: sz });
  }
};

/** A cushion-topped red mat, like the reference's floor mats. */
export const mat = (b: PartBuilder, x: number, y: number, z: number, w: number, d: number, color = 0xc0392b): void => {
  b.box(w, 0.12, d, color, 'stud', { x, y: y + 0.06, z });
};

/** A picnic cloth: red and white checks. */
export const picnic = (b: PartBuilder, x: number, y: number, z: number): void => {
  for (let i = 0; i < 4; i += 1) {
    for (let k = 0; k < 4; k += 1) b.box(1, 0.06, 1, (i + k) % 2 ? 0xffffff : 0xe0342b, 'smooth', { x: x + (i - 1.5), y: y + 0.03, z: z + (k - 1.5) });
  }
};

/** A little stone Jizo statue with a red bib. */
export const jizo = (b: PartBuilder, x: number, y: number, z: number): void => {
  b.box(1, 0.4, 1, PALETTE.stoneDark, 'smooth', { x, y: y + 0.2, z });
  b.add(new CylinderGeometry(0.35, 0.42, 1.1, 8), PALETTE.stone, 'smooth', { x, y: y + 0.95, z });
  b.add(new SphereGeometry(0.32, 8, 6), PALETTE.stone, 'smooth', { x, y: y + 1.75, z });
  b.add(new ConeGeometry(0.46, 0.5, 8), 0xe0342b, 'smooth', { x, y: y + 1.3, z: z + 0.05, rx: Math.PI });
};

/** A box standing on `y` (its base, not its centre). */
export const block = (b: PartBuilder, x: number, y: number, z: number, w: number, h: number, d: number, color: number | string, kind: 'stud' | 'smooth' | 'glow' = 'stud', yaw = 0): void => {
  b.box(w, h, d, color, kind, { x, y: y + h / 2, z, ry: yaw });
};
