import { formatAmount } from '@katana/shared';
import { injectKatanaStyles } from './katanaStyles.js';

const HOLD_MS = 2000;
const FADE_MS = 380;

/**
 * The centre-screen popup: LEVEL UP (with the damage and speed it brought),
 * STAGE CLEARED, a mastered dummy. Several level-ups in a row merge into one
 * popup that runs from the first level to the latest.
 */
export class LevelUpPopup {
  private readonly root: HTMLDivElement;
  private readonly title: HTMLDivElement;
  private readonly lineA: HTMLDivElement;
  private readonly lineB: HTMLDivElement;
  private fromLevel = 0;
  private fromDamage = 0;
  private fromSpeed = 0;
  private merging = false;
  private hideTimer = 0;
  private doneTimer = 0;

  constructor(parent: HTMLElement) {
    injectKatanaStyles();
    this.root = document.createElement('div');
    this.root.className = 'ke-pop';
    this.root.hidden = true;
    this.root.setAttribute('role', 'status');
    this.title = document.createElement('div');
    this.title.className = 'ke-pop__title ke-outline';
    this.lineA = document.createElement('div');
    this.lineA.className = 'ke-pop__line ke-pop__line--damage ke-outline';
    this.lineB = document.createElement('div');
    this.lineB.className = 'ke-pop__line ke-pop__line--speed ke-outline';
    this.root.append(this.title, this.lineA, this.lineB);
    parent.appendChild(this.root);
  }

  levelUp(oldLevel: number, oldDamage: number, oldSpeed: number, level: number, damage: number, speed: number): void {
    if (!this.merging) {
      this.fromLevel = oldLevel;
      this.fromDamage = oldDamage;
      this.fromSpeed = oldSpeed;
    }
    this.merging = true;
    this.title.textContent = `LEVEL ${level}!`;
    this.lineA.textContent = `Damage ${formatAmount(this.fromDamage)} > ${formatAmount(damage)}`;
    this.lineB.textContent = speed > this.fromSpeed ? `Speed ${this.fromSpeed} > ${speed}` : `Level ${this.fromLevel} > ${level}`;
    this.play();
  }

  message(title: string, lineA = '', lineB = ''): void {
    this.merging = false;
    this.title.textContent = title;
    this.lineA.textContent = lineA;
    this.lineB.textContent = lineB;
    this.play();
  }

  private play(): void {
    this.root.hidden = false;
    this.root.classList.remove('ke-pop--out', 'ke-pop--in');
    void this.root.offsetWidth;
    this.root.classList.add('ke-pop--in');
    window.clearTimeout(this.hideTimer);
    window.clearTimeout(this.doneTimer);
    this.hideTimer = window.setTimeout(() => {
      this.root.classList.add('ke-pop--out');
      this.doneTimer = window.setTimeout(() => {
        this.root.hidden = true;
        this.merging = false;
      }, FADE_MS);
    }, HOLD_MS);
  }

  dispose(): void {
    window.clearTimeout(this.hideTimer);
    window.clearTimeout(this.doneTimer);
    this.root.remove();
  }
}
