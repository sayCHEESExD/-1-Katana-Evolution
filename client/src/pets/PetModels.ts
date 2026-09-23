import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
} from 'three';
import { petById, type PetKind } from '@katana/shared';
import { PartBuilder, meshesFor, type PartKind } from '../render/PartBuilder.js';

/**
 * THE YOKAI, drawn in code: sixteen spirits of Japanese folklore, each a few
 * dozen primitives merged into at most three meshes and cached per species.
 * Faces are carved from the silhouettes - one great eye on the lantern and
 * the umbrella, a beak on the tengu, horns on the mask - so each reads at a
 * glance from behind a running player. About a unit and a half tall.
 */

const sphere = (r: number, w = 10, h = 8): BufferGeometry => new SphereGeometry(r, w, h);
const cyl = (rt: number, rb: number, h: number, s = 10): BufferGeometry => new CylinderGeometry(rt, rb, h, s);
const cone = (r: number, h: number, s = 8): BufferGeometry => new ConeGeometry(r, h, s);
const box = (w: number, h: number, d: number): BufferGeometry => new BoxGeometry(w, h, d);

/** Two eyes on a face at `z`, with pupils. */
const eyes = (b: PartBuilder, y: number, z: number, spread: number, size: number, white = 0xffffff, pupil = 0x111111, glow = false): void => {
  for (const side of [-1, 1]) {
    b.add(sphere(size, 8, 6), white, glow ? 'glow' : 'smooth', { x: side * spread, y, z, sz: 0.5 });
    b.add(sphere(size * 0.55, 6, 5), pupil, glow ? 'glow' : 'smooth', { x: side * spread, y, z: z + size * 0.35, sz: 0.4 });
  }
};

type Maker = (b: PartBuilder) => void;

const MAKERS: Readonly<Record<PetKind['model'], Maker>> = {
  chochin: (b) => {
    // A paper lantern with one huge eye and a lolling tongue.
    b.add(cyl(0.5, 0.5, 1.1, 14), 0xfff1c9, 'glow', { y: 0.6 });
    for (const y of [0.2, 0.45, 0.7, 0.95]) b.add(new TorusGeometry(0.51, 0.03, 4, 16), 0xc0392b, 'smooth', { y, rx: Math.PI / 2 });
    b.add(cyl(0.3, 0.36, 0.14, 12), 0x2b2b2b, 'smooth', { y: 1.2 });
    b.add(cyl(0.36, 0.3, 0.14, 12), 0x2b2b2b, 'smooth', { y: 0.02 });
    b.add(sphere(0.2, 10, 8), 0xffffff, 'smooth', { y: 0.72, z: 0.45, sz: 0.4 });
    b.add(sphere(0.1, 8, 6), 0x111111, 'smooth', { y: 0.72, z: 0.52, sz: 0.3 });
    b.add(box(0.5, 0.06, 0.12), 0x2b0a0a, 'smooth', { y: 0.4, z: 0.48 });
    b.add(box(0.16, 0.5, 0.06), 0xff4d6d, 'smooth', { y: 0.2, z: 0.52, rx: -0.3 });
  },
  karakasa: (b) => {
    // The umbrella spirit: a closed red paper umbrella, one eye, one leg, one geta.
    b.add(cone(0.62, 1.3, 12), 0xe0342b, 'smooth', { y: 1.15 });
    b.add(cone(0.64, 0.3, 12), 0xfff1c9, 'smooth', { y: 0.5 });
    b.add(cyl(0.05, 0.05, 0.6, 6), 0x8a5a33, 'smooth', { y: 0.2 });
    b.add(box(0.3, 0.06, 0.5), 0x5e3b20, 'smooth', { y: -0.1 });
    b.add(sphere(0.18, 10, 8), 0xffffff, 'smooth', { y: 1.05, z: 0.36, sz: 0.4 });
    b.add(sphere(0.09, 8, 6), 0x111111, 'smooth', { y: 1.05, z: 0.43, sz: 0.3 });
    b.add(box(0.14, 0.42, 0.05), 0xff4d6d, 'smooth', { y: 0.7, z: 0.5, rx: -0.25 });
  },
  tanuki: (b) => {
    b.add(sphere(0.55, 12, 10), 0x9a6a3f, 'smooth', { y: 0.55 });
    b.add(sphere(0.38, 10, 8), 0xe8d3b0, 'smooth', { y: 0.45, z: 0.3, sz: 0.6 });
    b.add(sphere(0.38, 10, 8), 0x9a6a3f, 'smooth', { y: 1.15 });
    b.add(box(0.62, 0.18, 0.2), 0x3a2a1c, 'smooth', { y: 1.18, z: 0.28 });
    eyes(b, 1.2, 0.36, 0.13, 0.07);
    for (const side of [-1, 1]) b.add(sphere(0.12, 8, 6), 0x3a2a1c, 'smooth', { x: side * 0.28, y: 1.48 });
    b.add(cone(0.7, 0.26, 16), 0xd9b27a, 'smooth', { y: 1.6 });
    // The striped tail.
    for (let i = 0; i < 4; i += 1) b.add(sphere(0.2, 8, 6), i % 2 ? 0x3a2a1c : 0x9a6a3f, 'smooth', { y: 0.35 + i * 0.12, z: -0.5 - i * 0.14 });
  },
  kitsune: (b) => {
    // The nine-tailed fox: white, red markings, fanned tails with foxfire.
    b.add(sphere(0.45, 12, 10), 0xfafafa, 'smooth', { y: 0.55, sz: 1.3 });
    b.add(sphere(0.34, 10, 8), 0xfafafa, 'smooth', { y: 1.05, z: 0.35 });
    b.add(cone(0.16, 0.36, 8), 0xfafafa, 'smooth', { y: 1.0, z: 0.72, rx: Math.PI / 2 });
    b.add(sphere(0.06, 6, 5), 0x111111, 'smooth', { y: 1.0, z: 0.9 });
    for (const side of [-1, 1]) {
      b.add(cone(0.12, 0.36, 6), 0xfafafa, 'smooth', { x: side * 0.18, y: 1.42, z: 0.28 });
      b.add(cone(0.07, 0.18, 6), 0xe0342b, 'smooth', { x: side * 0.18, y: 1.5, z: 0.3 });
      b.add(box(0.1, 0.03, 0.04), 0xe0342b, 'smooth', { x: side * 0.14, y: 1.12, z: 0.66, rz: side * 0.4 });
    }
    eyes(b, 1.08, 0.64, 0.13, 0.05, 0xffd21f, 0x111111);
    for (let i = 0; i < 5; i += 1) {
      const a = -0.9 + i * 0.45;
      b.add(cone(0.16, 0.9, 8), 0xfafafa, 'smooth', { x: Math.sin(a) * 0.4, y: 0.95, z: -0.55, rx: -0.7, rz: -a * 0.8 });
      b.add(sphere(0.1, 6, 5), 0x6fd6ff, 'glow', { x: Math.sin(a) * 0.62, y: 1.32, z: -0.85 });
    }
  },
  kappa: (b) => {
    b.add(sphere(0.48, 12, 10), 0x5fbf4a, 'smooth', { y: 0.55 });
    b.add(sphere(0.5, 12, 8), 0x2f6b2a, 'smooth', { y: 0.6, z: -0.2, sz: 0.7 });
    b.add(sphere(0.34, 10, 8), 0x5fbf4a, 'smooth', { y: 1.1, z: 0.1 });
    b.add(cyl(0.26, 0.26, 0.06, 12), 0xeaf6ff, 'smooth', { y: 1.42, z: 0.1 });
    b.add(cyl(0.22, 0.22, 0.03, 12), 0x4fc3f7, 'glow', { y: 1.455, z: 0.1 });
    b.add(cone(0.14, 0.3, 6), 0xffc933, 'smooth', { y: 1.02, z: 0.46, rx: Math.PI / 2 });
    eyes(b, 1.2, 0.37, 0.14, 0.07);
    for (const side of [-1, 1]) b.add(sphere(0.12, 6, 5), 0x5fbf4a, 'smooth', { x: side * 0.5, y: 0.55, z: 0.1 });
  },
  tengu: (b) => {
    // A crow tengu: black-feathered head, yellow beak, red coat, wings, a tokin cap.
    b.add(cyl(0.34, 0.46, 0.8, 10), 0xc0392b, 'smooth', { y: 0.45 });
    b.add(sphere(0.34, 10, 8), 0x1f2230, 'smooth', { y: 1.08 });
    b.add(cone(0.14, 0.42, 6), 0xffc933, 'smooth', { y: 1.02, z: 0.46, rx: Math.PI / 2 });
    b.add(box(0.2, 0.18, 0.2), 0x111111, 'smooth', { y: 1.46 });
    eyes(b, 1.16, 0.3, 0.13, 0.06, 0xffe23a, 0x111111, true);
    for (const side of [-1, 1]) b.add(box(0.08, 0.7, 0.55), 0x14161f, 'smooth', { x: side * 0.46, y: 0.8, z: -0.2, rz: side * 0.5 });
  },
  bakeneko: (b) => {
    // A two-tailed spirit cat with glowing eyes and wisps.
    b.add(sphere(0.46, 12, 10), 0x4a3a66, 'smooth', { y: 0.5, sz: 1.2 });
    b.add(sphere(0.36, 10, 8), 0x4a3a66, 'smooth', { y: 1.0, z: 0.3 });
    for (const side of [-1, 1]) b.add(cone(0.13, 0.34, 4), 0x4a3a66, 'smooth', { x: side * 0.2, y: 1.38, z: 0.28 });
    eyes(b, 1.04, 0.6, 0.14, 0.07, 0xfff05a, 0x111111, true);
    for (const side of [-1, 1]) {
      b.add(cyl(0.06, 0.1, 0.9, 6), 0x4a3a66, 'smooth', { x: side * 0.16, y: 0.9, z: -0.6, rx: -0.6, rz: side * 0.3 });
      b.add(sphere(0.12, 6, 5), 0xb16bff, 'glow', { x: side * 0.3, y: 1.35, z: -0.9 });
    }
  },
  hannya: (b) => {
    // A floating hannya mask: pale face, golden horns, fangs, burning eyes.
    b.add(sphere(0.55, 12, 10), 0xf4efe3, 'smooth', { y: 0.9, sz: 0.45 });
    for (const side of [-1, 1]) {
      b.add(cone(0.1, 0.55, 8), 0xf2c14e, 'smooth', { x: side * 0.3, y: 1.5, z: -0.05, rz: side * -0.45 });
      b.add(cone(0.05, 0.16, 5), 0xffffff, 'smooth', { x: side * 0.14, y: 0.52, z: 0.22, rx: Math.PI });
    }
    b.add(box(0.5, 0.1, 0.1), 0x7a0f1a, 'smooth', { y: 0.6, z: 0.22 });
    eyes(b, 1.0, 0.24, 0.17, 0.08, 0xffd21f, 0xe0342b, true);
    b.add(box(0.5, 0.05, 0.04), 0x1f1f1f, 'smooth', { y: 1.15, z: 0.24, rz: 0 });
    b.add(cone(0.35, 0.8, 8), 0xb16bff, 'glow', { y: 0.2, z: -0.2, rx: Math.PI });
  },
  hitodama: (b) => {
    // A soul-flame: a glowing teardrop with a trailing tail.
    b.add(sphere(0.45, 12, 10), 0x6fd6ff, 'glow', { y: 0.7 });
    b.add(cone(0.42, 1.0, 10), 0x6fd6ff, 'glow', { y: 1.35 });
    b.add(sphere(0.28, 10, 8), 0xe8fbff, 'glow', { y: 0.72, z: 0.1 });
    b.add(cone(0.2, 0.9, 8), 0x3fa9ff, 'glow', { y: 0.55, z: -0.6, rx: -1.3 });
    eyes(b, 0.78, 0.36, 0.12, 0.06, 0x0a2a4a, 0x0a2a4a);
  },
  jorogumo: (b) => {
    // The spider-woman's true form: a striped body and eight bent legs.
    b.add(sphere(0.45, 12, 10), 0x2a1a3a, 'smooth', { y: 0.8, z: -0.25, sz: 1.2 });
    b.add(sphere(0.3, 10, 8), 0x2a1a3a, 'smooth', { y: 0.75, z: 0.35 });
    for (const z of [-0.45, -0.2, 0.05]) b.add(new TorusGeometry(0.4, 0.04, 4, 14), 0xffc933, 'smooth', { y: 0.8, z, sx: 1, sy: 1 });
    for (let i = 0; i < 4; i += 1) {
      for (const side of [-1, 1]) {
        const z = 0.3 - i * 0.22;
        b.add(cyl(0.04, 0.04, 0.7, 5), 0x1a1024, 'smooth', { x: side * 0.45, y: 0.75, z, rz: side * 1.0 });
        b.add(cyl(0.035, 0.03, 0.7, 5), 0x1a1024, 'smooth', { x: side * 0.85, y: 0.4, z, rz: side * -0.35 });
      }
    }
    for (const [x, y] of [[-0.1, 0.85], [0.1, 0.85], [-0.18, 0.75], [0.18, 0.75]] as const) b.add(sphere(0.05, 6, 5), 0xff2e4a, 'glow', { x, y, z: 0.6 });
  },
  nurikabe: (b) => {
    // The living wall: a mossy stone slab with stubby limbs.
    b.box(1.2, 1.3, 0.45, 0x9aa0a8, 'stud', { y: 0.85 });
    b.box(1.24, 0.2, 0.5, 0x5fbf4a, 'stud', { y: 1.55 });
    eyes(b, 1.1, 0.24, 0.24, 0.1);
    b.add(box(0.46, 0.08, 0.06), 0x3a3f4a, 'smooth', { y: 0.72, z: 0.24 });
    for (const side of [-1, 1]) {
      b.add(box(0.22, 0.4, 0.22), 0x8a9098, 'smooth', { x: side * 0.35, y: 0.1 });
      b.add(box(0.2, 0.2, 0.4), 0x8a9098, 'smooth', { x: side * 0.72, y: 0.9, z: 0.1 });
    }
  },
  ryu: (b) => {
    // A coiling dragon: a green-gold serpent in an S, horned head, a pearl.
    for (let i = 0; i < 8; i += 1) {
      const t = i / 7;
      const x = Math.sin(t * Math.PI * 1.6) * 0.45;
      const y = 0.4 + t * 0.9;
      const z = -0.6 + t * 1.0;
      b.add(sphere(0.26 - t * 0.06, 10, 8), i % 2 ? 0x2fae5a : 0x38c76a, 'smooth', { x, y, z });
      if (i % 2 === 0) b.add(cone(0.07, 0.2, 5), 0xf2c14e, 'smooth', { x, y: y + 0.26, z });
    }
    b.add(box(0.46, 0.36, 0.6), 0x2fae5a, 'smooth', { x: 0, y: 1.45, z: 0.55 });
    b.add(box(0.36, 0.14, 0.3), 0xf2e3b0, 'smooth', { y: 1.3, z: 0.85 });
    for (const side of [-1, 1]) {
      b.add(cone(0.06, 0.45, 5), 0xf2c14e, 'smooth', { x: side * 0.16, y: 1.8, z: 0.4, rx: -0.6 });
      b.add(cyl(0.015, 0.015, 0.6, 3), 0xf2c14e, 'smooth', { x: side * 0.25, y: 1.3, z: 1.0, rz: side * 1.2 });
    }
    eyes(b, 1.55, 0.86, 0.14, 0.06, 0xffe23a, 0xe0342b, true);
    b.add(sphere(0.14, 10, 8), 0x9fe6ff, 'glow', { x: 0.45, y: 0.9, z: 0.6 });
  },
  gashadokuro: (b) => {
    // The starving skeleton: a great skull and two bony hands.
    b.add(sphere(0.5, 12, 10), 0xf1ecdc, 'smooth', { y: 1.0 });
    b.add(box(0.6, 0.3, 0.45), 0xf1ecdc, 'smooth', { y: 0.58, z: 0.08 });
    for (const side of [-1, 1]) {
      b.add(sphere(0.14, 8, 6), 0x1a1016, 'smooth', { x: side * 0.2, y: 1.02, z: 0.38, sz: 0.5 });
      b.add(sphere(0.06, 6, 5), 0xff5a3c, 'glow', { x: side * 0.2, y: 1.02, z: 0.45 });
      for (let f = 0; f < 3; f += 1) b.add(box(0.06, 0.4, 0.06), 0xf1ecdc, 'smooth', { x: side * (0.62 + f * 0.1), y: 0.5, z: 0.25, rz: side * 0.2 });
    }
    for (let t = -2; t <= 2; t += 1) b.add(box(0.07, 0.12, 0.06), 0xffffff, 'smooth', { x: t * 0.1, y: 0.55, z: 0.32 });
    b.add(cone(0.08, 0.16, 3), 0x1a1016, 'smooth', { y: 0.8, z: 0.46, rx: Math.PI });
  },
  raiju: (b) => {
    // The thunder beast: a blue wolf-cat wreathed in yellow lightning.
    b.add(sphere(0.45, 12, 10), 0x3f6fe0, 'smooth', { y: 0.6, sz: 1.3 });
    b.add(sphere(0.34, 10, 8), 0x3f6fe0, 'smooth', { y: 1.05, z: 0.45 });
    b.add(cone(0.14, 0.3, 6), 0x3f6fe0, 'smooth', { y: 1.0, z: 0.8, rx: Math.PI / 2 });
    for (const side of [-1, 1]) b.add(cone(0.12, 0.4, 4), 0xffe23a, 'glow', { x: side * 0.2, y: 1.42, z: 0.4 });
    eyes(b, 1.12, 0.74, 0.14, 0.06, 0xffffff, 0x1f6fd6, true);
    const bolt = [
      [0, 0.8, -0.55, 0.5],
      [0.18, 1.1, -0.8, -0.6],
      [0, 1.4, -1.0, 0.5],
    ] as const;
    for (const [x, y, z, r] of bolt) b.add(box(0.1, 0.45, 0.1), 0xffe23a, 'glow', { x, y, z, rz: r });
  },
  baku: (b) => {
    // The dream-eater: a pale tapir with a trunk and tusks, star-spotted.
    b.add(sphere(0.52, 12, 10), 0xd9c8e8, 'smooth', { y: 0.6, sz: 1.3 });
    b.add(sphere(0.36, 10, 8), 0xd9c8e8, 'smooth', { y: 1.0, z: 0.5 });
    b.add(cyl(0.1, 0.07, 0.5, 8), 0xd9c8e8, 'smooth', { y: 0.78, z: 0.86, rx: 0.5 });
    for (const side of [-1, 1]) {
      b.add(cone(0.05, 0.3, 5), 0xffffff, 'smooth', { x: side * 0.15, y: 0.78, z: 0.78, rx: 2.2 });
      b.add(cyl(0.1, 0.1, 0.5, 6), 0x8a6aa8, 'smooth', { x: side * 0.28, y: 0.15, z: 0.3 });
      b.add(cyl(0.1, 0.1, 0.5, 6), 0x8a6aa8, 'smooth', { x: side * 0.28, y: 0.15, z: -0.4 });
    }
    eyes(b, 1.1, 0.8, 0.15, 0.06);
    for (const [x, y, z] of [[0.3, 0.9, -0.2], [-0.35, 0.7, 0.1], [0.1, 1.05, -0.5]] as const) b.add(sphere(0.07, 6, 5), 0xfff05a, 'glow', { x, y, z });
  },
  nue: (b) => {
    // The chimera: a red monkey face, a striped tiger body, a snake for a tail.
    b.add(sphere(0.46, 12, 10), 0xff9a2e, 'smooth', { y: 0.6, sz: 1.35 });
    for (let i = -1; i <= 1; i += 1) b.add(new TorusGeometry(0.44, 0.05, 4, 14), 0x1a1016, 'smooth', { y: 0.62, z: i * 0.2 });
    b.add(sphere(0.34, 10, 8), 0xc0392b, 'smooth', { y: 1.08, z: 0.5 });
    b.add(sphere(0.22, 10, 8), 0xf4d6b0, 'smooth', { y: 1.02, z: 0.72, sz: 0.5 });
    for (const side of [-1, 1]) b.add(sphere(0.1, 8, 6), 0xc0392b, 'smooth', { x: side * 0.34, y: 1.12, z: 0.5 });
    eyes(b, 1.12, 0.8, 0.1, 0.05, 0xffe23a, 0x111111, true);
    for (let i = 0; i < 5; i += 1) b.add(sphere(0.12 - i * 0.012, 8, 6), 0x3fae3f, 'smooth', { y: 0.7 + i * 0.12, z: -0.65 - i * 0.12 });
    b.add(sphere(0.14, 8, 6), 0x3fae3f, 'smooth', { y: 1.35, z: -1.2 });
    eyes(b, 1.4, -1.08, 0.07, 0.03, 0xff2e4a, 0x111111, true);
  },
};

const cache = new Map<number, Partial<Record<PartKind, BufferGeometry>>>();

/** A pet model. Geometry is cached per species and shared; never dispose it, only remove it. */
export const createPetModel = (petId: number): Group => {
  const pet = petById(petId);
  let geometries = cache.get(petId);
  if (!geometries) {
    const builder = new PartBuilder();
    MAKERS[pet?.model ?? 'chochin'](builder);
    geometries = builder.geometries();
    cache.set(petId, geometries);
  }
  const group = meshesFor(geometries, `pet-${petId}`, false);
  return group;
};
