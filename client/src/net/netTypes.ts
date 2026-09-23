import type { AvatarAppearance, AvatarProportions } from '@katana/shared';
import type { ArraySchema, MapSchema } from '@colyseus/schema';

/**
 * Client-side TYPE mirror of the server's Colyseus schema.
 *
 * Types only - colyseus.js builds the concrete schema instances at runtime
 * from the handshake reflection.
 */
export interface NetPet {
  uid: number;
  petId: number;
  equipped: boolean;
}

export interface NetPlayerState {
  sessionId: string;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  speed: number;
  verticalVelocity: number;
  grounded: boolean;
  velocityX: number;
  velocityY: number;
  velocityZ: number;
  lastInputSeq: number;
  jumpLatched: boolean;
  jumpCount: number;
  attackCount: number;
  attackYaw: number;

  avatar: AvatarAppearance & AvatarProportions;
  displayName: string;
  avatarUrl: string;

  level: number;
  maxLevel: number;
  rebirths: number;
  wins: number;
  lifetimeWins: number;
  xp: number;
  lifetimeXp: number;
  damage: number;
  speedStat: number;
  moveSpeed: number;
  jumpVelocity: number;
  katanaSlot: number;
  ownedKatanas: number;
  trainingTier: number;
  trainingHits: ArraySchema<number>;
  forgePercent: number;
  forgeRotation: number;
  forgeBought: ArraySchema<number>;
  pets: ArraySchema<NetPet>;
  petsHatched: number;
  bestStage: number;
  /** Stages cleared in the current run: portals up to it are open. */
  runStage: number;
  killMasks: ArraySchema<number>;
  hp: number;
  maxHp: number;
  /** Fallen: the death animation plays; the server respawns them after it. */
  dead: boolean;
  /** This player's own enemies - only ever present on the LOCAL player. */
  enemies?: ArraySchema<NetEnemyState>;
  playSeconds: number;
  ready: boolean;
}

export interface NetEnemyState {
  id: number;
  x: number;
  z: number;
  yaw: number;
  hp: number;
  alive: boolean;
  moving: boolean;
  hits: number;
  swings: number;
}

export interface NetLeaderEntry {
  handle: string;
  name: string;
  avatarUrl: string;
  value: number;
}

export interface NetLeaderboardState {
  wins: ArrayLike<NetLeaderEntry>;
  damage: ArrayLike<NetLeaderEntry>;
  time: ArrayLike<NetLeaderEntry>;
}

export interface NetGameState {
  players: MapSchema<NetPlayerState>;
  elapsed: number;
  leaderboard: NetLeaderboardState;
  forgeRotation: number;
  forgeSecondsLeft: number;
}

/** A leaderboard flattened into plain data, ready to draw. */
export interface LeaderboardSnapshot {
  wins: readonly NetLeaderEntry[];
  damage: readonly NetLeaderEntry[];
  time: readonly NetLeaderEntry[];
}

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';
