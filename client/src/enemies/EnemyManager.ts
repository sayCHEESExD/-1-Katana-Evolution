import { ENEMIES, PLAYER_HEIGHT, arenaStartZ, stageByIndex, type EnemyDef } from '@katana/shared';
import {
  AdditiveBlending,
  CanvasTexture,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  type Material,
  type Scene,
} from 'three';
import { createAnimationInput, type AnimationInput } from '../animation/AnimationInput.js';
import { PlayerAnimator } from '../animation/PlayerAnimator.js';
import { attachToMount, measureMounts } from '../animation/rig/BoneMounts.js';
import { PlayerRig } from '../animation/rig/PlayerRig.js';
import { SWING } from '../config/animationConfig.js';
import type { NetEnemyState } from '../net/netTypes.js';
import { playerModelLoader } from '../player/PlayerModelLoader.js';
import { PartBuilder } from '../render/PartBuilder.js';
import { worldTextures } from '../world/WorldTextures.js';
import { ENEMY_LOOKS } from './EnemyLooks.js';
import { recoloredAtlas } from './EnemyTextures.js';

/** Stages within this distance (along the road) have their enemies built. */
const BUILD_DISTANCE = 150;
const FOLLOW_RATE = 12;
const DEATH_SECONDS = 0.6;
const FLINCH_SECONDS = 0.18;

const labelCache = new Map<string, CanvasTexture>();

/** A name tag - the NAME only. Health lives in the HUD, never over a head. */
const labelTexture = (name: string, boss: boolean): CanvasTexture => {
  const key = `${boss ? 'b' : 'n'}:${name}`;
  const cached = labelCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.font = `700 ${boss ? 58 : 52}px "Fredoka", "Baloo 2", "Nunito", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  let size = boss ? 58 : 52;
  while (ctx.measureText(name).width > 480 && size > 20) {
    size -= 4;
    ctx.font = `700 ${size}px "Fredoka", "Baloo 2", "Nunito", system-ui, sans-serif`;
  }
  ctx.lineWidth = size * 0.2;
  ctx.strokeStyle = '#140a0a';
  ctx.strokeText(name, 256, 50);
  ctx.fillStyle = boss ? '#ff5a4a' : '#ffe9c9';
  ctx.fillText(name, 256, 50);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = LinearFilter;
  labelCache.set(key, texture);
  return texture;
};

const shortestAngle = (from: number, to: number): number => {
  let diff = to - from;
  diff -= Math.round(diff / (Math.PI * 2)) * Math.PI * 2;
  return diff;
};

/** One enemy on screen: a player rig in its look, driven by replicated state. */
class EnemyVisual {
  readonly root = new Group();
  private readonly visual = new Group();
  private readonly animator: PlayerAnimator;
  private readonly input: AnimationInput = createAnimationInput();
  private readonly materials: MeshStandardMaterial[] = [];
  private readonly accessories: Group[] = [];
  private readonly label: Sprite;
  private readonly seal: Mesh | null = null;
  private readonly sealRing: Mesh | null = null;
  private lastHits = -1;
  private lastSwings = -1;
  private swingTime = -1;
  private swingVariant = 0;
  private flinch = 0;
  private deathTime = -1;
  private alive = true;
  private placed = false;
  private targetX = 0;
  private targetZ = 0;
  private targetYaw = 0;
  private moving = false;

  constructor(readonly def: EnemyDef) {
    const look = ENEMY_LOOKS[def.look];
    const model = playerModelLoader.createInstance();
    const atlas = playerModelLoader.atlasImage;
    const map = atlas ? recoloredAtlas(atlas, look.palette) : null;
    model.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      const material = new MeshStandardMaterial({ map, roughness: 0.85, metalness: 0 });
      this.materials.push(material);
      mesh.material = material;
    });
    this.root.add(this.visual);
    this.visual.add(model);
    const rig = new PlayerRig(model, model);
    this.animator = new PlayerAnimator(rig, this.visual);

    // Accessories go on in the bind pose, root at the origin, before scaling.
    rig.resetToBindPose();
    this.root.updateMatrixWorld(true);
    const mounts = measureMounts(rig, this.root);
    const wear = (make: ((b: PartBuilder, size: number) => void) | undefined, mount: typeof mounts.head): void => {
      if (!make || !mount) return;
      const builder = new PartBuilder();
      make(builder, mounts.headSize);
      const group = builder.build(`${def.look}-gear`, true);
      attachToMount(group, mount, this.root);
      this.accessories.push(group);
    };
    wear(look.head, mounts.head);
    wear(look.hand ? (b) => look.hand!(b) : undefined, mounts.hand);
    wear(look.back ? (b) => look.back!(b) : undefined, mounts.back);
    this.animator.reset();

    this.visual.scale.setScalar(def.scale);
    this.label = new Sprite(new SpriteMaterial({ map: labelTexture(def.name, def.boss), transparent: true, depthWrite: false, fog: false }));
    const width = def.boss ? 9 : 5;
    this.label.scale.set(width, width * (96 / 512), 1);
    this.label.position.set(0, PLAYER_HEIGHT * def.scale + (def.boss ? 1.6 : 0.9), 0);
    this.root.add(this.label);

    if (def.boss) {
      // The SEAL: a violet ward around a boss the local player cannot fight yet.
      this.seal = new Mesh(
        new SphereGeometry(def.radius * 1.9, 20, 14),
        new MeshBasicMaterial({ color: 0xb16bff, transparent: true, opacity: 0.22, blending: AdditiveBlending, depthWrite: false }),
      );
      this.seal.position.y = PLAYER_HEIGHT * def.scale * 0.5;
      this.sealRing = new Mesh(
        new PlaneGeometry(def.radius * 5, def.radius * 5),
        new MeshBasicMaterial({ map: worldTextures.runeCircle('#d9a6ff'), transparent: true, depthWrite: false, blending: AdditiveBlending }),
      );
      this.sealRing.rotation.x = -Math.PI / 2;
      this.sealRing.position.y = 0.08;
      this.root.add(this.seal, this.sealRing);
    }
  }

  apply(state: NetEnemyState, sealed: boolean): void {
    this.targetX = state.x;
    this.targetZ = state.z;
    this.targetYaw = state.yaw;
    this.moving = state.moving;
    if (this.lastHits >= 0 && state.hits !== this.lastHits) this.flinch = FLINCH_SECONDS;
    this.lastHits = state.hits;
    if (this.lastSwings >= 0 && state.swings !== this.lastSwings) {
      this.swingTime = 0;
      this.swingVariant = (this.swingVariant + 1) % 2;
    }
    this.lastSwings = state.swings;
    if (this.alive && !state.alive) this.deathTime = 0;
    if (!this.alive && state.alive) {
      this.deathTime = -1;
      this.placed = false;
      this.visual.rotation.set(0, 0, 0);
      this.visual.position.set(0, 0, 0);
    }
    this.alive = state.alive;
    if (this.seal && this.sealRing) {
      this.seal.visible = sealed && state.alive;
      this.sealRing.visible = sealed && state.alive;
    }
  }

  update(dt: number): void {
    const p = this.root.position;
    if (!this.placed) {
      p.set(this.targetX, 0, this.targetZ);
      this.root.rotation.y = this.targetYaw;
      this.placed = true;
    } else {
      const alpha = 1 - Math.exp(-FOLLOW_RATE * dt);
      p.x += (this.targetX - p.x) * alpha;
      p.z += (this.targetZ - p.z) * alpha;
      this.root.rotation.y += shortestAngle(this.root.rotation.y, this.targetYaw) * alpha;
    }

    if (this.deathTime >= 0) {
      this.deathTime += dt;
      const t = Math.min(1, this.deathTime / DEATH_SECONDS);
      this.root.visible = this.deathTime < DEATH_SECONDS + 0.5;
      this.label.visible = false;
      // Topple backward, then sink.
      this.visual.rotation.x = -t * t * 1.45;
      this.visual.position.y = -Math.max(0, this.deathTime - DEATH_SECONDS) * 3;
      return;
    }
    this.root.visible = true;
    this.label.visible = true;

    if (this.swingTime >= 0) {
      this.swingTime += dt;
      if (this.swingTime >= SWING.duration * 1.4) this.swingTime = -1;
    }
    const input = this.input;
    input.grounded = true;
    input.horizontalSpeed = this.moving ? this.def.speed : 0;
    input.swingTime = this.swingTime >= 0 ? this.swingTime / 1.4 : -1;
    input.swingVariant = this.swingVariant;
    input.drawn = true;
    this.animator.update(dt, input);

    if (this.flinch > 0) {
      this.flinch = Math.max(0, this.flinch - dt);
      const k = this.flinch / FLINCH_SECONDS;
      const punch = 1 + 0.12 * k;
      this.visual.scale.set(this.def.scale * punch, this.def.scale * (1 - 0.06 * k), this.def.scale * punch);
      for (const material of this.materials) material.emissive.setScalar(0.9 * k);
    } else {
      this.visual.scale.setScalar(this.def.scale);
    }
    if (this.sealRing?.visible) this.sealRing.rotation.z += dt * 0.6;
  }

  dispose(): void {
    for (const material of this.materials) material.dispose();
    for (const group of this.accessories) {
      group.traverse((child) => {
        const mesh = child as Mesh;
        if (mesh.isMesh) mesh.geometry.dispose();
      });
    }
    (this.label.material as Material).dispose();
    if (this.seal) {
      this.seal.geometry.dispose();
      (this.seal.material as Material).dispose();
    }
    if (this.sealRing) {
      this.sealRing.geometry.dispose();
      (this.sealRing.material as Material).dispose();
    }
    this.root.removeFromParent();
  }
}

/**
 * Every enemy in the room, drawn from replicated state ONLY.
 *
 * Built lazily per stage, only while the local player is near that stage,
 * and torn down when they leave: ten stages of enemies is sixty rigs, and a
 * player can only ever see one or two stages at a time.
 */
export class EnemyManager {
  private readonly visuals = new Map<number, EnemyVisual>();
  private readonly builtStages = new Set<number>();

  constructor(private readonly scene: Scene) {}

  /** The on-screen position of an enemy, if it is built. */
  positionOf(id: number): { x: number; z: number } | null {
    const visual = this.visuals.get(id);
    return visual ? { x: visual.root.position.x, z: visual.root.position.z } : null;
  }

  update(
    dt: number,
    enemies: ArrayLike<NetEnemyState> | null,
    localZ: number,
    killMasks: ArrayLike<number> | null,
  ): void {
    this.cull(localZ);
    if (!enemies) return;
    for (const [id, visual] of this.visuals) {
      const state = enemies[id];
      if (!state) continue;
      const stage = stageByIndex(visual.def.stage);
      const mask = killMasks?.[visual.def.stage - 1] ?? 0;
      const sealed = visual.def.boss && !!stage && (mask & stage.waveMask) !== stage.waveMask;
      visual.apply(state, sealed);
      visual.update(dt);
    }
  }

  private cull(localZ: number): void {
    const stages = new Set<number>();
    for (const def of ENEMIES) stages.add(def.stage);
    for (const stage of stages) {
      const centre = arenaStartZ(stage) + 48;
      const near = Math.abs(localZ - centre) < BUILD_DISTANCE;
      if (near && !this.builtStages.has(stage)) {
        this.builtStages.add(stage);
        for (const def of ENEMIES) {
          if (def.stage !== stage) continue;
          const visual = new EnemyVisual(def);
          this.visuals.set(def.id, visual);
          this.scene.add(visual.root);
        }
      } else if (!near && this.builtStages.has(stage) && Math.abs(localZ - centre) > BUILD_DISTANCE + 40) {
        this.builtStages.delete(stage);
        for (const def of ENEMIES) {
          if (def.stage !== stage) continue;
          this.visuals.get(def.id)?.dispose();
          this.visuals.delete(def.id);
        }
      }
    }
  }

  dispose(): void {
    for (const visual of this.visuals.values()) visual.dispose();
    this.visuals.clear();
    this.builtStages.clear();
  }
}
