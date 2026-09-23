import type { Group } from 'three';
import { AIRBORNE, GUARD, IDLE, LANDING, LOCOMOTION, SWING, TRANSITIONS } from '../config/animationConfig.js';
import type { AnimationInput } from './AnimationInput.js';
import { LocomotionCycle } from './LocomotionCycle.js';
import { PoseBuffer, type PoseDefinition } from './PoseBuffer.js';
import type { PlayerRig } from './rig/PlayerRig.js';
import { BONE_INDEX, type BoneName } from './rig/boneNames.js';

/** The body's state. The katana swing is a LAYER over it, not a state. */
export type AnimationState = 'idle' | 'run' | 'airborne' | 'landing';

const clamp = (value: number, min: number, max: number): number => (value < min ? min : value > max ? max : value);
const ease = (t: number): number => t * t * (3 - 2 * t);

/** The bones the swing layer owns while it plays. */
const UPPER: readonly BoneName[] = ['ArmL1', 'ArmL2', 'ArmR1', 'ArmR2', 'Spine1', 'Spine2', 'Neck1'];

/**
 * Writes ONLY to bones (via `PlayerRig`) and to the visual node's position and
 * rotation. It never touches the physics root.
 *
 * The body runs, idles, jumps and lands; the KATANA layer - a swing, or the
 * guard held just after one - overrides the arms and torso on top of that, so
 * a player can swing while running and the legs keep their cycle.
 */
export class PlayerAnimator {
  private readonly locomotion = new LocomotionCycle();
  private readonly target = new PoseBuffer();
  private readonly from = new PoseBuffer();
  private readonly output = new PoseBuffer();
  private readonly layer = new PoseBuffer();
  private readonly layerB = new PoseBuffer();

  private state: AnimationState = 'idle';
  private stateTime = 0;
  private blendTime = 0;
  private blendDuration = 0;
  private idleTime = 0;
  private wasGrounded = true;
  private bank = 0;
  private lean = 0;
  /** 0..1 weight of the drawn-katana guard, eased. */
  private guard = 0;

  constructor(
    private rig: PlayerRig,
    private readonly visual: Group,
  ) {}

  get currentState(): AnimationState {
    return this.state;
  }

  setRig(rig: PlayerRig): void {
    this.rig = rig;
  }

  reset(): void {
    this.state = 'idle';
    this.stateTime = 0;
    this.blendDuration = 0;
    this.wasGrounded = true;
    this.bank = 0;
    this.lean = 0;
    this.guard = 0;
    this.target.reset();
    this.from.reset();
    this.output.reset();
    this.rig.resetToBindPose();
    this.visual.position.set(0, 0, 0);
    this.visual.rotation.set(0, 0, 0);
  }

  update(delta: number, input: AnimationInput): void {
    const dt = Math.max(0, delta);
    this.stateTime += dt;
    this.resolveState(input);
    this.writePose(dt, input);
    this.blend(dt);
    this.applyKatanaLayer(dt, input);
    this.rig.applyPose(this.output);
    this.applyVisual(dt, input);
  }

  private resolveState(input: AnimationInput): void {
    if (input.landed || (input.grounded && !this.wasGrounded)) {
      this.wasGrounded = true;
      this.setState('landing', TRANSITIONS.toLanding);
      return;
    }
    this.wasGrounded = input.grounded;
    if (!input.grounded) {
      this.setState('airborne', TRANSITIONS.toAirborne);
      return;
    }
    if (this.state === 'landing' && this.stateTime < LANDING.duration) return;
    this.setState(input.horizontalSpeed < LOCOMOTION.idleSpeed ? 'idle' : 'run', TRANSITIONS.toLocomotion);
  }

  private setState(next: AnimationState, duration: number): void {
    if (next === this.state) return;
    this.from.copyFrom(this.output);
    this.state = next;
    this.stateTime = 0;
    this.blendTime = 0;
    this.blendDuration = duration;
  }

  private writePose(dt: number, input: AnimationInput): void {
    switch (this.state) {
      case 'idle': {
        this.locomotion.settleTowardNeutral(dt);
        this.idleTime += dt;
        const breath = Math.sin(this.idleTime * IDLE.breathFrequency * Math.PI * 2);
        this.target.applyDefinition(IDLE.basePose);
        this.target.add('Spine1', breath * IDLE.breathAmount);
        this.target.add('Neck1', -breath * IDLE.breathAmount * 0.6);
        this.target.bobY = breath * IDLE.breathBob;
        break;
      }
      case 'run':
        this.locomotion.advance(dt, input.horizontalSpeed, 1, false);
        this.locomotion.writePose(this.target, input.horizontalSpeed, 1);
        // The left hand steadies the scabbard while running.
        this.target.add('ArmL1', -0.1, 0, 0.18);
        break;
      case 'airborne': {
        const rising = clamp(input.verticalVelocity / AIRBORNE.velocityReference, -1, 1);
        this.target.applyDefinition(AIRBORNE.fall);
        this.layerB.applyDefinition(AIRBORNE.rise);
        this.target.lerpBetween(this.target, this.layerB, clamp(0.5 + rising * 0.5, 0, 1));
        this.target.bobY = 0;
        break;
      }
      case 'landing': {
        const depth = 1 - ease(clamp(this.stateTime / LANDING.duration, 0, 1));
        this.target.applyDefinition(LANDING.pose, depth);
        this.target.bobY = LANDING.bobY * depth;
        break;
      }
    }
  }

  private blend(dt: number): void {
    if (this.blendDuration > 0) {
      this.blendTime += dt;
      const t = clamp(this.blendTime / this.blendDuration, 0, 1);
      this.output.lerpBetween(this.from, this.target, ease(t));
      if (t >= 1) this.blendDuration = 0;
    } else {
      this.output.copyFrom(this.target);
    }
  }

  /**
   * THE KATANA LAYER: the swing while it plays, else the drawn guard (eased),
   * else nothing - the sheathed run and idle show through untouched.
   */
  private applyKatanaLayer(dt: number, input: AnimationInput): void {
    this.guard += ((input.drawn ? 1 : 0) - this.guard) * (1 - Math.exp(-10 * dt));
    const swinging = input.swingTime >= 0 && input.swingTime < SWING.duration;

    if (swinging) {
      const variant = input.swingVariant % 2 === 0 ? SWING.forehand : SWING.backhand;
      const t = input.swingTime / SWING.duration;
      if (t < SWING.windEnd) {
        // Guard -> wind.
        this.layerB.applyDefinition(GUARD);
        this.layer.applyDefinition(variant.wind);
        this.layer.lerpBetween(this.layerB, this.layer, ease(t / SWING.windEnd));
      } else if (t < SWING.cutEnd) {
        // Wind -> cut, fast.
        const k = (t - SWING.windEnd) / (SWING.cutEnd - SWING.windEnd);
        this.layerB.applyDefinition(variant.wind);
        this.layer.applyDefinition(variant.cut);
        this.layer.lerpBetween(this.layerB, this.layer, k * k * (3 - 2 * k));
      } else {
        // Cut -> guard.
        const k = (t - SWING.cutEnd) / (1 - SWING.cutEnd);
        this.layerB.applyDefinition(variant.cut);
        this.layer.applyDefinition(GUARD);
        this.layer.lerpBetween(this.layerB, this.layer, ease(k));
      }
      this.overrideUpper(this.layer, 1);
      if (this.state === 'idle') this.addLegs(SWING.lunge, Math.sin(Math.PI * clamp(t, 0, 1)));
      return;
    }
    if (this.guard > 0.01) {
      this.layer.applyDefinition(GUARD);
      this.overrideUpper(this.layer, this.guard);
    }
  }

  private overrideUpper(layer: PoseBuffer, weight: number): void {
    const out = this.output.rotations;
    const src = layer.rotations;
    for (const bone of UPPER) {
      const at = boneIndex(bone);
      for (let k = 0; k < 3; k += 1) {
        const a = out[at + k] ?? 0;
        const b = src[at + k] ?? 0;
        out[at + k] = a + (b - a) * weight;
      }
    }
  }

  private addLegs(definition: PoseDefinition, weight: number): void {
    for (const [bone, rotation] of Object.entries(definition) as [BoneName, { x?: number; y?: number; z?: number }][]) {
      this.output.add(bone, (rotation.x ?? 0) * weight, (rotation.y ?? 0) * weight, (rotation.z ?? 0) * weight);
    }
  }

  private applyVisual(dt: number, input: AnimationInput): void {
    const swinging = input.swingTime >= 0 && input.swingTime < SWING.duration;
    const wantLean = swinging ? SWING.lean * Math.sin(Math.PI * clamp(input.swingTime / SWING.duration, 0, 1)) : 0;
    this.lean += (wantLean - this.lean) * (1 - Math.exp(-18 * dt));
    const wantBank = this.state === 'run' ? -input.turn * LOCOMOTION.bankAngle * 0.6 : 0;
    this.bank += (wantBank - this.bank) * (1 - Math.exp(-LOCOMOTION.bankRate * dt));
    this.visual.rotation.set(this.lean, 0, this.bank);
    this.visual.position.y = this.output.bobY;
  }
}

const boneIndex = (bone: BoneName): number => BONE_INDEX[bone] * 3;
