import { DEATH_ANIMATION_SECONDS, PLAYER_HEIGHT } from '@katana/shared';
import { AdditiveBlending, CanvasTexture, Group, Mesh, Object3D, SRGBColorSpace, Sprite, SpriteMaterial } from 'three';
import type { AnimationInput } from '../animation/AnimationInput.js';
import { PlayerAnimator, type AnimationState } from '../animation/PlayerAnimator.js';
import { attachToMount, measureMounts } from '../animation/rig/BoneMounts.js';
import { PlayerRig } from '../animation/rig/PlayerRig.js';
import { PLAYER_MODEL_YAW_OFFSET } from '../config/worldVisuals.js';
import { KatanaFx } from '../katana/KatanaFx.js';
import { createKatana, createSaya, createSheathed } from '../katana/KatanaModels.js';
import { PetFollower } from '../pets/PetFollower.js';
import { playerModelLoader } from './PlayerModelLoader.js';

/**
 * The visual half of a player, arranged so animation can never move them.
 *
 *   root          physics transform (position + facing). Gameplay owns it.
 *     fall        the death topple, pivoting at the feet (identity while alive)
 *       visual    the bob and the lean
 *       model     the cloned FBX (or a Bloxity body), posed by the rig
 *         (bones) the katana in the right hand, the scabbard at the left hip
 *   worldRoot     the pets, which float after the player in WORLD space
 *
 * The katana is attached to the BONES, computed once in the bind pose from
 * where the hand and the hip actually are on this body - so it follows every
 * swing and stride and fits the bundled rig and a Bloxity body alike.
 */
export class PlayerCharacter {
  readonly root = new Group();
  readonly worldRoot = new Group();
  readonly pets = new PetFollower();

  private readonly visual = new Group();
  /** Between root and visual: the death topple turns the whole body about the feet. */
  private readonly fall = new Group();
  private readonly souls: Sprite[] = [];
  /** Seconds into the death animation, or -1 while alive. */
  private deathTime = -1;
  private readonly defaultModel: Object3D;
  private model: Object3D;
  private animator: PlayerAnimator;
  private rig: PlayerRig;

  /** Mounts bolted to bones: children are re-parented on every body change. */
  private readonly handMount = new Group();
  private readonly hipMount = new Group();
  private katanaSlot = 0;
  private drawnKatana: Group | null = null;
  private sheathed: Group | null = null;
  private emptySaya: Mesh | null = null;
  private drawn = false;
  /** The rare-katana aura, on the drawn blade and on the sheathed one. */
  private drawnFx: KatanaFx | null = null;
  private sheathedFx: KatanaFx | null = null;

  constructor() {
    // Mounted gear keeps its own materials whatever the avatar code does to the body.
    this.handMount.userData['gear'] = true;
    this.hipMount.userData['gear'] = true;
    this.defaultModel = playerModelLoader.createInstance();
    this.model = this.defaultModel;
    this.model.rotation.y = PLAYER_MODEL_YAW_OFFSET;
    this.root.add(this.fall);
    this.fall.add(this.visual);
    this.visual.add(this.model);
    this.rig = new PlayerRig(this.model, this.model);
    this.animator = new PlayerAnimator(this.rig, this.visual);
    this.worldRoot.add(this.pets.root);
    this.mountWeapons();
  }

  get body(): { visual: Group; model: Object3D } {
    return { visual: this.visual, model: this.model };
  }

  get height(): number {
    return PLAYER_HEIGHT;
  }

  /** Wear a different body, or null for the bundled one. */
  setModel(next: Object3D | null): Object3D {
    const target = next ?? this.defaultModel;
    if (target === this.model) return target;
    const previous = this.model;
    previous.removeFromParent();
    // The katana mounts ride the old body's bones: take them off BEFORE its
    // materials are released, or the shared katana materials go with them.
    this.handMount.removeFromParent();
    this.hipMount.removeFromParent();
    releaseBody(previous);
    target.rotation.y = PLAYER_MODEL_YAW_OFFSET;
    this.rig = new PlayerRig(target, target);
    this.rig.resetToBindPose();
    target.updateMatrixWorld(true);
    this.model = target;
    this.visual.add(target);
    this.animator.setRig(this.rig);
    this.mountWeapons();
    return target;
  }

  /** Which katana this player wears. Cheap when unchanged. */
  setKatana(slot: number): void {
    if (slot === this.katanaSlot) return;
    this.katanaSlot = slot;
    this.drawnKatana?.removeFromParent();
    this.sheathed?.removeFromParent();
    this.emptySaya?.removeFromParent();
    this.drawnKatana = createKatana(slot);
    this.sheathed = createSheathed(slot);
    this.emptySaya = createSaya(slot);
    this.drawnFx = new KatanaFx(slot, false);
    this.sheathedFx = new KatanaFx(slot, true);
    if (this.drawnFx.active) this.drawnKatana.add(this.drawnFx.root);
    if (this.sheathedFx.active) this.sheathed.add(this.sheathedFx.root);
    this.handMount.add(this.drawnKatana);
    this.hipMount.add(this.sheathed, this.emptySaya);
    this.applyDrawn();
  }

  /** Katana in hand (true) or in its scabbard (false). */
  setDrawn(drawn: boolean): void {
    if (drawn === this.drawn) return;
    this.drawn = drawn;
    this.applyDrawn();
  }

  private applyDrawn(): void {
    if (this.drawnKatana) this.drawnKatana.visible = this.drawn;
    if (this.sheathed) this.sheathed.visible = !this.drawn;
    if (this.emptySaya) this.emptySaya.visible = this.drawn;
  }

  /**
   * Bolt the hand and hip mounts to this body's bones.
   *
   * In the bind pose, with the character at the origin: the HAND is one
   * forearm-length past the elbow along the forearm; the grip there points
   * the blade forward, edge down the arm. The SCABBARD rides the left hip,
   * hilt forward and a little up, edge up - how a katana is worn. Both are
   * then expressed in their bone's local space, so the rig carries them.
   */
  private mountWeapons(): void {
    const savedPosition = this.root.position.clone();
    const savedYaw = this.root.rotation.y;
    this.root.position.set(0, 0, 0);
    this.root.rotation.set(0, 0, 0);
    this.fall.position.set(0, 0, 0);
    this.fall.rotation.set(0, 0, 0);
    this.visual.position.set(0, 0, 0);
    this.visual.rotation.set(0, 0, 0);
    this.rig.resetToBindPose();
    this.root.updateMatrixWorld(true);

    const mounts = measureMounts(this.rig, this.root);
    if (mounts.hand) attachToMount(this.handMount, mounts.hand, this.root);
    if (mounts.hip) attachToMount(this.hipMount, mounts.hip, this.root);

    this.root.position.copy(savedPosition);
    this.root.rotation.y = savedYaw;
    this.root.updateMatrixWorld(true);
    this.animator.reset();
  }

  setPosition(x: number, y: number, z: number): void {
    this.root.position.set(x, y, z);
  }

  setYaw(yaw: number): void {
    this.root.rotation.y = yaw;
  }

  update(delta: number, input: AnimationInput): void {
    this.animator.update(Math.max(0, delta), input);
    const time = performance.now() / 1000;
    this.drawnFx?.update(time);
    this.sheathedFx?.update(time);
    this.updateDeath(Math.max(0, delta));
  }

  get isDying(): boolean {
    return this.deathTime >= 0;
  }

  /**
   * Fall (true) or stand back up (false). The fall plays once, from where the
   * player stands: stagger, topple backwards onto the ground with a small
   * bounce, lie still, then sink away as spirit lights rise. It lasts
   * `DEATH_ANIMATION_SECONDS`; the server holds the respawn until after that.
   */
  setDead(dead: boolean): void {
    if (dead === this.deathTime >= 0) return;
    if (dead) {
      this.deathTime = 0;
      this.spawnSouls();
    } else {
      this.deathTime = -1;
      this.fall.position.set(0, 0, 0);
      this.fall.rotation.set(0, 0, 0);
      this.fall.visible = true;
      this.clearSouls();
    }
  }

  private updateDeath(delta: number): void {
    if (this.deathTime < 0) return;
    this.deathTime += delta;
    const t = this.deathTime;
    const end = DEATH_ANIMATION_SECONDS;
    const f = this.fall;
    // 0 - 0.22 s: the blow lands - a stagger back and a buckle at the knees.
    // 0.22 - 0.8 s: the topple, accelerating like a falling body, onto the back.
    // 0.8 - 1.05 s: the thump: a small bounce off the ground.
    // then still, and from 1.35 s the body sinks away as the lights rise.
    const TOPPLE = -Math.PI / 2;
    let tilt = 0;
    let lift = 0;
    let sink = 0;
    if (t < 0.22) {
      const k = t / 0.22;
      tilt = -0.22 * Math.sin(k * Math.PI * 0.5);
      sink = 0.18 * k;
    } else if (t < 0.8) {
      const k = (t - 0.22) / 0.58;
      tilt = -0.22 + (TOPPLE + 0.22) * k * k;
      sink = 0.18;
      lift = 0.38 * k;
    } else if (t < 1.05) {
      const k = (t - 0.8) / 0.25;
      tilt = TOPPLE + Math.sin(k * Math.PI) * 0.12;
      lift = 0.38 + Math.sin(k * Math.PI) * 0.18;
      sink = 0.18;
    } else {
      tilt = TOPPLE;
      lift = 0.38;
      sink = 0.18 + (t > 1.35 ? Math.min(1, (t - 1.35) / (end - 1.35)) ** 2 * 1.6 : 0);
    }
    f.rotation.x = tilt;
    // Lying on its back the body would be half in the ground: lift it onto it, then let it sink.
    f.position.y = lift - sink;
    f.position.z = -0.2 * Math.min(1, t / 0.8);
    f.visible = t < end;
    this.updateSouls(t);
  }

  private spawnSouls(): void {
    this.clearSouls();
    const material = soulMaterial();
    for (let i = 0; i < 7; i += 1) {
      const sprite = new Sprite(material);
      sprite.visible = false;
      sprite.userData['angle'] = (i / 7) * Math.PI * 2 + Math.random() * 0.6;
      sprite.userData['delay'] = 1.1 + i * 0.09;
      this.worldRoot.add(sprite);
      this.souls.push(sprite);
    }
  }

  /** Spirit lights: rising from where the body lies, drifting outwards, fading. */
  private updateSouls(t: number): void {
    const p = this.root.position;
    for (const sprite of this.souls) {
      const k = (t - (sprite.userData['delay'] as number)) / 0.9;
      if (k < 0 || k >= 1) {
        sprite.visible = false;
        continue;
      }
      const angle = sprite.userData['angle'] as number;
      sprite.visible = true;
      sprite.position.set(p.x + Math.cos(angle) * (0.4 + k * 0.9), p.y + 0.4 + k * 3.2, p.z + Math.sin(angle) * (0.4 + k * 0.9));
      sprite.scale.setScalar(0.9 * Math.sin(k * Math.PI) + 0.05);
    }
  }

  private clearSouls(): void {
    for (const sprite of this.souls) sprite.removeFromParent();
    this.souls.length = 0;
  }

  /** Advance the pets, after the body has moved. */
  updatePets(delta: number): void {
    const p = this.root.position;
    this.pets.update(delta, p.x, p.y, p.z, this.root.rotation.y);
  }

  get animationState(): AnimationState {
    return this.animator.currentState;
  }

  resetAnimation(): void {
    this.animator.reset();
    this.pets.snap();
  }

  dispose(): void {
    this.clearSouls();
    this.pets.dispose();
    this.root.removeFromParent();
    this.worldRoot.removeFromParent();
  }
}

/** Let go of a Bloxity body's materials when it is swapped out. */
const releaseBody = (model: Object3D): void => {
  if (model.userData['bloxityBody'] !== true) return;
  model.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
    else material?.dispose();
  });
};

let soulSprite: SpriteMaterial | null = null;
/** A pale spirit light, shared by every death. */
const soulMaterial = (): SpriteMaterial => {
  if (soulSprite) return soulSprite;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(32, 32, 1, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.3, 'rgba(190,230,255,0.6)');
  gradient.addColorStop(1, 'rgba(120,180,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  soulSprite = new SpriteMaterial({ map: texture, transparent: true, blending: AdditiveBlending, depthWrite: false, fog: false });
  return soulSprite;
};
