import {
  KATANAS,
  TRAINING_TIERS,
  baseSpeedFor,
  damageBreakdown,
  formatAmount,
  formatMultiplier,
  formatPercent,
  ownsKatana,
  rebirthSpeedMultiplier,
  type DamageInputs,
} from '@katana/shared';
import { ICONS } from './hudStyles.js';
import { injectKatanaStyles } from './katanaStyles.js';
import { Panel } from './Panel.js';

/**
 * THE BAG: where the numbers come from. The damage formula, factor by
 * factor, exactly as the server evaluates it - katana x training x level x
 * forge x pets x rebirth - and the speed stat the same way, plus the katanas
 * owned. No hidden multipliers: if it is not a row here, it is not in the sum.
 */
export class BagPanel extends Panel {
  private readonly content: HTMLDivElement;
  private signature = '';
  private inputs: DamageInputs | null = null;
  private serverDamage = 0;
  private speed = 0;

  constructor(parent: HTMLElement) {
    super(parent, 'bag', 'Stats & Katanas', ICONS.bag);
    injectKatanaStyles();
    this.content = document.createElement('div');
    this.body.appendChild(this.content);
  }

  setState(inputs: DamageInputs, serverDamage: number, speed: number): void {
    this.inputs = inputs;
    this.serverDamage = serverDamage;
    this.speed = speed;
    if (this.isOpen) this.render();
  }

  protected override onOpened(): void {
    this.signature = '';
    this.render();
  }

  private render(): void {
    const inputs = this.inputs;
    if (!inputs) return;
    const signature = JSON.stringify(inputs) + this.serverDamage + ':' + this.speed;
    if (signature === this.signature) return;
    this.signature = signature;
    const b = damageBreakdown(inputs);
    const katana = KATANAS[inputs.katanaSlot - 1];
    const training = TRAINING_TIERS[inputs.trainingTier];
    const row = (label: string, value: string): string => `<div class="ke-bag__row"><span>${label}</span><b>${value}</b></div>`;
    const owned = KATANAS.filter((tier) => ownsKatana(inputs.ownedKatanas, tier.slot)).map((tier) => tier.name);
    this.content.innerHTML =
      '<div class="ke-bag__h">Damage per click</div>' +
      row(`Katana: ${katana?.name ?? '-'}`, `${formatAmount(b.katana)}`) +
      row(`Training: ${training?.name ?? '-'}`, formatMultiplier(b.training)) +
      row(`Level ${inputs.level}`, formatMultiplier(b.level)) +
      row('Forge upgrades', `${formatMultiplier(b.forge)} (${formatPercent(inputs.forgePercent)})`) +
      row(`Pets (${inputs.equippedPetIds.length} equipped)`, formatMultiplier(b.pets)) +
      row(`Rebirths (${inputs.rebirths})`, formatMultiplier(b.rebirth)) +
      `<div class="ke-bag__row ke-bag__total"><span>Total damage</span><b>${formatAmount(this.serverDamage)}</b></div>` +
      '<div class="ke-bag__h">Speed</div>' +
      row(`Level ${inputs.level}`, String(baseSpeedFor(inputs.level))) +
      row(`Rebirths (${inputs.rebirths})`, formatMultiplier(rebirthSpeedMultiplier(inputs.rebirths))) +
      `<div class="ke-bag__row ke-bag__total"><span>Total speed</span><b>${this.speed}</b></div>` +
      '<div class="ke-bag__h">Katanas owned</div>' +
      `<div style="line-height:1.6">${owned.join(' · ')}</div>` +
      '<div style="margin-top:8px;opacity:0.7">Equip an owned katana by standing on its pad at the Katana Stage.</div>';
  }
}
