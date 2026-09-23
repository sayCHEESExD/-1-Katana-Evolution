import { EGGS, EGG_PLACEMENTS, PETS_SHOP, formatWins } from '@katana/shared';
import {
  AdditiveBlending,
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  SphereGeometry,
  TorusGeometry,
  type Material,
} from 'three';
import { PALETTE } from '../config/worldVisuals.js';
import { PartBuilder } from '../render/PartBuilder.js';
import { CanvasSign } from './CanvasSign.js';
import { paperLantern } from './JapaneseProps.js';
import { LabelSprite, trophyIcon } from './LabelSprite.js';

/** Each egg's shell, painted on a canvas: bamboo, magma, frost and spirit. */
const EGG_ART: readonly { readonly base: string; readonly glow: number; readonly paint: (ctx: CanvasRenderingContext2D) => void }[] = [
  {
    base: '#7ccf45',
    glow: 0x9dff6a,
    paint: (ctx) => {
      for (let x = 10; x < 256; x += 42) {
        ctx.fillStyle = '#4f9a2c';
        ctx.fillRect(x, 0, 12, 256);
        for (let y = 20; y < 256; y += 56) {
          ctx.fillStyle = '#2f6b1c';
          ctx.fillRect(x - 3, y, 18, 6);
        }
      }
    },
  },
  {
    base: '#ffb02e',
    glow: 0xff7a1c,
    paint: (ctx) => {
      ctx.strokeStyle = '#3a1406';
      ctx.lineWidth = 7;
      let seed = 7;
      const rand = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 14; i += 1) {
        ctx.beginPath();
        let x = rand() * 256;
        let y = rand() * 256;
        ctx.moveTo(x, y);
        for (let k = 0; k < 4; k += 1) {
          x += (rand() - 0.5) * 70;
          y += (rand() - 0.5) * 70;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255, 240, 120, 0.5)';
      for (let i = 0; i < 20; i += 1) ctx.fillRect(rand() * 256, rand() * 256, 10, 10);
    },
  },
  {
    base: '#e8fbff',
    glow: 0x6fe3ff,
    paint: (ctx) => {
      ctx.strokeStyle = '#3fa9ff';
      ctx.lineWidth = 16;
      for (let i = 0; i < 4; i += 1) {
        ctx.beginPath();
        for (let x = 0; x <= 256; x += 8) ctx.lineTo(x, 40 + i * 60 + Math.sin(x / 30 + i) * 18);
        ctx.stroke();
      }
    },
  },
  {
    base: '#6a3aa8',
    glow: 0xd9a6ff,
    paint: (ctx) => {
      ctx.fillStyle = '#ffe08a';
      for (const [x, y, r] of [[60, 70, 22], [180, 150, 18], [110, 200, 14], [210, 50, 12]] as const) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#6a3aa8';
        ctx.beginPath();
        ctx.arc(x + r * 0.45, y - r * 0.2, r * 0.85, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffe08a';
      }
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 30; i += 1) ctx.fillRect((i * 83) % 256, (i * 47) % 256, 4, 4);
    },
  },
];

interface EggView {
  readonly egg: Mesh;
  readonly ring: Mesh;
  readonly label: LabelSprite;
  readonly baseY: number;
}

/**
 * THE PETS SHOP, behind-right of the spawn: four great eggs on stone
 * pedestals under a vermilion frame, each with a glowing pad in front.
 * Step onto a pad to see that egg's Yokai and their chances, and hatch.
 */
export class PetsShop {
  readonly root = new Group();
  private readonly eggs: EggView[] = [];
  private readonly signs: CanvasSign[] = [];
  private readonly materials: Material[] = [];
  private readonly textures: CanvasTexture[] = [];
  private time = 0;

  constructor() {
    const b = new PartBuilder();
    const z = PETS_SHOP.eggZ;
    const [minX, maxX] = [Math.min(...PETS_SHOP.frameXs), Math.max(...PETS_SHOP.frameXs)];
    const cx = (minX + maxX) / 2;
    // A great frame behind the eggs: two pillars, a beam, the sign board.
    for (const x of [minX, maxX]) {
      b.box(1.8, 16, 1.8, PALETTE.vermilion, 'smooth', { x, y: 8, z: PETS_SHOP.frameZ });
      b.box(2.4, 1, 2.4, 0x22252e, 'smooth', { x, y: 0.5, z: PETS_SHOP.frameZ });
    }
    b.box(maxX - minX + 4, 1.4, 2.2, 0x22252e, 'smooth', { x: cx, y: 16.4, z: PETS_SHOP.frameZ });
    b.box(maxX - minX + 1, 1, 1.6, PALETTE.vermilion, 'smooth', { x: cx, y: 14.8, z: PETS_SHOP.frameZ });
    b.box(20, 5, 0.6, 0x1c2a4a, 'stud', { x: cx, y: 19.6, z: PETS_SHOP.frameZ });
    for (const placement of EGG_PLACEMENTS) {
      const h = PETS_SHOP.pedestalHalf;
      b.box(h * 2, PETS_SHOP.pedestalTop, h * 2, PALETTE.stone, 'stud', { x: placement.x, y: PETS_SHOP.pedestalTop / 2, z });
      b.box(h * 2 + 0.4, 0.3, h * 2 + 0.4, PALETTE.gold, 'smooth', { x: placement.x, y: PETS_SHOP.pedestalTop - 0.1, z });
      b.box(PETS_SHOP.padHalf * 2, 0.16, PETS_SHOP.padHalf * 2, 0x2a2e3a, 'smooth', { x: placement.x, y: 0.08, z: PETS_SHOP.padZ });
    }
    for (let i = 0; i < 5; i += 1) paperLantern(b, minX + ((maxX - minX) * (i + 0.5)) / 5, 13.2, PETS_SHOP.frameZ, 1, 0xffc766);
    this.root.add(b.build('pets-shop'));

    const title = new CanvasSign(19, 4.6, [
      { text: 'HATCH A PET', size: 0.5, fill: '#ffffff', stroke: '#1c2233', strokeWidth: 0.14 },
      { text: 'PETS SHOP', size: 1, fill: '#62d6ff', stroke: '#0b2a5a', strokeWidth: 0.18 },
    ]);
    title.mesh.position.set(cx, 19.6, PETS_SHOP.frameZ + 0.35);
    this.root.add(title.mesh);
    this.signs.push(title);

    const eggGeometry = new SphereGeometry(2.1, 24, 18);
    eggGeometry.scale(1, 1.32, 1);
    const ringGeometry = new TorusGeometry(2.7, 0.12, 6, 32);
    const padGeometry = new PlaneGeometry(PETS_SHOP.padHalf * 2 - 0.4, PETS_SHOP.padHalf * 2 - 0.4);
    EGG_PLACEMENTS.forEach((placement, index) => {
      const art = EGG_ART[index]!;
      const texture = eggTexture(art.base, art.paint);
      this.textures.push(texture);
      const shell = new MeshLambertMaterial({ map: texture, emissive: art.glow, emissiveIntensity: 0.18 });
      this.materials.push(shell);
      const egg = new Mesh(eggGeometry, shell);
      const baseY = PETS_SHOP.pedestalTop + 2.8;
      egg.position.set(placement.x, baseY, z);
      egg.castShadow = true;
      this.root.add(egg);

      const ringMaterial = new MeshBasicMaterial({ color: art.glow, transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false });
      this.materials.push(ringMaterial);
      const ring = new Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(placement.x, PETS_SHOP.pedestalTop + 0.3, z);
      this.root.add(ring);

      const padMaterial = new MeshBasicMaterial({ color: art.glow, transparent: true, opacity: 0.75 });
      this.materials.push(padMaterial);
      const pad = new Mesh(padGeometry, padMaterial);
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(placement.x, 0.18, PETS_SHOP.padZ);
      this.root.add(pad);

      const label = new LabelSprite(7, 2.6);
      label.sprite.position.set(placement.x, baseY + 4.4, z);
      this.root.add(label.sprite);
      this.eggs.push({ egg, ring, label, baseY });
    });
    this.refreshLabels();
  }

  private refreshLabels(): void {
    const trophy = trophyIcon(() => this.refreshLabels());
    this.eggs.forEach((view, index) => {
      const egg = EGGS[index]!;
      view.label.set([
        { text: egg.name, color: '#ffffff', size: 1 },
        { text: formatWins(egg.cost), color: '#ffd93d', size: 1, icon: trophy },
      ]);
    });
  }

  update(delta: number): void {
    this.time += delta;
    this.eggs.forEach((view, index) => {
      view.egg.position.y = view.baseY + Math.sin(this.time * 1.4 + index) * 0.3;
      view.egg.rotation.y = this.time * 0.4 + index;
      view.ring.rotation.z = this.time * 0.8;
      view.ring.scale.setScalar(1 + Math.sin(this.time * 2 + index) * 0.05);
    });
  }

  dispose(): void {
    for (const view of this.eggs) view.label.dispose();
    for (const sign of this.signs) sign.dispose();
    for (const material of this.materials) material.dispose();
    for (const texture of this.textures) texture.dispose();
    this.root.removeFromParent();
  }
}

const eggTexture = (base: string, paint: (ctx: CanvasRenderingContext2D) => void): CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  paint(ctx);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
};
