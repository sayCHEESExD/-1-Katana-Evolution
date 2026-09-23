import { formatWins } from '@katana/shared';
import { ICONS } from './hudStyles.js';
import { injectKatanaStyles } from './katanaStyles.js';

/**
 * Top left, above the rail: Wins (the trophy) and rebirths, as the
 * reference stacks them. Replicated server state; Wins pop when they rise.
 */
export class Counters {
  private readonly root: HTMLDivElement;
  private readonly wins: HTMLDivElement;
  private readonly winsValue: HTMLSpanElement;
  private readonly rebirthsValue: HTMLSpanElement;
  private lastWins = -1;
  private popTimer = 0;

  constructor(parent: HTMLElement) {
    injectKatanaStyles();
    this.root = document.createElement('div');
    this.root.className = 'ke-counters';
    const make = (variant: string, icon: string): [HTMLDivElement, HTMLSpanElement] => {
      const row = document.createElement('div');
      row.className = `ke-counter ke-counter--${variant}`;
      row.innerHTML = icon;
      const value = document.createElement('span');
      value.className = 'ke-counter__value ke-outline';
      value.textContent = '0';
      row.appendChild(value);
      this.root.appendChild(row);
      return [row, value];
    };
    [this.wins, this.winsValue] = make('wins', ICONS.trophy);
    [, this.rebirthsValue] = make('rebirths', ICONS.rebirth);
    parent.appendChild(this.root);
  }

  update(wins: number, rebirths: number): void {
    this.rebirthsValue.textContent = String(rebirths);
    if (wins === this.lastWins) return;
    const rose = this.lastWins >= 0 && wins > this.lastWins;
    this.lastWins = wins;
    this.winsValue.textContent = formatWins(wins);
    if (!rose) return;
    this.wins.classList.remove('ke-counter--pop');
    void this.wins.offsetWidth;
    this.wins.classList.add('ke-counter--pop');
    window.clearTimeout(this.popTimer);
    this.popTimer = window.setTimeout(() => this.wins.classList.remove('ke-counter--pop'), 560);
  }

  dispose(): void {
    window.clearTimeout(this.popTimer);
    this.root.remove();
  }
}
