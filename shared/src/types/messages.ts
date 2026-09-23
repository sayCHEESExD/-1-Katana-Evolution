import type { AvatarAppearance, AvatarProportions } from './avatar.js';

/**
 * Client -> server input (MessageType.Move).
 *
 * INPUT ONLY. No position, velocity or target: the server simulates movement
 * from intent and owns the result.
 */
export interface MoveMessage {
  /** Monotonically increasing input sequence number. */
  seq: number;
  /** Seconds this input covers. Clamped and rate-limited server-side. */
  dt: number;
  /** -1..1, camera-relative. */
  moveX: number;
  /** -1..1, camera-relative. */
  moveZ: number;
  /** The jump control, held. Only a fresh press jumps. */
  jump: boolean;
  /** Yaw the camera faced: movement is camera-relative. */
  cameraYaw: number;
}

/** Client -> server: one swing. `target` is a HINT (enemy id, dummy target, or -1). */
export interface AttackMessage {
  target: number;
}

/** Server -> client: a swing landed on something. */
export interface HitMessage {
  target: number;
  damage: number;
  /** The target's health after the hit, for an enemy; the training progress after it, for a dummy. */
  after: number;
  killed: boolean;
  /** XP the hit paid. */
  xp: number;
}

/** Why a player was placed. */
export type RespawnReason = 'manual' | 'join' | 'teleport' | 'rebirth' | 'death' | 'claim';

/** Server -> client authoritative placement (MessageType.Respawn). */
export interface RespawnMessage {
  x: number;
  y: number;
  z: number;
  rotationY: number;
  reason: RespawnReason;
}

export interface TeleportMessage {
  /** A `TeleportId`: spawn, katanas, training, forge, eggs, or stageN. */
  to: string;
}

/** Client -> server: "I am on this stage's reward pad." A request, never a grant. */
export interface ClaimStageMessage {
  stage: number;
}

/** Server -> client: a stage reward landed. Presentation only. */
export interface StageAwardedMessage {
  stage: number;
  wins: number;
  total: number;
}

/** Server -> client: this player just cleared a stage's wave. */
export interface StageClearedMessage {
  stage: number;
  /** True on the clear that opened the next portal. */
  firstClear: boolean;
}

/** Client -> server: "I am on this katana's pad." */
export interface KatanaPadMessage {
  slot: number;
}

/** Client -> server: buy from the forge. `rotation` must be the current one. */
export interface ForgeBuyMessage {
  rotation: number;
  slot: number;
}

export interface HatchMessage {
  egg: number;
  count: number;
}

export interface HatchedMessage {
  egg: number;
  pets: { uid: number; petId: number }[];
}

export type PetActionKind = 'equip' | 'unequip' | 'delete' | 'equipBest' | 'unequipAll';

export interface PetActionMessage {
  action: PetActionKind;
  /** The pet's uid; ignored by equipBest / unequipAll. */
  uid?: number;
}

/** Server -> client: what happened to a request, so the UI can say so. */
export interface NoticeMessage {
  kind: 'bought' | 'equipped' | 'refused' | 'rebirth' | 'locked' | 'info' | 'defeated';
  text: string;
}

export interface SetAvatarMessage {
  appearance: AvatarAppearance;
  proportions: AvatarProportions;
}

export interface SetIdentityMessage {
  displayName: string;
  avatarUrl: string;
}

/** Client -> server: the portal's game TOKEN, or null when signed out. */
export interface SetAuthMessage {
  token: string | null;
}

export type AuthStatus = 'account' | 'guest' | 'unavailable';

export interface AuthStateMessage {
  status: AuthStatus;
  note?: string;
}
