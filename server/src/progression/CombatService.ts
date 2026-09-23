import {
  ARENA,
  COMBAT,
  DUMMIES,
  DUMMY_HALF,
  DUMMY_TARGET_BASE,
  ENEMIES,
  ENEMY_AI,
  STAGE_COUNT,
  TRAINING_TIERS,
  arenaEndZ,
  arenaStartZ,
  canTrainOn,
  enemyXpFactor,
  isDummyTarget,
  stageByIndex,
  type EnemyDef,
  type StageDef,
} from '@katana/shared';
import type { EnemyState } from '../rooms/state/EnemyState.js';
import type { GameState } from '../rooms/state/GameState.js';
import type { PlayerState } from '../rooms/state/PlayerState.js';
import type { ProgressionService } from './ProgressionService.js';

/** Per-enemy bookkeeping of one run that the replicated state must not carry. */
interface EnemyRuntime {
  swingIn: number;
}

interface SwingBucket {
  tokens: number;
  at: number;
}

export type AttackOutcome =
  | { readonly ok: false; readonly reason: 'rate' | 'no-target' | 'sealed' | 'locked-dummy'; readonly tier?: number; readonly xp?: number }
  | {
      readonly ok: true;
      readonly target: number;
      readonly damage: number;
      readonly after: number;
      readonly killed: boolean;
      readonly xp: number;
      /** A dummy just mastered, if any. */
      readonly mastered: number;
    };

/** A stage clear the room announces. */
export interface StageClear {
  readonly sessionId: string;
  readonly stage: number;
  readonly firstClear: boolean;
}

/** An enemy swing that landed on a player. */
export interface PlayerHurt {
  readonly sessionId: string;
  readonly enemy: number;
  readonly damage: number;
  readonly killed: boolean;
}

/**
 * THE ONE PLACE DAMAGE IS DEALT - both ways - and the enemies' brains.
 *
 * Every player fights their OWN run: `player.enemies` is a full set of every
 * stage's enemies, replicated to that player alone. Nobody else can hit
 * them, be hit by them, or see them, so one player's fight never touches
 * another's.
 *
 * A player's swing is validated here, in this order: the rate limit, a target
 * of THEIR run that exists and is alive, that they may attack (a boss is
 * sealed until the rest of its wave is down; a dummy needs its rebirths), and
 * that it is within reach of the position the SERVER simulated. Only then is
 * the player's own server-derived `damage` applied.
 *
 * While a player stands in a stage, every enemy of that stage comes for them,
 * wherever they are in it, and each swing takes the enemy's `damage` off the
 * player's health. At zero the player is DEAD: the room returns them to base,
 * which resets the run (`resetRun`). A fallen enemy stays down for the rest of
 * the run; a stage whose every enemy is down is CLEARED: its portal opens
 * (`runStage`) and its reward pad arms.
 */
export class CombatService {
  private readonly runs = new Map<string, EnemyRuntime[]>();
  private readonly buckets = new Map<string, SwingBucket>();
  private readonly clears: StageClear[] = [];
  private readonly hurts: PlayerHurt[] = [];

  forget(sessionId: string): void {
    this.buckets.delete(sessionId);
    this.runs.delete(sessionId);
  }

  /** Stage clears since the last call. */
  drainClears(): StageClear[] {
    if (this.clears.length === 0) return [];
    const out = this.clears.slice();
    this.clears.length = 0;
    return out;
  }

  /** Enemy hits on players since the last call (a killing one included). */
  drainHurts(): PlayerHurt[] {
    if (this.hurts.length === 0) return [];
    const out = this.hurts.slice();
    this.hurts.length = 0;
    return out;
  }

  /**
   * A FRESH RUN: every enemy of every stage back at its post at full health,
   * no stage cleared, every portal shut, the player at full health. Called
   * whenever the player is placed at base (join, death, claim, teleport).
   */
  resetRun(sessionId: string, player: PlayerState): void {
    for (const def of ENEMIES) {
      const enemy = player.enemies[def.id];
      if (!enemy) continue;
      enemy.alive = true;
      enemy.hp = def.maxHp;
      enemy.x = def.x;
      enemy.z = def.z;
      enemy.yaw = Math.PI;
      enemy.moving = false;
    }
    for (let i = 0; i < player.killMasks.length; i += 1) if (player.killMasks[i] !== 0) player.killMasks[i] = 0;
    player.runStage = 0;
    player.hp = player.maxHp;
    player.dead = false;
    this.runs.set(sessionId, ENEMIES.map(() => ({ swingIn: ENEMY_AI.firstSwingSeconds })));
  }

  /**
   * Begin a run part-way down the road (a teleport to a stage already
   * reached): the stages before it count as cleared, so the portals behind
   * the player are open and theirs is the next to earn.
   */
  startRunAt(player: PlayerState, stage: number): void {
    for (let s = 1; s < stage; s += 1) {
      const def = stageByIndex(s);
      if (!def) continue;
      player.killMasks[s - 1] = def.fullMask;
      for (const enemy of def.enemies) {
        const state = player.enemies[enemy.id];
        if (state) state.alive = false;
      }
    }
    player.runStage = Math.max(0, Math.min(STAGE_COUNT, stage - 1));
  }

  /** May this player hit this enemy at all? A boss waits for its wave. */
  canAttack(player: PlayerState, def: EnemyDef): boolean {
    if (!def.boss) return true;
    const stage = stageByIndex(def.stage);
    if (!stage) return false;
    const mask = player.killMasks[def.stage - 1] ?? 0;
    return (mask & stage.waveMask) === stage.waveMask;
  }

  /** One swing. `hint` is what the client says it swung at; it is only a hint. */
  attack(
    sessionId: string,
    player: PlayerState,
    hint: number,
    _state: GameState,
    progression: ProgressionService,
  ): AttackOutcome {
    if (!this.takeToken(sessionId)) return { ok: false, reason: 'rate' };

    const reach = COMBAT.reach + COMBAT.reachSlack;
    player.attackCount += 1;
    // Every accepted swing trains the arm: XP whether it lands or not, on the
    // ground or mid-jump. The rate limit above is what keeps this honest.
    const swingXp = progression.creditSwing(player);
    let target = this.validTarget(player, hint, reach);
    if (target === null && Number.isFinite(hint) && hint >= 0) {
      // Swung at something within reach this player may not hit yet: say why,
      // rather than quietly landing on whatever else is near.
      const id = Math.floor(hint);
      if (isDummyTarget(id)) {
        const tier = id - DUMMY_TARGET_BASE;
        const dummy = DUMMIES[tier];
        if (dummy && !canTrainOn(tier, player.rebirths) && this.withinReach(player, dummy.x, dummy.z, DUMMY_HALF, reach)) {
          return { ok: false, reason: 'locked-dummy', tier, xp: swingXp };
        }
      } else {
        const def = ENEMIES[id];
        const enemy = player.enemies[id];
        if (def && enemy?.alive && !this.canAttack(player, def) && this.withinReach(player, enemy.x, enemy.z, def.radius, reach)) {
          return { ok: false, reason: 'sealed', xp: swingXp };
        }
      }
    }
    if (target === null) target = this.nearestTarget(player, reach);
    // A swing at nothing: it plays for everyone, and pays only the swing XP.
    if (target === null) return { ok: false, reason: 'no-target', xp: swingXp };

    const outcome = isDummyTarget(target)
      ? this.hitDummy(player, target - DUMMY_TARGET_BASE, progression)
      : this.hitEnemy(sessionId, player, target, progression);
    return outcome.ok ? { ...outcome, xp: outcome.xp + swingXp } : outcome;
  }

  private hitEnemy(sessionId: string, player: PlayerState, id: number, progression: ProgressionService): AttackOutcome {
    const def = ENEMIES[id]!;
    const enemy = player.enemies[id]!;
    player.attackYaw = Math.atan2(enemy.x - player.x, enemy.z - player.z);
    const damage = player.damage;
    enemy.hp = Math.max(0, enemy.hp - damage);
    enemy.hits = (enemy.hits + 1) % 65536;
    const xp = progression.creditHit(player, enemyXpFactor(def));

    let killed = false;
    if (enemy.hp <= 0) {
      killed = true;
      this.kill(sessionId, player, def, enemy);
    }
    return { ok: true, target: id, damage, after: enemy.hp, killed, xp, mastered: -1 };
  }

  private hitDummy(player: PlayerState, tier: number, progression: ProgressionService): AttackOutcome {
    const dummy = DUMMIES[tier]!;
    const def = TRAINING_TIERS[tier]!;
    player.attackYaw = Math.atan2(dummy.x - player.x, dummy.z - player.z);
    const damage = player.damage;
    let mastered = -1;
    if (tier > player.trainingTier) {
      const hits = Math.min((player.trainingHits[tier] ?? 0) + 1, def.hitsToMaster);
      player.trainingHits[tier] = hits;
      if (hits >= def.hitsToMaster) {
        player.trainingTier = tier;
        mastered = tier;
        progression.syncDerived(player);
      }
    }
    const xp = progression.creditHit(player, tier + 1);
    const after = tier <= player.trainingTier ? def.hitsToMaster : (player.trainingHits[tier] ?? 0);
    return { ok: true, target: DUMMY_TARGET_BASE + tier, damage, after, killed: false, xp, mastered };
  }

  /** An enemy of this run falls - for the rest of the run. A full wave clears its stage. */
  private kill(sessionId: string, player: PlayerState, def: EnemyDef, enemy: EnemyState): void {
    enemy.alive = false;
    enemy.moving = false;
    const stage = stageByIndex(def.stage)!;
    const index = stage.index - 1;
    const after = (player.killMasks[index] ?? 0) | (1 << def.bit);
    player.killMasks[index] = after;
    if (after !== stage.fullMask) return;
    if (stage.index > player.runStage) player.runStage = stage.index;
    const firstClear = stage.index > player.bestStage;
    if (firstClear) player.bestStage = stage.index;
    this.clears.push({ sessionId, stage: stage.index, firstClear });
  }

  /** The hinted target, if it is a real one of this player's run they may hit from here. */
  private validTarget(player: PlayerState, hint: number, reach: number): number | null {
    if (!Number.isFinite(hint) || hint < 0) return null;
    const id = Math.floor(hint);
    if (isDummyTarget(id)) {
      const tier = id - DUMMY_TARGET_BASE;
      const dummy = DUMMIES[tier];
      if (!dummy || !canTrainOn(tier, player.rebirths)) return null;
      return this.withinReach(player, dummy.x, dummy.z, DUMMY_HALF, reach) ? id : null;
    }
    const def = ENEMIES[id];
    const enemy = player.enemies[id];
    if (!def || !enemy || !enemy.alive || !this.canAttack(player, def)) return null;
    return this.withinReach(player, enemy.x, enemy.z, def.radius, reach) ? id : null;
  }

  /** The nearest thing this player may hit from where the server has them. */
  private nearestTarget(player: PlayerState, reach: number): number | null {
    let best: number | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const def of ENEMIES) {
      const enemy = player.enemies[def.id];
      if (!enemy || !enemy.alive || !this.canAttack(player, def)) continue;
      const d = Math.hypot(enemy.x - player.x, enemy.z - player.z) - def.radius;
      if (d <= reach && d < bestDistance) {
        best = def.id;
        bestDistance = d;
      }
    }
    for (const dummy of DUMMIES) {
      if (!canTrainOn(dummy.tier, player.rebirths)) continue;
      const d = Math.hypot(dummy.x - player.x, dummy.z - player.z) - DUMMY_HALF;
      if (d <= reach && d < bestDistance) {
        best = DUMMY_TARGET_BASE + dummy.tier;
        bestDistance = d;
      }
    }
    return best;
  }

  private withinReach(player: PlayerState, x: number, z: number, radius: number, reach: number): boolean {
    // Mid-jump still reaches: even the highest rebirth jump peaks below this.
    if (Math.abs(player.y) > 10) return false;
    return Math.hypot(x - player.x, z - player.z) - radius <= reach;
  }

  private takeToken(sessionId: string): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(sessionId);
    if (!bucket) {
      bucket = { tokens: COMBAT.burst, at: now };
      this.buckets.set(sessionId, bucket);
    }
    bucket.tokens = Math.min(COMBAT.burst, bucket.tokens + (now - bucket.at) / 1000 / COMBAT.refillSeconds);
    bucket.at = now;
    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  }

  // ------------------------------------------------------------------ AI

  /**
   * Advance every player's run. In the village the player heals to full.
   * Inside one, every live enemy of THAT stage (a sealed boss excepted, which
   * holds its post) closes on the player and swings.
   */
  tick(delta: number, state: GameState): void {
    for (const [sessionId, player] of state.players) {
      let run = this.runs.get(sessionId);
      if (!run) {
        run = ENEMIES.map(() => ({ swingIn: ENEMY_AI.firstSwingSeconds }));
        this.runs.set(sessionId, run);
      }
      const stageIndex = fightingStageAt(player.x, player.z);
      const stage = stageByIndex(stageIndex);
      if (!stage) {
        // Back in the village (not merely between two arenas): full health.
        if (!player.dead && player.z < arenaStartZ(1) && player.hp !== player.maxHp) player.hp = player.maxHp;
        continue;
      }
      if (player.dead || player.hp <= 0) continue;
      for (const def of stage.enemies) {
        const enemy = player.enemies[def.id];
        if (!enemy || !enemy.alive) continue;
        if (!this.think(sessionId, player, stage, def, enemy, run[def.id]!, delta)) break;
      }
      this.separate(player, stage);
    }
  }

  /** One enemy's step. Returns false once the player has fallen. */
  private think(
    sessionId: string,
    player: PlayerState,
    stage: StageDef,
    def: EnemyDef,
    enemy: EnemyState,
    runtime: EnemyRuntime,
    delta: number,
  ): boolean {
    const startZ = arenaStartZ(stage.index);
    const endZ = arenaEndZ(stage.index);
    // A sealed boss holds its post until its wave is down.
    const engaged = this.canAttack(player, def);
    const goalX = engaged ? player.x : def.x;
    const goalZ = engaged ? player.z : def.z;
    const stopAt = engaged ? ENEMY_AI.reach + def.radius * 0.5 : 0.4;
    const dx = goalX - enemy.x;
    const dz = goalZ - enemy.z;
    const distance = Math.hypot(dx, dz);

    if (distance > stopAt) {
      const step = Math.min(def.speed * delta, distance - stopAt);
      const limit = ARENA.halfWidth - 1.5;
      enemy.x = Math.max(-limit, Math.min(limit, enemy.x + (dx / distance) * step));
      // Up into the exit portal's recess too: a player pressed against a shut portal is not safe.
      enemy.z = Math.max(startZ + 1.5, Math.min(endZ + ARENA.gateDepth / 2 - 1.5, enemy.z + (dz / distance) * step));
      enemy.yaw = Math.atan2(dx, dz);
      if (!enemy.moving) enemy.moving = true;
      runtime.swingIn = Math.min(runtime.swingIn, ENEMY_AI.firstSwingSeconds);
      return true;
    }
    if (enemy.moving) enemy.moving = false;
    if (!engaged) return true;
    enemy.yaw = Math.atan2(dx, dz);
    runtime.swingIn -= delta;
    if (runtime.swingIn > 0) return true;
    runtime.swingIn = ENEMY_AI.swingSeconds * (def.boss ? 1.3 : 1);
    enemy.swings = (enemy.swings + 1) % 65536;
    // The swing lands if the player is still within its reach (and not high above it).
    const now = Math.hypot(player.x - enemy.x, player.z - enemy.z);
    if (now > stopAt + ENEMY_AI.hitSlack || player.y > 6) return true;
    player.hp = Math.max(0, player.hp - def.damage);
    const killed = player.hp <= 0;
    this.hurts.push({ sessionId, enemy: def.id, damage: def.damage, killed });
    return !killed;
  }

  /** Keep a wave from stacking into one body: a gentle push apart. */
  private separate(player: PlayerState, stage: StageDef): void {
    const list = stage.enemies;
    for (let i = 0; i < list.length; i += 1) {
      const a = player.enemies[list[i]!.id];
      if (!a || !a.alive || !a.moving) continue;
      for (let j = 0; j < list.length; j += 1) {
        if (i === j) continue;
        const b = player.enemies[list[j]!.id];
        if (!b || !b.alive) continue;
        const min = list[i]!.radius + list[j]!.radius + 0.4;
        const dx = a.x - b.x;
        const dz = a.z - b.z;
        const d = Math.hypot(dx, dz);
        if (d > 1e-3 && d < min) {
          const push = (min - d) * 0.5;
          a.x += (dx / d) * push;
          a.z += (dz / d) * push;
        }
      }
    }
  }
}

/**
 * The stage whose wave a player at (x, z) is fighting: its arena AND the
 * recess of its exit portal (where a player stopped by a shut portal stands).
 * 0 in the village.
 */
export const fightingStageAt = (x: number, z: number): number => {
  if (Math.abs(x) > ARENA.halfWidth) return 0;
  for (let stage = 1; stage <= STAGE_COUNT; stage += 1) {
    if (z >= arenaStartZ(stage) && z < arenaEndZ(stage) + ARENA.gateDepth) return stage;
  }
  return 0;
};
