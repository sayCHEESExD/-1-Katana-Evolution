import { formatAmount } from '@katana/shared';
import type { FocusTarget } from '../combat/TargetSelector.js';
import { injectKatanaStyles } from './katanaStyles.js';

/**
 * WHAT YOU ARE FIGHTING, top centre: the enemy's name over its health bar,
 * the one place an enemy's health is ever shown. For a training dummy it is
 * the dummy's name and the hits toward mastering it.
 */
export class TargetBar {
  private readonly root: HTMLDivElement;
  private readonly name: HTMLDivElement;
  private readonly fill: HTMLDivElement;
  private readonly hp: HTMLDivElement;
  private readonly lock: HTMLDivElement;
  private signature = '';

  constructor(parent: HTMLElement) {
    injectKatanaStyles();
    this.root = document.createElement('div');
    this.root.className = 'ke-target';
    this.root.hidden = true;
    this.name = document.createElement('div');
    this.name.className = 'ke-target__name ke-outline';
    const bar = document.createElement('div');
    bar.className = 'ke-target__bar';
    this.fill = document.createElement('div');
    this.fill.className = 'ke-target__fill';
    this.hp = document.createElement('div');
    this.hp.className = 'ke-target__hp ke-outline';
    bar.append(this.fill, this.hp);
    this.lock = document.createElement('div');
    this.lock.className = 'ke-target__lock ke-outline';
    this.root.append(this.name, bar, this.lock);
    parent.appendChild(this.root);
  }

  show(target: FocusTarget | null): void {
    if (!target) {
      if (this.signature !== '') {
        this.signature = '';
        this.root.hidden = true;
      }
      return;
    }
    const signature = `${target.target}:${Math.ceil(target.value)}:${target.locked}:${target.lockText}`;
    if (signature === this.signature) return;
    this.signature = signature;
    this.root.hidden = false;
    this.root.classList.toggle('ke-target--boss', target.boss);
    this.root.classList.toggle('ke-target--dummy', target.kind === 'dummy');
    this.name.textContent = target.name;
    const fraction = Math.max(0, Math.min(1, target.value / target.max));
    this.fill.style.width = `${(fraction * 100).toFixed(1)}%`;
    this.hp.textContent =
      target.kind === 'dummy' ? `${Math.floor(target.value)} / ${target.max} hits` : `${formatAmount(Math.ceil(target.value))} / ${formatAmount(target.max)}`;
    this.lock.textContent = target.lockText;
    this.lock.hidden = target.lockText.length === 0;
  }

  dispose(): void {
    this.root.remove();
  }
}
