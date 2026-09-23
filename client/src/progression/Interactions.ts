import {
  EGG_PLACEMENTS,
  FORGE,
  KATANA_PADS,
  PETS_SHOP,
  STAGES,
  inRect,
  rewardPadOf,
} from '@katana/shared';

export interface InteractionHandlers {
  katanaPad(slot: number): void;
  forge(open: boolean): void;
  egg(egg: number | null): void;
  claimStage(stage: number): void;
}

/** Seconds between repeat claims while standing on an armed reward pad. */
const CLAIM_RETRY = 0.6;

/**
 * WHERE THE LOCAL PLAYER IS STANDING, and what that asks the server for.
 *
 * Every pad is an EDGE: stepping onto a katana pad asks once (buy or equip);
 * stepping onto the forge mat opens the shop and stepping off closes it; an
 * egg pad opens that egg's hatch menu; a reward pad claims the stage's Wins
 * while its wave is cleared. Every request is checked again by the server
 * against its own simulated position - this only decides when to ask.
 */
export class Interactions {
  private katana = 0;
  private inForge = false;
  private egg: number | null = null;
  private rewardStage = 0;
  private claimTimer = 0;

  constructor(private readonly handlers: InteractionHandlers) {}

  update(delta: number, x: number, y: number, z: number, grounded: boolean, killMasks: ArrayLike<number> | null): void {
    // Katana pads.
    let onKatana = 0;
    if (grounded) {
      for (const pad of KATANA_PADS) {
        if (Math.abs(x - pad.x) <= pad.half && Math.abs(z - pad.z) <= pad.half && Math.abs(y - pad.y) < 0.6) {
          onKatana = pad.slot;
          break;
        }
      }
    }
    if (onKatana !== this.katana) {
      this.katana = onKatana;
      if (onKatana > 0) this.handlers.katanaPad(onKatana);
    }

    // The forge mat.
    const inForge = inRect(x, z, FORGE.trigger) && y < 2;
    if (inForge !== this.inForge) {
      this.inForge = inForge;
      this.handlers.forge(inForge);
    }

    // Egg pads.
    let egg: number | null = null;
    for (const placement of EGG_PLACEMENTS) {
      if (Math.abs(x - placement.x) <= PETS_SHOP.padHalf + 0.3 && Math.abs(z - PETS_SHOP.padZ) <= PETS_SHOP.padHalf + 0.3 && y < 2) {
        egg = placement.egg;
        break;
      }
    }
    if (egg !== this.egg) {
      this.egg = egg;
      this.handlers.egg(egg);
    }

    // Reward pads.
    let reward = 0;
    for (const stage of STAGES) {
      const pad = rewardPadOf(stage.index);
      if (Math.abs(x - pad.x) <= pad.half && Math.abs(z - pad.z) <= pad.half && y < 2) {
        reward = stage.index;
        break;
      }
    }
    this.claimTimer -= delta;
    if (reward !== this.rewardStage) {
      this.rewardStage = reward;
      this.claimTimer = 0;
    }
    if (reward > 0 && this.claimTimer <= 0) {
      const stage = STAGES[reward - 1]!;
      if ((killMasks?.[reward - 1] ?? 0) === stage.fullMask) {
        this.claimTimer = CLAIM_RETRY;
        this.handlers.claimStage(reward);
      }
    }
  }

  /** Forget where the player was: a teleport starts every edge fresh. */
  reset(): void {
    this.katana = 0;
    if (this.inForge) this.handlers.forge(false);
    this.inForge = false;
    if (this.egg !== null) this.handlers.egg(null);
    this.egg = null;
    this.rewardStage = 0;
  }
}
