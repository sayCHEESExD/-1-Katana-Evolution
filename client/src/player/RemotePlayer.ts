import { COMBAT } from '@katana/shared';
import { createAnimationInput, type AnimationInput } from '../animation/AnimationInput.js';
import { AvatarDresser } from '../bloxity/AvatarDresser.js';
import { lookFromState } from '../bloxity/avatarLook.js';
import { SWING } from '../config/animationConfig.js';
import type { NetPlayerState } from '../net/netTypes.js';
import { NamePlate } from './NamePlate.js';
import { PlayerCharacter } from './PlayerCharacter.js';

const FOLLOW_RATE = 14;
const SNAP_DISTANCE = 14;
const FACE_SECONDS = 0.35;

const shortestAngle = (from: number, to: number): number => {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
};

/**
 * Another player's samurai, rendered from replicated state ONLY.
 *
 * The transform is smoothed toward the replicated one. Swings are derived
 * from the replicated `attackCount`: every increase is one swing to play,
 * facing `attackYaw` - a difference against the count first seen, never a
 * replay of somebody's whole session.
 */
export class RemotePlayer {
  readonly character: PlayerCharacter;

  private readonly plate = new NamePlate();
  private targetX = 0;
  private targetY = 0;
  private targetZ = 0;
  private targetYaw = 0;
  private readonly input: AnimationInput = createAnimationInput();
  private placed = false;
  private readonly dresser: AvatarDresser;
  private lastLook = '';
  private lastAttackCount = -1;
  private swingTime = -1;
  private swingVariant = 0;
  private drawnFor = 0;
  private faceYaw = 0;
  private faceFor = 0;
  private wasGrounded = true;
  private readonly petIds: number[] = [];
  private katanaSlot = 1;
  onSwing: ((x: number, y: number, z: number, yaw: number, katana: number, backhand: boolean) => void) | null = null;

  get position(): { readonly x: number; readonly y: number; readonly z: number } {
    return { x: this.targetX, y: this.targetY, z: this.targetZ };
  }

  constructor(state: NetPlayerState) {
    this.character = new PlayerCharacter();
    this.character.root.add(this.plate.sprite);
    this.dresser = new AvatarDresser(this.character);
    this.apply(state);
    this.character.setPosition(this.targetX, this.targetY, this.targetZ);
    this.character.setYaw(this.targetYaw);
    this.placed = true;
  }

  apply(state: NetPlayerState): void {
    this.targetX = state.x;
    this.targetY = state.y;
    this.targetZ = state.z;
    this.targetYaw = state.rotationY;
    this.plate.set(state.displayName, state.avatarUrl, this.character.height);

    this.input.grounded = state.grounded;
    this.input.horizontalSpeed = state.speed;
    this.input.verticalVelocity = state.verticalVelocity;
    this.katanaSlot = state.katanaSlot;
    this.character.setKatana(state.katanaSlot);

    this.petIds.length = 0;
    for (let i = 0; i < state.pets.length; i += 1) {
      const pet = state.pets[i];
      if (pet?.equipped) this.petIds.push(pet.petId);
    }
    this.character.pets.setPets(this.petIds);

    if (this.lastAttackCount >= 0 && state.attackCount > this.lastAttackCount) {
      this.swingTime = 0;
      this.swingVariant = (this.swingVariant + 1) % 2;
      this.drawnFor = COMBAT.drawnSeconds;
      this.faceYaw = state.attackYaw;
      this.faceFor = FACE_SECONDS;
      this.onSwing?.(state.x, state.y, state.z, state.attackYaw, this.katanaSlot, this.swingVariant === 1);
    }
    this.lastAttackCount = state.attackCount;
    this.character.setDead(state.dead === true);
    this.dressFrom(state);
  }

  private dressFrom(state: NetPlayerState): void {
    const avatar = state.avatar;
    if (!avatar) return;
    const look = lookFromState(avatar);
    const key = JSON.stringify(look);
    if (key === this.lastLook) return;
    this.lastLook = key;
    this.dresser.setLook(look.appearance, look.proportions);
  }

  update(delta: number): void {
    const dt = Math.max(0, delta);
    const position = this.character.root.position;
    const gap = Math.hypot(this.targetX - position.x, this.targetY - position.y, this.targetZ - position.z);
    if (!this.placed || gap > SNAP_DISTANCE) {
      position.set(this.targetX, this.targetY, this.targetZ);
      this.character.setYaw(this.targetYaw);
      this.character.pets.snap();
      this.placed = true;
    } else {
      const alpha = 1 - Math.exp(-FOLLOW_RATE * dt);
      position.x += (this.targetX - position.x) * alpha;
      position.y += (this.targetY - position.y) * alpha;
      position.z += (this.targetZ - position.z) * alpha;
      const yaw = this.character.root.rotation.y;
      const want = this.faceFor > 0 && this.input.horizontalSpeed < 6 ? this.faceYaw : this.targetYaw;
      this.character.setYaw(yaw + shortestAngle(yaw, want) * Math.min(1, alpha * 1.5));
    }

    if (this.swingTime >= 0) {
      this.swingTime += dt;
      if (this.swingTime >= SWING.duration) this.swingTime = -1;
    }
    this.drawnFor = Math.max(0, this.drawnFor - dt);
    this.faceFor = Math.max(0, this.faceFor - dt);

    this.input.landed = this.input.grounded && !this.wasGrounded;
    this.wasGrounded = this.input.grounded;
    this.input.swingTime = this.swingTime;
    this.input.swingVariant = this.swingVariant;
    this.input.drawn = this.drawnFor > 0;
    this.character.setDrawn(this.drawnFor > 0);
    this.character.update(dt, this.input);
    this.character.updatePets(dt);
  }

  dispose(): void {
    this.plate.dispose();
    this.dresser.dispose();
    this.character.dispose();
  }
}
