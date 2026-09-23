import {
  AdditiveBlending,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  type Scene,
} from 'three';
import { KATANAS } from '@katana/shared';

const POOL = 8;
const LIFE = 0.2;

interface Slash {
  readonly mesh: Mesh;
  readonly material: MeshBasicMaterial;
  age: number;
  spin: number;
}

/**
 * THE SLASH: one bright crescent per swing, in the katana's colour, sweeping
 * through the space in front of the swordsman and gone in a fifth of a second.
 * A fixed pool of eight quads - a room of fifteen players swinging costs the
 * same as one - and no particles at all.
 */
export class SlashEffects {
  private readonly root = new Group();
  private readonly slashes: Slash[] = [];
  private next = 0;

  constructor(scene: Scene) {
    const geometry = new RingGeometry(1.6, 2.6, 18, 1, -0.2, Math.PI * 0.9);
    for (let i = 0; i < POOL; i += 1) {
      const material = new MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
        fog: false,
      });
      const mesh = new Mesh(geometry, material);
      mesh.visible = false;
      mesh.renderOrder = 5;
      this.root.add(mesh);
      this.slashes.push({ mesh, material, age: LIFE, spin: 1 });
    }
    scene.add(this.root);
  }

  /** A swing at (x, y, z) facing `yaw`, with this katana, mirrored for a backhand. */
  play(x: number, y: number, z: number, yaw: number, katanaSlot: number, backhand: boolean): void {
    const slash = this.slashes[this.next]!;
    this.next = (this.next + 1) % POOL;
    const color = KATANAS[Math.max(0, katanaSlot - 1)]?.color ?? '#ffffff';
    slash.material.color.set(color);
    slash.age = 0;
    slash.spin = backhand ? -1 : 1;
    const m = slash.mesh;
    m.visible = true;
    m.position.set(x + Math.sin(yaw) * 0.9, y + 1.9, z + Math.cos(yaw) * 0.9);
    // A tilted disc in front of the body: the blade's path.
    m.rotation.set(-Math.PI / 2 + (backhand ? 0.5 : -0.5), 0, 0);
    m.rotation.order = 'YXZ';
    m.rotation.y = yaw + Math.PI;
  }

  update(delta: number): void {
    for (const slash of this.slashes) {
      if (!slash.mesh.visible) continue;
      slash.age += delta;
      const t = slash.age / LIFE;
      if (t >= 1) {
        slash.mesh.visible = false;
        continue;
      }
      slash.material.opacity = (1 - t) * 0.9;
      slash.mesh.rotation.z = slash.spin * (t * 1.6 - 0.6);
      const s = 0.8 + t * 0.35;
      slash.mesh.scale.set(s, s, s);
    }
  }

  dispose(): void {
    for (const slash of this.slashes) slash.material.dispose();
    this.slashes[0]?.mesh.geometry.dispose();
    this.root.removeFromParent();
  }
}
