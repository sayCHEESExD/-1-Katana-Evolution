import {
  ARENA,
  HUB,
  HUB_DECOR,
  HUB_GATE,
  STAGE_COUNT,
  arenaEndZ,
} from '@katana/shared';
import {
  CanvasTexture,
  CircleGeometry,
  Group,
  Mesh,
  MeshLambertMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  type BufferGeometry,
  type Material,
} from 'three';
import { PALETTE } from '../config/worldVisuals.js';
import { PartBuilder } from '../render/PartBuilder.js';
import { drawDecor } from './DecorRenderer.js';
import { koiPond, paperLantern, pineTree, torii } from './JapaneseProps.js';
import { worldTextures } from './WorldTextures.js';

/**
 * THE VILLAGE: the spawn hub every system is reached from.
 *
 * A pale-tiled plaza with a yin-yang spawn mat in the middle, the Training
 * Area's three pockets right at its left edge, sandy paths out to the Katana
 * Stage (right), the Forge and the scoreboards (behind), the Pets Shop
 * (behind-right) and the Stage 1 gate (ahead). Tan studded cliffs with grass
 * caps close it in, stepped in terraces planted with pines; a castle wall
 * with a great torii fronts the stage road. Houses and a koi pond fill the
 * corners either side of the training pockets.
 */
export class Village {
  readonly root = new Group();
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];

  constructor() {
    this.buildGround();
    this.buildCliffs();
    this.buildFrontWall();
    this.buildDecor();
  }

  private buildGround(): void {
    const ground = new PartBuilder();
    // One grass slab under the whole hub.
    ground.box(HUB.maxX - HUB.minX, 1, HUB.maxZ - HUB.minZ, PALETTE.grass, 'stud', {
      x: (HUB.minX + HUB.maxX) / 2,
      y: -0.5,
      z: (HUB.minZ + HUB.maxZ) / 2,
    });
    // Sandy paths, a little proud of the grass so no two faces are coplanar.
    const paths: readonly (readonly [number, number, number, number])[] = [
      [-38, -30, -6, 6],
      [-8, 8, 36, 40],
      [-8, 8, -52, -36],
      [-74, -30, -50, -44],
    ];
    for (const [x0, x1, z0, z1] of paths) {
      ground.box(x1 - x0, 0.1, z1 - z0, PALETTE.path, 'stud', { x: (x0 + x1) / 2, y: 0.05, z: (z0 + z1) / 2 });
    }
    this.root.add(ground.build('hub-ground', false));

    // The plaza: pale tiles with chevrons, as in the reference.
    const tiles = worldTextures.plazaTiles(PALETTE.plaza, PALETTE.plazaLine, PALETTE.plazaChevron);
    // Wide enough to reach the training pockets' open front (x 20).
    const plazaW = 40;
    const plazaD = 72;
    const plazaGeometry = new PlaneGeometry(plazaW, plazaD);
    const uv = plazaGeometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) * (plazaW / 4), uv.getY(i) * (plazaD / 4));
    const plazaMaterial = new MeshLambertMaterial({ map: tiles, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
    const plaza = new Mesh(plazaGeometry, plazaMaterial);
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(0, 0.06, 0);
    plaza.receiveShadow = true;
    this.root.add(plaza);
    this.geometries.push(plazaGeometry);
    this.materials.push(plazaMaterial);

    // The spawn mat: a great yin-yang disc.
    const matGeometry = new CircleGeometry(6, 40);
    const matMaterial = new MeshLambertMaterial({ map: yinYangTexture(), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    const mat = new Mesh(matGeometry, matMaterial);
    mat.rotation.x = -Math.PI / 2;
    mat.position.set(0, 0.09, 0);
    mat.receiveShadow = true;
    this.root.add(mat);
    this.geometries.push(matGeometry);
    this.materials.push(matMaterial);
  }

  /**
   * The cliffs: studded tan terraces with grass caps, stepping up and back,
   * pines on the steps. They stand OUTSIDE the walkable area, where the
   * collision already has them.
   */
  private buildCliffs(): void {
    const b = new PartBuilder();
    const terrace = (x0: number, x1: number, z0: number, z1: number, h: number): void => {
      b.box(x1 - x0, h, z1 - z0, PALETTE.cliff, 'stud', { x: (x0 + x1) / 2, y: h / 2 - 1, z: (z0 + z1) / 2 });
      b.box(x1 - x0, 1, z1 - z0, PALETTE.cliffCap, 'stud', { x: (x0 + x1) / 2, y: h - 0.5, z: (z0 + z1) / 2 });
    };
    // Back: a sheer face for the scoreboards, then two steps up.
    terrace(HUB.minX - 30, HUB.maxX + 30, HUB.minZ - 10, HUB.minZ, 27);
    terrace(HUB.minX - 30, HUB.maxX + 30, HUB.minZ - 22, HUB.minZ - 10, 36);
    terrace(HUB.minX - 30, HUB.maxX + 30, HUB.minZ - 40, HUB.minZ - 22, 46);
    // Sides.
    terrace(HUB.minX - 12, HUB.minX, HUB.minZ, HUB.maxZ + 4, 20);
    terrace(HUB.minX - 30, HUB.minX - 12, HUB.minZ, HUB.maxZ + 30, 32);
    terrace(HUB.maxX, HUB.maxX + 12, HUB.minZ, HUB.maxZ + 4, 20);
    terrace(HUB.maxX + 12, HUB.maxX + 30, HUB.minZ, HUB.maxZ + 30, 32);
    // The stage road's canyon: both sides, the whole way down.
    const roadEnd = arenaEndZ(STAGE_COUNT) + 14;
    for (const side of [-1, 1]) {
      const inner = side * ARENA.halfWidth;
      const outer = side * (ARENA.halfWidth + 14);
      terrace(Math.min(inner, outer), Math.max(inner, outer), HUB.maxZ + 4, roadEnd, 18);
      const far = side * (ARENA.halfWidth + 40);
      terrace(Math.min(outer, far), Math.max(outer, far), HUB.maxZ + 4, roadEnd, 30);
    }
    terrace(-ARENA.halfWidth, ARENA.halfWidth, arenaEndZ(STAGE_COUNT), roadEnd, 34);
    // Distant hills either side of the road, so the view over the front wall is never empty.
    terrace(HUB.minX - 30, -ARENA.halfWidth - 40, HUB.maxZ + 4, HUB.maxZ + 260, 38);
    terrace(ARENA.halfWidth + 40, HUB.maxX + 30, HUB.maxZ + 4, HUB.maxZ + 260, 38);
    // Pines on the steps.
    for (let x = HUB.minX - 6; x < HUB.maxX + 20; x += 17) pineTree(b, x, 35, HUB.minZ - 16, 1.2);
    for (let z = HUB.minZ + 8; z < HUB.maxZ; z += 16) {
      pineTree(b, HUB.minX - 20, 31, z, 1.1);
      pineTree(b, HUB.maxX + 20, 31, z, 1.1);
    }
    for (let z = HUB.maxZ + 20; z < roadEnd; z += 26) {
      pineTree(b, ARENA.halfWidth + 26, 29, z, 1.2);
      pineTree(b, -ARENA.halfWidth - 26, 29, z + 13, 1.2);
    }
    this.root.add(b.build('cliffs', false));
  }

  /** The castle wall between the village and the road, with the great torii over the Stage 1 portal. */
  private buildFrontWall(): void {
    const b = new PartBuilder();
    const z = HUB.maxZ + 2;
    for (const [x0, x1] of [[HUB.minX, HUB_GATE.minX], [HUB_GATE.maxX, HUB.maxX]] as const) {
      const w = x1 - x0;
      const cx = (x0 + x1) / 2;
      b.box(w, 3, 4.4, PALETTE.stoneDark, 'stud', { x: cx, y: 1.5, z });
      b.box(w, 8, 3.6, PALETTE.plaster, 'smooth', { x: cx, y: 7, z });
      b.box(w + 0.4, 0.8, 5.2, PALETTE.roof, 'stud', { x: cx, y: 11.4, z });
      b.box(w, 0.6, 2.2, PALETTE.roofEdge, 'smooth', { x: cx, y: 12.1, z });
    }
    // Tall enough that its tie beam clears the STAGE 1 sign.
    torii(b, 0, 0, HUB.maxZ - 1.5, 26, 24);
    for (const side of [-1, 1]) paperLantern(b, side * 7, 10, HUB.maxZ - 1.5, 1.4);
    this.root.add(b.build('front-wall'));
  }

  private buildDecor(): void {
    const b = new PartBuilder();
    drawDecor(b, HUB_DECOR);
    koiPond(b, 54, 0, -30, 10, 6);
    this.root.add(b.build('hub-decor'));
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.root.traverse((child) => {
      const mesh = child as Mesh;
      if (mesh.isMesh && !this.geometries.includes(mesh.geometry)) mesh.geometry.dispose();
    });
    this.root.removeFromParent();
  }
}

/** The spawn mat's yin-yang, drawn once. */
const yinYangTexture = (): CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const c = 128;
  const r = 120;
  ctx.fillStyle = '#e8f2fa';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#1c2233';
  ctx.beginPath();
  ctx.arc(c, c, r + 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1c2233';
  ctx.beginPath();
  ctx.arc(c, c, r, -Math.PI / 2, Math.PI / 2);
  ctx.arc(c, c + r / 2, r / 2, Math.PI / 2, -Math.PI / 2, false);
  ctx.arc(c, c - r / 2, r / 2, Math.PI / 2, -Math.PI / 2, true);
  ctx.fill();
  ctx.fillStyle = '#1c2233';
  ctx.beginPath();
  ctx.arc(c, c + r / 2, r / 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(c, c - r / 2, r / 7, 0, Math.PI * 2);
  ctx.fill();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
};
