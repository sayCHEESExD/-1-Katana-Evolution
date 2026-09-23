import { formatAmount, resolveLevel } from '@katana/shared';
import { injectKatanaStyles } from './katanaStyles.js';

/**
 * THE STAT BAR, bottom centre, laid out as the reference: DAMAGE on the left
 * and SPEED on the right above a chunky level bar that reads "LEVEL 9" and
 * "440 / 520", with the AUTO CLICK toggle beside it, and the HEALTH bar between
 * DAMAGE and SPEED (with a red flash at the screen edges when hit). Every figure is
 * replicated server state; the bar only draws it.
 */
export class StatsHud {
  private readonly root: HTMLDivElement;
  private readonly damage: HTMLSpanElement;
  private readonly speed: HTMLSpanElement;
  private readonly bar: HTMLDivElement;
  private readonly fill: HTMLDivElement;
  private readonly level: HTMLSpanElement;
  private readonly xp: HTMLDivElement;
  private readonly auto: HTMLButtonElement;
  private readonly health: HTMLDivElement;
  private readonly healthFill: HTMLDivElement;
  private readonly healthText: HTMLSpanElement;
  private readonly hurt: HTMLDivElement;
  private signature = '';
  private healthSignature = '';
  private lastHp = -1;

  constructor(parent: HTMLElement, onAutoToggle: () => void) {
    injectKatanaStyles();
    this.root = document.createElement('div');
    this.root.className = 'ke-stats';
    const row = document.createElement('div');
    row.className = 'ke-stats__row';
    this.damage = document.createElement('span');
    this.damage.className = 'ke-stat ke-stat--damage ke-outline';
    this.speed = document.createElement('span');
    this.speed.className = 'ke-stat ke-stat--speed ke-outline';
    this.health = document.createElement('div');
    this.health.className = 'ke-hp';
    this.healthFill = document.createElement('div');
    this.healthFill.className = 'ke-hp__fill';
    this.healthText = document.createElement('span');
    this.healthText.className = 'ke-hp__text ke-outline';
    this.health.append(this.healthFill, this.healthText);
    row.append(this.damage, this.health, this.speed);

    this.hurt = document.createElement('div');
    this.hurt.className = 'ke-hurt';
    parent.appendChild(this.hurt);

    this.bar = document.createElement('div');
    this.bar.className = 'ke-bar';
    const track = document.createElement('div');
    track.className = 'ke-bar__track';
    this.fill = document.createElement('div');
    this.fill.className = 'ke-bar__fill';
    this.level = document.createElement('span');
    this.level.className = 'ke-bar__level ke-outline';
    track.append(this.fill, this.level);
    this.xp = document.createElement('div');
    this.xp.className = 'ke-bar__xp ke-outline';
    this.bar.append(track, this.xp);

    this.auto = document.createElement('button');
    this.auto.type = 'button';
    this.auto.className = 'ke-auto ke-outline';
    this.auto.textContent = 'OFF';
    this.auto.setAttribute('aria-label', 'Auto click');
    this.auto.addEventListener('click', (event) => {
      event.stopPropagation();
      onAutoToggle();
    });
    this.auto.addEventListener('pointerdown', (event) => event.stopPropagation());

    this.root.append(row, this.bar, this.auto);
    parent.appendChild(this.root);
  }

  update(level: number, maxLevel: number, xp: number, damage: number, speed: number): void {
    const signature = `${level}:${maxLevel}:${Math.floor(xp)}:${damage}:${speed}`;
    if (signature === this.signature) return;
    this.signature = signature;
    const progress = resolveLevel(xp, maxLevel);
    this.damage.textContent = `DAMAGE: ${formatAmount(damage)}`;
    this.speed.textContent = `SPEED: ${speed}`;
    this.level.textContent = `LEVEL ${progress.level}`;
    this.fill.style.width = `${(progress.fraction * 100).toFixed(1)}%`;
    this.bar.classList.toggle('ke-bar--max', progress.capped);
    this.xp.textContent = progress.capped ? 'MAX - REBIRTH!' : `${formatAmount(progress.into)} / ${formatAmount(progress.required)}`;
  }

  /** Health, as the server has it. A drop flashes the screen edges red. */
  setHealth(hp: number, maxHp: number): void {
    const signature = `${Math.ceil(hp)}:${maxHp}`;
    if (signature === this.healthSignature) return;
    this.healthSignature = signature;
    if (this.lastHp >= 0 && hp < this.lastHp) {
      this.hurt.classList.remove('ke-hurt--on');
      void this.hurt.offsetWidth;
      this.hurt.classList.add('ke-hurt--on');
    }
    this.lastHp = hp;
    const fraction = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
    this.healthFill.style.width = `${(fraction * 100).toFixed(1)}%`;
    this.health.classList.toggle('ke-hp--low', fraction <= 0.3);
    this.healthText.textContent = `❤ ${formatAmount(Math.ceil(hp))} / ${formatAmount(maxHp)}`;
  }

  setAuto(on: boolean): void {
    this.auto.textContent = on ? 'ON' : 'OFF';
    this.auto.classList.toggle('ke-auto--on', on);
  }

  dispose(): void {
    this.hurt.remove();
    this.root.remove();
  }
}
