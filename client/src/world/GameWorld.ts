import { WorldCollision } from '@katana/shared';
import type { Scene } from 'three';
import type { LeaderboardSnapshot } from '../net/netTypes.js';
import { ForgeShop } from './ForgeShop.js';
import { KatanaStage } from './KatanaStage.js';
import { PetsShop } from './PetsShop.js';
import { Scoreboard } from './Scoreboard.js';
import { Sky } from './Sky.js';
import { StageRoad } from './StageRoad.js';
import { TrainingArea } from './TrainingArea.js';
import { Village } from './Village.js';

/**
 * THE WORLD: the village and everything reached from it, plus the stage road.
 * Composition only - each area owns its own meshes and its own live state.
 * The collision is the SHARED one, built from the same map data the server
 * simulates against.
 */
export class GameWorld {
  readonly collision = new WorldCollision();
  readonly sky = new Sky();
  readonly village = new Village();
  readonly katanaStage = new KatanaStage();
  readonly training = new TrainingArea();
  readonly forge = new ForgeShop();
  readonly petsShop = new PetsShop();
  readonly scoreboard = new Scoreboard();
  readonly road = new StageRoad();

  addTo(scene: Scene): void {
    scene.add(
      this.sky.root,
      this.village.root,
      this.katanaStage.root,
      this.training.root,
      this.forge.root,
      this.petsShop.root,
      this.scoreboard.root,
      this.road.root,
    );
  }

  update(delta: number, x: number, z: number, cameraZ: number): void {
    this.sky.follow(x, z);
    // The village's animated pieces only matter while the player is in the village.
    const inVillage = z < 60;
    if (inVillage) {
      this.katanaStage.update(delta);
      this.training.update(delta);
      this.forge.update(delta);
      this.petsShop.update(delta);
    }
    this.road.update(delta, z, cameraZ);
  }

  setBoards(board: LeaderboardSnapshot | null): void {
    this.scoreboard.update(board);
  }

  dispose(): void {
    this.sky.dispose();
    this.village.dispose();
    this.katanaStage.dispose();
    this.training.dispose();
    this.forge.dispose();
    this.petsShop.dispose();
    this.scoreboard.dispose();
    this.road.dispose();
  }
}
