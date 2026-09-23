import { KATANA_PADS, katanaBySlot, ownsKatana, type KatanaTier } from '@katana/shared';
import type { PlayerState } from '../rooms/state/PlayerState.js';
import type { ProgressionService } from './ProgressionService.js';
import { wallet } from './Wallet.js';

export type KatanaResult =
  | { readonly ok: true; readonly action: 'bought' | 'equipped'; readonly tier: KatanaTier }
  | { readonly ok: false; readonly reason: 'unknown' | 'not-on-pad' | 'too-few-wins' | 'already-worn'; readonly tier?: KatanaTier };

/** Slack on the pad footprint, for the latency between the client's step and the server's. */
const PAD_SLACK = 1.2;

/**
 * Server authority over the Katana Stage.
 *
 * Walking onto a pad is a REQUEST: the server checks the player is standing on
 * that pad by its own simulated position, then either BUYS the katana (the
 * Wins are spent through the wallet, then it is owned and worn) or, if already
 * owned, wears it. Damage is re-derived afterwards.
 */
export class KatanaService {
  pad(player: PlayerState, slotRaw: unknown, progression: ProgressionService): KatanaResult {
    const slot = Math.floor(Number(slotRaw));
    const tier = katanaBySlot(slot);
    const pad = KATANA_PADS.find((entry) => entry.slot === slot);
    if (!tier || !pad) return { ok: false, reason: 'unknown' };

    const half = pad.half + PAD_SLACK;
    if (Math.abs(player.x - pad.x) > half || Math.abs(player.z - pad.z) > half || Math.abs(player.y - pad.y) > 1.5) {
      return { ok: false, reason: 'not-on-pad', tier };
    }

    if (ownsKatana(player.ownedKatanas, slot)) {
      if (player.katanaSlot === slot) return { ok: false, reason: 'already-worn', tier };
      player.katanaSlot = slot;
      progression.syncDerived(player);
      return { ok: true, action: 'equipped', tier };
    }

    if (!wallet.spend(player, tier.cost)) return { ok: false, reason: 'too-few-wins', tier };
    player.ownedKatanas |= 1 << (slot - 1);
    player.katanaSlot = slot;
    progression.syncDerived(player);
    return { ok: true, action: 'bought', tier };
  }
}
