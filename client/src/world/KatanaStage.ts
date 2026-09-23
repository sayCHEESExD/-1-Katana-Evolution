import {
  KATANAS,
  KATANA_PADS,
  KATANA_STAGE,
  KATANA_STAIRS,
  formatAmount,
  formatWins,
  ownsKatana,
  stairBoxes,
} from '@katana/shared';
import {
  AdditiveBlending,
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  type Material,
} from 'three';
import { PALETTE } from '../config/worldVisuals.js';
import { createKatana } from '../katana/KatanaModels.js';
import { PartBuilder } from '../render/PartBuilder.js';
import { CanvasSign } from './CanvasSign.js';
import { paperLantern } from './JapaneseProps.js';
import { LabelPanel, trophyIcon } from './LabelSprite.js';

type PadState = 'locked' | 'affordable' | 'owned' | 'worn';

const PAD_COLORS: Readonly<Record<PadState, number>> = {
  locked: PALETTE.padLocked,
  affordable: PALETTE.padReady,
  owned: PALETTE.padOwned,
  worn: PALETTE.padWorn,
};

interface PadView {
  readonly slot: number;
  readonly glow: MeshBasicMaterial;
  readonly katana: Group;
  readonly halo: Sprite;
  readonly label: LabelPanel;
  readonly baseY: number;
  state: PadState | null;
}

let haloTexture: CanvasTexture | null = null;
const halo = (): CanvasTexture => {
  if (haloTexture) return haloTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  haloTexture = new CanvasTexture(canvas);
  haloTexture.colorSpace = SRGBColorSpace;
  return haloTexture;
};

/**
 * THE KATANA STAGE, to the right of the spawn: three stepped storeys of pads
 * against a vermilion back wall under a tiled awning, each pad with its katana
 * floating and turning above it and a label with its damage per click and its
 * price. The pad glows the state: red = not enough Wins yet, green = can buy,
 * gold = owned, cyan = worn.
 */
export class KatanaStage {
  readonly root = new Group();
  private readonly pads: PadView[] = [];
  private readonly signs: CanvasSign[] = [];
  private readonly materials: Material[] = [];
  private time = 0;
  private lastSignature = '';

  constructor() {
    this.buildStructure();
    this.buildPads();
    const sign = new CanvasSign(34, 5.6, [
      { text: 'KATANA STAGE', size: 1, fill: '#ffe08a', stroke: '#5a0f0a', strokeWidth: 0.16 },
    ]);
    sign.mesh.position.set(KATANA_STAGE.backX + 0.2, 29.4, 0);
    sign.mesh.rotation.y = Math.PI / 2;
    this.root.add(sign.mesh);
    this.signs.push(sign);
    const sub = new CanvasSign(30, 2.4, [
      { text: 'Walk onto a pad to buy or equip a katana', size: 1, fill: '#ffffff', stroke: '#1c2233', strokeWidth: 0.14 },
    ]);
    sub.mesh.position.set(KATANA_STAGE.backX + 0.25, 25.3, 0);
    sub.mesh.rotation.y = Math.PI / 2;
    this.root.add(sub.mesh);
    this.signs.push(sub);
  }

  private buildStructure(): void {
    const b = new PartBuilder();
    const { minZ, maxZ } = KATANA_STAGE;
    const depth = maxZ - minZ;
    KATANA_STAGE.tiers.forEach((tier, index) => {
      const w = tier.maxX - tier.minX;
      const cx = (tier.minX + tier.maxX) / 2;
      // The storey: a dark timber body with a cream studded deck and gold trim on its lip.
      b.box(w, tier.top - 0.3, depth, 0x3a2a24, 'stud', { x: cx, y: (tier.top - 0.3) / 2, z: 0 });
      b.box(w, 0.3, depth, PALETTE.stageFloor, 'stud', { x: cx, y: tier.top - 0.15, z: 0 });
      b.box(0.4, 0.34, depth, PALETTE.gold, 'smooth', { x: tier.maxX - 0.2, y: tier.top - 0.12, z: 0 });
      // Railings on both ends.
      for (const side of [-1, 1]) {
        const z = side > 0 ? maxZ + 0.5 : minZ - 0.5;
        b.box(w, 1.4, 1, PALETTE.vermilion, 'smooth', { x: cx, y: tier.top + 0.7, z });
        b.box(w + 0.2, 0.25, 1.2, PALETTE.gold, 'smooth', { x: cx, y: tier.top + 1.45, z });
      }
      // A step lip of red lacquer on each storey face above the first.
      if (index > 0) b.box(0.3, tier.top - KATANA_STAGE.tiers[index - 1]!.top, depth, PALETTE.vermilion, 'smooth', { x: tier.maxX + 0.15, y: (tier.top + KATANA_STAGE.tiers[index - 1]!.top) / 2, z: 0 });
    });
    for (const stair of KATANA_STAIRS) {
      for (const box of stairBoxes(stair)) {
        const w = box.maxX - box.minX;
        const h = box.maxY - box.minY;
        const d = box.maxZ - box.minZ;
        b.box(w, h, d, PALETTE.stageFloor, 'stud', { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2, z: (box.minZ + box.maxZ) / 2 });
      }
    }
    // The back wall: vermilion frame, cream panels, gold emblem discs.
    const backX = KATANA_STAGE.backX - 1.5;
    b.box(3, 24, depth + 6, PALETTE.vermilionDark, 'stud', { x: backX, y: 12, z: 0 });
    for (let i = -2; i <= 2; i += 1) {
      b.box(0.3, 8, 7.4, PALETTE.plaster, 'smooth', { x: KATANA_STAGE.backX + 0.1, y: 14.5, z: i * 9.4 });
      b.box(0.34, 0.5, 7.8, PALETTE.gold, 'smooth', { x: KATANA_STAGE.backX + 0.12, y: 18.7, z: i * 9.4 });
    }
    // The awning: a tiled roof over the top storey, and lanterns under it.
    b.box(22, 0.8, depth + 10, PALETTE.roof, 'stud', { x: KATANA_STAGE.backX + 9, y: 21.6, z: 0, rz: -0.18 });
    b.box(1.2, 0.8, depth + 10.4, PALETTE.gold, 'smooth', { x: KATANA_STAGE.backX + 19.6, y: 19.8, z: 0 });
    for (let i = -3; i <= 3; i += 1) paperLantern(b, KATANA_STAGE.backX + 17, 18, i * 7, 1.1);
    // The gable signboard rising from the middle of the back wall, which the title is painted on.
    b.box(3, 8.5, 38, PALETTE.vermilionDark, 'stud', { x: backX, y: 28.25, z: 0 });
    b.box(3.4, 0.8, 39, PALETTE.roof, 'stud', { x: backX, y: 32.9, z: 0 });
    // Pad frames: dark bevelled squares the glow sits in.
    for (const pad of KATANA_PADS) {
      b.box(pad.half * 2 + 0.6, 0.2, pad.half * 2 + 0.6, 0x22252e, 'smooth', { x: pad.x, y: pad.y + 0.1, z: pad.z });
    }
    this.root.add(b.build('katana-stage'));
  }

  private buildPads(): void {
    const glowGeometry = new PlaneGeometry(1, 1);
    for (const pad of KATANA_PADS) {
      const tier = KATANAS[pad.slot - 1]!;
      const glow = new MeshBasicMaterial({ color: PAD_COLORS.locked, transparent: true, opacity: 0.85, fog: false });
      this.materials.push(glow);
      const plate = new Mesh(glowGeometry, glow);
      plate.rotation.x = -Math.PI / 2;
      plate.scale.set(pad.half * 2 - 0.3, pad.half * 2 - 0.3, 1);
      plate.position.set(pad.x, pad.y + 0.22, pad.z);
      this.root.add(plate);

      const katana = createKatana(pad.slot);
      const baseY = pad.y + 1.7;
      katana.position.set(pad.x, baseY, pad.z);
      katana.scale.setScalar(1.7);
      katana.rotation.z = 0.12;
      this.root.add(katana);

      const haloMaterial = new SpriteMaterial({ map: halo(), color: tier.color, transparent: true, blending: AdditiveBlending, depthWrite: false, fog: false });
      this.materials.push(haloMaterial);
      const haloSprite = new Sprite(haloMaterial);
      haloSprite.scale.set(5.5, 5.5, 1);
      haloSprite.position.set(pad.x, baseY + 2, pad.z);
      this.root.add(haloSprite);

      // Printed on the riser BEHIND the pad - the next storey's face, or the back wall.
      const index = KATANA_STAGE.tiers.findIndex((entry) => entry.top === pad.y);
      const riserX = KATANA_STAGE.tiers[index + 1]?.maxX ?? KATANA_STAGE.backX;
      const label = new LabelPanel(6.6, 3.4);
      // Clear of the lacquer lip (0.3 proud of the riser) and the wall panels.
      label.object.position.set(riserX + 0.36, pad.y + 2.0, pad.z);
      label.object.rotation.y = Math.PI / 2;
      this.root.add(label.object);
      this.pads.push({ slot: pad.slot, glow, katana, halo: haloSprite, label, baseY, state: null });
    }
  }

  /** Recolour pads and rewrite labels for this player's Wins and inventory. Cheap when nothing changed. */
  setInventory(wins: number, ownedKatanas: number, worn: number): void {
    const trophy = trophyIcon(() => {
      this.lastSignature = '';
      this.setInventory(wins, ownedKatanas, worn);
    });
    const signature = `${wins >= 0 ? this.affordMask(wins) : 0}:${ownedKatanas}:${worn}:${trophy ? 1 : 0}`;
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;
    for (const pad of this.pads) {
      const tier = KATANAS[pad.slot - 1]!;
      const owned = ownsKatana(ownedKatanas, pad.slot);
      const state: PadState = pad.slot === worn ? 'worn' : owned ? 'owned' : wins >= tier.cost ? 'affordable' : 'locked';
      pad.state = state;
      pad.glow.color.setHex(PAD_COLORS[state]);
      const status =
        state === 'worn'
          ? { text: 'EQUIPPED', color: '#7fe6ff' }
          : state === 'owned'
            ? { text: 'OWNED - EQUIP', color: '#ffd93d' }
            : state === 'affordable'
              ? { text: `BUY ${formatWins(tier.cost)}`, color: '#7dff6a', icon: trophy }
              : { text: `LOCKED ${formatWins(tier.cost)}`, color: '#ff7a6a', icon: trophy };
      pad.label.set([
        { text: tier.name, color: tier.color, size: 0.8 },
        { text: `+${formatAmount(tier.damage)} / CLICK`, color: '#ffffff', size: 1.15 },
        { ...status, size: 1 },
      ]);
    }
  }

  private affordMask(wins: number): number {
    let mask = 0;
    KATANAS.forEach((tier, index) => {
      if (wins >= tier.cost) mask |= 1 << index;
    });
    return mask;
  }

  update(delta: number): void {
    this.time += delta;
    for (const pad of this.pads) {
      pad.katana.rotation.y = this.time * 0.9 + pad.slot;
      pad.katana.position.y = pad.baseY + Math.sin(this.time * 1.6 + pad.slot) * 0.25;
      const pulse = 0.72 + Math.sin(this.time * 3 + pad.slot) * 0.12;
      pad.glow.opacity = pad.state === 'worn' ? 0.95 : pulse;
    }
  }

  dispose(): void {
    for (const pad of this.pads) pad.label.dispose();
    for (const sign of this.signs) sign.dispose();
    for (const material of this.materials) material.dispose();
    this.root.removeFromParent();
  }
}
