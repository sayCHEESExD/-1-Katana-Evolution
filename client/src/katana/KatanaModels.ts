import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  Shape,
  TorusGeometry,
  ConeGeometry,
  CanvasTexture,
  SRGBColorSpace,
  RepeatWrapping,
  NearestFilter,
  DoubleSide,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * THE FOURTEEN KATANAS, drawn in code.
 *
 * Each design is a handful of numbers - blade length, width, curve (sori),
 * colours, the shape of the guard (tsuba) and one signature detail - turned
 * into a few merged meshes. Nothing is loaded: the whole armoury is a few
 * kilobytes of code against the 12 MB budget.
 *
 * Local axes: the GRIP is at the origin, the blade runs up +Y, the cutting
 * EDGE faces +Z. A built katana is cached per slot and every player wearing it
 * shares the geometry and materials.
 */

type Tsuba = 'round' | 'square' | 'flower' | 'star' | 'horns' | 'snowflake' | 'crescent' | 'ring' | 'none';
type Detail = 'none' | 'bamboo' | 'serrated' | 'lightning' | 'flame' | 'crystal' | 'halo';

interface KatanaDesign {
  readonly blade: number;
  readonly edge: number;
  /** Emissive strength of the edge band. */
  readonly glow: number;
  readonly length: number;
  readonly width: number;
  readonly curve: number;
  readonly tsuba: Tsuba;
  readonly tsubaColor: number;
  readonly handle: number;
  readonly wrap: number;
  readonly saya: number;
  readonly detail: Detail;
  readonly handleLength?: number;
}

const DESIGNS: readonly KatanaDesign[] = [
  // 1 Bamboo Starter: a length of green bamboo with a twine grip.
  { blade: 0x79c94a, edge: 0xb8f07a, glow: 0, length: 1.9, width: 0.2, curve: 0, tsuba: 'none', tsubaColor: 0x4f8f2c, handle: 0x8a5a33, wrap: 0xd9b27a, saya: 0x5d9b35, detail: 'bamboo' },
  // 2 Ashigaru Blade: honest steel, round iron guard, black wrap.
  { blade: 0xd6dde6, edge: 0xffffff, glow: 0.05, length: 1.9, width: 0.2, curve: 0.1, tsuba: 'round', tsubaColor: 0x3a3f4a, handle: 0x22252e, wrap: 0xeeeeee, saya: 0x1f2330, detail: 'none' },
  // 3 Sakura Edge: pink hamon, blossom guard.
  { blade: 0xf2e9ef, edge: 0xff7fc0, glow: 0.35, length: 2, width: 0.21, curve: 0.12, tsuba: 'flower', tsubaColor: 0xff9fd0, handle: 0x5a1f3a, wrap: 0xffc3e0, saya: 0xd04f8f, detail: 'none' },
  // 4 Jade Serpent: jade blade, gold wrap.
  { blade: 0x5fe0a8, edge: 0xbfffe6, glow: 0.3, length: 2, width: 0.22, curve: 0.14, tsuba: 'round', tsubaColor: 0xf2c14e, handle: 0x14502f, wrap: 0xf2c14e, saya: 0x1c7a4a, detail: 'none' },
  // 5 Crimson Oni: red steel, horned guard.
  { blade: 0xe23b3b, edge: 0xffb0a0, glow: 0.4, length: 2.1, width: 0.23, curve: 0.14, tsuba: 'horns', tsubaColor: 0x1a1a1f, handle: 0x16161b, wrap: 0xe0342b, saya: 0x8e1b18, detail: 'none' },
  // 6 Frostbite Tachi: ice blade, snowflake guard.
  { blade: 0xbaf2ff, edge: 0xffffff, glow: 0.6, length: 2.15, width: 0.22, curve: 0.18, tsuba: 'snowflake', tsubaColor: 0x9fe6ff, handle: 0x2b4a7a, wrap: 0xdff6ff, saya: 0x3d7cc2, detail: 'crystal' },
  // 7 Raijin Thunder: yellow lightning edge and notched spine.
  { blade: 0x3a3f55, edge: 0xffe23a, glow: 0.9, length: 2.15, width: 0.23, curve: 0.12, tsuba: 'square', tsubaColor: 0xffd21f, handle: 0x2a2140, wrap: 0xffe23a, saya: 0x2f2a55, detail: 'lightning' },
  // 8 Moonlit Kitsune: lavender, crescent guard.
  { blade: 0xe5ddff, edge: 0xb89cff, glow: 0.7, length: 2.2, width: 0.22, curve: 0.16, tsuba: 'crescent', tsubaColor: 0xfff6c9, handle: 0x3b2a66, wrap: 0xffffff, saya: 0x5b45a8, detail: 'none' },
  // 9 Dragonfire Muramasa: black-red blade, flaming edge.
  { blade: 0x2a1414, edge: 0xff7a1c, glow: 1.1, length: 2.25, width: 0.24, curve: 0.16, tsuba: 'flower', tsubaColor: 0xf2c14e, handle: 0x3a0e0e, wrap: 0xff4d1c, saya: 0x5a1210, detail: 'flame' },
  // 10 Shadow Ninjato: straight black blade, square guard, violet edge.
  { blade: 0x1b1a24, edge: 0xb16bff, glow: 1, length: 2.05, width: 0.2, curve: 0, tsuba: 'square', tsubaColor: 0x2d2640, handle: 0x14121c, wrap: 0x8a4dff, saya: 0x17151f, detail: 'none' },
  // 11 Toxic Yokai Fang: acid green, serrated spine.
  { blade: 0x2f3a1c, edge: 0x8dff3a, glow: 1.2, length: 2.25, width: 0.25, curve: 0.2, tsuba: 'horns', tsubaColor: 0x5a7a1c, handle: 0x1d2410, wrap: 0x8dff3a, saya: 0x364a14, detail: 'serrated' },
  // 12 Celestial Masamune: white-gold, star guard.
  { blade: 0xfff8e0, edge: 0xffe89a, glow: 1.3, length: 2.35, width: 0.24, curve: 0.14, tsuba: 'star', tsubaColor: 0xf2c14e, handle: 0xf4efe3, wrap: 0xf2c14e, saya: 0xf4efe3, detail: 'halo' },
  // 13 Demon King Nodachi: a long crimson-black blade.
  { blade: 0x3a0a14, edge: 0xff2e6a, glow: 1.4, length: 2.9, width: 0.27, curve: 0.22, tsuba: 'star', tsubaColor: 0x1a0a10, handle: 0x14060a, wrap: 0xff2e6a, saya: 0x2a0710, detail: 'flame', handleLength: 0.95 },
  // 14 Kusanagi, Heaven Blade: a crystalline cyan blade with a gold halo.
  { blade: 0x7ff7ff, edge: 0xffffff, glow: 1.6, length: 2.6, width: 0.28, curve: 0.1, tsuba: 'ring', tsubaColor: 0xf2c14e, handle: 0x0e3a5a, wrap: 0xf2c14e, saya: 0x0e5a7a, detail: 'crystal' },
];

interface BuiltKatana {
  readonly blade: BufferGeometry;
  readonly edge: BufferGeometry;
  readonly hilt: BufferGeometry;
  readonly guard: BufferGeometry;
  readonly extra: BufferGeometry | null;
  readonly saya: BufferGeometry;
  readonly materials: {
    blade: Material;
    edge: Material;
    hilt: Material;
    guard: Material;
    extra: Material;
    saya: Material;
  };
}

const cache = new Map<number, BuiltKatana>();

const designOf = (slot: number): KatanaDesign => DESIGNS[Math.max(0, Math.min(DESIGNS.length - 1, slot - 1))]!;

/** The grip length of a design, so hands and scabbards line up. */
export const handleLengthOf = (slot: number): number => designOf(slot).handleLength ?? 0.62;
export const bladeLengthOf = (slot: number): number => designOf(slot).length;

/** A diamond-wrapped grip texture (tsuka-ito), drawn once per colour pair. */
const wrapTextures = new Map<string, CanvasTexture>();
const wrapTexture = (handle: number, wrap: number): CanvasTexture => {
  const key = `${handle}:${wrap}`;
  const existing = wrapTextures.get(key);
  if (existing) return existing;
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = `#${wrap.toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = `#${handle.toString(16).padStart(6, '0')}`;
  ctx.beginPath();
  ctx.moveTo(16, 3);
  ctx.lineTo(29, 16);
  ctx.lineTo(16, 29);
  ctx.lineTo(3, 16);
  ctx.closePath();
  ctx.fill();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.magFilter = NearestFilter;
  texture.repeat.set(1, 4);
  wrapTextures.set(key, texture);
  return texture;
};

/** The blade outline: a spine and an edge that bend back together (sori) and meet in a slanted tip. */
const bladeShape = (length: number, width: number, curve: number, inset: number): Shape => {
  const shape = new Shape();
  const bend = (y: number): number => -curve * (y / length) ** 2;
  const tip = Math.min(width * 1.6, length * 0.14);
  const steps = 8;
  shape.moveTo(-width / 2 + bend(0), 0);
  for (let i = 1; i <= steps; i += 1) {
    const y = (length * i) / steps;
    shape.lineTo(-width / 2 + bend(y), y);
  }
  const edgeTop = length - tip;
  shape.lineTo(width / 2 - inset + bend(edgeTop), edgeTop);
  for (let i = steps; i >= 0; i -= 1) {
    const y = (edgeTop * i) / steps;
    shape.lineTo(width / 2 - inset + bend(y), y);
  }
  shape.closePath();
  return shape;
};

/** The edge band: the outer third of the blade, a little proud of it, for the glow. */
const edgeShape = (length: number, width: number, curve: number): Shape => {
  const shape = new Shape();
  const bend = (y: number): number => -curve * (y / length) ** 2;
  const tip = Math.min(width * 1.6, length * 0.14);
  const edgeTop = length - tip;
  const steps = 8;
  const inner = width * 0.18;
  shape.moveTo(inner + bend(0), 0.02);
  for (let i = 1; i <= steps; i += 1) {
    const y = (edgeTop * i) / steps;
    shape.lineTo(inner + bend(y), y);
  }
  shape.lineTo(-width / 2 + bend(length), length);
  for (let i = steps; i >= 0; i -= 1) {
    const y = (edgeTop * i) / steps;
    shape.lineTo(width / 2 + bend(y), y);
  }
  shape.closePath();
  return shape;
};

/** Extrude a blade-plane shape: shape X -> +Z (edge), shape Y -> +Y (length), depth -> X. */
const extrude = (shape: Shape, thickness: number): BufferGeometry => {
  const geometry = new ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 2 });
  geometry.translate(0, 0, -thickness / 2);
  geometry.rotateY(-Math.PI / 2);
  return geometry;
};

const at = (geometry: BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): BufferGeometry => {
  if (rx) geometry.rotateX(rx);
  if (ry) geometry.rotateY(ry);
  if (rz) geometry.rotateZ(rz);
  geometry.translate(x, y, z);
  return geometry;
};

const guardGeometry = (design: KatanaDesign): BufferGeometry => {
  const w = design.width;
  const parts: BufferGeometry[] = [];
  // The habaki collar is part of every guard.
  parts.push(at(new BoxGeometry(w * 0.55, 0.12, w * 1.15), 0, 0.06, 0));
  switch (design.tsuba) {
    case 'none':
      parts.push(at(new CylinderGeometry(w * 0.62, w * 0.62, 0.06, 10), 0, 0, 0));
      break;
    case 'round':
      parts.push(at(new CylinderGeometry(w * 1.5, w * 1.5, 0.07, 18), 0, 0, 0));
      break;
    case 'square':
      parts.push(at(new BoxGeometry(w * 2.6, 0.08, w * 2.6), 0, 0, 0, 0, Math.PI / 4, 0));
      break;
    case 'flower':
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2;
        parts.push(at(new CylinderGeometry(w * 0.7, w * 0.7, 0.07, 10), Math.cos(a) * w * 0.9, 0, Math.sin(a) * w * 0.9));
      }
      parts.push(at(new CylinderGeometry(w * 0.8, w * 0.8, 0.09, 12), 0, 0, 0));
      break;
    case 'star':
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        const spike = new ConeGeometry(w * 0.42, w * 2.2, 4);
        spike.rotateZ(-Math.PI / 2);
        spike.translate(w * 1.1, 0, 0);
        parts.push(spike.rotateY(a));
      }
      parts.push(at(new CylinderGeometry(w * 0.9, w * 0.9, 0.1, 12), 0, 0, 0));
      break;
    case 'horns':
      parts.push(at(new CylinderGeometry(w * 1.25, w * 1.25, 0.08, 14), 0, 0, 0));
      for (const side of [-1, 1]) {
        parts.push(at(new ConeGeometry(w * 0.32, w * 2.4, 6), 0, w * 0.5, side * w * 1.3, side * -0.9, 0, 0));
      }
      break;
    case 'snowflake':
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        parts.push(at(new BoxGeometry(w * 0.26, 0.07, w * 2.2), 0, 0, 0, 0, a, 0));
      }
      parts.push(at(new CylinderGeometry(w * 0.7, w * 0.7, 0.09, 12), 0, 0, 0));
      break;
    case 'crescent':
      parts.push(at(new TorusGeometry(w * 1.3, w * 0.26, 6, 16, Math.PI * 1.4), 0, 0, 0, Math.PI / 2, 0, 0));
      parts.push(at(new CylinderGeometry(w * 0.8, w * 0.8, 0.08, 12), 0, 0, 0));
      break;
    case 'ring':
      parts.push(at(new TorusGeometry(w * 1.45, w * 0.2, 6, 20), 0, 0, 0, Math.PI / 2, 0, 0));
      parts.push(at(new CylinderGeometry(w * 1.0, w * 1.0, 0.08, 14), 0, 0, 0));
      break;
  }
  return merge(parts);
};

const hiltGeometry = (design: KatanaDesign): BufferGeometry => {
  const w = design.width;
  const length = design.handleLength ?? 0.62;
  const parts: BufferGeometry[] = [];
  if (design.detail === 'bamboo') {
    parts.push(at(new CylinderGeometry(w * 0.5, w * 0.5, length, 8), 0, -length / 2, 0));
  } else {
    parts.push(at(new BoxGeometry(w * 0.62, length, w * 0.95), 0, -length / 2, 0));
    // Kashira: the pommel cap.
    parts.push(at(new BoxGeometry(w * 0.72, 0.08, w * 1.05), 0, -length - 0.02, 0));
  }
  return merge(parts);
};

const extraGeometry = (design: KatanaDesign): BufferGeometry | null => {
  const L = design.length;
  const w = design.width;
  const bend = (y: number): number => -design.curve * (y / L) ** 2;
  const parts: BufferGeometry[] = [];
  switch (design.detail) {
    case 'bamboo':
      // Node rings every so often up the stalk.
      for (let y = 0.35; y < L; y += 0.45) parts.push(at(new CylinderGeometry(w * 0.62, w * 0.62, 0.06, 8), 0, y, 0));
      parts.push(at(new CylinderGeometry(w * 0.66, w * 0.66, 0.08, 8), 0, -0.3, 0));
      break;
    case 'serrated':
      for (let y = 0.4; y < L * 0.85; y += 0.22) {
        parts.push(at(new ConeGeometry(w * 0.16, w * 0.55, 4), 0, y, -w / 2 + bend(y) - w * 0.18, -Math.PI / 2, 0, 0));
      }
      break;
    case 'lightning':
      for (let y = 0.3, i = 0; y < L * 0.85; y += 0.3, i += 1) {
        parts.push(at(new BoxGeometry(0.05, 0.22, w * 0.3), 0, y, -w / 2 + bend(y) - w * 0.1, i % 2 ? 0.6 : -0.6, 0, 0));
      }
      break;
    case 'flame':
      for (let y = 0.25; y < L * 0.8; y += 0.28) {
        parts.push(at(new ConeGeometry(w * 0.2, w * 0.8, 5), 0, y + 0.05, w / 2 + bend(y) + w * 0.18, Math.PI / 2.6, 0, 0));
      }
      break;
    case 'crystal':
      for (let y = 0.5; y < L * 0.8; y += 0.55) {
        parts.push(at(new ConeGeometry(w * 0.2, w * 0.9, 4), 0, y, -w / 2 + bend(y) - w * 0.25, -Math.PI / 2.4, 0, 0));
      }
      break;
    case 'halo':
      parts.push(at(new TorusGeometry(w * 2.1, 0.025, 4, 24), 0, 0.35, 0, Math.PI / 2, 0, 0));
      break;
    case 'none':
      return null;
  }
  return parts.length > 0 ? merge(parts) : null;
};

/** The scabbard: a curved sheath the blade's length, open at the top. */
const sayaGeometry = (design: KatanaDesign): BufferGeometry => {
  const L = design.length + 0.05;
  const w = design.width * 1.35;
  const shape = new Shape();
  const bend = (y: number): number => -design.curve * (y / L) ** 2;
  const steps = 8;
  shape.moveTo(-w / 2 + bend(0), 0);
  for (let i = 1; i <= steps; i += 1) shape.lineTo(-w / 2 + bend((L * i) / steps), (L * i) / steps);
  shape.lineTo(w / 2 + bend(L) - w * 0.2, L);
  for (let i = steps; i >= 0; i -= 1) shape.lineTo(w / 2 + bend((L * i) / steps), (L * i) / steps);
  shape.closePath();
  return extrude(shape, design.width * 0.55);
};

const merge = (parts: BufferGeometry[]): BufferGeometry => {
  // mergeGeometries needs matching attributes: strip everything to position/normal.
  const clean = parts.map((part) => {
    const g = part.index ? part.toNonIndexed() : part;
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    return g;
  });
  const merged = mergeGeometries(clean, false) ?? clean[0]!;
  return merged;
};

const build = (slot: number): BuiltKatana => {
  const cached = cache.get(slot);
  if (cached) return cached;
  const d = designOf(slot);
  const bamboo = d.detail === 'bamboo';

  const blade = bamboo
    ? at(new CylinderGeometry(d.width * 0.5, d.width * 0.56, d.length, 9), 0, d.length / 2, 0)
    : extrude(bladeShape(d.length, d.width, d.curve, d.width * 0.25), d.width * 0.16);
  const edge = bamboo
    ? at(new ConeGeometry(d.width * 0.5, 0.2, 9), 0, d.length + 0.1, 0)
    : extrude(edgeShape(d.length, d.width, d.curve), d.width * 0.12);

  const metal = !bamboo;
  const materials = {
    // Extruded shapes: double-sided, so their lighting holds whichever way the outline was wound.
    blade: new MeshStandardMaterial({ color: d.blade, metalness: metal ? 0.45 : 0, roughness: metal ? 0.3 : 0.7, emissive: d.blade, emissiveIntensity: 0.12 + d.glow * 0.25, side: DoubleSide }),
    edge: new MeshStandardMaterial({ color: d.edge, metalness: 0.2, roughness: 0.25, emissive: d.edge, emissiveIntensity: 0.25 + d.glow * 0.8, side: DoubleSide }),
    hilt: new MeshStandardMaterial({ map: bamboo ? null : wrapTexture(d.handle, d.wrap), color: bamboo ? d.handle : 0xffffff, roughness: 0.85 }),
    guard: new MeshStandardMaterial({ color: d.tsubaColor, metalness: 0.5, roughness: 0.4, emissive: d.tsubaColor, emissiveIntensity: d.glow * 0.15 }),
    extra: new MeshStandardMaterial({ color: bamboo ? d.saya : d.edge, metalness: 0.2, roughness: 0.5, emissive: bamboo ? 0x000000 : d.edge, emissiveIntensity: bamboo ? 0 : 0.4 + d.glow * 0.6 }),
    saya: new MeshStandardMaterial({ color: d.saya, metalness: 0.1, roughness: 0.45, emissive: d.saya, emissiveIntensity: 0.15, side: DoubleSide }),
  };
  const built: BuiltKatana = {
    blade,
    edge,
    // A wrapped grip needs UVs for its pattern, so it is one plain box rather than merged parts.
    hilt: bamboo ? hiltGeometry(d) : withBoxUv(d),
    guard: guardGeometry(d),
    extra: extraGeometry(d),
    saya: sayaGeometry(d),
    materials,
  };
  cache.set(slot, built);
  return built;
};

/** The grip as one UV-mapped box (the wrap pattern needs UVs; merged parts drop them). */
const withBoxUv = (design: KatanaDesign): BufferGeometry => {
  const length = design.handleLength ?? 0.62;
  const geometry = new BoxGeometry(design.width * 0.62, length + 0.08, design.width * 0.95);
  geometry.translate(0, -length / 2 - 0.04, 0);
  return geometry;
};

const mesh = (geometry: BufferGeometry, material: Material, name: string): Mesh => {
  const m = new Mesh(geometry, material);
  m.name = name;
  m.castShadow = true;
  return m;
};

/**
 * A full katana, grip at the origin, blade up +Y. Shared geometry and
 * materials: never dispose what this returns, only remove it.
 */
export const createKatana = (slot: number): Group => {
  const built = build(slot);
  const group = new Group();
  group.name = `katana-${slot}`;
  group.add(mesh(built.blade, built.materials.blade, 'blade'));
  group.add(mesh(built.edge, built.materials.edge, 'edge'));
  group.add(mesh(built.guard, built.materials.guard, 'guard'));
  group.add(mesh(built.hilt, built.materials.hilt, 'hilt'));
  if (built.extra) group.add(mesh(built.extra, built.materials.extra, 'extra'));
  return group;
};

/**
 * The katana SHEATHED: its scabbard, with the guard and grip standing out of
 * the mouth. The sheath hangs from the origin DOWN -Y, so the grip sits above it.
 */
export const createSheathed = (slot: number): Group => {
  const built = build(slot);
  const group = new Group();
  group.name = `sheathed-${slot}`;
  const saya = mesh(built.saya, built.materials.saya, 'saya');
  saya.rotation.z = Math.PI;
  group.add(saya);
  const hilt = new Group();
  hilt.add(mesh(built.guard, built.materials.guard, 'guard'));
  hilt.add(mesh(built.hilt, built.materials.hilt, 'hilt'));
  hilt.rotation.z = Math.PI;
  group.add(hilt);
  return group;
};

/** An empty scabbard, worn while the katana is drawn. */
export const createSaya = (slot: number): Mesh => {
  const built = build(slot);
  const saya = mesh(built.saya, built.materials.saya, 'saya');
  saya.rotation.z = Math.PI;
  return saya;
};
