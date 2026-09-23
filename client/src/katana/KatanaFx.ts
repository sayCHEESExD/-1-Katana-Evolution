import { KATANAS } from '@katana/shared';
import { AdditiveBlending, CanvasTexture, Color, Group, SRGBColorSpace, Sprite, SpriteMaterial } from 'three';
import { bladeLengthOf } from './KatanaModels.js';

/**
 * THE RARE-KATANA AURA: the Katana Stage's glow, carried in the hand.
 *
 * Common blades (1-2) carry nothing. From there each band adds to the last,
 * in the katana's own shop colour:
 *
 *   3-5   a soft glow along the blade;
 *   6-8   a brighter glow that breathes;
 *   9-11  plus sparks spiralling up and down the blade;
 *   12-14 a blazing aura, a flare at the tip and a swarm of sparks.
 *
 * Lightweight by construction: a handful of additive sprites per katana, two
 * tiny canvas textures and ONE material per katana per kind, shared by every
 * player wearing it. Nothing here is a mesh, a light or a shader. The aura is
 * attached to a player's OWN katana, so it only ever shows what that player
 * is holding.
 */
export class KatanaFx {
  readonly root = new Group();
  private readonly glows: Sprite[] = [];
  private readonly sparks: Sprite[] = [];
  private readonly flare: Sprite | null = null;
  private readonly length: number;
  private readonly band: number;
  private readonly direction: number;
  private readonly glowBase: number = 0;
  private readonly seed = Math.random() * 10;

  /**
   * @param sheathed the aura of a katana in its scabbard (blade down -Y): quieter
   */
  constructor(slot: number, sheathed: boolean) {
    this.band = bandOf(slot);
    this.direction = sheathed ? -1 : 1;
    this.length = bladeLengthOf(slot) * (sheathed ? 0.92 : 1);
    this.root.name = `katana-fx-${slot}`;
    if (this.band === 0) return;

    const materials = materialsFor(slot);
    const quiet = sheathed ? 0.65 : 1;
    const glowCount = [0, 2, 3, 4, 5][this.band]!;
    this.glowBase = [0, 0.75, 0.95, 1.15, 1.45][this.band]! * quiet;
    for (let i = 0; i < glowCount; i += 1) {
      const sprite = new Sprite(materials.glow);
      const t = (i + 1) / (glowCount + 1);
      sprite.position.set(0, this.direction * (0.25 + t * this.length), 0);
      sprite.scale.setScalar(this.glowBase);
      sprite.renderOrder = 2;
      this.root.add(sprite);
      this.glows.push(sprite);
    }
    const sparkCount = sheathed ? [0, 0, 0, 2, 4][this.band]! : [0, 0, 0, 5, 9][this.band]!;
    for (let i = 0; i < sparkCount; i += 1) {
      const sprite = new Sprite(materials.spark);
      sprite.renderOrder = 3;
      this.root.add(sprite);
      this.sparks.push(sprite);
    }
    if (this.band === 4 && !sheathed) {
      this.flare = new Sprite(materials.flare);
      this.flare.position.set(0, this.length + 0.3, 0);
      this.flare.renderOrder = 3;
      this.root.add(this.flare);
    }
  }

  get active(): boolean {
    return this.band > 0;
  }

  /** Advance the aura: time-driven, so every copy of it stays in step. */
  update(time: number): void {
    if (this.band === 0 || !this.root.visible) return;
    const t = time + this.seed;
    if (this.band >= 2) {
      const breathe = 1 + Math.sin(t * (this.band >= 4 ? 5 : 3)) * (this.band >= 4 ? 0.18 : 0.12);
      for (const glow of this.glows) glow.scale.setScalar(this.glowBase * breathe);
    }
    // Sparks spiral along the blade, each on its own phase, flickering in and out.
    const count = this.sparks.length;
    for (let i = 0; i < count; i += 1) {
      const sprite = this.sparks[i]!;
      const phase = (t * (0.45 + (i % 3) * 0.12) + i / count) % 1;
      const angle = t * 3.2 + i * 2.4;
      const radius = 0.18 + 0.22 * Math.sin(phase * Math.PI);
      sprite.position.set(Math.cos(angle) * radius, this.direction * (0.2 + phase * (this.length + 0.3)), Math.sin(angle) * radius);
      const size = Math.sin(phase * Math.PI) * (this.band >= 4 ? 0.42 : 0.3);
      sprite.scale.setScalar(Math.max(0.001, size));
    }
    if (this.flare) {
      this.flare.scale.setScalar(0.9 + Math.sin(t * 7) * 0.25);
      this.flare.material.rotation = t * 1.5;
    }
  }
}

/** Which band a katana is in: 0 common .. 4 legendary. */
const bandOf = (slot: number): number => {
  if (slot <= 2) return 0;
  if (slot <= 5) return 1;
  if (slot <= 8) return 2;
  if (slot <= 11) return 3;
  return 4;
};

interface FxMaterials {
  readonly glow: SpriteMaterial;
  readonly spark: SpriteMaterial;
  readonly flare: SpriteMaterial;
}

const materialCache = new Map<number, FxMaterials>();

const materialsFor = (slot: number): FxMaterials => {
  const cached = materialCache.get(slot);
  if (cached) return cached;
  const band = bandOf(slot);
  const color = new Color(KATANAS[slot - 1]?.color ?? '#ffffff');
  const common = { transparent: true, blending: AdditiveBlending, depthWrite: false, fog: false } as const;
  const made: FxMaterials = {
    glow: new SpriteMaterial({ ...common, map: glowTexture(), color, opacity: [0, 0.45, 0.55, 0.65, 0.8][band]! }),
    spark: new SpriteMaterial({ ...common, map: sparkTexture(), color: color.clone().lerp(new Color(0xffffff), 0.45), opacity: 0.95 }),
    flare: new SpriteMaterial({ ...common, map: sparkTexture(), color: color.clone().lerp(new Color(0xffffff), 0.6), opacity: 0.9 }),
  };
  materialCache.set(slot, made);
  return made;
};

let glowMap: CanvasTexture | null = null;
/** A soft round glow, white: tinted per katana. */
const glowTexture = (): CanvasTexture => {
  if (glowMap) return glowMap;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(32, 32, 1, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  glowMap = new CanvasTexture(canvas);
  glowMap.colorSpace = SRGBColorSpace;
  return glowMap;
};

let sparkMap: CanvasTexture | null = null;
/** A four-pointed twinkle, white: tinted per katana. */
const sparkTexture = (): CanvasTexture => {
  if (sparkMap) return sparkMap;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const core = ctx.createRadialGradient(32, 32, 0, 32, 32, 12);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  for (const [w, h] of [[3, 30], [30, 3]] as const) {
    ctx.beginPath();
    ctx.ellipse(32, 32, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  sparkMap = new CanvasTexture(canvas);
  sparkMap.colorSpace = SRGBColorSpace;
  return sparkMap;
};
