import { canRebirth, maxLevelFor, rebirthSpeedMultiplier } from '@katana/shared';
import type { PlayerState } from '../rooms/state/PlayerState.js';
import type { ProgressionService } from './ProgressionService.js';

export type RebirthResult =
  | { readonly ok: true; readonly rebirths: number; readonly speedMultiplier: number; readonly maxLevel: number }
  | { readonly ok: false; readonly reason: 'not-eligible' };

/**
 * Server authority over rebirths.
 *
 * Eligibility is the server's own level against the current cap: Rebirth 0
 * needs Level 15, Rebirth 1 needs Level 30, and so on. A rebirth resets level
 * and XP ("Rebirth resets your progress!") for a permanently higher cap, a
 * bigger speed multiplier and +10% damage. Wins, katanas, training, forge
 * upgrades, pets and opened stages are kept. The client sends an empty message.
 */
export class RebirthService {
  rebirth(player: PlayerState, progression: ProgressionService): RebirthResult {
    if (!canRebirth(player.level, player.rebirths)) return { ok: false, reason: 'not-eligible' };
    player.rebirths += 1;
    player.xp = 0;
    progression.syncDerived(player);
    return {
      ok: true,
      rebirths: player.rebirths,
      speedMultiplier: rebirthSpeedMultiplier(player.rebirths),
      maxLevel: maxLevelFor(player.rebirths),
    };
  }
}
