import { Client, Room, ServerError } from '@colyseus/core';
import { StateView } from '@colyseus/schema';
import {
  DEATH_RESPAWN_SECONDS,
  ENEMIES,
  MAX_PLAYERS_PER_ROOM,
  MessageType,
  SPAWN,
  STAGE_COUNT,
  TELEPORTS,
  TRAINING_TIERS,
  accountKeyFor,
  stageTeleportCost,
  formatAmount,
  formatMultiplier,
  formatPercent,
  formatWins,
  forgeSecondsLeftAt,
  isAccountKey,
  isValidGuestId,
  sanitizeAppearance,
  sanitizeIdentity,
  sanitizeProportions,
  stageEntry,
  type AttackMessage,
  type AuthStateMessage,
  type AuthStatus,
  type ClaimStageMessage,
  type ForgeBuyMessage,
  type HatchMessage,
  type HatchedMessage,
  type HitMessage,
  type KatanaPadMessage,
  type MoveMessage,
  type NoticeMessage,
  type PetActionMessage,
  type Placement,
  type RespawnMessage,
  type RespawnReason,
  type SetAuthMessage,
  type SetAvatarMessage,
  type SetIdentityMessage,
  type StageAwardedMessage,
  type StageClearedMessage,
  type TeleportMessage,
} from '@katana/shared';
import { tokenHash, verifyGameToken } from '../auth/BloxityAuth.js';
import { serverConfig } from '../config/serverConfig.js';
import { MovementService } from '../movement/MovementService.js';
import { hasProgress, progressOf, type ProfileFields, type StoredProfile } from '../persistence/index.js';
import { buxGrants } from '../progression/BuxGrants.js';
import { CombatService } from '../progression/CombatService.js';
import { ForgeService } from '../progression/ForgeService.js';
import { KatanaService } from '../progression/KatanaService.js';
import { leaderboardService } from '../progression/LeaderboardService.js';
import { PetService } from '../progression/PetService.js';
import { profileStore } from '../progression/ProfileStore.js';
import { ProgressionService } from '../progression/ProgressionService.js';
import { RebirthService } from '../progression/RebirthService.js';
import { StageService } from '../progression/StageService.js';
import { wallet } from '../progression/Wallet.js';
import { logger } from '../util/logger.js';
import { GameState } from './state/GameState.js';
import { PlayerState } from './state/PlayerState.js';

const SCOPE = 'GameRoom';

/** Seconds between autosaves of every connected player. */
const AUTOSAVE_SECONDS = 15;
/** Milliseconds between looks for purchases waiting on an account. */
const GRANT_POLL_MS = 15_000;
/** Re-verification backoff for a token Bloxity could not be asked about. */
const REVERIFY_FIRST_MS = 15_000;
const REVERIFY_MAX_MS = 120_000;
/** How long a mid-session switch waits for the leaving profile to land before staying put. */
const SWITCH_SAVE_TIMEOUT_MS = 8000;
/** How long a leave or a dispose waits for its save to land before moving on. */
const LEAVE_SAVE_TIMEOUT_MS = 5000;
/** Longest token accepted. Bloxity's are a few hundred bytes. */
const MAX_TOKEN_LENGTH = 4096;
/** Milliseconds between two "locked" notices to one player. */
const NOTICE_GAP_MS = 2000;

/** Join refusals. The client's retry/backoff recognises STORAGE_UNAVAILABLE. */
export const JOIN_ERROR = {
  ROOM_FULL: 4103,
  BAD_PLAYER_ID: 4104,
  STORAGE_UNAVAILABLE: 4105,
} as const;

interface JoinOptions {
  /** The browser's own guest id. NEVER an account id; the prefix is refused. */
  playerId?: string;
  /** The portal's game token, or nothing. Verified with Bloxity, never trusted. */
  token?: string | null;
  avatar?: SetAvatarMessage;
  identity?: SetIdentityMessage;
}

/** What `onAuth` resolves and hands to `onJoin`. */
interface ResolvedProfile {
  readonly key: string;
  readonly guestKey: string;
  readonly accountKey: string | null;
  readonly token: string | null;
  readonly tokenHash: string;
  readonly status: AuthStatus;
  readonly profile: StoredProfile | null;
  readonly migrated: boolean;
}

/** Per-session bookkeeping the replicated state must not carry. */
interface Session {
  key: string;
  guestKey: string;
  accountKey: string | null;
  token: string | null;
  tokenHash: string;
  status: AuthStatus;
  /** True while a login change is being applied: autosaves and grants hold off. */
  switching: boolean;
  queued: SetAuthMessage | null;
  granting: boolean;
  reverifyAt: number;
  reverifyDelay: number;
  grantPollAt: number;
  lastNoticeAt: number;
}

/**
 * The authoritative room.
 *
 * Composition only: every rule lives in a service, and this decides the order
 * they run in. The one hard rule: nothing a client sends is ever copied into
 * state. A Move is simulated, a swing is validated and resolved with the
 * server's own damage, a purchase is checked against the server's position and
 * wallet - and each produces a result the server writes itself.
 *
 * WHOSE PROGRESS A SESSION PLAYS ON is decided here too: the client sends its
 * browser id and the portal's TOKEN, Bloxity is asked whose token it is, and
 * the profile is READ FROM STORAGE in `onAuth`. A read that fails refuses the
 * join - a player is never seated on an empty profile that would autosave
 * over their real one.
 */
export class GameRoom extends Room<GameState> {
  override maxClients = MAX_PLAYERS_PER_ROOM;
  override autoDispose = true;

  private readonly movement = new MovementService();
  private readonly progression = new ProgressionService();
  private readonly combat = new CombatService();
  private readonly katanas = new KatanaService();
  private readonly stages = new StageService();
  private readonly forge = new ForgeService();
  private readonly pets = new PetService();
  private readonly rebirths = new RebirthService();

  /** Session id -> the profile key it currently plays on. The boards read it. */
  private readonly playerIds = new Map<string, string>();
  private readonly sessions = new Map<string, Session>();

  private autosaveTimer = 0;
  /** Fallen players and the seconds until they are sent home (after the death animation). */
  private readonly deathTimers = new Map<string, number>();

  override onCreate(): void {
    this.state = new GameState();
    this.setPatchRate(serverConfig.patchRateMs);

    this.onMessage(MessageType.Move, (client, message: MoveMessage) => this.onMove(client, message));
    this.onMessage(MessageType.Attack, (client, message: AttackMessage) => this.onAttack(client, message));
    this.onMessage(MessageType.ClaimStage, (client, message: ClaimStageMessage) => this.onClaimStage(client, message));
    this.onMessage(MessageType.KatanaPad, (client, message: KatanaPadMessage) => this.onKatanaPad(client, message));
    this.onMessage(MessageType.ForgeBuy, (client, message: ForgeBuyMessage) => this.onForgeBuy(client, message));
    this.onMessage(MessageType.Hatch, (client, message: HatchMessage) => this.onHatch(client, message));
    this.onMessage(MessageType.PetAction, (client, message: PetActionMessage) => this.onPetAction(client, message));
    this.onMessage(MessageType.Rebirth, (client) => this.onRebirth(client));
    this.onMessage(MessageType.Teleport, (client, message: TeleportMessage) => this.onTeleport(client, message));
    this.onMessage(MessageType.RequestRespawn, (client) => {
      if (!this.state.players.get(client.sessionId)?.dead) this.placeAt(client, SPAWN, 'manual');
    });
    this.onMessage(MessageType.SetIdentity, (client, message: SetIdentityMessage) => this.onSetIdentity(client, message));
    this.onMessage(MessageType.SetAvatar, (client, message: SetAvatarMessage) => this.onSetAvatar(client, message));
    this.onMessage(MessageType.SetAuth, (client, message: SetAuthMessage) => {
      void this.switchAuth(client, message, false);
    });

    this.tickForge();
    this.setSimulationInterval((deltaMs) => this.tick(deltaMs / 1000), serverConfig.patchRateMs);
    logger.info(SCOPE, `room ${this.roomId} created (capacity ${MAX_PLAYERS_PER_ROOM})`);
  }

  override async onAuth(client: Client, options: JoinOptions = {}): Promise<ResolvedProfile> {
    if (this.clients.length >= MAX_PLAYERS_PER_ROOM) {
      logger.warn(SCOPE, `refused a join: room ${this.roomId} is full (${this.clients.length}/${MAX_PLAYERS_PER_ROOM})`);
      throw new ServerError(JOIN_ERROR.ROOM_FULL, 'room is full');
    }
    const guestKey = readGuestKey(options.playerId);
    const token = readToken(options.token);
    try {
      return await this.resolveProfile(guestKey, token, null);
    } catch (error) {
      logger.error(SCOPE, `refused a join: storage unreachable for ${client.sessionId}:`, error);
      throw new ServerError(JOIN_ERROR.STORAGE_UNAVAILABLE, 'storage unavailable, try again shortly');
    }
  }

  override onJoin(client: Client, options: JoinOptions = {}, auth?: ResolvedProfile): void {
    const resolved: ResolvedProfile = auth ?? {
      key: '',
      guestKey: '',
      accountKey: null,
      token: null,
      tokenHash: '',
      status: 'guest',
      profile: null,
      migrated: false,
    };

    const player = new PlayerState();
    player.sessionId = client.sessionId;
    const now = Date.now();
    this.sessions.set(client.sessionId, {
      key: resolved.key,
      guestKey: resolved.guestKey,
      accountKey: resolved.accountKey,
      token: resolved.token,
      tokenHash: resolved.tokenHash,
      status: resolved.status,
      switching: false,
      queued: null,
      granting: false,
      reverifyAt: now + REVERIFY_FIRST_MS,
      reverifyDelay: REVERIFY_FIRST_MS,
      grantPollAt: now + GRANT_POLL_MS,
      lastNoticeAt: 0,
    });
    if (resolved.key) this.playerIds.set(client.sessionId, resolved.key);

    // Restore BEFORE any service initialises: everything derived is derived from it.
    profileStore.applyTo(player, resolved.profile);
    this.state.players.set(client.sessionId, player);
    // This player's own enemies go to this client alone.
    client.view = new StateView();
    client.view.add(player);
    this.initialiseServices(client.sessionId, player);

    if (options.avatar) this.writeAvatar(player, options.avatar);
    if (options.identity) {
      const identity = sanitizeIdentity(options.identity);
      if (identity.displayName) {
        player.displayName = identity.displayName;
        player.avatarUrl = identity.avatarUrl;
      }
    }

    this.placeAt(client, SPAWN, 'join');
    this.sendAuthState(client, resolved.status);
    if (resolved.accountKey) void this.applyGrants(client.sessionId);

    logger.info(
      SCOPE,
      `join ${client.sessionId} as ${describe(resolved)} (${resolved.profile ? 'restored' : 'new'}) ` +
        `level=${player.level} wins=${player.wins} damage=${player.damage} katana=${player.katanaSlot}`,
    );
  }

  override async onLeave(client: Client): Promise<void> {
    const player = this.state.players.get(client.sessionId);
    const key = this.sessions.get(client.sessionId)?.key;

    this.state.players.delete(client.sessionId);
    this.movement.forget(client.sessionId);
    this.deathTimers.delete(client.sessionId);
    this.forgetServices(client.sessionId);
    this.sessions.delete(client.sessionId);
    this.playerIds.delete(client.sessionId);

    logger.info(SCOPE, `leave ${client.sessionId}`);
    if (player && key) await this.saveBounded(key, player);
  }

  override async onDispose(): Promise<void> {
    const saves: Promise<void>[] = [];
    for (const [sessionId, player] of this.state.players) {
      const key = this.sessions.get(sessionId)?.key;
      if (key) saves.push(this.saveBounded(key, player));
    }
    await Promise.all(saves);
    logger.info(SCOPE, `room ${this.roomId} disposed`);
  }

  // ------------------------------------------------------------- identity

  /**
   * WHOSE PROFILE, and the profile itself, read from storage now.
   *
   * With a token, Bloxity is asked. Verified -> the account key; the
   * account's own profile always wins. If the account has none and this
   * browser's guest has real progress, the guest's progress becomes the
   * account's - insert-only, so two pods racing for the same first login
   * create one profile - and the guest is then retired.
   *
   * Rejected -> a guest. Unavailable -> a guest FOR NOW, re-asked on a backoff.
   * Throws when storage cannot be read. Callers refuse or stay put.
   */
  private async resolveProfile(guestKey: string, token: string | null, live: ProfileFields | null): Promise<ResolvedProfile> {
    let status: AuthStatus = 'guest';
    let accountKey: string | null = null;
    const hash = token ? tokenHash(token) : '';
    if (token) {
      const outcome = await verifyGameToken(token);
      if (outcome.status === 'verified') {
        accountKey = accountKeyFor(outcome.accountId);
        status = 'account';
      } else if (outcome.status === 'unavailable') {
        status = 'unavailable';
      }
    }

    if (accountKey) {
      let profile = await profileStore.load(accountKey);
      let migrated = false;
      if (!profile && guestKey) {
        const guest = await profileStore.load(guestKey);
        const retired = Boolean(guest?.migratedTo);
        const source: ProfileFields | null =
          live ??
          (guest
            ? { ...progressOf(guest), displayName: guest.displayName, avatarUrl: guest.avatarUrl, updatedAt: guest.updatedAt }
            : null);
        if (!retired && source && hasProgress(source)) {
          const created = { ...source, updatedAt: Date.now(), migratedFrom: guestKey };
          if (await profileStore.insertIfAbsent(accountKey, created)) {
            // Only AFTER the account holds it is the guest copy retired.
            await profileStore.retireGuest(guestKey, accountKey, progressOf(source), {
              displayName: source.displayName,
              avatarUrl: source.avatarUrl,
            });
            profile = created;
            migrated = true;
            logger.info(SCOPE, `migrated guest ${guestKey} into ${accountKey} (wins=${source.wins})`);
          } else {
            logger.info(SCOPE, `lost the first-login race for ${accountKey}; loading the winner`);
            profile = await profileStore.load(accountKey);
          }
        }
      }
      return { key: accountKey, guestKey, accountKey, token, tokenHash: hash, status, profile, migrated };
    }

    const profile = guestKey ? await profileStore.load(guestKey) : null;
    return { key: guestKey, guestKey, accountKey: null, token, tokenHash: hash, status, profile, migrated: false };
  }

  /**
   * A LOGIN CHANGE ON THE LIVE SESSION: sign-in, sign-out, account switch, or
   * a re-ask about a token Bloxity was unavailable for. Save the profile being
   * left, resolve the new one, apply it exactly as a join does. Only the
   * newest login counts.
   */
  private async switchAuth(client: Client, message: SetAuthMessage, reverify: boolean): Promise<void> {
    const session = this.sessions.get(client.sessionId);
    const player = this.state.players.get(client.sessionId);
    if (!session || !player) return;

    const token = readToken(message?.token);
    if (session.switching) {
      session.queued = { token };
      return;
    }
    const hash = token ? tokenHash(token) : '';
    if (!reverify && hash === session.tokenHash) return;

    session.switching = true;
    try {
      const leavingKey = session.key;
      const wasGuest = session.accountKey === null;
      const live = profileStore.snapshot(player);

      if (leavingKey) {
        const landed = await withTimeout(profileStore.save(leavingKey, player), SWITCH_SAVE_TIMEOUT_MS);
        if (!landed) {
          logger.warn(SCOPE, `${client.sessionId}: storage did not take the leaving save; staying on ${leavingKey}`);
          this.sendAuthState(client, session.status, 'storage unavailable; staying on the current profile');
          return;
        }
      }

      let target: ResolvedProfile;
      try {
        target = await this.resolveProfile(session.guestKey, token, wasGuest ? live : null);
      } catch (error) {
        logger.warn(SCOPE, `${client.sessionId}: storage unreachable during a login change; staying put:`, error);
        this.sendAuthState(client, session.status, 'storage unavailable; staying on the current profile');
        return;
      }

      session.token = target.token;
      session.tokenHash = target.tokenHash;
      if (target.status === 'unavailable') {
        session.reverifyDelay = Math.min(REVERIFY_MAX_MS, session.reverifyDelay * 2);
        session.reverifyAt = Date.now() + session.reverifyDelay;
      } else {
        session.reverifyDelay = REVERIFY_FIRST_MS;
      }

      if (target.key === session.key) {
        session.status = target.status;
        this.sendAuthState(client, target.status);
        return;
      }

      profileStore.applyTo(player, target.profile, true);
      session.key = target.key;
      session.accountKey = target.accountKey;
      session.status = target.status;
      if (target.key) this.playerIds.set(client.sessionId, target.key);
      else this.playerIds.delete(client.sessionId);

      this.forgetServices(client.sessionId);
      this.initialiseServices(client.sessionId, player);
      this.placeAt(client, SPAWN, 'join');

      if (target.key) await this.saveBounded(target.key, player);
      this.sendAuthState(client, target.status);
      leaderboardService.rebuild(this.state.leaderboard, this.state.players, this.playerIds);
      logger.info(
        SCOPE,
        `${client.sessionId} switched ${leavingKey || '(none)'} -> ${describe(target)}` +
          `${target.migrated ? ' [migrated]' : ''} level=${player.level} wins=${player.wins}`,
      );
    } finally {
      session.switching = false;
      const queued = session.queued;
      session.queued = null;
      if (queued) void this.switchAuth(client, queued, false);
      else if (session.accountKey) void this.applyGrants(client.sessionId);
    }
  }

  private initialiseServices(sessionId: string, player: PlayerState): void {
    if (!this.movement.has(sessionId)) this.movement.initialise(player);
    this.pets.normalise(player);
    this.forge.sync(player);
    this.progression.initialise(player);
  }

  /** Everything but movement, whose simulation state belongs to the connection. */
  private forgetServices(sessionId: string): void {
    this.progression.forget(sessionId);
    this.combat.forget(sessionId);
    this.stages.forget(sessionId);
  }

  private sendAuthState(client: Client, status: AuthStatus, note?: string): void {
    const message: AuthStateMessage = note ? { status, note } : { status };
    client.send(MessageType.AuthState, message);
  }

  // ---------------------------------------------------------------- input

  private onMove(client: Client, message: MoveMessage): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    // The fallen lie where they fell: their input still advances the clock, but moves nothing.
    if (player.dead && message) message = { ...message, moveX: 0, moveZ: 0, jump: false };
    if (!this.movement.applyInput(client.sessionId, player, message)) return;
    this.progression.creditMovement(
      client.sessionId,
      player,
      this.movement.lastStep,
      this.movement.lastDistance(player),
      this.movement.lastStepOnGround(player),
    );
  }

  private onAttack(client: Client, message: AttackMessage): void {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.dead) return;
    const outcome = this.combat.attack(client.sessionId, player, Number(message?.target), this.state, this.progression);
    if (!outcome.ok) {
      if (outcome.reason === 'sealed') this.notifyOnce(client, { kind: 'locked', text: 'Defeat the rest of the wave first!' });
      if (outcome.reason === 'locked-dummy' && outcome.tier !== undefined) {
        const tier = TRAINING_TIERS[outcome.tier]!;
        this.notifyOnce(client, { kind: 'locked', text: `${tier.name} needs ${tier.rebirthsRequired} Rebirth${tier.rebirthsRequired === 1 ? '' : 's'}` });
      }
      return;
    }
    const hit: HitMessage = { target: outcome.target, damage: outcome.damage, after: outcome.after, killed: outcome.killed, xp: outcome.xp };
    client.send(MessageType.Hit, hit);
    if (outcome.mastered >= 0) {
      const tier = TRAINING_TIERS[outcome.mastered]!;
      this.notify(client, { kind: 'bought', text: `${tier.name} mastered! Training ${formatMultiplier(tier.multiplier)} damage` });
      this.persist(client.sessionId, player);
    }
    if (outcome.killed) this.announceClears();
  }

  /** Tell every player whose wave just completed, and save them: a first clear opened a portal. */
  private announceClears(): void {
    for (const clear of this.combat.drainClears()) {
      const client = this.clients.find((c) => c.sessionId === clear.sessionId);
      const player = this.state.players.get(clear.sessionId);
      if (!client || !player) continue;
      const message: StageClearedMessage = { stage: clear.stage, firstClear: clear.firstClear };
      client.send(MessageType.StageCleared, message);
      this.persist(clear.sessionId, player);
      logger.info(SCOPE, `stage ${clear.stage} cleared by ${clear.sessionId}${clear.firstClear ? ' (first clear)' : ''}`);
    }
  }

  private onClaimStage(client: Client, message: ClaimStageMessage): void {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.dead) return;
    const award = this.stages.claim(client.sessionId, player, message?.stage);
    if (!award.granted || !award.stage) return;
    const payload: StageAwardedMessage = { stage: award.stage.index, wins: award.wins, total: player.wins };
    client.send(MessageType.StageAwarded, payload);
    // Claiming ends the run: back to base, where a fresh one begins.
    this.placeAt(client, SPAWN, 'claim');
    this.persist(client.sessionId, player);
    leaderboardService.rebuild(this.state.leaderboard, this.state.players, this.playerIds);
    logger.info(SCOPE, `stage ${award.stage.index} reward banked by ${client.sessionId} (+${award.wins}, total ${player.wins})`);
  }

  private onKatanaPad(client: Client, message: KatanaPadMessage): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const result = this.katanas.pad(player, message?.slot, this.progression);
    if (!result.ok) {
      if (result.reason === 'too-few-wins' && result.tier) {
        this.notifyOnce(client, { kind: 'refused', text: `${result.tier.name} needs ${formatWins(result.tier.cost)} Wins` });
      }
      return;
    }
    this.persist(client.sessionId, player);
    const text =
      result.action === 'bought'
        ? `Bought ${result.tier.name}! +${formatAmount(result.tier.damage)} damage per click`
        : `Equipped ${result.tier.name}`;
    this.notify(client, { kind: result.action, text });
    logger.info(SCOPE, `${client.sessionId} ${result.action} katana ${result.tier.slot} (wins left ${player.wins})`);
  }

  private onForgeBuy(client: Client, message: ForgeBuyMessage): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const result = this.forge.buy(player, message?.rotation, message?.slot, this.progression);
    if (!result.ok) {
      const texts: Record<string, string> = {
        stale: 'The forge restocked! Pick again.',
        away: 'Stand at the Forge counter to buy.',
        'sold-out': 'Sold out until the next restock.',
        'too-few-wins': result.offer ? `${result.offer.item.name} costs ${formatWins(result.offer.item.cost)} Wins` : 'Not enough Wins',
      };
      const text = texts[result.reason];
      if (text) this.notify(client, { kind: 'refused', text });
      return;
    }
    this.persist(client.sessionId, player);
    this.notify(client, { kind: 'bought', text: `Forged ${result.offer.item.name}! ${formatPercent(result.offer.bonus)} damage` });
  }

  private onHatch(client: Client, message: HatchMessage): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const result = this.pets.hatch(player, message?.egg, message?.count, this.progression);
    if (!result.ok) {
      const texts: Record<string, string> = {
        away: 'Stand at the egg to hatch it.',
        full: 'Your pet inventory is full! Delete a pet first.',
        'too-few-wins': result.egg ? `${result.egg.name} costs ${formatWins(result.egg.cost)} Wins` : 'Not enough Wins',
      };
      const text = texts[result.reason];
      if (text) this.notify(client, { kind: 'refused', text });
      return;
    }
    const payload: HatchedMessage = { egg: result.egg.id, pets: result.pets.map((entry) => ({ uid: entry.uid, petId: entry.pet.id })) };
    client.send(MessageType.Hatched, payload);
    this.persist(client.sessionId, player);
    leaderboardService.rebuild(this.state.leaderboard, this.state.players, this.playerIds);
    logger.info(SCOPE, `${client.sessionId} hatched ${result.pets.map((entry) => entry.pet.name).join(', ')}`);
  }

  private onPetAction(client: Client, message: PetActionMessage): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const result = this.pets.act(player, message?.action, message?.uid, this.progression);
    if (!result.ok) {
      if (result.reason === 'slots-full') this.notify(client, { kind: 'refused', text: 'All 3 pet slots are full. Unequip one first.' });
      return;
    }
    this.persist(client.sessionId, player);
  }

  private onRebirth(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.dead) return;
    const result = this.rebirths.rebirth(player, this.progression);
    if (!result.ok) return;
    this.placeAt(client, SPAWN, 'rebirth');
    this.persist(client.sessionId, player);
    this.notify(client, {
      kind: 'rebirth',
      text: `Rebirth ${result.rebirths}! Speed ${formatMultiplier(result.speedMultiplier)} - Max Level ${result.maxLevel}`,
    });
    leaderboardService.rebuild(this.state.leaderboard, this.state.players, this.playerIds);
    logger.info(SCOPE, `${client.sessionId} rebirthed to ${result.rebirths}`);
  }

  /**
 * A teleport is to a NAMED place the server knows. A stage only once it is
 * open to this player (Stage N needs Stage N-1 cleared once) AND paid for:
 * `stageTeleportCost` Wins, spent here. Village places are free.
 */
  private onTeleport(client: Client, message: TeleportMessage): void {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.dead) return;
    const to = String(message?.to ?? '');
    let destination: Placement | null = null;
    const match = /^stage(\d{1,2})$/.exec(to);
    if (match) {
      const stage = Number(match[1]);
      const cost = stageTeleportCost(stage);
      if (cost === null) return;
      if (stage > player.bestStage + 1) {
        this.notify(client, { kind: 'locked', text: `Clear Stage ${stage - 1} to unlock Stage ${stage}` });
        return;
      }
      // A stage teleport is paid for, in Wins, here and only here.
      if (!wallet.spend(player, cost)) {
        this.notify(client, { kind: 'refused', text: `Teleporting to Stage ${stage} costs ${formatWins(cost)} Wins` });
        return;
      }
      // A fresh run that starts at that stage: the portals behind are open, its own is not.
      this.placeAt(client, stageEntry(stage), 'teleport');
      this.combat.startRunAt(player, stage);
      this.persist(client.sessionId, player);
      logger.info(SCOPE, `${client.sessionId} teleported to stage ${stage} for ${cost} wins (left ${player.wins})`);
      return;
    } else if (to in TELEPORTS) {
      destination = TELEPORTS[to as keyof typeof TELEPORTS];
    }
    if (destination) this.placeAt(client, destination, 'teleport');
  }

  private onSetAvatar(client: Client, message: SetAvatarMessage): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    this.writeAvatar(player, message);
  }

  private onSetIdentity(client: Client, message: SetIdentityMessage): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const identity = sanitizeIdentity(message);
    if (player.displayName === identity.displayName && player.avatarUrl === identity.avatarUrl) return;
    player.displayName = identity.displayName;
    player.avatarUrl = identity.avatarUrl;
    this.persist(client.sessionId, player);
    leaderboardService.rebuild(this.state.leaderboard, this.state.players, this.playerIds);
  }

  private writeAvatar(player: PlayerState, message: SetAvatarMessage): void {
    player.avatar.apply(sanitizeAppearance(message?.appearance), sanitizeProportions(message?.proportions));
  }

  private notify(client: Client, notice: NoticeMessage): void {
    client.send(MessageType.Notice, notice);
  }

  /** A notice that may be triggered every swing: at most one per NOTICE_GAP_MS. */
  private notifyOnce(client: Client, notice: NoticeMessage): void {
    const session = this.sessions.get(client.sessionId);
    const now = Date.now();
    if (session) {
      if (now - session.lastNoticeAt < NOTICE_GAP_MS) return;
      session.lastNoticeAt = now;
    }
    this.notify(client, notice);
  }

  // ----------------------------------------------------------------- clock

  private tick(delta: number): void {
    this.state.elapsed += delta;
    leaderboardService.update(delta, this.state.leaderboard, this.state.players, this.playerIds);
    this.tickSessions();
    this.tickForge();
    this.combat.tick(delta, this.state);
    this.resolveHurts(delta);

    for (const player of this.state.players.values()) {
      if (player.ready) player.playSeconds += delta;
    }

    this.autosaveTimer += delta;
    if (this.autosaveTimer >= AUTOSAVE_SECONDS) {
      this.autosaveTimer = 0;
      for (const [sessionId, player] of this.state.players) this.persist(sessionId, player);
    }
  }

  /**
   * Enemy swings that landed. A killing one FELLS the player: they are held
   * where they fell while the death animation plays (`dead`), and only then
   * sent home - which starts a fresh run.
   */
  private resolveHurts(delta: number): void {
    for (const hurt of this.combat.drainHurts()) {
      if (!hurt.killed) continue;
      const client = this.clients.find((c) => c.sessionId === hurt.sessionId);
      const player = this.state.players.get(hurt.sessionId);
      if (!client || !player || player.dead) continue;
      const name = ENEMIES[hurt.enemy]?.name ?? 'an enemy';
      player.dead = true;
      this.deathTimers.set(hurt.sessionId, DEATH_RESPAWN_SECONDS);
      this.notify(client, { kind: 'defeated', text: `Defeated by ${name}!` });
      logger.info(SCOPE, `${hurt.sessionId} was defeated by ${name}`);
    }
    for (const [sessionId, left] of this.deathTimers) {
      const next = left - delta;
      if (next > 0) {
        this.deathTimers.set(sessionId, next);
        continue;
      }
      this.deathTimers.delete(sessionId);
      const client = this.clients.find((c) => c.sessionId === sessionId);
      if (client) this.placeAt(client, SPAWN, 'death');
    }
  }

  /** The forge clock: the rotation in effect and the seconds left, replicated once a second at most. */
  private tickForge(): void {
    const now = Date.now();
    const rotation = this.forge.rotation;
    if (this.state.forgeRotation !== rotation) {
      this.state.forgeRotation = rotation;
      for (const player of this.state.players.values()) this.forge.sync(player);
    }
    const left = forgeSecondsLeftAt(now);
    if (this.state.forgeSecondsLeft !== left) this.state.forgeSecondsLeft = left;
  }

  /** Re-asks about tokens Bloxity was unavailable for, and polls for purchases. */
  private tickSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions) {
      if (session.switching) continue;
      if (session.status === 'unavailable' && session.token && now >= session.reverifyAt) {
        session.reverifyAt = now + session.reverifyDelay;
        const client = this.clients.find((c) => c.sessionId === sessionId);
        if (client) void this.switchAuth(client, { token: session.token }, true);
      }
      if (session.accountKey && now >= session.grantPollAt) {
        session.grantPollAt = now + GRANT_POLL_MS;
        void this.applyGrants(sessionId);
      }
    }
  }

  // ---------------------------------------------------------------- grants

  /**
   * Pay out what the webhook recorded for this account: CLAIM (atomic per
   * grant, so no other pod pays the same one), add the Wins, SAVE the profile,
   * and only then mark the grants applied.
   */
  private async applyGrants(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    const player = this.state.players.get(sessionId);
    if (!session || !player || !session.accountKey || session.switching || session.granting) return;
    const accountKey = session.accountKey;
    session.granting = true;
    try {
      const grants = await buxGrants.claim(accountKey);
      if (grants.length === 0) return;
      if (this.sessions.get(sessionId) !== session || session.accountKey !== accountKey || session.switching) {
        logger.warn(SCOPE, `left ${grants.length} claimed grant(s) for ${accountKey} to a later session`);
        return;
      }
      for (const grant of grants) {
        if (grant.wins > 0) wallet.add(player, grant.wins);
        logger.info(SCOPE, `granted ${grant.sku} to ${sessionId} (+${grant.wins} wins) [${grant.transactionId}]`);
      }
      await profileStore.save(accountKey, player);
      await buxGrants.settle(grants.map((grant) => grant.transactionId));
      leaderboardService.rebuild(this.state.leaderboard, this.state.players, this.playerIds);
    } catch (error) {
      logger.warn(SCOPE, `could not pay grants for ${accountKey}: ${String(error)}`);
    } finally {
      session.granting = false;
    }
  }

  // ------------------------------------------------------------- placement

  /** THE one way a player is placed. */
  private placeAt(client: Client, placement: Placement, reason: RespawnReason): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    this.movement.teleport(client.sessionId, player, placement.x, placement.y, placement.z, placement.yaw);
    this.progression.reset(client.sessionId);
    // Every placement starts a fresh run: enemies back, stages reset, full health, alive.
    this.combat.resetRun(client.sessionId, player);
    this.deathTimers.delete(client.sessionId);
    const message: RespawnMessage = { x: placement.x, y: placement.y, z: placement.z, rotationY: placement.yaw, reason };
    client.send(MessageType.Respawn, message);
    if (reason !== 'join') logger.info(SCOPE, `place ${client.sessionId} (${reason}) -> ${placement.x}, ${placement.z}`);
  }

  // ----------------------------------------------------------------- saves

  /** A routine save. Held while the session is changing login. */
  private persist(sessionId: string, player: PlayerState): void {
    const session = this.sessions.get(sessionId);
    if (!session || !session.key || session.switching) return;
    void this.saveQuietly(session.key, player);
  }

  private async saveQuietly(key: string, player: PlayerState): Promise<void> {
    try {
      await profileStore.save(key, player);
    } catch (error) {
      logger.error(SCOPE, `save of ${key} failed:`, error);
    }
  }

  /** A save that is waited for only so long; it stays queued and retried regardless. */
  private async saveBounded(key: string, player: PlayerState): Promise<void> {
    const landed = await withTimeout(this.saveQuietly(key, player), LEAVE_SAVE_TIMEOUT_MS);
    if (!landed) logger.warn(SCOPE, `save of ${key} is queued; it lands when storage is back`);
  }
}

/** A guest key from a join option: valid, or empty when none was sent. Refuses the account prefix. */
const readGuestKey = (raw: unknown): string => {
  if (raw === undefined || raw === null || raw === '') return '';
  if (typeof raw === 'string' && isAccountKey(raw)) {
    logger.warn(SCOPE, `refused a join: browser id carries the account prefix`);
    throw new ServerError(JOIN_ERROR.BAD_PLAYER_ID, 'invalid player id');
  }
  if (!isValidGuestId(raw)) {
    logger.warn(SCOPE, `refused a join: malformed browser id`);
    throw new ServerError(JOIN_ERROR.BAD_PLAYER_ID, 'invalid player id');
  }
  return raw;
};

const readToken = (raw: unknown): string | null =>
  typeof raw === 'string' && raw.length > 0 && raw.length <= MAX_TOKEN_LENGTH ? raw : null;

const describe = (resolved: ResolvedProfile): string => {
  if (resolved.accountKey) return `account ${resolved.accountKey}`;
  const key = resolved.guestKey || '(no id)';
  return resolved.status === 'unavailable' ? `guest ${key} (bloxity unavailable, will re-ask)` : `guest ${key}`;
};

/** True if the promise settled within the deadline; it keeps running either way. */
const withTimeout = (promise: Promise<unknown>, ms: number): Promise<boolean> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), ms);
    promise.then(
      () => {
        clearTimeout(timer);
        resolve(true);
      },
      () => {
        clearTimeout(timer);
        resolve(false);
      },
    );
  });
