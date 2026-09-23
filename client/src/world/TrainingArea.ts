import {
  DUMMIES,
  TRAINING,
  TRAINING_TIERS,
  TRAINING_ZONES,
  canTrainOn,
  type TrainingZoneId,
} from '@katana/shared';
import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  SphereGeometry,
  TorusGeometry,
  type Material,
  type Texture,
} from 'three';
import { PALETTE } from '../config/worldVisuals.js';
import { PartBuilder } from '../render/PartBuilder.js';
import { CanvasSign } from './CanvasSign.js';
import {
  bambooClump,
  barrel,
  crate,
  fence,
  house,
  nobori,
  pagoda,
  paperLantern,
  pineTree,
  rock,
  sakuraTree,
  stoneLantern,
  sunFlag,
  torii,
  weaponRack,
} from './JapaneseProps.js';
import { LabelSprite } from './LabelSprite.js';
import { worldTextures } from './WorldTextures.js';

const T = TRAINING;
const HALF = T.dividerThickness / 2;
/** Where the back dressing bed starts (x), and the height props stand on. */
const BED_BACK = T.backX - T.backBedDepth;
const BED_Y = T.bedTop;
const FLOOR_Y = T.floorTop;
/** Centre x of the side beds, and of the back bed. */
const SIDE_X0 = T.sideBedFrom;
const BACK_X = (BED_BACK + T.backX) / 2;
const NEAR_HILL = T.hill[0];
const FAR_HILL = T.hill[1];

interface ZoneStyle {
  readonly floor: number | string;
  readonly bed: number | string;
  readonly bedTrim: number;
  readonly wall: number;
  readonly cliff: number | string;
  readonly cap: number | string;
  readonly sign: string;
  readonly stroke: string;
}

/** Each pocket's own materials, so the three read apart at a glance. */
const ZONE_STYLE: Readonly<Record<TrainingZoneId, ZoneStyle>> = {
  basic: { floor: '#e2c48c', bed: PALETTE.grass, bedTrim: 0x8a5a33, wall: 0xd8c29a, cliff: PALETTE.cliff, cap: PALETTE.cliffCap, sign: '#ffffff', stroke: '#1c2233' },
  dojo: { floor: '#d9cf8f', bed: '#cfd3d6', bedTrim: 0x5e6470, wall: 0xf4efe3, cliff: '#9aa0a8', cap: '#4fbf3a', sign: '#63ff5a', stroke: '#0f3a12' },
  cultist: { floor: '#4a1426', bed: '#2a1420', bedTrim: 0x7a0f1a, wall: 0x3a1024, cliff: '#3b2338', cap: '#b3263a', sign: '#ff3b3b', stroke: '#2a0008' },
};

/** One pocket's footprint: its centre and the inner faces of its walls. */
interface Pocket {
  readonly cz: number;
  readonly z0: number;
  readonly z1: number;
}

interface DummyView {
  readonly tier: number;
  readonly group: Group;
  readonly label: LabelSprite;
  wobble: number;
}

/**
 * THE TRAINING AREA, right at the spawn's left: three SMALL, crammed pocket
 * biomes side by side, open toward the spawn, each walled low and closed in
 * behind by a stepped hill. A U of raised dressing beds (back and both sides)
 * is packed with the pocket's own scenery around a little floor with its two
 * dummies, so almost no ground is bare -
 *
 *   BASIC   : a beginner's yard - sand floor, grass beds, a fence, hay bales,
 *             an archery target, a bokken rack, orange boulders, bushes;
 *   DOJO    : tatami before a glowing blue waterfall under a red torii, stone
 *             lanterns, sakura, a taiko drum, banners, a dojo hall above;
 *   CULTIST : crimson stone under a burning rune circle, a black shrine gate,
 *             red crystals, a bone skull, skull piles, candles, a dead tree
 *             hung with lanterns, a red pagoda on the dark crag above.
 *
 * Each dummy carries a floating label: its multiplier, and whether it is
 * locked (and by how many rebirths), in training, or mastered.
 */
export class TrainingArea {
  readonly root = new Group();
  private readonly dummies: DummyView[] = [];
  private readonly signs: CanvasSign[] = [];
  private readonly materials: Material[] = [];
  private readonly textures: Texture[] = [];
  private readonly spinners: Mesh[] = [];
  private waterfall: Texture | null = null;
  private time = 0;
  private signature = '';

  constructor() {
    this.buildShell();
    for (const zone of T.zones) this.buildZone(zone.id, pocketOf(zone));
    this.buildDummies();
  }

  /** The far hill, the low walls between the pockets and their lantern posts. */
  private buildShell(): void {
    const b = new PartBuilder();
    const minZ = T.zones[2]!.minZ - HALF;
    const maxZ = T.zones[0]!.maxZ + HALF;
    const hillW = maxZ - minZ;
    // The far step: one tall terrace behind all three, pines along its top.
    const farW = FAR_HILL.maxX - FAR_HILL.minX;
    const farX = (FAR_HILL.minX + FAR_HILL.maxX) / 2;
    b.box(farW, FAR_HILL.top, hillW, PALETTE.cliffDark, 'stud', { x: farX, y: FAR_HILL.top / 2 - 1, z: (minZ + maxZ) / 2 });
    b.box(farW, 1, hillW, PALETTE.cliffCap, 'stud', { x: farX, y: FAR_HILL.top - 0.5, z: (minZ + maxZ) / 2 });
    for (let z = minZ + 4; z < maxZ - 2; z += 9) pineTree(b, FAR_HILL.minX + 6 + ((z * 7) % 5), FAR_HILL.top, z, 1.1);

    // The low walls, exactly the solids (x frontX..backX, the divider's thickness):
    // a stone footing, plaster above it, a tiled cap on top. Every piece meets the
    // next edge to edge - none shares a face with a floor, a bed or the hill.
    const bounds = [T.zones[2]!.minZ, T.zones[1]!.minZ, T.zones[1]!.maxZ, T.zones[0]!.maxZ];
    const footTop = 1;
    const capBottom = T.wallHeight - 0.4;
    bounds.forEach((z, i) => {
      const style = ZONE_STYLE[(i <= 1 ? 'cultist' : i === 2 ? 'dojo' : 'basic') as TrainingZoneId];
      slab(b, T.frontX, T.backX, -1, footTop, z - HALF, z + HALF, PALETTE.stoneDark, 'stud');
      slab(b, T.frontX, T.backX, footTop, capBottom, z - HALF, z + HALF, style.wall, 'smooth');
      slab(b, T.frontX, T.backX, capBottom, T.wallHeight, z - HALF, z + HALF, PALETTE.roof, 'stud');
      // A lit paper lantern standing on the cap's front end.
      slab(b, T.frontX, T.frontX + 0.7, T.wallHeight, T.wallHeight + 0.5, z - 0.35, z + 0.35, PALETTE.woodDark, 'smooth');
      paperLantern(b, T.frontX + 0.35, T.wallHeight + 1.05, z, 0.95, i <= 1 ? 0xff3b3b : PALETTE.lanternGlow);
    });
    this.root.add(b.build('training-shell'));
  }

  private buildZone(id: TrainingZoneId, pocket: Pocket): void {
    const style = ZONE_STYLE[id];
    const b = new PartBuilder();

    // The floor and the U of dressing beds, laid edge to edge with no two pieces
    // overlapping: the floor fills only what the beds and their trims leave.
    const W = T.sideBedWidth;
    const TRIM = 0.3;
    const bedFront = BED_BACK - TRIM;
    const floorPiece = (x0: number, x1: number, z0: number, z1: number): void => {
      if (id !== 'dojo') {
        slab(b, x0, x1, -1, FLOOR_Y, z0, z1, style.floor, 'stud');
        return;
      }
      // The dojo lays tatami.
      const tatami = new MeshLambertMaterial({ map: worldTextures.tatami() });
      this.materials.push(tatami);
      const geometry = new BoxGeometry(x1 - x0, FLOOR_Y + 1, z1 - z0);
      const uv = geometry.getAttribute('uv');
      for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) * ((x1 - x0) / 6), uv.getY(i) * ((z1 - z0) / 3));
      const floor = new Mesh(geometry, tatami);
      floor.position.set((x0 + x1) / 2, (FLOOR_Y - 1) / 2, (z0 + z1) / 2);
      floor.receiveShadow = true;
      this.root.add(floor);
    };
    floorPiece(T.frontX, bedFront, pocket.z0 + W, pocket.z1 - W);
    floorPiece(T.frontX, SIDE_X0 - TRIM, pocket.z0, pocket.z0 + W);
    floorPiece(T.frontX, SIDE_X0 - TRIM, pocket.z1 - W, pocket.z1);
    // Back bed and its front trim.
    slab(b, BED_BACK, T.backX, -1, BED_Y, pocket.z0, pocket.z1, style.bed, 'stud');
    slab(b, bedFront, BED_BACK, -1, BED_Y + 0.1, pocket.z0, pocket.z1, style.bedTrim, 'smooth');
    // Side beds: the bed, its inner trim, its front trim.
    for (const side of [0, 1]) {
      const outer = side === 0 ? pocket.z0 : pocket.z1 - W;
      const bedZ0 = side === 0 ? outer : outer + TRIM;
      const bedZ1 = side === 0 ? outer + W - TRIM : outer + W;
      const trimZ0 = side === 0 ? outer + W - TRIM : outer;
      slab(b, SIDE_X0, bedFront, -1, BED_Y, bedZ0, bedZ1, style.bed, 'stud');
      slab(b, SIDE_X0, bedFront, -1, BED_Y + 0.1, trimZ0, trimZ0 + TRIM, style.bedTrim, 'smooth');
      slab(b, SIDE_X0 - TRIM, SIDE_X0, -1, BED_Y + 0.1, outer, outer + W, style.bedTrim, 'smooth');
    }

    // The near step of the hill behind, in the pocket's own rock.
    const z0 = id === 'cultist' ? pocket.z0 - HALF * 2 : pocket.z0 - HALF;
    const z1 = id === 'basic' ? pocket.z1 + HALF * 2 : pocket.z1 + HALF;
    const nearW = NEAR_HILL.maxX - NEAR_HILL.minX;
    const nearX = (NEAR_HILL.minX + NEAR_HILL.maxX) / 2;
    b.box(nearW, NEAR_HILL.top, z1 - z0, style.cliff, 'stud', { x: nearX, y: NEAR_HILL.top / 2 - 1, z: (z0 + z1) / 2 });
    b.box(nearW, 1, z1 - z0, style.cap, 'stud', { x: nearX, y: NEAR_HILL.top - 0.5, z: (z0 + z1) / 2 });

    switch (id) {
      case 'basic':
        this.dressBasic(b, pocket);
        break;
      case 'dojo':
        this.dressDojo(b, pocket);
        break;
      case 'cultist':
        this.dressCultist(b, pocket);
        break;
    }
    this.root.add(b.build(`zone-${id}`));

    const meta = TRAINING_ZONES.find((entry) => entry.id === id)!;
    const sign = new CanvasSign(12, 2.5, [{ text: meta.name, size: 1, fill: style.sign, stroke: style.stroke, strokeWidth: 0.2 }]);
    sign.mesh.position.set(NEAR_HILL.minX - 0.4, NEAR_HILL.top + 5, pocket.cz);
    sign.mesh.rotation.y = -Math.PI / 2;
    this.root.add(sign.mesh);
    this.signs.push(sign);
  }

  /** BASIC: a beginner samurai's practice yard. */
  private dressBasic(b: PartBuilder, p: Pocket): void {
    const { cz } = p;
    // Straw mats under the dummies.
    for (const dummy of DUMMIES.filter((entry) => entry.tier <= 1)) {
      b.box(3.2, 0.1, 3.2, 0xc9a36a, 'stud', { x: dummy.x, y: FLOOR_Y + 0.05, z: dummy.z });
    }
    // Back bed: a fence, an archery target, hay bales, a bokken rack, boulders, a pine.
    fence(b, T.backX - 0.4, p.z0 + 0.4, T.backX - 0.4, p.z1 - 0.4, BED_Y);
    for (let i = 0; i < 2; i += 1) b.box(0.25, 3, 0.25, PALETTE.woodDark, 'smooth', { x: BACK_X + 0.6, y: BED_Y + 1.5, z: cz + (i ? 1 : -1) });
    b.box(0.3, 0.3, 2.4, PALETTE.woodDark, 'smooth', { x: BACK_X + 0.6, y: BED_Y + 1.2, z: cz });
    for (const [r, color] of [[1.3, 0xffffff], [1.0, 0xe0342b], [0.65, 0xffffff], [0.32, 0xe0342b]] as const) {
      b.add(new CylinderGeometry(r, r, 0.2 + (1.3 - r) * 0.08, 18), color, 'smooth', { x: BACK_X + 0.4 - (1.3 - r) * 0.08, y: BED_Y + 2.7, z: cz, rz: Math.PI / 2 });
    }
    for (const [dz, dy] of [[-3.2, 0.7], [-4.8, 0.7], [-4, 1.95]] as const) {
      b.add(new CylinderGeometry(0.7, 0.7, 1.5, 10), 0xe8c86a, 'smooth', { x: BACK_X, y: BED_Y + dy, z: cz + dz, rx: Math.PI / 2 });
      b.add(new TorusGeometry(0.7, 0.05, 4, 12), 0x8a5a33, 'smooth', { x: BACK_X, y: BED_Y + dy, z: cz + dz });
    }
    weaponRack(b, BACK_X + 0.4, BED_Y, cz + 3.4, Math.PI / 2);
    pineTree(b, BACK_X, BED_Y, cz + 5.8, 0.42);
    orangeBoulders(b, BACK_X - 0.2, BED_Y, cz - 5.6, 1);
    // Side beds: bushes, crates, barrels, a rock, bamboo, stone lanterns at the front.
    const left = p.z0 + T.sideBedWidth / 2;
    const right = p.z1 - T.sideBedWidth / 2;
    bush(b, 29.6, BED_Y, left, 1);
    crate(b, 27.6, BED_Y, left, 0.9, 0.3);
    crate(b, 27.7, BED_Y + 1.44, left, 0.6, 0.9);
    stoneLantern(b, 25.4, BED_Y, left, 0.62);
    rock(b, 29.8, BED_Y, right, 0.55, 0.6);
    barrel(b, 27.8, BED_Y, right - 0.2, 0.8);
    barrel(b, 26.9, BED_Y, right + 0.35, 0.6);
    stoneLantern(b, 25.4, BED_Y, right, 0.62);
    // The entrance: a plain timber arch with a hanging plaque, a water bucket and a practice post by it.
    const gx = T.frontX + 1.2;
    for (const z of [p.z0 + 0.35, p.z1 - 0.35]) b.box(0.5, 9.4, 0.5, PALETTE.wood, 'smooth', { x: gx, y: FLOOR_Y + 4.7, z });
    b.box(0.6, 0.55, p.z1 - p.z0 + 1.2, PALETTE.wood, 'smooth', { x: gx, y: FLOOR_Y + 9.5, z: cz });
    b.box(0.5, 0.4, p.z1 - p.z0, PALETTE.woodDark, 'smooth', { x: gx, y: FLOOR_Y + 8.6, z: cz });
    b.box(0.2, 1.3, 3.6, 0xf2d7a0, 'smooth', { x: gx - 0.3, y: FLOOR_Y + 8.8, z: cz });
    b.box(0.22, 0.9, 3, 0x3a2a1c, 'smooth', { x: gx - 0.34, y: FLOOR_Y + 8.8, z: cz });
    b.add(new CylinderGeometry(0.45, 0.38, 0.7, 10), 0x8a5a33, 'smooth', { x: T.frontX + 2.5, y: FLOOR_Y + 0.35, z: p.z0 + 0.9 });
    b.add(new CylinderGeometry(0.38, 0.38, 0.05, 10), PALETTE.water, 'smooth', { x: T.frontX + 2.5, y: FLOOR_Y + 0.73, z: p.z0 + 0.9 });
    b.box(0.5, 2.6, 0.5, 0xa87a4a, 'smooth', { x: T.frontX + 2.5, y: FLOOR_Y + 1.3, z: p.z1 - 0.9 });
    for (const y of [0.9, 1.7]) b.box(0.6, 0.12, 0.6, 0x5e3b20, 'smooth', { x: T.frontX + 2.5, y: FLOOR_Y + y, z: p.z1 - 0.9 });
    // Raked lines in the sand.
    for (let i = 0; i < 4; i += 1) b.box(0.12, 0.04, 3.6, 0xcfae72, 'smooth', { x: 22.4 + i * 0.5, y: FLOOR_Y + 0.02, z: cz });
    // Bunting strung between the side walls above the yard.
    bunting(b, BED_BACK - 0.5, p.z0 - HALF, p.z1 + HALF, T.wallHeight + 2.6);
    // On the near step: a practice shed, pines, bushes and more boulders.
    const top = NEAR_HILL.top;
    house(b, 40, top, cz + 1.5, 7, 5, 3.6, -Math.PI / 2);
    pineTree(b, 37, top, cz - 5, 0.75);
    pineTree(b, 42, top, cz - 6.2, 0.6);
    bush(b, 36.2, top, cz + 6, 1.4);
    orangeBoulders(b, 36, top, cz - 1.8, 1.2);
    bambooClump(b, 42.6, top, cz + 6.5, 4, 7, 3);
  }

  /** DOJO: tatami before a glowing waterfall under a red torii. */
  private dressDojo(b: PartBuilder, p: Pocket): void {
    const { cz } = p;
    // The waterfall down the hill face, into a glowing pool on the back bed.
    const texture = waterfallTexture();
    this.textures.push(texture);
    this.waterfall = texture;
    const falls = new MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.95 });
    this.materials.push(falls);
    const fallH = NEAR_HILL.top - BED_Y + 0.4;
    const panel = new Mesh(new PlaneGeometry(4.6, fallH), falls);
    panel.position.set(T.backX - 0.2, BED_Y + fallH / 2, cz);
    panel.rotation.y = -Math.PI / 2;
    this.root.add(panel);
    b.box(2.4, 0.2, 5.2, 0x4fd6ff, 'glow', { x: BACK_X + 0.3, y: BED_Y + 0.1, z: cz });
    b.box(2.8, 0.4, 0.5, PALETTE.stoneDark, 'stud', { x: BACK_X + 0.2, y: BED_Y + 0.2, z: cz - 2.9 });
    b.box(2.8, 0.4, 0.5, PALETTE.stoneDark, 'stud', { x: BACK_X + 0.2, y: BED_Y + 0.2, z: cz + 2.9 });
    b.box(1.6, 0.8, 6, PALETTE.stone, 'stud', { x: T.backX + 0.6, y: NEAR_HILL.top + 0.4, z: cz });
    torii(b, BED_BACK + 1.1, BED_Y, cz, 6.6, 7.4, Math.PI / 2);
    rock(b, BACK_X + 0.5, BED_Y, cz - 4.1, 0.55, 0.3);
    rock(b, BACK_X + 0.5, BED_Y, cz + 4.1, 0.5, 1.2);
    sakuraTree(b, BACK_X, BED_Y, cz - 6, 0.55, 2);
    pineTree(b, BACK_X, BED_Y, cz + 5.8, 0.42);
    // Side beds: stone lanterns, clipped hedges, a sun flag, a taiko drum, banners.
    const left = p.z0 + T.sideBedWidth / 2;
    const right = p.z1 - T.sideBedWidth / 2;
    stoneLantern(b, 25.4, BED_Y, left, 0.7);
    hedge(b, 27.6, BED_Y, left);
    sunFlag(b, 29.7, BED_Y, left, -Math.PI / 2);
    stoneLantern(b, 25.4, BED_Y, right, 0.7);
    taiko(b, 27.7, BED_Y, right);
    nobori(b, 29.8, BED_Y, right + 0.3, 0xf4efe3, Math.PI / 2);
    nobori(b, 29.8, BED_Y, right - 0.5, PALETTE.vermilion, Math.PI / 2);
    // The entrance: a little tiled gateway roof with white noren curtains to pass under.
    const gx = T.frontX + 1.2;
    for (const z of [p.z0 + 0.35, p.z1 - 0.35]) b.box(0.55, 9.2, 0.55, 0x3a2a1c, 'smooth', { x: gx, y: FLOOR_Y + 4.6, z });
    b.box(0.5, 0.4, p.z1 - p.z0, 0x3a2a1c, 'smooth', { x: gx, y: FLOOR_Y + 9, z: cz });
    for (const side of [-1, 1]) b.box(1.5, 0.35, p.z1 - p.z0 + 1.2, PALETTE.roof, 'stud', { x: gx + side * 0.6, y: FLOOR_Y + 9.5, z: cz, rz: side * 0.35 });
    b.box(0.3, 0.3, p.z1 - p.z0 + 1.3, PALETTE.roofEdge, 'smooth', { x: gx, y: FLOOR_Y + 9.85, z: cz });
    for (let i = -3; i <= 3; i += 1) {
      if (i === 0) continue;
      b.box(0.06, 1.3, 1.6, i % 2 ? 0xf4efe3 : 0xe8e0cc, 'smooth', { x: gx - 0.25, y: FLOOR_Y + 8.15, z: cz + i * 1.75 });
    }
    b.add(new CylinderGeometry(0.38, 0.38, 0.06, 16), PALETTE.vermilion, 'smooth', { x: gx - 0.3, y: FLOOR_Y + 8.2, z: cz, rz: Math.PI / 2 });
    // A bonsai by the door, and a rack of wooden sandals.
    b.box(1, 0.6, 1, 0x3a4a66, 'smooth', { x: T.frontX + 2.5, y: FLOOR_Y + 0.3, z: p.z0 + 0.9 });
    b.box(0.2, 0.8, 0.2, PALETTE.trunk, 'smooth', { x: T.frontX + 2.5, y: FLOOR_Y + 1, z: p.z0 + 0.9, rz: 0.3 });
    b.box(1.3, 0.5, 1.1, PALETTE.pine, 'stud', { x: T.frontX + 2.4, y: FLOOR_Y + 1.5, z: p.z0 + 1 });
    b.box(0.8, 0.9, 1.4, PALETTE.wood, 'smooth', { x: T.frontX + 2.5, y: FLOOR_Y + 0.45, z: p.z1 - 1 });
    for (const [dz, c] of [[-0.35, 0xa81f1c], [0.35, 0x2b3448]] as const) b.box(0.6, 0.12, 0.35, c, 'smooth', { x: T.frontX + 2.5, y: FLOOR_Y + 0.96, z: p.z1 - 1 + dz });
    // The dojo hall on the step above, sakura and a pine either side of the falls.
    const top = NEAR_HILL.top;
    house(b, 40.6, top, cz, 6.4, 5.4, 4, -Math.PI / 2, 0x22252e);
    sakuraTree(b, 36.4, top, cz - 5.2, 0.8, 1);
    pineTree(b, 36.4, top, cz + 5.4, 0.7);
    lampPostGlow(b, 35.4, top, cz - 2.4);
    lampPostGlow(b, 35.4, top, cz + 2.4);
  }

  /** CULTIST: a dark shrine of red crystals, bones and candles. */
  private dressCultist(b: PartBuilder, p: Pocket): void {
    const { cz } = p;
    const runes = new MeshBasicMaterial({ map: worldTextures.runeCircle('#ff4d6d'), transparent: true, blending: AdditiveBlending, depthWrite: false });
    this.materials.push(runes);
    const circle = new Mesh(new PlaneGeometry(10, 10), runes);
    circle.rotation.x = -Math.PI / 2;
    circle.position.set(T.dummyX - 0.4, FLOOR_Y + 0.04, cz);
    this.root.add(circle);
    this.spinners.push(circle);
    // Back bed: the black shrine gate, a skull, crystals, a burning brazier.
    for (const side of [-1, 1]) {
      b.box(0.6, 7, 0.6, 0x1a1016, 'smooth', { x: BED_BACK + 1, y: BED_Y + 3.5, z: cz + side * 2.6 });
      for (const y of [2.2, 3.6, 5]) b.box(0.05, 0.9, 0.35, 0xff3b3b, 'glow', { x: BED_BACK + 0.68, y: BED_Y + y, z: cz + side * 2.6 });
    }
    b.box(0.7, 0.5, 7.2, 0x1a1016, 'smooth', { x: BED_BACK + 1, y: BED_Y + 7, z: cz, rx: 0 });
    b.box(0.8, 0.4, 7.8, 0x7a0f1a, 'smooth', { x: BED_BACK + 1, y: BED_Y + 7.4, z: cz });
    b.box(0.5, 0.4, 5.2, 0x1a1016, 'smooth', { x: BED_BACK + 1, y: BED_Y + 5.6, z: cz });
    // The shimenawa rope with its paper streamers.
    b.add(new CylinderGeometry(0.16, 0.16, 5.2, 8), 0xe8d9a8, 'smooth', { x: BED_BACK + 0.9, y: BED_Y + 5.1, z: cz, rx: Math.PI / 2 });
    for (let i = -2; i <= 2; i += 1) b.box(0.05, 0.7, 0.25, 0xf4efe3, 'smooth', { x: BED_BACK + 0.85, y: BED_Y + 4.6, z: cz + i * 0.9 });
    brazier(b, BACK_X + 0.3, BED_Y, cz);
    skull(b, BACK_X, BED_Y, cz - 5.3, 0.65);
    crystals(b, BACK_X + 0.2, BED_Y, cz + 5.4, 1);
    crystals(b, BACK_X + 0.6, BED_Y, cz - 2.8, 0.6);
    crystals(b, BACK_X + 0.6, BED_Y, cz + 3, 0.55);
    // Side beds: skull piles, candles, a dead tree hung with lanterns, dark banners.
    const left = p.z0 + T.sideBedWidth / 2;
    const right = p.z1 - T.sideBedWidth / 2;
    skullPile(b, 29.6, BED_Y, left);
    candles(b, 27.4, BED_Y, left);
    crystals(b, 25.4, BED_Y, left, 0.5);
    deadTree(b, 29.4, BED_Y, right);
    nobori(b, 27.4, BED_Y, right, 0x2a0a14, Math.PI / 2);
    candles(b, 25.4, BED_Y, right);
    // Orbs of red fire hanging over the pocket.
    for (const [x, y, z] of [[28.5, 7.2, cz - 4.2], [30, 8, cz + 3.8], [26, 6.6, cz + 0.4]] as const) {
      b.add(new SphereGeometry(0.4, 10, 8), 0xff3b5c, 'glow', { x, y, z });
      b.add(new SphereGeometry(0.62, 10, 8), 0x7a0f1a, 'glow', { x, y, z, sx: 1, sy: 1, sz: 1 });
    }
    // The entrance: a black torii hung with a rope of talismans, skulls and candles at its feet.
    const gx = T.frontX + 1.2;
    for (const z of [p.z0 + 0.5, p.z1 - 0.5]) {
      b.box(0.6, 9.6, 0.6, 0x14090d, 'smooth', { x: gx, y: FLOOR_Y + 4.8, z });
      b.box(0.9, 0.5, 0.9, 0x7a0f1a, 'smooth', { x: gx, y: FLOOR_Y + 0.25, z });
    }
    b.box(0.7, 0.5, p.z1 - p.z0 + 1.2, 0x14090d, 'smooth', { x: gx, y: FLOOR_Y + 9.7, z: cz });
    b.box(0.8, 0.3, p.z1 - p.z0 + 1.3, 0x7a0f1a, 'smooth', { x: gx, y: FLOOR_Y + 10.1, z: cz });
    b.box(0.5, 0.35, p.z1 - p.z0, 0x14090d, 'smooth', { x: gx, y: FLOOR_Y + 8.6, z: cz });
    b.add(new CylinderGeometry(0.14, 0.14, p.z1 - p.z0 - 1, 8), 0xe8d9a8, 'smooth', { x: gx - 0.3, y: FLOOR_Y + 8.2, z: cz, rx: Math.PI / 2 });
    for (let i = -5; i <= 5; i += 1) b.box(0.05, 0.8, 0.28, i % 2 ? 0xff3b3b : 0xf4efe3, i % 2 ? 'glow' : 'smooth', { x: gx - 0.35, y: FLOOR_Y + 7.7, z: cz + i * 1.2 });
    skullPile(b, T.frontX + 2.5, FLOOR_Y, p.z0 + 1);
    candles(b, T.frontX + 2.5, FLOOR_Y, p.z1 - 1);
    // The dark crag above: a red pagoda, crystal spires, dead trees, glowing cracks.
    const top = NEAR_HILL.top;
    pagoda(b, 39.5, top, cz + 0.8, 0.42);
    crystals(b, 36, top, cz - 5, 1.6);
    crystals(b, 42.5, top, cz + 6, 1.2);
    deadTree(b, 36.2, top, cz + 5.6);
    for (const [y, z, h] of [[3, cz - 4.5, 3], [6, cz + 4, 2.2], [4.5, cz - 1, 2.6]] as const) {
      b.box(0.1, h, 0.35, 0xff2e4a, 'glow', { x: T.backX - 0.12, y: BED_Y + y, z, rx: 0.3 });
    }
  }

  private buildDummies(): void {
    for (const dummy of DUMMIES) {
      const b = new PartBuilder();
      buildDummy(b, dummy.tier);
      const group = b.build(`dummy-${dummy.tier}`);
      group.position.set(dummy.x, FLOOR_Y, dummy.z);
      // Face the spawn (-X).
      group.rotation.y = -Math.PI / 2;
      this.root.add(group);
      // Right above its own dummy: a tag, not a sign on the roof.
      const label = new LabelSprite(4.4, 1.95);
      label.sprite.position.set(dummy.x, FLOOR_Y + (DUMMY_TOPS[dummy.tier] ?? 4.5) + 1.25, dummy.z);
      this.root.add(label.sprite);
      this.dummies.push({ tier: dummy.tier, group, label, wobble: 0 });
    }
  }

  /** Relabel the dummies for this player's rebirths and training. Cheap when unchanged. */
  setProgress(rebirths: number, trainingTier: number, hits: ArrayLike<number>): void {
    const signature = `${rebirths}:${trainingTier}:${Array.from(hits).join(',')}`;
    if (signature === this.signature) return;
    this.signature = signature;
    for (const view of this.dummies) {
      const tier = TRAINING_TIERS[view.tier]!;
      const locked = !canTrainOn(tier.tier, rebirths);
      const mastered = trainingTier >= tier.tier;
      const status = locked
        ? { text: `LOCKED - ${tier.rebirthsRequired} REBIRTH${tier.rebirthsRequired === 1 ? '' : 'S'}`, color: '#ff7a6a' }
        : mastered
          ? { text: trainingTier === tier.tier ? 'ACTIVE' : 'MASTERED', color: '#7dff6a' }
          : { text: `TRAIN ${hits[tier.tier] ?? 0} / ${tier.hitsToMaster}`, color: '#ffd93d' };
      view.label.set([
        { text: `x${tier.multiplier} DAMAGE`, color: '#ffffff', size: 1.2 },
        { ...status, size: 0.9 },
      ]);
    }
  }

  /** A dummy took a hit: it rocks on its post. */
  hit(tier: number): void {
    const view = this.dummies.find((entry) => entry.tier === tier);
    if (view) view.wobble = 1;
  }

  update(delta: number): void {
    this.time += delta;
    for (const view of this.dummies) {
      if (view.wobble <= 0) continue;
      view.wobble = Math.max(0, view.wobble - delta * 3);
      view.group.rotation.z = Math.sin(this.time * 30) * 0.12 * view.wobble;
    }
    for (const spinner of this.spinners) spinner.rotation.z += delta * 0.3;
    if (this.waterfall) this.waterfall.offset.y = (this.waterfall.offset.y + delta * 0.9) % 1;
  }

  dispose(): void {
    for (const view of this.dummies) view.label.dispose();
    for (const sign of this.signs) sign.dispose();
    for (const material of this.materials) material.dispose();
    for (const texture of this.textures) texture.dispose();
    this.root.removeFromParent();
  }
}

/** How tall each dummy stands, so its tag sits just over its head. */
const DUMMY_TOPS: readonly number[] = [4.3, 4.4, 4.2, 4.6, 4.6, 6.3];

const pocketOf = (zone: { readonly minZ: number; readonly maxZ: number }): Pocket => ({
  cz: (zone.minZ + zone.maxZ) / 2,
  z0: zone.minZ + HALF,
  z1: zone.maxZ - HALF,
});

// ------------------------------------------------------------ small props

/** A box given by its extents. */
const slab = (b: PartBuilder, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, color: number | string, kind: 'stud' | 'smooth' | 'glow'): void => {
  b.box(x1 - x0, y1 - y0, z1 - z0, color, kind, { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2 });
};

/** A round studded bush. */
const bush = (b: PartBuilder, x: number, y: number, z: number, s: number): void => {
  b.box(1.8 * s, 1.2 * s, 1.8 * s, PALETTE.pine, 'stud', { x, y: y + 0.6 * s, z });
  b.box(1.2 * s, 0.8 * s, 1.2 * s, PALETTE.grassDark, 'stud', { x: x + 0.3 * s, y: y + 1.4 * s, z: z - 0.2 * s, ry: 0.4 });
};

/** A clipped box hedge. */
const hedge = (b: PartBuilder, x: number, y: number, z: number): void => {
  b.box(2.2, 1.1, 1.6, 0x3f9a3a, 'stud', { x, y: y + 0.55, z });
  b.box(1.4, 0.7, 1.1, 0x57b84a, 'stud', { x, y: y + 1.45, z });
};

/** A heap of blocky orange boulders, as in the reference's beginner yard. */
const orangeBoulders = (b: PartBuilder, x: number, y: number, z: number, s: number): void => {
  b.box(2.2 * s, 1.4 * s, 1.8 * s, 0xd9772e, 'stud', { x, y: y + 0.7 * s, z, ry: 0.3 });
  b.box(1.5 * s, 1.1 * s, 1.4 * s, 0xe89a4a, 'stud', { x: x + 0.3 * s, y: y + 1.9 * s, z: z + 0.2 * s, ry: -0.4 });
  b.box(1.1 * s, 0.9 * s, 1 * s, 0xc4622a, 'stud', { x: x - 0.4 * s, y: y + 0.45 * s, z: z + 1.3 * s, ry: 0.8 });
};

/** Triangle pennants strung along z. */
const bunting = (b: PartBuilder, x: number, z0: number, z1: number, y: number): void => {
  const length = z1 - z0;
  b.box(0.06, 0.06, length, 0x3a2a1c, 'smooth', { x, y, z: (z0 + z1) / 2 });
  const colors = [0xe0342b, 0xffffff, 0xf2c14e, 0x3fa9f5];
  let i = 0;
  for (let z = z0 + 1; z < z1 - 0.5; z += 1.1, i += 1) {
    b.add(new ConeGeometry(0.32, 0.8, 3), colors[i % colors.length]!, 'smooth', { x, y: y - 0.45 - Math.sin((z - z0) / length * Math.PI) * 0.5, z, rx: Math.PI });
  }
};

/** A taiko drum on its stand, its skin toward the spawn. */
const taiko = (b: PartBuilder, x: number, y: number, z: number): void => {
  b.box(1.4, 0.9, 0.3, PALETTE.woodDark, 'smooth', { x, y: y + 0.45, z: z - 0.6 });
  b.box(1.4, 0.9, 0.3, PALETTE.woodDark, 'smooth', { x, y: y + 0.45, z: z + 0.6 });
  b.add(new CylinderGeometry(0.85, 0.85, 1.2, 16), 0xa81f1c, 'smooth', { x, y: y + 1.6, z, rz: Math.PI / 2 });
  for (const side of [-1, 1]) b.add(new CylinderGeometry(0.8, 0.8, 0.06, 16), 0xf4e6c4, 'smooth', { x: x + side * 0.62, y: y + 1.6, z, rz: Math.PI / 2 });
};

/** A lamp post with a warm yellow lantern. */
const lampPostGlow = (b: PartBuilder, x: number, y: number, z: number): void => {
  b.add(new CylinderGeometry(0.12, 0.15, 3.4, 8), 0x3a2a1c, 'smooth', { x, y: y + 1.7, z });
  b.box(0.8, 0.9, 0.8, 0xffe066, 'glow', { x, y: y + 3.8, z });
  b.add(new ConeGeometry(0.75, 0.5, 4), 0x2b2f3d, 'smooth', { x, y: y + 4.5, z, ry: Math.PI / 4 });
};

/** A cluster of glowing red crystal shards. */
const crystals = (b: PartBuilder, x: number, y: number, z: number, s: number): void => {
  b.add(new ConeGeometry(0.7 * s, 3.6 * s, 5), 0xff2e4a, 'glow', { x, y: y + 1.8 * s, z });
  b.add(new ConeGeometry(0.45 * s, 2.4 * s, 5), 0xff6a86, 'glow', { x: x + 0.6 * s, y: y + 1 * s, z: z + 0.4 * s, rz: -0.45 });
  b.add(new ConeGeometry(0.4 * s, 2 * s, 5), 0xd41a3a, 'glow', { x: x - 0.5 * s, y: y + 0.85 * s, z: z - 0.5 * s, rx: 0.45 });
  b.add(new DodecahedronGeometry(0.6 * s), 0x2a1420, 'stud', { x, y: y + 0.2 * s, z });
};

/** A great horned bone skull. */
const skull = (b: PartBuilder, x: number, y: number, z: number, s: number): void => {
  b.add(new SphereGeometry(2 * s, 12, 10), 0xf1ecdc, 'smooth', { x, y: y + 1.8 * s, z, sz: 1.2 });
  b.box(1.6 * s, 1 * s, 2.4 * s, 0xe6dfcb, 'smooth', { x: x - 1.6 * s, y: y + 1.1 * s, z });
  for (const side of [-1, 1]) {
    b.add(new SphereGeometry(0.5 * s, 8, 6), 0x1a1016, 'smooth', { x: x - 1.5 * s, y: y + 2.2 * s, z: z + side * 0.85 * s });
    b.add(new SphereGeometry(0.2 * s, 6, 5), 0xff2e4a, 'glow', { x: x - 1.8 * s, y: y + 2.2 * s, z: z + side * 0.85 * s });
    b.add(new ConeGeometry(0.4 * s, 2.8 * s, 6), 0xf1ecdc, 'smooth', { x, y: y + 3.6 * s, z: z + side * 1.6 * s, rx: side * 0.6 });
  }
};

/** A pile of little skulls. */
const skullPile = (b: PartBuilder, x: number, y: number, z: number): void => {
  for (const [dx, dy, dz] of [[0, 0.35, -0.5], [0.1, 0.35, 0.5], [-0.3, 0.35, 0], [0, 0.95, 0]] as const) {
    b.add(new SphereGeometry(0.42, 8, 6), 0xefe8d4, 'smooth', { x: x + dx, y: y + dy, z: z + dz });
    for (const side of [-1, 1]) b.add(new SphereGeometry(0.1, 5, 4), 0x1a1016, 'smooth', { x: x + dx - 0.36, y: y + dy + 0.06, z: z + dz + side * 0.15 });
  }
};

/** Squat candles, lit. */
const candles = (b: PartBuilder, x: number, y: number, z: number): void => {
  for (const [dx, dz, h] of [[0, 0, 0.9], [0.4, 0.5, 0.6], [-0.3, -0.5, 0.7], [0.35, -0.35, 0.45]] as const) {
    b.add(new CylinderGeometry(0.16, 0.16, h, 8), 0xefe3c4, 'smooth', { x: x + dx, y: y + h / 2, z: z + dz });
    b.add(new ConeGeometry(0.1, 0.28, 6), 0xffb03a, 'glow', { x: x + dx, y: y + h + 0.14, z: z + dz });
  }
};

/** A leafless black tree hung with red paper lanterns. */
const deadTree = (b: PartBuilder, x: number, y: number, z: number): void => {
  b.box(0.6, 4.4, 0.6, 0x1f1418, 'smooth', { x, y: y + 2.2, z });
  for (const [dz, dy, r, len] of [[0.9, 3.8, -0.8, 2.2], [-0.8, 4.2, 0.7, 2], [0.3, 4.8, -0.3, 1.6]] as const) {
    b.box(0.25, len, 0.25, 0x1f1418, 'smooth', { x, y: y + dy, z: z + dz, rx: r });
    paperLantern(b, x, y + dy - 0.6, z + dz * 1.8, 0.5, 0xff3b3b);
  }
};

/** A stone brazier with a column of fire. */
const brazier = (b: PartBuilder, x: number, y: number, z: number): void => {
  b.box(1.2, 0.8, 1.2, 0x2a1420, 'stud', { x, y: y + 0.4, z });
  b.add(new CylinderGeometry(0.9, 0.6, 0.6, 8), 0x1a1016, 'smooth', { x, y: y + 1.1, z });
  b.add(new ConeGeometry(0.6, 1.8, 7), 0xff5a2e, 'glow', { x, y: y + 2.2, z });
  b.add(new ConeGeometry(0.35, 1.2, 7), 0xffd23a, 'glow', { x, y: y + 2, z });
};

/** Falling water: bright streaks on blue, scrolled down in `update`. */
const waterfallTexture = (): CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#39c6ff';
  ctx.fillRect(0, 0, 64, 128);
  let seed = 7;
  const rand = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 26; i += 1) {
    ctx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,0.85)' : 'rgba(170,236,255,0.8)';
    ctx.fillRect(Math.floor(rand() * 60), Math.floor(rand() * 128), 2 + Math.floor(rand() * 3), 10 + Math.floor(rand() * 26));
  }
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(1, 2);
  texture.colorSpace = SRGBColorSpace;
  return texture;
};

/** Six dummies, each unmistakably its tier. Built facing +Z, turned to face the spawn. */
const buildDummy = (b: PartBuilder, tier: number): void => {
  switch (tier) {
    case 0: // Straw Dummy: a straw bundle on a post, arms of rope.
      b.add(new CylinderGeometry(0.18, 0.2, 3, 6), 0x7a5a33, 'smooth', { y: 1.5 });
      b.add(new CylinderGeometry(0.75, 0.65, 1.9, 10), 0xe8c86a, 'smooth', { y: 2.4 });
      b.add(new SphereGeometry(0.55, 10, 8), 0xe8c86a, 'smooth', { y: 3.7 });
      b.box(2.6, 0.3, 0.3, 0xd9b27a, 'smooth', { y: 2.9 });
      for (const y of [1.7, 3.1]) b.add(new TorusGeometry(0.72, 0.06, 4, 14), 0x8a5a33, 'smooth', { y, rx: Math.PI / 2 });
      break;
    case 1: // Iron-Bound: straw clad in iron plates and bands.
      b.add(new CylinderGeometry(0.2, 0.22, 3, 6), 0x5e3b20, 'smooth', { y: 1.5 });
      b.add(new CylinderGeometry(0.8, 0.7, 2, 10), 0xd9b27a, 'smooth', { y: 2.4 });
      b.add(new SphereGeometry(0.6, 10, 8), 0x9aa0a8, 'smooth', { y: 3.8 });
      b.box(1.3, 1.2, 0.2, 0x9aa0a8, 'smooth', { y: 2.5, z: 0.72 });
      for (const y of [1.6, 2.4, 3.2]) b.add(new TorusGeometry(0.8, 0.09, 4, 14), 0x5a5f6a, 'smooth', { y, rx: Math.PI / 2 });
      break;
    case 2: // Dojo Makiwara: a lacquered post wrapped in a rope striking pad.
      b.box(0.7, 4.2, 0.7, 0x8a5a33, 'smooth', { y: 2.1 });
      b.box(0.9, 1.6, 0.9, 0xf4efe3, 'smooth', { y: 2.9 });
      for (let i = 0; i < 6; i += 1) b.box(0.95, 0.08, 0.95, 0xc9a36a, 'smooth', { y: 2.2 + i * 0.26 });
      b.box(1.8, 0.4, 1.8, 0x3a2a1c, 'smooth', { y: 0.2 });
      break;
    case 3: // Sensei Dummy: a wooden man with three sparring arms and a black belt.
      b.add(new CylinderGeometry(0.55, 0.6, 3.6, 10), 0xa87a4a, 'smooth', { y: 1.8 });
      b.add(new SphereGeometry(0.55, 10, 8), 0xa87a4a, 'smooth', { y: 4 });
      b.box(1.3, 0.2, 0.4, 0x1c1c22, 'smooth', { y: 1.9 });
      for (const [y, x, r] of [[3.1, 0.6, 0.4], [3.1, -0.6, -0.4], [2.3, 0, 0]] as const) {
        b.add(new CylinderGeometry(0.1, 0.1, 1.2, 6), 0x7a5a33, 'smooth', { x: x * 0.8, y, z: 0.7, rx: Math.PI / 2, ry: r });
      }
      b.box(1, 0.15, 0.6, 0xe0342b, 'smooth', { y: 4.45 });
      break;
    case 4: // Cursed Effigy: a dark bundle nailed with red paper talismans.
      b.add(new CylinderGeometry(0.2, 0.2, 3, 6), 0x2a1a1a, 'smooth', { y: 1.5 });
      b.add(new CylinderGeometry(0.8, 0.6, 2.2, 8), 0x4a2a5a, 'smooth', { y: 2.5 });
      b.add(new SphereGeometry(0.62, 10, 8), 0x4a2a5a, 'smooth', { y: 3.9 });
      for (const [x, y] of [[-0.3, 2.8], [0.35, 2.2], [0, 3.4]] as const) b.box(0.3, 0.6, 0.05, 0xff3b3b, 'glow', { x, y, z: 0.82 });
      for (const side of [-1, 1]) b.add(new SphereGeometry(0.1, 6, 5), 0xff2e4a, 'glow', { x: side * 0.22, y: 4, z: 0.55 });
      break;
    default: // Blood Moon Idol: a crimson crystal idol under a burning moon.
      b.box(1.8, 0.6, 1.8, 0x3a1024, 'stud', { y: 0.3 });
      b.add(new ConeGeometry(0.9, 3.6, 6), 0xff2e4a, 'glow', { y: 2.4 });
      b.add(new ConeGeometry(0.9, 1.6, 6), 0xff2e4a, 'glow', { y: 4.9, rx: Math.PI });
      b.add(new TorusGeometry(1.3, 0.12, 6, 18), 0xffd23a, 'glow', { y: 3.8 });
      b.add(new SphereGeometry(0.5, 10, 8), 0xff9a2e, 'glow', { y: 5.8 });
      break;
  }
};
