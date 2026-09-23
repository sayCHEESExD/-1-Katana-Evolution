import { formatAmount } from '@katana/shared';
import { Vector3, type PerspectiveCamera } from 'three';

const LIFE_MS = 900;
/** Gains this close together are one popup: a burst of swings reads as one number. */
const MERGE_MS = 140;
/** Side-by-side places beside the player; when all are taken the newest one grows. */
const SLOTS = 4;
const HEAD = new Vector3();

interface Popup {
  readonly element: HTMLDivElement;
  readonly amount: HTMLSpanElement;
  readonly slot: number;
  value: number;
  born: number;
  bumped: number;
}

/**
 * "+1!" beside the player, with the supplied katana, for every XP gain -
 * walking or swinging alike. The figure is the server's own: it is the rise of
 * the replicated lifetime XP, so nothing here can award or invent XP.
 *
 * Placement follows the reference: to the RIGHT of the player at chest height,
 * each new gain in the next place along a short row, popping in, drifting up
 * and fading. Rapid gains merge into one popup, and with every place in use
 * the newest popup counts up instead of adding another - never a pile.
 */
export class XpPopups {
  private readonly root: HTMLDivElement;
  private readonly popups: Popup[] = [];

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'ke-xp-layer';
    parent.appendChild(this.root);
  }

  show(gain: number): void {
    if (!(gain > 0)) return;
    const now = performance.now();
    const newest = this.popups[this.popups.length - 1];
    if (newest && (now - newest.born < MERGE_MS || this.popups.length >= SLOTS)) {
      newest.value += gain;
      newest.amount.textContent = `+${formatAmount(newest.value)}!`;
      newest.bumped = now;
      // A popup that keeps counting stays alive while it does.
      newest.born = Math.max(newest.born, now - LIFE_MS * 0.35);
      return;
    }
    const taken = new Set(this.popups.map((p) => p.slot));
    let slot = 0;
    while (taken.has(slot)) slot += 1;

    const element = document.createElement('div');
    element.className = 'ke-xp';
    const icon = document.createElement('img');
    icon.className = 'ke-xp__icon';
    icon.src = '/ui/Katana.png';
    icon.alt = '';
    icon.draggable = false;
    const amount = document.createElement('span');
    amount.className = 'ke-xp__amount';
    amount.textContent = `+${formatAmount(gain)}!`;
    element.append(icon, amount);
    this.root.appendChild(element);
    this.popups.push({ element, amount, slot, value: gain, born: now, bumped: now });
  }

  /** Follow the player on screen, at chest height. */
  update(camera: PerspectiveCamera, width: number, height: number, x: number, y: number, z: number): void {
    if (this.popups.length === 0) return;
    HEAD.set(x, y + 1.9, z).project(camera);
    const hidden = HEAD.z > 1;
    const unit = Math.min(width / 1920, height / 1080, 1.35) || 1;
    const baseX = (HEAD.x * 0.5 + 0.5) * width + 90 * unit;
    const baseY = (-HEAD.y * 0.5 + 0.5) * height;
    const now = performance.now();
    for (let i = this.popups.length - 1; i >= 0; i -= 1) {
      const popup = this.popups[i]!;
      const age = (now - popup.born) / LIFE_MS;
      if (age >= 1) {
        popup.element.remove();
        this.popups.splice(i, 1);
        continue;
      }
      if (hidden) {
        popup.element.style.opacity = '0';
        continue;
      }
      const sx = baseX + popup.slot * 200 * unit;
      const sy = baseY + (popup.slot % 2) * 34 * unit - age * 56 * unit;
      const pop = age < 0.12 ? 0.55 + (age / 0.12) * 0.6 : 1.15 - Math.min((age - 0.12) / 0.2, 1) * 0.15;
      const bump = Math.max(0, 1 - (now - popup.bumped) / 160) * 0.18;
      popup.element.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(0, -50%) scale(${(pop + bump).toFixed(3)})`;
      popup.element.style.opacity = age > 0.72 ? String(1 - (age - 0.72) / 0.28) : '1';
    }
  }

  clear(): void {
    for (const popup of this.popups) popup.element.remove();
    this.popups.length = 0;
  }

  dispose(): void {
    this.root.remove();
  }
}
