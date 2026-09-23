import { FORGE } from '@katana/shared';
import {
  AdditiveBlending,
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  type Material,
} from 'three';
import { attachToMount, measureMounts } from '../animation/rig/BoneMounts.js';
import { PoseBuffer } from '../animation/PoseBuffer.js';
import { PlayerRig } from '../animation/rig/PlayerRig.js';
import { PALETTE } from '../config/worldVisuals.js';
import { recoloredAtlas } from '../enemies/EnemyTextures.js';
import { playerModelLoader } from '../player/PlayerModelLoader.js';
import { PartBuilder } from '../render/PartBuilder.js';
import { CanvasSign } from './CanvasSign.js';
import { bambooClump, barrel, paperLantern, weaponRack } from './JapaneseProps.js';

const deg = (d: number): number => (d * Math.PI) / 180;
/** Hammer blows per second. */
const BEAT = 1.1;

/**
 * THE FORGE SHOP, at the back of the spawn: an open timber workshop under a
 * tiled roof. A blacksmith hammers a glowing blade on the anvil behind the
 * counter, sparks jump on every blow, the furnace roars at the back, and
 * weapon racks and helmets line the walls. Step onto the red mat in front of
 * the counter to open the shop.
 */
export class ForgeShop {
  readonly root = new Group();
  private readonly signs: CanvasSign[] = [];
  private readonly materials: Material[] = [];
  private readonly fire: Mesh;
  private readonly sparks: Mesh[] = [];
  private readonly smithRig: PlayerRig | null = null;
  private readonly pose = new PoseBuffer();
  private readonly hotBlade: MeshBasicMaterial;
  private time = 0;

  constructor() {
    const b = new PartBuilder();
    const { minX, maxX, minZ, maxZ } = FORGE;
    const w = maxX - minX;
    const d = maxZ - minZ;
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    // Floor, back wall, side walls.
    b.box(w, 0.2, d, 0x6b6f7a, 'stud', { x: cx, y: 0.1, z: cz });
    b.box(w, 12, 1, 0x8a5a33, 'stud', { x: cx, y: 6, z: minZ + 0.5 });
    for (const side of [-1, 1]) b.box(1, 10, 12, PALETTE.plaster, 'smooth', { x: side > 0 ? maxX - 0.5 : minX + 0.5, y: 5, z: minZ + 7 });
    // Posts, exactly where the solids are.
    for (const [x, z] of [[minX + 0.8, maxZ - 0.8], [maxX - 0.8, maxZ - 0.8], [minX + 0.8, minZ + 2], [maxX - 0.8, minZ + 2]] as const) {
      b.box(1.4, 12, 1.4, PALETTE.woodDark, 'smooth', { x, y: 6, z });
    }
    // The roof: a deep tiled slab with a red ridge and a front beam that carries the sign.
    b.box(w + 6, 0.9, d + 6, PALETTE.roof, 'stud', { x: cx, y: 12.45, z: cz });
    b.box(w + 6.4, 0.7, 1.2, PALETTE.vermilion, 'smooth', { x: cx, y: 13.25, z: minZ + 1 });
    b.box(w + 2, 2.4, 0.8, PALETTE.woodDark, 'smooth', { x: cx, y: 11.2, z: maxZ - 0.6 });
    // Counter and anvil.
    const c = FORGE.counter;
    b.box(c.maxX - c.minX, c.top, c.maxZ - c.minZ, 0x8a5a33, 'stud', { x: (c.minX + c.maxX) / 2, y: c.top / 2, z: (c.minZ + c.maxZ) / 2 });
    b.box(c.maxX - c.minX + 0.4, 0.2, c.maxZ - c.minZ + 0.4, PALETTE.woodDark, 'smooth', { x: (c.minX + c.maxX) / 2, y: c.top + 0.1, z: (c.minZ + c.maxZ) / 2 });
    b.add(new CylinderGeometry(1.2, 1.4, 1.4, 10), 0x6b4a2a, 'smooth', { x: FORGE.anvil.x, y: 0.7, z: FORGE.anvil.z });
    b.box(1.2, 0.8, 1.0, 0x3a3f4a, 'smooth', { x: FORGE.anvil.x, y: 1.8, z: FORGE.anvil.z });
    b.box(3.2, 0.5, 1.4, 0x4a4f5a, 'smooth', { x: FORGE.anvil.x, y: 2.3, z: FORGE.anvil.z });
    b.add(new ConeGeometry(0.5, 1.2, 4), 0x4a4f5a, 'smooth', { x: FORGE.anvil.x + 2.1, y: 2.3, z: FORGE.anvil.z, rz: Math.PI / 2 });
    // The furnace: stone, a glowing mouth, a chimney.
    b.box(6, 6, 4, 0x8e929c, 'stud', { x: cx + 11, y: 3, z: minZ + 3 });
    b.box(2.6, 2.2, 0.2, 0xff8a1c, 'glow', { x: cx + 11, y: 2.2, z: minZ + 5.05 });
    b.box(2.4, 8, 2.4, 0x6b6f7a, 'stud', { x: cx + 11, y: 10, z: minZ + 2.5 });
    // Racks, helmets on a table, barrels, a water trough, bamboo.
    weaponRack(b, cx - 10, 0, minZ + 1.6);
    b.box(6, 1.2, 2, 0x8a5a33, 'smooth', { x: cx - 9, y: 1.4, z: minZ + 8 });
    for (let i = 0; i < 4; i += 1) {
      b.add(new SphereGeometry(0.55, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), i % 2 ? 0x9aa0a8 : 0xc7b8ff, 'smooth', { x: cx - 11.2 + i * 1.4, y: 2.0, z: minZ + 8 });
    }
    barrel(b, cx + 14.5, 0, maxZ - 4);
    barrel(b, cx + 14.5, 0, maxZ - 6.2, 0.9);
    b.box(4, 1, 1.6, 0x5e3b20, 'smooth', { x: cx - 13.4, y: 0.5, z: maxZ - 4 });
    b.box(3.6, 0.2, 1.2, PALETTE.water, 'smooth', { x: cx - 13.4, y: 1.0, z: maxZ - 4 });
    bambooClump(b, maxX + 3, 0, maxZ - 2, 5, 9, 11);
    bambooClump(b, minX - 3, 0, maxZ - 2, 5, 9, 12);
    // Two big lanterns hang from the front beam, as in the reference.
    for (const side of [-1, 1]) paperLantern(b, cx + side * 13, 8.6, maxZ - 0.6, 1.8, 0xffc766);
    // The mat that opens the shop.
    const t = FORGE.trigger;
    b.box(t.maxX - t.minX, 0.12, t.maxZ - t.minZ, 0xc0392b, 'stud', { x: (t.minX + t.maxX) / 2, y: 0.08, z: (t.minZ + t.maxZ) / 2 });
    b.box(t.maxX - t.minX - 2, 0.14, 0.4, PALETTE.gold, 'smooth', { x: (t.minX + t.maxX) / 2, y: 0.09, z: t.maxZ - 0.8 });
    this.root.add(b.build('forge'));

    // The fire's flicker and the blade on the anvil are their own materials, so they can glow.
    const fireMaterial = new MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false });
    this.materials.push(fireMaterial);
    this.fire = new Mesh(new PlaneGeometry(3, 3), fireMaterial);
    this.fire.position.set(cx + 11, 2.4, minZ + 5.2);
    this.root.add(this.fire);
    this.hotBlade = new MeshBasicMaterial({ color: 0xff7a1c });
    this.materials.push(this.hotBlade);
    const blade = new Mesh(new BoxGeometry(2.4, 0.08, 0.3), this.hotBlade);
    blade.position.set(FORGE.anvil.x - 0.3, 2.6, FORGE.anvil.z);
    this.root.add(blade);
    const sparkMaterial = new MeshBasicMaterial({ color: 0xffe066, transparent: true, blending: AdditiveBlending, depthWrite: false });
    this.materials.push(sparkMaterial);
    const sparkGeometry = new BoxGeometry(0.12, 0.12, 0.12);
    for (let i = 0; i < 8; i += 1) {
      const spark = new Mesh(sparkGeometry, sparkMaterial);
      spark.visible = false;
      this.root.add(spark);
      this.sparks.push(spark);
    }

    // The blacksmith: the player rig in a dark work kimono, a hammer in hand.
    const atlas = playerModelLoader.atlasImage;
    try {
      const model = playerModelLoader.createInstance();
      const map = atlas ? recoloredAtlas(atlas, { cloth: 0x2b2f3d, trim: 0x14161f, skin: 0xe0a878 }) : null;
      model.traverse((child) => {
        const mesh = child as Mesh;
        if (!mesh.isMesh) return;
        const material = new MeshStandardMaterial({ map, roughness: 0.85 });
        this.materials.push(material);
        mesh.material = material;
      });
      const holder = new Group();
      holder.add(model);
      const rig = new PlayerRig(model, model);
      rig.resetToBindPose();
      holder.updateMatrixWorld(true);
      const mounts = measureMounts(rig, holder);
      if (mounts.hand) {
        const hammer = new PartBuilder();
        hammer.add(new CylinderGeometry(0.07, 0.07, 1.3, 6), 0x6b4a2a, 'smooth', { y: 0.3 });
        hammer.box(0.34, 0.34, 0.8, 0x3a3f4a, 'smooth', { y: 0.95, z: 0.1 });
        attachToMount(hammer.build('hammer'), mounts.hand, holder);
      }
      if (mounts.head) {
        const band = new PartBuilder();
        band.add(new CylinderGeometry(mounts.headSize * 0.56, mounts.headSize * 0.56, mounts.headSize * 0.16, 12), 0xffffff, 'smooth', { y: mounts.headSize * 0.12 });
        attachToMount(band.build('hachimaki'), mounts.head, holder);
      }
      holder.position.set(FORGE.smith.x, 0.2, FORGE.smith.z);
      this.root.add(holder);
      this.smithRig = rig;
    } catch {
      // No model yet: the forge stands without its smith rather than not at all.
    }

    const sign = new CanvasSign(20, 3.6, [
      { text: 'FORGE A KATANA!', size: 0.55, fill: '#ffffff', stroke: '#1c2233', strokeWidth: 0.14 },
      { text: 'FORGE SHOP', size: 1, fill: '#ff3b2f', stroke: '#2a0808', strokeWidth: 0.18 },
    ]);
    sign.mesh.position.set(cx, 10.2, maxZ - 0.15);
    this.root.add(sign.mesh);
    this.signs.push(sign);
  }

  update(delta: number): void {
    this.time += delta;
    const cycle = (this.time * BEAT) % 1;
    // Hammer up for most of the beat, then down hard; sparks on the strike.
    const lift = cycle < 0.7 ? Math.sin((cycle / 0.7) * Math.PI * 0.5) : 1 - (cycle - 0.7) / 0.3;
    if (this.smithRig) {
      const p = this.pose;
      p.reset();
      p.set('ArmR1', deg(-30 - 120 * lift), 0, deg(-12));
      p.set('ArmR2', deg(20 + 40 * lift));
      p.set('ArmL1', deg(-35), 0, deg(18));
      p.set('ArmL2', deg(50));
      p.set('Spine1', deg(8 + 10 * (1 - lift)));
      p.set('Neck1', deg(14));
      this.smithRig.applyPose(p);
    }
    const struck = cycle >= 0.97 || cycle < 0.03;
    this.sparks.forEach((spark, i) => {
      const age = ((this.time * BEAT + i * 0.013) % 1) * 1.6;
      spark.visible = age < 0.4;
      const a = i * 0.8;
      spark.position.set(FORGE.anvil.x + Math.cos(a) * age * 3, 2.7 + age * 4 - age * age * 9, FORGE.anvil.z + Math.sin(a) * age * 2);
    });
    this.hotBlade.color.setHex(struck ? 0xffe066 : 0xff7a1c);
    const flicker = 0.75 + Math.sin(this.time * 17) * 0.1 + Math.sin(this.time * 7.3) * 0.08;
    (this.fire.material as MeshBasicMaterial).opacity = flicker;
    this.fire.scale.set(1, 0.9 + flicker * 0.2, 1);
  }

  dispose(): void {
    for (const sign of this.signs) sign.dispose();
    for (const material of this.materials) material.dispose();
    this.root.removeFromParent();
  }
}
