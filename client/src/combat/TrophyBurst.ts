import { Vector3, type PerspectiveCamera } from 'three';

const COUNT = 10;
/** Delay between one trophy and the next, ms. */
const STAGGER_MS = 38;
const APPEAR_MS = 170;
const HOVER_MS = 150;
const FLY_MS = 430;
const LIFE_MS = APPEAR_MS + HOVER_MS + FLY_MS;
const FLASH_MS = 420;
const CHEST = new Vector3();

interface Trophy {
  readonly element: HTMLImageElement;
  readonly angle: number;
  readonly radius: number;
  readonly spin: number;
  readonly born: number;
  landed: boolean;
}

/**
 * THE CLAIM: a ring of trophies (the supplied `ui/trophy.png`) pops up around
 * the player, hangs for a beat, then flies into them - shrinking and fading
 * as it lands - with a gold flash at the chest as the Wins arrive. Screen
 * space, projected from the player each frame so it follows them home after
 * the claim; about a second long, and it never takes input.
 */
export class TrophyBurst {
  private readonly root: HTMLDivElement;
  private readonly flash: HTMLDivElement;
  private trophies: Trophy[] = [];
  private flashAt = -1;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'ke-trophy-layer';
    this.flash = document.createElement('div');
    this.flash.className = 'ke-trophy-flash';
    this.root.appendChild(this.flash);
    parent.appendChild(this.root);
  }

  play(): void {
    this.clear();
    const now = performance.now();
    const turn = Math.random() * Math.PI * 2;
    for (let i = 0; i < COUNT; i += 1) {
      const element = document.createElement('img');
      element.className = 'ke-trophy';
      element.src = '/ui/trophy.png';
      element.alt = '';
      element.draggable = false;
      element.style.opacity = '0';
      this.root.appendChild(element);
      this.trophies.push({
        element,
        angle: turn + (i / COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.35,
        radius: 170 + Math.random() * 70,
        spin: (Math.random() - 0.5) * 50,
        born: now + i * STAGGER_MS,
        landed: false,
      });
    }
    this.flashAt = -1;
  }

  update(camera: PerspectiveCamera, width: number, height: number, x: number, y: number, z: number): void {
    if (this.trophies.length === 0 && this.flashAt < 0) return;
    CHEST.set(x, y + 1.7, z).project(camera);
    const hidden = CHEST.z > 1;
    const unit = Math.min(width / 1920, height / 1080, 1.35) || 1;
    const cx = (CHEST.x * 0.5 + 0.5) * width;
    const cy = (-CHEST.y * 0.5 + 0.5) * height;
    const now = performance.now();

    for (let i = this.trophies.length - 1; i >= 0; i -= 1) {
      const trophy = this.trophies[i]!;
      const age = now - trophy.born;
      if (age < 0) continue;
      if (age >= LIFE_MS) {
        if (!trophy.landed) {
          trophy.landed = true;
          // Each landing re-kindles the flash: a pulse per trophy.
          this.flashAt = now;
        }
        trophy.element.remove();
        this.trophies.splice(i, 1);
        continue;
      }
      if (hidden) {
        trophy.element.style.opacity = '0';
        continue;
      }
      let radius = trophy.radius * unit;
      let scale = 1;
      let opacity = 1;
      let angle = trophy.angle;
      if (age < APPEAR_MS) {
        // Pop out of the air with a little overshoot.
        const t = age / APPEAR_MS;
        scale = t < 0.7 ? (t / 0.7) * 1.15 : 1.15 - ((t - 0.7) / 0.3) * 0.15;
        opacity = Math.min(1, t * 2);
        radius *= 0.85 + t * 0.15;
      } else if (age < APPEAR_MS + HOVER_MS) {
        const t = (age - APPEAR_MS) / HOVER_MS;
        angle += t * 0.25;
      } else {
        // Fly in: accelerating, shrinking, fading into the player.
        const t = (age - APPEAR_MS - HOVER_MS) / FLY_MS;
        const ease = t * t * (3 - 2 * t) * 0.35 + t * t * 0.65;
        angle += 0.25 + ease * 0.6;
        radius *= 1 - ease;
        scale = 1 - ease * 0.65;
        opacity = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
      }
      const sx = cx + Math.cos(angle) * radius;
      const sy = cy + Math.sin(angle) * radius * 0.8;
      const tilt = trophy.spin * (1 - Math.min(1, age / LIFE_MS));
      trophy.element.style.opacity = opacity.toFixed(3);
      trophy.element.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -50%) rotate(${tilt.toFixed(1)}deg) scale(${scale.toFixed(3)})`;
    }

    if (this.flashAt >= 0) {
      const t = (now - this.flashAt) / FLASH_MS;
      if (t >= 1 || hidden) {
        this.flash.style.opacity = '0';
        if (t >= 1 && this.trophies.length === 0) this.flashAt = -1;
      } else {
        this.flash.style.opacity = (1 - t).toFixed(3);
        this.flash.style.transform = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px) translate(-50%, -50%) scale(${(0.4 + t * 1.3).toFixed(3)})`;
      }
    }
  }

  clear(): void {
    for (const trophy of this.trophies) trophy.element.remove();
    this.trophies = [];
    this.flashAt = -1;
    this.flash.style.opacity = '0';
  }

  dispose(): void {
    this.root.remove();
  }
}
