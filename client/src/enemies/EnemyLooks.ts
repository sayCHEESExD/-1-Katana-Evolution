import { BoxGeometry, ConeGeometry, CylinderGeometry, SphereGeometry, TorusGeometry } from 'three';
import type { EnemyLook } from '@katana/shared';
import type { PartBuilder } from '../render/PartBuilder.js';

/**
 * How each enemy type looks: the body atlas recoloured to its palette, and
 * accessories built on its head, in its hand and on its back. Every enemy is
 * the same rig as a player - so it runs, swings and falls with the same
 * animator - dressed to read at a glance as a ronin, an oni or a shogun.
 *
 * Accessories are authored in world units around their mount: the head's
 * centre (the head is ~0.9 tall), the grip (weapon up +Y), and the upper back.
 */
export interface LookPalette {
  /** Replaces the atlas's teal cloth. */
  readonly cloth: number;
  /** Replaces its darker trim. */
  readonly trim: number;
  /** Replaces its warm (skin) tones. */
  readonly skin: number;
}

export interface EnemyLookDef {
  readonly palette: LookPalette;
  readonly head?: (b: PartBuilder, size: number) => void;
  readonly hand?: (b: PartBuilder) => void;
  readonly back?: (b: PartBuilder) => void;
}

const kasa = (b: PartBuilder, s: number, color = 0xd9b27a): void => {
  b.add(new ConeGeometry(s * 0.95, s * 0.42, 14), color, 'smooth', { y: s * 0.5 });
};
const horns = (b: PartBuilder, s: number, color: number, length = 0.5): void => {
  for (const side of [-1, 1]) b.add(new ConeGeometry(s * 0.12, s * length, 7), color, 'smooth', { x: side * s * 0.28, y: s * 0.55, rz: side * -0.35 });
};
const kabuto = (b: PartBuilder, s: number, shell: number, crest: number): void => {
  b.add(new SphereGeometry(s * 0.56, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), shell, 'smooth', { y: s * 0.08 });
  b.add(new CylinderGeometry(s * 0.72, s * 0.8, s * 0.12, 12), shell, 'smooth', { y: s * 0.02 });
  for (const side of [-1, 1]) b.add(new BoxGeometry(s * 0.06, s * 0.5, s * 0.3), crest, 'smooth', { x: side * s * 0.2, y: s * 0.62, z: s * 0.4, rz: side * -0.35 });
};
const blade = (b: PartBuilder, length: number, steel = 0xdfe6ee, hilt = 0x22252e): void => {
  b.add(new BoxGeometry(0.06, length, 0.18), steel, 'smooth', { y: length / 2 });
  b.add(new CylinderGeometry(0.2, 0.2, 0.05, 10), 0x3a3f4a, 'smooth');
  b.add(new BoxGeometry(0.12, 0.55, 0.16), hilt, 'smooth', { y: -0.28 });
};
const spear = (b: PartBuilder, shaft = 0x6b4a2a, head = 0xdfe6ee): void => {
  b.add(new CylinderGeometry(0.05, 0.05, 3.6, 6), shaft, 'smooth', { y: 0.9 });
  b.add(new ConeGeometry(0.12, 0.6, 6), head, 'smooth', { y: 3.0 });
};
const club = (b: PartBuilder, color = 0x5e3b20, studs = 0xc9ccd4, scale = 1): void => {
  b.add(new CylinderGeometry(0.22 * scale, 0.1 * scale, 1.8 * scale, 8), color, 'smooth', { y: 0.7 * scale });
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    b.add(new ConeGeometry(0.06 * scale, 0.18 * scale, 5), studs, 'smooth', { x: Math.cos(a) * 0.2 * scale, y: (1.0 + (i % 3) * 0.25) * scale, z: Math.sin(a) * 0.2 * scale, rz: -Math.cos(a) * 1.5, rx: Math.sin(a) * 1.5 });
  }
};
const flames = (b: PartBuilder, s: number, color = 0xff8a1c, count = 5): void => {
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    b.add(new ConeGeometry(s * 0.14, s * 0.55, 6), i % 2 ? 0xffd23a : color, 'glow', { x: Math.cos(a) * s * 0.25, y: s * 0.62, z: Math.sin(a) * s * 0.25 });
  }
};
const drums = (b: PartBuilder, count: number, radius: number): void => {
  b.add(new TorusGeometry(radius, 0.08, 6, 24), 0xc0392b, 'smooth', { rx: 0 });
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    b.add(new CylinderGeometry(0.28, 0.28, 0.22, 10), 0xf2c14e, 'smooth', { x: Math.cos(a) * radius, y: Math.sin(a) * radius, rx: Math.PI / 2 });
  }
};
const banner = (b: PartBuilder, cloth: number, emblem: number): void => {
  b.add(new CylinderGeometry(0.04, 0.04, 2.6, 5), 0x3a2a1c, 'smooth', { y: 1.1 });
  b.add(new BoxGeometry(0.04, 1.4, 0.7), cloth, 'smooth', { y: 1.6, z: -0.38 });
  b.add(new CylinderGeometry(0.2, 0.2, 0.05, 12), emblem, 'glow', { y: 1.7, z: -0.38, rz: Math.PI / 2 });
};

export const ENEMY_LOOKS: Readonly<Record<EnemyLook, EnemyLookDef>> = {
  ronin: {
    palette: { cloth: 0x6b6f8a, trim: 0x3a3d52, skin: 0xf0c8a0 },
    head: (b, s) => kasa(b, s),
    hand: (b) => blade(b, 1.6),
  },
  bandit: {
    palette: { cloth: 0x9a6a3f, trim: 0x5e3b20, skin: 0xe8b890 },
    head: (b, s) => {
      kasa(b, s, 0xc9a36a);
      b.add(new BoxGeometry(s * 0.9, s * 0.25, s * 0.9), 0xc0392b, 'smooth', { y: -s * 0.12, z: s * 0.05 });
    },
    hand: (b) => club(b, 0x7a5a33, 0x7a5a33, 0.8),
  },
  ashigaru: {
    palette: { cloth: 0x3f5a8a, trim: 0x22324f, skin: 0xf0c8a0 },
    head: (b, s) => b.add(new ConeGeometry(s * 0.8, s * 0.35, 12), 0x2b2f3d, 'smooth', { y: s * 0.5 }),
    hand: (b) => spear(b),
    back: (b) => banner(b, 0x3f5a8a, 0xffffff),
  },
  oni: {
    palette: { cloth: 0x3a3d52, trim: 0x22252e, skin: 0xe0453a },
    head: (b, s) => {
      horns(b, s, 0xf4efe3);
      b.add(new BoxGeometry(s * 0.7, s * 0.12, s * 0.2), 0xffffff, 'smooth', { y: -s * 0.18, z: s * 0.4 });
    },
    hand: (b) => club(b),
  },
  kunoichi: {
    palette: { cloth: 0x6a3a8a, trim: 0x3a1f4f, skin: 0xf0c8a0 },
    head: (b, s) => {
      b.add(new SphereGeometry(s * 0.58, 10, 8), 0x3a1f4f, 'smooth', { y: s * 0.05, sz: 1.05 });
      b.add(new BoxGeometry(s * 0.9, s * 0.08, s * 0.08), 0xff7fc0, 'smooth', { y: s * 0.25, z: s * 0.5 });
    },
    hand: (b) => blade(b, 0.8, 0xc7b8ff, 0x3a1f4f),
  },
  samurai: {
    palette: { cloth: 0xc0392b, trim: 0x2b2f3d, skin: 0xf0c8a0 },
    head: (b, s) => kabuto(b, s, 0x2b2f3d, 0xf2c14e),
    hand: (b) => blade(b, 1.8, 0xffe0f0),
  },
  frost: {
    palette: { cloth: 0xdff6ff, trim: 0x6fa8dc, skin: 0xf4e0d0 },
    head: (b, s) => {
      kabuto(b, s, 0xe8f6ff, 0x9fe6ff);
      for (let i = 0; i < 4; i += 1) b.add(new ConeGeometry(s * 0.07, s * 0.35, 5), 0x9fe6ff, 'glow', { x: (i - 1.5) * s * 0.2, y: s * 0.62 });
    },
    hand: (b) => spear(b, 0xb0d8f0, 0x9fe6ff),
  },
  monk: {
    palette: { cloth: 0xf4efe3, trim: 0x8a7a5a, skin: 0xf0c8a0 },
    head: (b, s) => b.add(new CylinderGeometry(s * 0.55, s * 0.62, s * 0.95, 12), 0xc9a36a, 'smooth', { y: s * 0.1 }),
    hand: (b) => {
      b.add(new CylinderGeometry(0.05, 0.05, 3.0, 6), 0x5e3b20, 'smooth', { y: 0.6 });
      b.add(new TorusGeometry(0.3, 0.04, 6, 14), 0xf2c14e, 'smooth', { y: 2.3 });
    },
  },
  fireoni: {
    palette: { cloth: 0x2b1a14, trim: 0x140a08, skin: 0xff6a2a },
    head: (b, s) => {
      horns(b, s, 0x2b1a14, 0.6);
      flames(b, s);
    },
    hand: (b) => club(b, 0x2b1a14, 0xff8a1c),
  },
  kappa: {
    palette: { cloth: 0x4f9a2c, trim: 0x2f5a1c, skin: 0x7fd65a },
    head: (b, s) => {
      b.add(new CylinderGeometry(s * 0.34, s * 0.34, s * 0.06, 12), 0xeaf6ff, 'smooth', { y: s * 0.48 });
      b.add(new ConeGeometry(s * 0.14, s * 0.32, 6), 0xffc933, 'smooth', { y: -s * 0.08, z: s * 0.5, rx: Math.PI / 2 });
    },
    back: (b) => b.add(new SphereGeometry(0.62, 10, 8), 0x2f5a1c, 'smooth', { z: -0.1, sz: 0.55 }),
    hand: (b) => {
      spear(b, 0x2f5a1c, 0x9aa0a8);
      for (const side of [-1, 1]) b.add(new ConeGeometry(0.06, 0.35, 5), 0x9aa0a8, 'smooth', { z: side * 0.14, y: 2.9 });
    },
  },
  tengu: {
    palette: { cloth: 0x2b2f3d, trim: 0x14161f, skin: 0xd8342b },
    head: (b, s) => {
      b.add(new ConeGeometry(s * 0.1, s * 0.75, 7), 0xd8342b, 'smooth', { y: 0, z: s * 0.6, rx: Math.PI / 2 });
      b.add(new BoxGeometry(s * 0.26, s * 0.24, s * 0.26), 0x111111, 'smooth', { y: s * 0.6 });
    },
    back: (b) => {
      for (const side of [-1, 1]) b.add(new BoxGeometry(0.1, 1.2, 0.9), 0x14161f, 'smooth', { x: side * 0.7, y: 0.2, rz: side * 0.6 });
    },
    hand: (b) => b.add(new BoxGeometry(0.06, 0.9, 0.7), 0x3fae3f, 'smooth', { y: 0.55 }),
  },
  raijin: {
    palette: { cloth: 0x3f6fe0, trim: 0x1f3a8a, skin: 0x7fb0ff },
    head: (b, s) => {
      horns(b, s, 0xffe23a);
      b.add(new SphereGeometry(s * 0.5, 10, 8), 0x2b2f3d, 'smooth', { y: s * 0.18, sy: 0.6 });
    },
    back: (b) => drums(b, 5, 1.0),
    hand: (b) => {
      b.add(new CylinderGeometry(0.05, 0.05, 1.0, 6), 0xf4efe3, 'smooth', { y: 0.3 });
      b.add(new SphereGeometry(0.14, 8, 6), 0xffe23a, 'glow', { y: 0.85 });
    },
  },
  ninja: {
    palette: { cloth: 0x1f2230, trim: 0x0e0f16, skin: 0xf0c8a0 },
    head: (b, s) => {
      b.add(new SphereGeometry(s * 0.58, 10, 8), 0x1f2230, 'smooth', { y: s * 0.05, sz: 1.05 });
      b.add(new BoxGeometry(s * 0.7, s * 0.12, s * 0.05), 0xe0342b, 'smooth', { y: s * 0.12, z: s * 0.55 });
    },
    hand: (b) => blade(b, 1.5, 0x3a3f55, 0x0e0f16),
    back: (b) => b.add(new BoxGeometry(0.08, 1.6, 0.18), 0x0e0f16, 'smooth', { rz: 0.6 }),
  },
  guard: {
    palette: { cloth: 0x5a2a6a, trim: 0x2d1438, skin: 0xf0c8a0 },
    head: (b, s) => kabuto(b, s, 0x2d1438, 0xb16bff),
    hand: (b) => {
      b.add(new CylinderGeometry(0.05, 0.05, 3.2, 6), 0x2d1438, 'smooth', { y: 0.7 });
      b.add(new BoxGeometry(0.05, 0.9, 0.22), 0xc7b8ff, 'glow', { y: 2.7, z: 0.05 });
    },
    back: (b) => banner(b, 0x5a2a6a, 0xb16bff),
  },
  hatamoto: {
    palette: { cloth: 0x8e1b18, trim: 0x2b0a08, skin: 0xf0c8a0 },
    head: (b, s) => {
      kabuto(b, s, 0x1a0a08, 0xf2c14e);
      b.add(new BoxGeometry(s * 0.7, s * 0.3, s * 0.08), 0xc0392b, 'smooth', { y: -s * 0.15, z: s * 0.5 });
    },
    hand: (b) => blade(b, 2.0, 0xffd0d0, 0x1a0a08),
    back: (b) => banner(b, 0x8e1b18, 0xf2c14e),
  },
  'boss-oni': {
    palette: { cloth: 0xf2a33a, trim: 0x2b1a14, skin: 0xd8342b },
    head: (b, s) => {
      horns(b, s, 0xf4efe3, 0.8);
      b.add(new BoxGeometry(s * 0.9, s * 0.16, s * 0.2), 0xffffff, 'smooth', { y: -s * 0.2, z: s * 0.42 });
      b.add(new ConeGeometry(s * 0.08, s * 0.25, 5), 0xffffff, 'smooth', { x: s * 0.25, y: -s * 0.35, z: s * 0.45, rx: Math.PI });
      b.add(new ConeGeometry(s * 0.08, s * 0.25, 5), 0xffffff, 'smooth', { x: -s * 0.25, y: -s * 0.35, z: s * 0.45, rx: Math.PI });
    },
    hand: (b) => club(b, 0x2b2f3d, 0xc9ccd4, 1.2),
  },
  'boss-flame': {
    palette: { cloth: 0x1a0a08, trim: 0x2b0a08, skin: 0xff6a2a },
    head: (b, s) => {
      horns(b, s, 0x1a0a08, 0.7);
      flames(b, s, 0xff4d1c, 8);
    },
    hand: (b) => {
      b.add(new BoxGeometry(0.08, 2.4, 0.3), 0xff8a1c, 'glow', { y: 1.2 });
      b.add(new BoxGeometry(0.16, 0.6, 0.2), 0x1a0a08, 'smooth', { y: -0.3 });
    },
    back: (b) => {
      for (let i = 0; i < 5; i += 1) b.add(new ConeGeometry(0.2, 1.4, 6), i % 2 ? 0xffd23a : 0xff4d1c, 'glow', { x: (i - 2) * 0.35, y: 0.6 + Math.abs(i - 2) * -0.2 });
    },
  },
  'boss-storm': {
    palette: { cloth: 0x2b3a8a, trim: 0x141f4f, skin: 0x6fa8ff },
    head: (b, s) => {
      horns(b, s, 0xffe23a, 0.75);
      b.add(new SphereGeometry(s * 0.12, 8, 6), 0xffe23a, 'glow', { y: s * 0.6 });
    },
    back: (b) => drums(b, 8, 1.3),
    hand: (b) => {
      const zig = [0.3, 0.9, 1.5, 2.1];
      zig.forEach((y, i) => b.add(new BoxGeometry(0.12, 0.7, 0.12), 0xffe23a, 'glow', { y, rz: i % 2 ? 0.5 : -0.5 }));
    },
  },
  'boss-shogun': {
    palette: { cloth: 0x2b0a14, trim: 0x14060a, skin: 0xb0a8b8 },
    head: (b, s) => {
      kabuto(b, s, 0x14060a, 0xf2c14e);
      b.add(new TorusGeometry(s * 0.45, s * 0.05, 5, 16, Math.PI), 0xf2c14e, 'smooth', { y: s * 0.55, z: s * 0.35 });
      b.add(new BoxGeometry(s * 0.72, s * 0.35, s * 0.08), 0x8e1b18, 'smooth', { y: -s * 0.1, z: s * 0.5 });
      for (const side of [-1, 1]) b.add(new SphereGeometry(s * 0.06, 6, 5), 0xff2e6a, 'glow', { x: side * s * 0.16, y: s * 0.02, z: s * 0.55 });
    },
    hand: (b) => blade(b, 2.8, 0x3a0a14, 0x14060a),
    back: (b) => {
      banner(b, 0x2b0a14, 0xff2e6a);
      b.add(new BoxGeometry(1.4, 2.2, 0.06), 0x8e1b18, 'smooth', { y: -0.9, z: -0.1 });
    },
  },
};
