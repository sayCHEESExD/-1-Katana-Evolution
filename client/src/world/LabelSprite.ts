import {
  CanvasTexture,
  FrontSide,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  type Object3D,
} from 'three';

export interface LabelLine {
  readonly text: string;
  readonly color: string;
  /** Relative size of the line. */
  readonly size?: number;
  /** An icon drawn before the text, e.g. the trophy. */
  readonly icon?: HTMLImageElement | null;
}

const FONT = '"Fredoka", "Baloo 2", "Nunito", "Segoe UI", system-ui, sans-serif';

/**
 * Chunky outlined text on a canvas - the "+5 / CLICK", the trophy price, the
 * zone names. Redrawn only when its text changes, so a label whose state never
 * changes costs one upload, ever. Shown as a billboard (`LabelSprite`) or a
 * flat panel on a wall (`LabelPanel`).
 */
abstract class LabelBase {
  abstract readonly object: Object3D;
  protected readonly canvas: HTMLCanvasElement;
  protected readonly texture: CanvasTexture;
  private signature = '';

  constructor(width: number, height: number, pixels: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = pixels;
    this.canvas.height = Math.max(16, Math.round((pixels * height) / width));
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.generateMipmaps = false;
    this.texture.minFilter = LinearFilter;
  }

  set(lines: readonly LabelLine[], background: string | null = null): void {
    const signature = `${background}\n` + lines.map((line) => `${line.text}|${line.color}|${line.size ?? 1}|${line.icon ? 1 : 0}`).join('\n');
    if (signature === this.signature) return;
    this.signature = signature;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = this.canvas;
    ctx.clearRect(0, 0, width, height);
    if (background) {
      ctx.fillStyle = background;
      const r = height * 0.12;
      ctx.beginPath();
      ctx.roundRect(2, 2, width - 4, height - 4, r);
      ctx.fill();
    }
    const total = lines.reduce((sum, line) => sum + (line.size ?? 1), 0) || 1;
    let cursor = height * 0.04;
    const usable = height * 0.92;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const line of lines) {
      const band = ((line.size ?? 1) / total) * usable;
      const centre = cursor + band / 2;
      cursor += band;
      let size = band * 0.8;
      for (let pass = 0; pass < 4; pass += 1) {
        ctx.font = `700 ${size}px ${FONT}`;
        const drawn = ctx.measureText(line.text).width + size * 0.22 + (line.icon ? size * 1.2 : 0);
        if (drawn <= width * 0.94) break;
        size *= (width * 0.94) / drawn;
      }
      ctx.font = `700 ${size}px ${FONT}`;
      const textWidth = ctx.measureText(line.text).width;
      const iconW = line.icon ? size * 1.15 : 0;
      const startX = width / 2 - (textWidth + iconW) / 2;
      if (line.icon) ctx.drawImage(line.icon, startX, centre - size / 2, size, size);
      const textX = startX + iconW + textWidth / 2;
      ctx.lineWidth = size * 0.22;
      ctx.strokeStyle = '#141822';
      ctx.strokeText(line.text, textX, centre);
      ctx.fillStyle = line.color;
      ctx.fillText(line.text, textX, centre);
    }
    this.texture.needsUpdate = true;
  }

  abstract dispose(): void;
}

/** A label that always faces the camera. */
export class LabelSprite extends LabelBase {
  readonly object: Sprite;

  constructor(width: number, height: number, pixels = 256) {
    super(width, height, pixels);
    this.object = new Sprite(new SpriteMaterial({ map: this.texture, transparent: true, depthWrite: false, fog: false }));
    this.object.scale.set(width, height, 1);
  }

  get sprite(): Sprite {
    return this.object;
  }

  dispose(): void {
    this.texture.dispose();
    this.object.material.dispose();
    this.object.removeFromParent();
  }
}

/** A label printed flat on a surface, facing +Z until turned. */
export class LabelPanel extends LabelBase {
  readonly object: Mesh;
  private readonly geometry: PlaneGeometry;
  private readonly material: MeshBasicMaterial;

  constructor(width: number, height: number, pixels = 256) {
    super(width, height, pixels);
    this.geometry = new PlaneGeometry(width, height);
    this.material = new MeshBasicMaterial({ map: this.texture, transparent: true, depthWrite: false, side: FrontSide });
    this.object = new Mesh(this.geometry, this.material);
  }

  dispose(): void {
    this.texture.dispose();
    this.material.dispose();
    this.geometry.dispose();
    this.object.removeFromParent();
  }
}

/** The supplied trophy icon, loaded once for every label that prices something in Wins. */
let trophy: HTMLImageElement | null = null;
const trophyWaiters: (() => void)[] = [];
export const trophyIcon = (onReady?: () => void): HTMLImageElement | null => {
  if (!trophy) {
    trophy = new Image();
    trophy.src = '/ui/trophy.png';
    trophy.onload = () => {
      for (const waiter of trophyWaiters.splice(0)) waiter();
    };
  }
  if (trophy.complete && trophy.naturalWidth > 0) return trophy;
  if (onReady) trophyWaiters.push(onReady);
  return null;
};
