import {
  ARENA,
  HUB,
  STAGES,
  STAGE_COUNT,
  arenaEndZ,
  arenaStartZ,
  formatAmount,
  formatWins,
  REWARD_SHRINE,
  gateZ,
  rewardPadOf,
  stageDecor,
  type StageDef,
} from '@katana/shared';
import {
  AdditiveBlending,
  CanvasTexture,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  SphereGeometry,
  TorusGeometry,
  type Material,
} from 'three';
import { THEME_STYLES, type ThemeStyle } from '../config/stageThemes.js';
import { PALETTE } from '../config/worldVisuals.js';
import { PartBuilder } from '../render/PartBuilder.js';
import { CanvasSign } from './CanvasSign.js';
import { drawDecor } from './DecorRenderer.js';
import { bambooClump, house, pagoda, paperLantern, picnic, pineTree, sakuraTree, stoneLantern, torii } from './JapaneseProps.js';
import { LabelSprite, trophyIcon } from './LabelSprite.js';
import { worldTextures } from './WorldTextures.js';

const FONT = '"Fredoka", "Baloo 2", "Nunito", "Segoe UI", system-ui, sans-serif';

/** A portal's face: red and locked with the wave's progress, or open and blue. */
class PortalFace {
  readonly mesh: Mesh;
  private readonly canvas = document.createElement('canvas');
  private readonly texture: CanvasTexture;
  private readonly material: MeshBasicMaterial;
  private signature = '';

  constructor(width: number, height: number) {
    this.canvas.width = 384;
    this.canvas.height = Math.round((384 * height) / width);
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.material = new MeshBasicMaterial({ map: this.texture, transparent: true, opacity: 0.88, side: DoubleSide, depthWrite: false, fog: false });
    this.mesh = new Mesh(new PlaneGeometry(width, height), this.material);
  }

  /** @param killed enemies of the wave this player has credit for; -1 when the portal is open */
  set(open: boolean, killed: number, total: number, nextStage: number): void {
    const signature = `${open}:${killed}:${total}`;
    if (signature === this.signature) return;
    this.signature = signature;
    const ctx = this.canvas.getContext('2d')!;
    const { width, height } = this.canvas;
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    if (open) {
      gradient.addColorStop(0, 'rgba(120, 230, 255, 0.95)');
      gradient.addColorStop(1, 'rgba(40, 150, 240, 0.9)');
    } else {
      gradient.addColorStop(0, 'rgba(255, 90, 80, 0.95)');
      gradient.addColorStop(1, 'rgba(200, 30, 40, 0.92)');
    }
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    // Vertical streaks, like falling water or a curtain of force.
    ctx.fillStyle = open ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.12)';
    for (let x = 8; x < width; x += 26) ctx.fillRect(x, 0, 8, height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const line = (text: string, y: number, size: number, fill: string): void => {
      ctx.font = `700 ${size}px ${FONT}`;
      ctx.lineWidth = size * 0.2;
      ctx.strokeStyle = '#1c0a0a';
      ctx.strokeText(text, width / 2, y);
      ctx.fillStyle = fill;
      ctx.fillText(text, width / 2, y);
    };
    if (open) {
      line(`STAGE ${nextStage}`, height * 0.45, 64, '#ffffff');
      line('ENTER', height * 0.64, 34, '#fff5a0');
    } else {
      line('Kill your', height * 0.36, 44, '#ffffff');
      line('enemies to enter', height * 0.5, 40, '#ffffff');
      line(`${killed} / ${total}`, height * 0.68, 46, '#ffe08a');
    }
    this.texture.needsUpdate = true;
  }

  setFaded(faded: boolean): void {
    this.material.opacity = faded ? 0.18 : 0.88;
  }

  dispose(): void {
    this.texture.dispose();
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}

interface GateView {
  /** The stage the portal leads INTO. */
  readonly next: number;
  readonly face: PortalFace;
  /** Where the portal stands along the road. */
  readonly z: number;
}

interface RewardView {
  readonly stage: number;
  readonly emblem: MeshBasicMaterial;
  readonly beam: Mesh;
  readonly beamMaterial: MeshBasicMaterial;
  readonly trophy: Group;
  readonly label: LabelSprite;
  readonly baseY: number;
  armed: boolean;
}

/**
 * THE STAGE ROAD: ten themed arenas, one behind the other, each an open field
 * the wave fights in, ringed with its own trees and lanterns and crowned with
 * its own skyline beyond the cliffs.
 *
 * Every arena ends in a GATE: a stone wall with a torii before a portal. The
 * portal is drawn for the LOCAL player - red, "Kill your enemies to enter" and
 * their tally until they have cleared the stage once, blue and open after
 * (the collision is the same rule, in the shared simulation). Beside it, the
 * WIN SHRINE (`buildShrine`) blazes gold whenever a clear is waiting to be claimed.
 */
export class StageRoad {
  readonly root = new Group();
  private readonly gates: GateView[] = [];
  private readonly rewards: RewardView[] = [];
  private readonly signs: CanvasSign[] = [];
  private readonly materials: Material[] = [];
  private readonly stageRoots: Group[] = [];
  private time = 0;

  constructor() {
    // The Stage 1 portal in the village's front wall: always open.
    const entry = new PortalFace(ARENA.portalHalfWidth * 2 - 2, ARENA.portalHeight - 1);
    entry.mesh.position.set(0, (ARENA.portalHeight - 1) / 2, HUB.maxZ + 2);
    entry.mesh.rotation.y = Math.PI;
    entry.set(true, 0, 0, 1);
    this.root.add(entry.mesh);
    this.gates.push({ next: 1, face: entry, z: HUB.maxZ + 2 });
    this.stageSign(1, HUB.maxZ - 3.2);

    for (const stage of STAGES) this.buildStage(stage);
  }

  /** The STAGE N sign, floating across the top of a portal, facing the player walking up to it. */
  private stageSign(next: number, z: number): void {
    const stage = STAGES[next - 1];
    if (!stage) return;
    const sign = new CanvasSign(20, 5.2, [
      { text: `STAGE ${next}`, size: 1, fill: '#ffffff', stroke: '#1c2233', strokeWidth: 0.16 },
      { text: `Recommended Damage: ${formatAmount(stage.recommendedDamage)}`, size: 0.42, fill: '#ff4d4d', stroke: '#2a0808', strokeWidth: 0.16 },
    ]);
    sign.mesh.position.set(0, ARENA.portalHeight - 2, z);
    sign.mesh.rotation.y = Math.PI;
    this.root.add(sign.mesh);
    this.signs.push(sign);
  }

  private buildStage(stage: StageDef): void {
    const style = THEME_STYLES[stage.theme];
    const start = arenaStartZ(stage.index);
    const end = arenaEndZ(stage.index);
    const length = end - start;
    const group = new Group();
    group.name = `stage-${stage.index}`;
    const b = new PartBuilder();

    // The field, a path down its middle, and the floor accent.
    b.box(ARENA.halfWidth * 2, 1, length, style.floor, 'stud', { x: 0, y: -0.5, z: (start + end) / 2 });
    b.box(12, 0.1, length, style.path, 'stud', { x: 0, y: 0.05, z: (start + end) / 2 });
    this.accent(b, style, start, end);
    drawDecor(b, stageDecor(stage.index));
    this.skyline(b, style, start, end);

    // The gate out of this stage (none after the last): walls, torii, portal, reward pad.
    if (stage.index < STAGE_COUNT) {
      const z0 = end;
      const z1 = end + ARENA.gateDepth;
      const zc = (z0 + z1) / 2;
      const segment = ARENA.halfWidth - ARENA.portalHalfWidth;
      for (const side of [-1, 1]) {
        const x = side * (ARENA.portalHalfWidth + segment / 2);
        b.box(segment, ARENA.wallHeight + 2, ARENA.gateDepth, style.wall, 'stud', { x, y: ARENA.wallHeight / 2 - 1, z: zc });
        b.box(segment + 0.6, 1, ARENA.gateDepth + 1.2, style.wallCap, 'stud', { x, y: ARENA.wallHeight + 0.5, z: zc });
      }
      b.box(ARENA.portalHalfWidth * 2, ARENA.wallHeight - ARENA.portalHeight, ARENA.gateDepth, style.wall, 'stud', {
        x: 0,
        y: (ARENA.wallHeight + ARENA.portalHeight) / 2,
        z: zc,
      });
      b.box(ARENA.halfWidth * 2, 0.1, ARENA.gateDepth, style.path, 'stud', { x: 0, y: 0.05, z: zc });
      // Tall enough that its tie beam clears the STAGE sign.
      torii(b, 0, 0, z0 - 1.2, 23, 22);
      for (const side of [-1, 1]) paperLantern(b, side * 8.5, 9, z0 - 1.2, 1.2);

      const face = new PortalFace(ARENA.portalHalfWidth * 2 - 1, ARENA.portalHeight - 0.5);
      face.mesh.position.set(0, (ARENA.portalHeight - 0.5) / 2, gateZ(stage.index));
      face.mesh.rotation.y = Math.PI;
      face.set(false, 0, stage.enemies.length, stage.index + 1);
      group.add(face.mesh);
      this.gates.push({ next: stage.index + 1, face, z: gateZ(stage.index) });
      this.stageSign(stage.index + 1, z0 - 0.4);
    } else {
      // The end of the road: the great keep's gate, closed.
      torii(b, 0, 0, end - 1.5, 26, 20);
      pagoda(b, 0, 33, end + 12, 1.1);
    }

    // The win shrine, beside the gate.
    this.buildShrine(b, group, stage);
    this.root.add(group);
    group.add(b.build(`stage-${stage.index}-parts`));
    this.stageRoots.push(group);
    this.setReward(stage.index, 0);
  }

  /**
   * THE WIN SHRINE: where a cleared stage's Wins are claimed. A low stone dais
   * (one step up, exactly the solid) rimmed in gold, a lacquered trophy emblem
   * on it marking the claim area, a small torii behind it hung with a CLAIM
   * WINS banner, a stone lantern at each front corner, and a golden trophy
   * turning in the air above. Armed, the emblem blazes and a column of light
   * rises from it; locked, it is dim and the trophy idles.
   */
  private buildShrine(b: PartBuilder, group: Group, stage: StageDef): void {
    const pad = rewardPadOf(stage.index);
    const r = REWARD_SHRINE;
    const h = r.daisHalf;
    const top = r.daisTop;
    // The dais: stone, a gold rim laid on its edges (no two pieces overlap), a lacquer plate inside.
    b.box(h * 2, top + 1, h * 2, PALETTE.stoneDark, 'stud', { x: pad.x, y: (top - 1) / 2, z: pad.z });
    const rim = 0.35;
    for (const side of [-1, 1]) {
      b.box(h * 2, 0.14, rim, PALETTE.gold, 'smooth', { x: pad.x, y: top + 0.07, z: pad.z + side * (h - rim / 2) });
      b.box(rim, 0.14, h * 2 - rim * 2, PALETTE.gold, 'smooth', { x: pad.x + side * (h - rim / 2), y: top + 0.07, z: pad.z });
    }
    b.box(h * 2 - rim * 2, 0.06, h * 2 - rim * 2, 0x7a1418, 'smooth', { x: pad.x, y: top + 0.03, z: pad.z });
    torii(b, pad.x, 0, pad.z + r.toriiZ, r.pillarX / 0.42, 8.4);
    for (const side of [-1, 1]) {
      stoneLantern(b, pad.x + side * r.lanternX, 0, pad.z + r.lanternZ, 0.85);
      paperLantern(b, pad.x + side * r.pillarX, 6.4, pad.z + r.toriiZ - 0.8, 0.9, 0xffc766);
    }

    // The emblem on the plate: the claim area, unmistakably.
    const emblemMaterial = new MeshBasicMaterial({ map: shrineEmblem(), transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    this.materials.push(emblemMaterial);
    const emblem = new Mesh(new CircleGeometry(pad.half - 0.3, 48), emblemMaterial);
    // Upright for a player walking up the road (+Z).
    emblem.rotation.set(-Math.PI / 2, 0, Math.PI);
    emblem.position.set(pad.x, top + 0.08, pad.z);
    group.add(emblem);

    // A column of light over an armed shrine.
    const beamMaterial = new MeshBasicMaterial({ color: 0xffd86a, transparent: true, opacity: 0.3, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false });
    this.materials.push(beamMaterial);
    const beam = new Mesh(new CylinderGeometry(pad.half - 0.6, pad.half - 0.2, 9, 32, 1, true), beamMaterial);
    beam.position.set(pad.x, top + 4.6, pad.z);
    group.add(beam);

    // The banner between the torii's two beams, on a dark board in front of them.
    const boardZ = pad.z + r.toriiZ - 0.55;
    b.box(6.6, 1.05, 0.12, 0x2a0e0a, 'smooth', { x: pad.x, y: 6.8, z: boardZ });
    const banner = new CanvasSign(6.2, 0.95, [{ text: 'CLAIM WINS', size: 1, fill: '#ffd53d', stroke: '#3a1204', strokeWidth: 0.2 }]);
    banner.mesh.position.set(pad.x, 6.8, boardZ - 0.07);
    banner.mesh.rotation.y = Math.PI;
    group.add(banner.mesh);
    this.signs.push(banner);

    // The trophy turning in the air above the emblem.
    const trophy = trophyModel();
    trophy.position.set(pad.x, top + 2.4, pad.z);
    group.add(trophy);

    const label = new LabelSprite(8, 3.2);
    label.sprite.position.set(pad.x, top + 9.4, pad.z);
    group.add(label.sprite);
    this.rewards.push({ stage: stage.index, emblem: emblemMaterial, beam, beamMaterial, trophy, label, armed: false, baseY: top + 2.4 });
  }

  /** Flat, walkable decoration on the arena floor. */
  private accent(b: PartBuilder, style: ThemeStyle, start: number, end: number): void {
    const mid = (start + end) / 2;
    switch (style.accent) {
      case 'picnic':
        picnic(b, -20, 0.02, start + 20);
        picnic(b, 22, 0.02, end - 30);
        break;
      case 'petals':
        for (let i = 0; i < 26; i += 1) b.box(1.2, 0.04, 1.2, PALETTE.sakura, 'smooth', { x: ((i * 37) % 70) - 35, y: 0.03, z: start + 6 + ((i * 53) % (end - start - 12)), ry: i });
        break;
      case 'snow':
        for (let i = 0; i < 12; i += 1) b.box(6 + (i % 3) * 2, 0.08, 4 + (i % 2) * 3, 0xffffff, 'smooth', { x: ((i * 29) % 64) - 32, y: 0.05, z: start + 8 + ((i * 41) % (end - start - 16)) });
        break;
      case 'lava':
        for (let i = 0; i < 10; i += 1) b.box(0.6, 0.06, 7 + (i % 3) * 3, 0xff7a1c, 'glow', { x: ((i * 31) % 60) - 30, y: 0.04, z: start + 10 + ((i * 47) % (end - start - 20)), ry: i * 0.7 });
        break;
      case 'pools':
        for (let i = 0; i < 7; i += 1) {
          const x = ((i * 23) % 56) - 28;
          const z = start + 12 + ((i * 37) % (end - start - 24));
          b.add(new CylinderGeometry(3.2, 3.2, 0.06, 18), PALETTE.water, 'smooth', { x, y: 0.04, z });
          b.add(new CylinderGeometry(0.7, 0.7, 0.07, 10), 0x3fae3f, 'smooth', { x: x + 1.2, y: 0.07, z: z - 0.8 });
        }
        break;
      case 'tiles':
        for (let i = -3; i <= 3; i += 1) b.box(3, 0.06, 3, 0xffe23a, 'smooth', { x: i * 9, y: 0.04, z: mid + (i % 2) * 14 });
        break;
      case 'gold':
        b.box(14, 0.06, end - start, PALETTE.gold, 'smooth', { x: 0, y: 0.03, z: mid });
        break;
      case 'runes':
      case 'violet': {
        const material = new MeshBasicMaterial({
          map: worldTextures.runeCircle(style.accent === 'runes' ? '#ff5a3c' : '#c77dff'),
          transparent: true,
          blending: AdditiveBlending,
          depthWrite: false,
        });
        this.materials.push(material);
        const circle = new Mesh(new PlaneGeometry(26, 26), material);
        circle.rotation.x = -Math.PI / 2;
        circle.position.set(0, 0.12, mid + 6);
        this.root.add(circle);
        break;
      }
      case 'none':
        break;
    }
  }

  /** What rises beyond the cliffs: every stage has its own horizon. */
  private skyline(b: PartBuilder, style: ThemeStyle, start: number, end: number): void {
    // The inner canyon terrace is 18 tall and stands on y = -1, so its top is 17.
    const top = 17;
    const sides = [-1, 1] as const;
    for (let z = start + 12; z < end; z += 24) {
      for (const side of sides) {
        const x = side * (ARENA.halfWidth + 8);
        switch (style.skyline) {
          case 'bamboo':
            bambooClump(b, x, top, z, 7, 13, z + side);
            break;
          case 'temples':
            house(b, x, top, z, 12, 9, 5, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0x3a4a6a);
            break;
          case 'fortress':
            b.box(8, 10, 10, 0x4a2e26, 'stud', { x, y: top + 5, z });
            for (let i = -1; i <= 1; i += 1) b.add(new ConeGeometry(0.6, 2.4, 5), 0xf1ecdc, 'smooth', { x: x - side * 4.2, y: top + 11, z: z + i * 3 });
            break;
          case 'sakura':
            sakuraTree(b, x, top, z, 1.6, z);
            break;
          case 'peaks':
            b.add(new ConeGeometry(9, 22, 6), 0xdff0ff, 'smooth', { x: x + side * 4, y: top + 11, z });
            b.add(new ConeGeometry(4.2, 8, 6), 0xffffff, 'smooth', { x: x + side * 4, y: top + 18, z });
            break;
          case 'volcano':
            b.add(new ConeGeometry(11, 18, 7), 0x5a4440, 'smooth', { x: x + side * 6, y: top + 9, z });
            b.add(new CylinderGeometry(3.4, 3.4, 0.6, 10), 0xff7a1c, 'glow', { x: x + side * 6, y: top + 17.2, z });
            break;
          case 'willows':
            pineTree(b, x, top, z, 1.3);
            bambooClump(b, x + side * 5, top, z + 8, 5, 10, z);
            break;
          case 'storm':
            b.box(16, 4, 12, 0x6a6f80, 'stud', { x, y: top + 20, z });
            b.box(0.8, 9, 0.8, 0xffe23a, 'glow', { x, y: top + 12, z, rz: 0.3 });
            b.add(new CylinderGeometry(3, 3, 3, 12), 0xc0392b, 'smooth', { x, y: top + 1.5, z: z + 8 });
            break;
          case 'towers':
            b.box(7, 16, 7, 0x4a3a6a, 'stud', { x, y: top + 8, z });
            b.add(new ConeGeometry(6, 5, 4), 0x2a1f3a, 'smooth', { x, y: top + 18.5, z, ry: Math.PI / 4 });
            b.box(1.4, 1.4, 1.4, 0xc77dff, 'glow', { x: x - side * 3.6, y: top + 11, z });
            break;
          case 'keep':
            pagoda(b, x + side * 6, top, z, 0.7);
            break;
        }
      }
    }
  }

  /** Set a stage's reward pad for this many credited enemies. */
  private setReward(stage: number, killed: number): void {
    const view = this.rewards.find((entry) => entry.stage === stage);
    const def = STAGES[stage - 1];
    if (!view || !def) return;
    const armed = killed >= def.enemies.length;
    view.armed = armed;
    view.emblem.color.setHex(armed ? 0xffffff : 0x6c6a74);
    view.beam.visible = armed;
    const trophy = trophyIcon(() => this.setReward(stage, killed));
    view.label.set(
      armed
        ? [
            { text: 'CLAIM!', color: '#ffe08a', size: 0.9 },
            { text: `+${formatWins(def.reward)} WIN${def.reward === 1 ? '' : 'S'}`, color: '#ffffff', size: 1.1, icon: trophy },
          ]
        : [
            { text: `+${formatWins(def.reward)} WIN${def.reward === 1 ? '' : 'S'}`, color: '#ffe08a', size: 1.1, icon: trophy },
            { text: `Defeat the wave ${killed}/${def.enemies.length}`, color: '#ffffff', size: 0.8 },
          ],
    );
  }

  /** The local player's progress: which portals are open, and each stage's tally. */
  setProgress(bestStage: number, killMasks: ArrayLike<number>): void {
    for (const gate of this.gates) {
      if (gate.next === 1) continue;
      const from = STAGES[gate.next - 2]!;
      const killed = popcount(killMasks[from.index - 1] ?? 0);
      gate.face.set(bestStage >= from.index, killed, from.enemies.length, gate.next);
    }
    for (const stage of STAGES) {
      const killed = popcount(killMasks[stage.index - 1] ?? 0);
      const view = this.rewards.find((entry) => entry.stage === stage.index);
      if (view) this.setReward(stage.index, killed);
    }
  }

  /** Show only the stages near the player: ten arenas of props is a lot to draw at once. */
  update(delta: number, playerZ: number, cameraZ: number): void {
    // A portal the camera is close to, or looking through from behind the player, fades
    // so walking through one never fills the screen with its face.
    for (const gate of this.gates) {
      const between = (cameraZ - gate.z) * (playerZ - gate.z) < 0;
      gate.face.setFaded(between || Math.abs(cameraZ - gate.z) < 9);
    }
    this.time += delta;
    for (const [index, group] of this.stageRoots.entries()) {
      const centre = (arenaStartZ(index + 1) + arenaEndZ(index + 1)) / 2;
      group.visible = Math.abs(playerZ - centre) < 260;
    }
    for (const view of this.rewards) {
      if (!view.trophy.parent?.visible) continue;
      // Armed, the trophy spins up and the light breathes; locked, it idles.
      view.trophy.rotation.y += delta * (view.armed ? 2.2 : 0.5);
      view.trophy.position.y = view.baseY + Math.sin(this.time * (view.armed ? 3 : 1.5)) * (view.armed ? 0.35 : 0.15);
      if (view.armed) view.beamMaterial.opacity = 0.22 + Math.sin(this.time * 4) * 0.1;
    }
  }

  dispose(): void {
    for (const gate of this.gates) gate.face.dispose();
    for (const view of this.rewards) view.label.dispose();
    for (const sign of this.signs) sign.dispose();
    for (const material of this.materials) material.dispose();
    this.root.removeFromParent();
  }
}

const popcount = (value: number): number => {
  let n = value >>> 0;
  let count = 0;
  while (n) {
    count += n & 1;
    n >>>= 1;
  }
  return count;
};


/** The emblem on every win shrine: a trophy in a gold ring on red lacquer. Drawn once, shared. */
let emblemTexture: CanvasTexture | null = null;
const shrineEmblem = (): CanvasTexture => {
  if (emblemTexture) return emblemTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  emblemTexture = texture;
  const draw = (): void => {
    const ctx = canvas.getContext('2d')!;
    const c = 256;
    ctx.clearRect(0, 0, 512, 512);
    ctx.fillStyle = '#f2c14e';
    ctx.beginPath();
    ctx.arc(c, c, 252, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b3202a';
    ctx.beginPath();
    ctx.arc(c, c, 226, 0, Math.PI * 2);
    ctx.fill();
    // Gold rays behind the trophy, like a rising sun.
    ctx.fillStyle = 'rgba(255, 214, 90, 0.35)';
    for (let i = 0; i < 16; i += 2) {
      const a0 = (i / 16) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.arc(c, c, 222, a0, a0 + Math.PI / 8);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = '#ffe08a';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(c, c, 170, 0, Math.PI * 2);
    ctx.stroke();
    const image = trophyIcon(draw);
    if (image) {
      const size = 230;
      const ratio = image.naturalWidth / Math.max(1, image.naturalHeight);
      const w = ratio >= 1 ? size : size * ratio;
      const hh = ratio >= 1 ? size / ratio : size;
      ctx.drawImage(image, c - w / 2, c - hh / 2 - 18, w, hh);
    }
    ctx.font = '700 58px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#3a0a0c';
    ctx.strokeText('WINS', c, 424);
    ctx.fillStyle = '#ffe08a';
    ctx.fillText('WINS', c, 424);
    texture.needsUpdate = true;
  };
  draw();
  return texture;
};

/** A golden trophy cup, built once and cloned onto every shrine (geometry shared). */
let trophyTemplate: Group | null = null;
const trophyModel = (): Group => {
  if (!trophyTemplate) {
    const b = new PartBuilder();
    b.add(new CylinderGeometry(1.1, 0.55, 1.5, 20), PALETTE.gold, 'glow', { y: 1.35 });
    b.add(new CylinderGeometry(1.14, 1.14, 0.14, 20), 0xffe89a, 'glow', { y: 2.12 });
    for (const side of [-1, 1]) b.add(new TorusGeometry(0.42, 0.11, 8, 16, Math.PI), PALETTE.gold, 'glow', { x: side * 1.05, y: 1.45, rz: side * -Math.PI / 2 });
    b.add(new CylinderGeometry(0.16, 0.22, 0.7, 10), PALETTE.gold, 'glow', { y: 0.35 });
    b.box(0.9, 0.2, 0.9, PALETTE.gold, 'glow', { y: -0.1 });
    b.box(1.2, 0.3, 1.2, 0x7a4a14, 'smooth', { y: -0.35 });
    b.add(new SphereGeometry(0.22, 10, 8), 0xffffff, 'glow', { y: 2.6 });
    trophyTemplate = b.build('shrine-trophy');
  }
  return trophyTemplate.clone();
};
