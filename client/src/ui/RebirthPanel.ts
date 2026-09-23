import {
  REBIRTH_DAMAGE_PER,
  canRebirth,
  formatMultiplier,
  maxLevelFor,
  rebirthRequiredLevel,
  rebirthSpeedMultiplier,
} from '@katana/shared';
import { ICONS } from './hudStyles.js';
import { injectKatanaStyles } from './katanaStyles.js';
import { Panel } from './Panel.js';

/**
 * REBIRTH, laid out as the reference: what you have now against what the next
 * rebirth gives - speed multiplier, maximum level, damage bonus - the level
 * needed as a progress bar, the warning, and the button. Eligibility is shown
 * from replicated state; the server decides it again when the button is hit.
 */
export class RebirthPanel extends Panel {
  private readonly now: HTMLDivElement;
  private readonly speedFrom: HTMLDivElement;
  private readonly speedTo: HTMLDivElement;
  private readonly levelFrom: HTMLDivElement;
  private readonly levelTo: HTMLDivElement;
  private readonly damageFrom: HTMLDivElement;
  private readonly damageTo: HTMLDivElement;
  private readonly fill: HTMLDivElement;
  private readonly label: HTMLDivElement;
  private readonly button: HTMLButtonElement;
  private eligible = false;

  constructor(parent: HTMLElement, onRebirth: () => void) {
    super(parent, 'rebirth', 'Rebirth', ICONS.rebirth);
    injectKatanaStyles();
    this.now = document.createElement('div');
    this.now.className = 'ke-rb__now';
    const grid = document.createElement('div');
    grid.className = 'ke-rb';
    const card = (variant: string): HTMLDivElement => {
      const element = document.createElement('div');
      element.className = `ke-rb__card ke-rb__card--${variant} ke-outline`;
      return element;
    };
    const arrow = (): HTMLDivElement => {
      const element = document.createElement('div');
      element.className = 'ke-rb__arrow';
      element.textContent = '➜';
      return element;
    };
    this.speedFrom = card('speed');
    this.speedTo = card('speed');
    this.levelFrom = card('level');
    this.levelTo = card('level');
    this.damageFrom = card('damage');
    this.damageTo = card('damage');
    grid.append(this.speedFrom, arrow(), this.speedTo, this.levelFrom, arrow(), this.levelTo, this.damageFrom, arrow(), this.damageTo);

    const warn = document.createElement('div');
    warn.className = 'ke-rb__warn';
    warn.textContent = 'REBIRTH RESETS YOUR LEVEL! Katanas, Wins, training, forge upgrades and pets are kept.';
    const bar = document.createElement('div');
    bar.className = 'ke-rb__bar';
    this.fill = document.createElement('div');
    this.fill.className = 'ke-rb__fill';
    this.label = document.createElement('div');
    this.label.className = 'ke-rb__label';
    bar.append(this.fill, this.label);
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'aoe-action ke-rb__go';
    this.button.textContent = 'REBIRTH';
    this.button.addEventListener('click', () => {
      if (!this.eligible) return;
      onRebirth();
      this.setOpen(false);
    });
    this.body.append(this.now, grid, warn, bar, this.button);
  }

  get isEligible(): boolean {
    return this.eligible;
  }

  setProgress(level: number, rebirths: number): void {
    const required = rebirthRequiredLevel(rebirths);
    this.eligible = canRebirth(level, rebirths);
    const percent = (value: number): string => `+${Math.round((value - 1) * 100)}%`;
    this.now.innerHTML = `Rebirths: <b>${rebirths}</b>`;
    this.speedFrom.textContent = `${formatMultiplier(rebirthSpeedMultiplier(rebirths))} SPEED`;
    this.speedTo.textContent = `${formatMultiplier(rebirthSpeedMultiplier(rebirths + 1))} SPEED`;
    this.levelFrom.textContent = `MAX LEVEL ${maxLevelFor(rebirths)}`;
    this.levelTo.textContent = `MAX LEVEL ${maxLevelFor(rebirths + 1)}`;
    this.damageFrom.textContent = `${percent(1 + REBIRTH_DAMAGE_PER * rebirths)} DAMAGE`;
    this.damageTo.textContent = `${percent(1 + REBIRTH_DAMAGE_PER * (rebirths + 1))} DAMAGE`;
    this.fill.style.width = `${Math.min(100, (level / required) * 100).toFixed(1)}%`;
    this.label.textContent = `Level ${Math.min(level, required)} / ${required}`;
    this.button.disabled = !this.eligible;
  }
}
