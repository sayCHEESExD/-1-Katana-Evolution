import {
  AmbientLight,
  Box3,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderTarget,
  type WebGLRenderer,
} from 'three';
import { createPetModel } from './PetModels.js';

const SIZE = 128;

/**
 * Portraits of the Yokai for the menus, rendered ONCE per species with the
 * game's own renderer into a small offscreen target and kept as data URLs.
 * Sixteen tiny renders on first use, and no image files at all.
 */
export class PetThumbnails {
  private readonly cache = new Map<number, string>();
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(32, 1, 0.1, 50);
  private target: WebGLRenderTarget | null = null;

  constructor(private readonly renderer: WebGLRenderer) {
    this.scene.add(new AmbientLight(0xffffff, 1.4));
    const key = new DirectionalLight(0xffffff, 2.2);
    key.position.set(2, 3, 4);
    this.scene.add(key);
  }

  get(petId: number): string {
    const cached = this.cache.get(petId);
    if (cached) return cached;
    const url = this.render(petId);
    this.cache.set(petId, url);
    return url;
  }

  private render(petId: number): string {
    this.target ??= new WebGLRenderTarget(SIZE, SIZE);
    this.target.texture.colorSpace = SRGBColorSpace;
    const model = createPetModel(petId);
    model.rotation.y = -0.5;
    this.scene.add(model);
    const box = new Box3().setFromObject(model);
    const centre = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
    const radius = Math.max(size.x, size.y, size.z) * 0.62;
    const distance = radius / Math.tan((this.camera.fov * Math.PI) / 360);
    this.camera.position.set(centre.x, centre.y + radius * 0.25, centre.z + distance);
    this.camera.lookAt(centre);

    const previousTarget = this.renderer.getRenderTarget();
    const previousClear = this.renderer.getClearAlpha();
    this.renderer.setRenderTarget(this.target);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    const pixels = new Uint8Array(SIZE * SIZE * 4);
    this.renderer.readRenderTargetPixels(this.target, 0, 0, SIZE, SIZE, pixels);
    this.renderer.setRenderTarget(previousTarget);
    this.renderer.setClearAlpha(previousClear);
    model.removeFromParent();

    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    const image = ctx.createImageData(SIZE, SIZE);
    // WebGL rows run bottom-up; a canvas runs top-down.
    for (let y = 0; y < SIZE; y += 1) {
      const from = (SIZE - 1 - y) * SIZE * 4;
      image.data.set(pixels.subarray(from, from + SIZE * 4), y * SIZE * 4);
    }
    ctx.putImageData(image, 0, 0);
    return canvas.toDataURL('image/png');
  }

  dispose(): void {
    this.target?.dispose();
  }
}
