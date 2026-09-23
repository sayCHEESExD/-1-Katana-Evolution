import {
  FORGE_RARITIES,
  forgeOffers,
  formatClock,
  formatPercent,
  formatWins,
  type ForgeOffer,
} from '@katana/shared';
import { ICONS } from './hudStyles.js';
import { forgeIcon } from './forgeIcons.js';
import { injectKatanaStyles } from './katanaStyles.js';
import { Panel } from './Panel.js';

/**
 * THE FORGE SHOP: this rotation's four items - one per rarity - with their
 * stock, bonus and price, and the countdown to the next restock. The stock
 * shown is the SERVER's rotation (replicated), so it turns over for everyone
 * at the same moment; a purchase names that rotation and the server refuses
 * it if the stock has since moved on.
 */
export class ForgePanel extends Panel {
  private readonly timer: HTMLDivElement;
  private readonly total: HTMLDivElement;
  private readonly grid: HTMLDivElement;
  private rotation = -1;
  private wins = 0;
  private bought: readonly number[] = [];
  private forgePercent = 0;
  private offers: ForgeOffer[] = [];
  private signature = '';

  constructor(parent: HTMLElement, private readonly buy: (rotation: number, slot: number) => void) {
    super(parent, 'forge', 'Forge Shop');
    injectKatanaStyles();
    const top = document.createElement('div');
    top.className = 'ke-forge__top';
    this.timer = document.createElement('div');
    this.timer.className = 'ke-forge__timer ke-outline';
    this.total = document.createElement('div');
    this.total.className = 'ke-forge__total';
    top.append(this.timer, this.total);
    this.grid = document.createElement('div');
    this.grid.className = 'ke-forge__grid';
    this.body.append(top, this.grid);
  }

  /** The replicated stock clock and this player's purchases in it. */
  setState(rotation: number, secondsLeft: number, wins: number, bought: ArrayLike<number>, forgePercent: number, playerRotation: number): void {
    this.timer.textContent = `Next restock in ${formatClock(secondsLeft)}`;
    if (rotation !== this.rotation) {
      this.rotation = rotation;
      this.offers = forgeOffers(rotation);
    }
    this.wins = wins;
    // Counts from an older rotation are a rotation that has turned over: nothing bought yet.
    this.bought = playerRotation === rotation ? Array.from(bought) : [];
    this.forgePercent = forgePercent;
    if (this.isOpen) this.render();
  }

  protected override onOpened(): void {
    this.signature = '';
    this.render();
  }

  private render(): void {
    const signature = `${this.rotation}:${this.wins}:${this.bought.join(',')}:${this.forgePercent}`;
    if (signature === this.signature) return;
    this.signature = signature;
    this.total.textContent = `Your forge bonus: ${formatPercent(this.forgePercent)} damage`;
    this.grid.replaceChildren(
      ...this.offers.map((offer) => {
        const rarity = FORGE_RARITIES[offer.slot]!;
        const card = document.createElement('div');
        card.className = 'ke-card';
        card.style.setProperty('--rarity', rarity.color);
        const left = Math.max(0, offer.item.stock - (this.bought[offer.slot] ?? 0));
        card.innerHTML =
          `<div class="ke-card__rarity ke-outline">${rarity.label}</div>` +
          `<div class="ke-card__name ke-outline">${escape(offer.item.name)}</div>` +
          `<div class="ke-card__stock">${left}/${offer.item.stock}</div>` +
          `<img class="ke-card__icon" src="${forgeIcon(offer.item.icon)}" alt="">` +
          `<div class="ke-card__perfect ke-outline">${offer.perfect ? 'PERFECT' : ''}</div>` +
          `<div class="ke-card__bonus ke-outline">${formatPercent(offer.bonus)} Damage</div>`;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ke-buy';
        const affordable = this.wins >= offer.item.cost;
        button.disabled = left <= 0 || !affordable;
        button.innerHTML = left <= 0 ? 'SOLD OUT' : `${ICONS.trophy}<span>${formatWins(offer.item.cost)}</span>`;
        button.addEventListener('click', () => this.buy(this.rotation, offer.slot));
        card.appendChild(button);
        return card;
      }),
    );
  }
}

const escape = (text: string): string => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
