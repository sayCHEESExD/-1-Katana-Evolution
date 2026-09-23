import { FORGE, forgeOffers, forgeRotationAt, inRect, type ForgeOffer } from '@katana/shared';
import type { PlayerState } from '../rooms/state/PlayerState.js';
import type { ProgressionService } from './ProgressionService.js';
import { wallet } from './Wallet.js';

export type ForgeResult =
  | { readonly ok: true; readonly offer: ForgeOffer }
  | { readonly ok: false; readonly reason: 'stale' | 'unknown' | 'away' | 'sold-out' | 'too-few-wins'; readonly offer?: ForgeOffer };

/**
 * Server authority over the Forge Shop.
 *
 * The stock is a pure function of the rotation number (`forgeOffers`), and
 * the rotation is the SERVER's wall clock. A purchase names the rotation the
 * client saw: if the stock has turned over since, the purchase is refused
 * rather than silently buying something else. Stock is per player per
 * rotation; the bonus is added to the player's forge total and damage is
 * re-derived.
 */
export class ForgeService {
  get rotation(): number {
    return forgeRotationAt(Date.now());
  }

  /** Reset a player's per-slot counts when the stock has turned over. */
  sync(player: PlayerState): void {
    const rotation = this.rotation;
    if (player.forgeRotation === rotation) return;
    player.forgeRotation = rotation;
    for (let i = 0; i < player.forgeBought.length; i += 1) player.forgeBought[i] = 0;
  }

  buy(player: PlayerState, rotationRaw: unknown, slotRaw: unknown, progression: ProgressionService): ForgeResult {
    this.sync(player);
    const rotation = this.rotation;
    if (Math.floor(Number(rotationRaw)) !== rotation) return { ok: false, reason: 'stale' };
    const slot = Math.floor(Number(slotRaw));
    const offer = forgeOffers(rotation)[slot];
    if (!offer) return { ok: false, reason: 'unknown' };
    if (!inRect(player.x, player.z, FORGE.serviceArea)) return { ok: false, reason: 'away', offer };
    if ((player.forgeBought[slot] ?? 0) >= offer.item.stock) return { ok: false, reason: 'sold-out', offer };
    if (!wallet.spend(player, offer.item.cost)) return { ok: false, reason: 'too-few-wins', offer };

    player.forgeBought[slot] = (player.forgeBought[slot] ?? 0) + 1;
    player.forgePercent = Math.round((player.forgePercent + offer.bonus) * 10) / 10;
    progression.syncDerived(player);
    return { ok: true, offer };
  }
}
