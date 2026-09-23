import { ArraySchema, Schema, type, view } from '@colyseus/schema';
import { SPAWN, STAGE_COUNT, TRAINING_TIERS } from '@katana/shared';
import { AvatarState } from './AvatarState.js';
import { EnemyState, enemyStates } from './EnemyState.js';

/** One owned Yokai pet. */
export class PetState extends Schema {
  @type('uint32') uid = 0;
  @type('uint8') petId = 0;
  @type('boolean') equipped = false;
}

const zeros = (length: number): ArraySchema<number> => {
  const list = new ArraySchema<number>();
  for (let i = 0; i < length; i += 1) list.push(0);
  return list;
};

/**
 * Replicated per-player state.
 *
 * Every field is written by the SERVER: transform and motion by the
 * authoritative simulation, progression and inventories by their own
 * service. Nothing is ever copied from a client message.
 */
export class PlayerState extends Schema {
  @type('string') sessionId = '';

  @type('float32') x: number = SPAWN.x;
  @type('float32') y: number = SPAWN.y;
  @type('float32') z: number = SPAWN.z;
  @type('float32') rotationY: number = SPAWN.yaw;

  @type('float32') speed = 0;
  @type('float32') verticalVelocity = 0;
  @type('boolean') grounded = true;

  /** Authoritative velocity, for client reconciliation. */
  @type('float32') velocityX = 0;
  @type('float32') velocityY = 0;
  @type('float32') velocityZ = 0;
  @type('uint32') lastInputSeq = 0;
  @type('boolean') jumpLatched = false;
  @type('uint32') jumpCount = 0;

  /** Landed-or-not swings, counted, so every client can play each one. */
  @type('uint32') attackCount = 0;
  /** Which way the last swing faced. */
  @type('float32') attackYaw = 0;

  @type(AvatarState) avatar = new AvatarState();
  @type('string') displayName = '';
  @type('string') avatarUrl = '';

  // ---- progression: every figure is the server's own
  @type('uint16') level = 1;
  @type('uint16') maxLevel = 15;
  @type('uint16') rebirths = 0;
  /** Written through `Wallet` only. */
  @type('float64') wins = 0;
  @type('float64') lifetimeWins = 0;
  @type('float64') xp = 0;
  @type('float64') lifetimeXp = 0;
  /** THE damage per click: `damageFor` of this player's own inputs. */
  @type('float64') damage = 1;
  /** THE Speed stat the HUD shows. */
  @type('uint16') speedStat = 17;
  /** What the simulation runs at, from the Speed stat. */
  @type('float32') moveSpeed = 10.88;
  @type('float32') jumpVelocity = 24;

  @type('uint8') katanaSlot = 1;
  @type('uint16') ownedKatanas = 1;

  @type('uint8') trainingTier = 0;
  @type(['uint16']) trainingHits = zeros(TRAINING_TIERS.length);

  @type('float64') forgePercent = 0;
  @type('uint32') forgeRotation = 0;
  @type(['uint8']) forgeBought = zeros(4);

  @type([PetState]) pets = new ArraySchema<PetState>();
  @type('uint32') petsHatched = 0;
  @type('uint32') nextPetUid = 1;

  /** Highest stage ever cleared: how far the Teleport menu reaches. Persisted. */
  @type('uint8') bestStage = 0;

  // ---- the current RUN: reset whenever the player is placed at base
  /** Stages cleared in this run, in order: every portal up to it is open. */
  @type('uint8') runStage = 0;
  /** Per stage: the enemies this player has defeated in this run. */
  @type(['uint16']) killMasks = zeros(STAGE_COUNT);
  /** Health: `maxHealthFor(damage)`, taken by enemy swings, refilled at base. */
  @type('float64') hp = 100;
  @type('float64') maxHp = 100;
  /** Fallen: the death animation is playing and the respawn is pending. */
  @type('boolean') dead = false;
  /** This player's own enemies - replicated to this player ALONE (a StateView). */
  @view() @type([EnemyState]) enemies = enemyStates();

  @type('float64') playSeconds = 0;

  /** True once the server has simulated at least one input for this player. */
  @type('boolean') ready = false;
}
