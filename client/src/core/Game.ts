import {
  COMBAT,
  DUMMIES,
  DUMMY_TARGET_BASE,
  ENEMIES,
  KATANAS,
  NO_TARGET,
  SPAWN,
  STAGES,
  STAGE_COUNT,
  canRebirth,
  formatWins,
  isDummyTarget,
  ownsKatana,
  stageAt,
  type DamageInputs,
  type HatchedMessage,
  type HitMessage,
  type NoticeMessage,
  type RespawnMessage,
  type StageAwardedMessage,
  type StageClearedMessage,
} from '@katana/shared';
import { AudioManager } from '../audio/AudioManager.js';
import { PlayerAudio } from '../audio/PlayerAudio.js';
import { AvatarDresser } from '../bloxity/AvatarDresser.js';
import { Bloxity } from '../bloxity/Bloxity.js';
import { lookFromLegion } from '../bloxity/avatarLook.js';
import { identityFromLegion } from '../bloxity/identity.js';
import { ThirdPersonCamera } from '../camera/ThirdPersonCamera.js';
import { DamagePopups } from '../combat/DamagePopups.js';
import { TrophyBurst } from '../combat/TrophyBurst.js';
import { XpPopups } from '../combat/XpPopups.js';
import { SlashEffects } from '../combat/SlashEffects.js';
import { TargetSelector } from '../combat/TargetSelector.js';
import { clientConfig } from '../config/clientConfig.js';
import { EnemyManager } from '../enemies/EnemyManager.js';
import { InputManager } from '../input/InputManager.js';
import { NetworkClient } from '../net/NetworkClient.js';
import type { ConnectionStatus, NetPlayerState } from '../net/netTypes.js';
import { PetThumbnails } from '../pets/PetThumbnails.js';
import { LocalPlayer } from '../player/LocalPlayer.js';
import { playerModelLoader, type PlayerModelReport } from '../player/PlayerModelLoader.js';
import { RemotePlayerManager } from '../player/RemotePlayerManager.js';
import { Interactions } from '../progression/Interactions.js';
import { RendererManager } from '../rendering/RendererManager.js';
import { SceneManager } from '../rendering/SceneManager.js';
import { BagPanel } from '../ui/BagPanel.js';
import { BloxityPanel } from '../ui/BloxityPanel.js';
import { Counters } from '../ui/Counters.js';
import { ForgePanel } from '../ui/ForgePanel.js';
import { ICONS } from '../ui/hudStyles.js';
import { injectKatanaStyles } from '../ui/katanaStyles.js';
import { LevelUpPopup } from '../ui/LevelUpPopup.js';
import { Panel, anyPanelOpen } from '../ui/Panel.js';
import { HatchPanel, HatchReveal, PetsPanel } from '../ui/PetPanels.js';
import { RailButton } from '../ui/RailButton.js';
import { RebirthPanel } from '../ui/RebirthPanel.js';
import { StatsHud } from '../ui/StatsHud.js';
import { TargetBar } from '../ui/TargetBar.js';
import { TeleportPanel } from '../ui/TeleportPanel.js';
import { HintLine, Toasts } from '../ui/Toasts.js';
import { logger } from '../util/logger.js';
import { GameWorld } from '../world/GameWorld.js';

const SCOPE = 'Game';

const shortcutOf = (event: KeyboardEvent): string => {
  const code = event.code;
  if (code.startsWith('Key') && code.length === 4) return code.slice(3).toLowerCase();
  if (code) return code.toLowerCase();
  return (event.key || '').toLowerCase();
};

const isTyping = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  if (!element) return false;
  if (element.isContentEditable) return true;
  const tag = element.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

/** What the fallen send: nothing. */
const DEAD_INPUT = Object.freeze({ moveX: 0, moveZ: 0, jump: false, attack: false, attackHeld: false });

/**
 * Composition root. Owns every subsystem and the per-frame order - input,
 * prediction, swings, interactions, camera, network, render - and no gameplay
 * rules: every rule is the server's, and every figure on screen is replicated.
 */
export class Game {
  private readonly container: HTMLElement;
  private readonly renderer: RendererManager;
  private readonly sceneManager = new SceneManager();
  private readonly camera = new ThirdPersonCamera();
  private readonly input = new InputManager();
  private readonly remotePlayers: RemotePlayerManager;
  private readonly audio = new AudioManager();
  private readonly playerAudio: PlayerAudio;
  private readonly bloxity: Bloxity;
  private readonly bloxityPanel: BloxityPanel;
  private readonly network: NetworkClient;
  private readonly selector = new TargetSelector();
  private readonly interactions: Interactions;

  private readonly stats: StatsHud;
  private readonly target: TargetBar;
  private readonly counters: Counters;
  private readonly hint: HintLine;
  private readonly toasts: Toasts;
  private readonly popup: LevelUpPopup;
  private readonly damagePopups: DamagePopups;
  private readonly xpPopups: XpPopups;
  private readonly trophyBurst: TrophyBurst;
  private readonly fpsReadout: HTMLDivElement;
  private readonly dock: HTMLDivElement;
  private readonly rail: HTMLDivElement;
  private readonly rebirthButton: RailButton;
  private readonly petsButton: RailButton;
  private readonly teleportButton: RailButton;
  private readonly bagButton: RailButton;
  private readonly storeButton: RailButton;
  private readonly audioButton: RailButton;
  private readonly rebirthPanel: RebirthPanel;
  private readonly teleportPanel: TeleportPanel;
  private readonly bagPanel: BagPanel;
  private forgePanel: ForgePanel | null = null;
  private hatchPanel: HatchPanel | null = null;
  private petsPanel: PetsPanel | null = null;
  private hatchReveal: HatchReveal | null = null;
  private thumbnails: PetThumbnails | null = null;

  private world: GameWorld | null = null;
  private enemies: EnemyManager | null = null;
  private slashes: SlashEffects | null = null;
  private localPlayer: LocalPlayer | null = null;
  private dresser: AvatarDresser | null = null;
  private pendingAvatar: (() => void) | null = null;
  private localSessionId: string | null = null;
  private local: NetPlayerState | null = null;

  private autoClick = false;
  private swingCooldown = 0;
  private lastLevel = -1;
  private lastHp = -1;
  private lastDead = false;
  /** Lifetime XP last seen: its rise is the XP just earned, for the popups. */
  private lastLifetimeXp = -1;
  private lastDamage = 0;
  private lastSpeed = 0;
  private lastRebirths = -1;
  private fpsAccum = 0;
  private fpsFrames = 0;
  private readonly petIds: number[] = [];

  constructor(container: HTMLElement) {
    this.container = container;
    injectKatanaStyles();
    this.renderer = new RendererManager(container);
    this.remotePlayers = new RemotePlayerManager(this.sceneManager.scene);
    this.stats = new StatsHud(container, () => this.toggleAuto());
    this.target = new TargetBar(container);
    // The indicators and the rail below them are one left-anchored group.
    this.dock = document.createElement('div');
    this.dock.className = 'aoe-dock';
    container.appendChild(this.dock);
    this.counters = new Counters(this.dock);
    this.hint = new HintLine(container);
    this.toasts = new Toasts(container);
    this.popup = new LevelUpPopup(container);
    this.damagePopups = new DamagePopups(container);
    this.xpPopups = new XpPopups(container);
    this.trophyBurst = new TrophyBurst(container);
    this.playerAudio = new PlayerAudio(this.audio);

    this.rail = document.createElement('div');
    this.rail.className = 'aoe-rail';
    this.dock.appendChild(this.rail);

    this.rebirthPanel = new RebirthPanel(container, () => this.network.requestRebirth());
    this.teleportPanel = new TeleportPanel(container, (to) => this.network.teleport(to));
    this.bagPanel = new BagPanel(container);

    this.bloxity = new Bloxity({
      setMasterVolume: (level) => this.audio.setMasterVolume(level),
      setMusicVolume: (level) => this.audio.setMusicVolume(level),
      setGraphicsQuality: (level) => this.renderer.setQuality(level),
      setShowFps: (show) => {
        this.fpsReadout.hidden = !show;
      },
      setCameraSensitivity: (scale) => this.input.look.setSensitivityScale(scale),
      respawn: () => this.network.requestRespawn(),
      pointerLockChanged: (locked) => this.input.look.setCursorFree(!locked),
      avatarChanged: (equipped, proportions) => {
        const look = lookFromLegion(equipped, proportions);
        this.network.sendAvatar(look);
        const apply = (): void => this.dresser?.setLook(look.appearance, look.proportions);
        if (this.dresser) apply();
        else this.pendingAvatar = apply;
      },
    });
    this.bloxityPanel = new BloxityPanel(container, this.bloxity);

    this.storeButton = new RailButton(this.rail, {
      variant: 'shop',
      label: 'Store',
      icon: ICONS.shop,
      hotkey: 'B',
      onClick: () => {
        this.closePanels();
        this.bloxityPanel.openStore();
      },
    });
    this.rebirthButton = new RailButton(this.rail, {
      variant: 'rebirth',
      label: 'Rebirth',
      icon: ICONS.rebirth,
      hotkey: 'R',
      onClick: () => this.openOnly(this.rebirthPanel),
    });
    this.petsButton = new RailButton(this.rail, {
      variant: 'pets',
      label: 'Pets',
      icon: ICONS.pets,
      hotkey: 'P',
      onClick: () => {
        if (this.petsPanel) this.openOnly(this.petsPanel);
      },
    });
    this.teleportButton = new RailButton(this.rail, {
      variant: 'teleport',
      label: 'Teleport',
      icon: ICONS.torii,
      hotkey: 'T',
      onClick: () => this.openOnly(this.teleportPanel),
    });
    this.bagButton = new RailButton(this.rail, {
      variant: 'bag',
      label: 'Stats',
      icon: ICONS.bag,
      hotkey: 'I',
      onClick: () => this.openOnly(this.bagPanel),
    });
    this.audioButton = new RailButton(this.rail, {
      variant: 'audio',
      label: 'Music',
      icon: ICONS.audio,
      hotkey: 'M',
      onClick: () => {
        const muted = this.audio.toggleMuted();
        this.audioButton.root.classList.toggle('aoe-tile--off', muted);
      },
    });

    this.fpsReadout = document.createElement('div');
    this.fpsReadout.className = 'aoe-fps aoe-font';
    this.fpsReadout.hidden = true;
    container.appendChild(this.fpsReadout);

    window.addEventListener('keydown', this.onHotkey);
    window.addEventListener('keydown', this.onGesture);
    window.addEventListener('mousedown', this.onGesture);
    window.addEventListener('touchstart', this.onGesture, { passive: true });
    this.renderer.onResize((width, height) => this.camera.setViewport(width, height));

    this.interactions = new Interactions({
      katanaPad: (slot) => this.network.katanaPad(slot),
      forge: (open) => this.forgePanel?.setOpen(open),
      egg: (egg) => {
        if (egg === null) this.hatchPanel?.setOpen(false);
        else this.hatchPanel?.show(egg);
      },
      claimStage: (stage) => {
        this.flushInput();
        this.network.claimStage(stage);
      },
    });

    this.network = new NetworkClient({
      onStatusChange: (status) => this.onStatusChange(status),
      onSelfJoined: (sessionId) => {
        this.localSessionId = sessionId;
        const roomId = this.network.roomId;
        this.bloxity.updateRoom(roomId);
        this.bloxityPanel.setRoom(roomId);
      },
      onPlayerAdded: (sessionId, player) => this.onPlayerAdded(sessionId, player),
      onPlayerChanged: (sessionId, player) => this.onPlayerChanged(sessionId, player),
      onPlayerRemoved: (sessionId) => this.remotePlayers.remove(sessionId),
      onRespawn: (message) => this.onRespawn(message),
      onStageAwarded: (message) => this.onStageAwarded(message),
      onStageCleared: (message) => this.onStageCleared(message),
      onHit: (message) => this.onHit(message),
      onHatched: (message) => this.onHatched(message),
      onNotice: (message) => this.onNotice(message),
    });
    this.network.setTokenProvider(() => this.bloxity.getToken());
    this.network.setLookProvider(() => lookFromLegion(this.bloxity.getEquipped(), this.bloxity.getProportions()));
    this.network.setDisplayProvider(() => identityFromLegion(this.bloxity.getUser(), this.bloxity.getGuest()));
    this.bloxity.onUserChanged((user) => {
      this.network.sendAuth(this.bloxity.getToken());
      this.network.sendIdentity(identityFromLegion(user, this.bloxity.getGuest()));
    });
  }

  private readonly onHotkey = (event: KeyboardEvent): void => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || isTyping(event.target)) return;
    switch (shortcutOf(event)) {
      case 'r':
        this.rebirthButton.press();
        break;
      case 'p':
        this.petsButton.press();
        break;
      case 't':
        this.teleportButton.press();
        break;
      case 'i':
        this.bagButton.press();
        break;
      case 'b':
        this.storeButton.press();
        break;
      case 'm':
        this.audioButton.press();
        break;
      case 'g':
        this.toggleAuto();
        break;
      case 'escape':
        this.closePanels();
        this.input.look.setCursorFree(true);
        this.bloxity.showPortalMenu(true);
        break;
      default:
        break;
    }
  };

  private readonly onGesture = (): void => {
    this.audio.resume();
  };

  private get panels(): Panel[] {
    const list: Panel[] = [this.rebirthPanel, this.teleportPanel, this.bagPanel];
    if (this.forgePanel) list.push(this.forgePanel);
    if (this.hatchPanel) list.push(this.hatchPanel);
    if (this.petsPanel) list.push(this.petsPanel);
    return list;
  }

  private closePanels(): void {
    for (const panel of this.panels) panel.setOpen(false);
  }

  private openOnly(panel: Panel): void {
    for (const other of this.panels) if (other !== panel) other.setOpen(false);
    panel.toggle();
  }

  private toggleAuto(): void {
    this.autoClick = !this.autoClick;
    this.stats.setAuto(this.autoClick);
    this.toasts.show(this.autoClick ? 'Auto click ON' : 'Auto click OFF', this.autoClick ? 'good' : 'pink');
  }

  startBloxity(): void {
    this.bloxity.start();
    document.body.classList.toggle('aoe-portal-embedded', this.bloxity.embedded);
  }

  loadingStep(text: string): void {
    this.bloxity.loadingStep(text);
  }

  /** Load the rig, then build everything that needs it: the world's smith, the enemies, the players. */
  async initialise(): Promise<PlayerModelReport> {
    const report = await playerModelLoader.load();
    const scene = this.sceneManager.scene;
    this.world = new GameWorld();
    this.world.addTo(scene);
    this.enemies = new EnemyManager(scene);
    this.slashes = new SlashEffects(scene);
    this.remotePlayers.onSwing = (x, y, z, yaw, katana, backhand) => this.slashes?.play(x, y, z, yaw, katana, backhand);

    this.thumbnails = new PetThumbnails(this.renderer.renderer);
    this.forgePanel = new ForgePanel(this.container, (rotation, slot) => this.network.forgeBuy(rotation, slot));
    this.hatchPanel = new HatchPanel(this.container, this.thumbnails, (egg, count) => this.network.hatch(egg, count));
    this.petsPanel = new PetsPanel(this.container, this.thumbnails, (action, uid) => this.network.petAction(action, uid));
    this.hatchReveal = new HatchReveal(this.container, this.thumbnails);

    this.localPlayer = new LocalPlayer(this.world.collision);
    this.dresser = new AvatarDresser(this.localPlayer.character);
    this.pendingAvatar?.();
    this.pendingAvatar = null;
    scene.add(this.localPlayer.character.root, this.localPlayer.character.worldRoot);
    this.camera.snapTo(this.localPlayer.position);
    this.teleportPanel.setState(0, 0);
    logger.info(SCOPE, 'world ready');
    return report;
  }

  async connect(): Promise<void> {
    await this.network.connect();
  }

  start(): void {
    this.input.attach(this.renderer.renderer.domElement);
    this.bloxity.loadingEnd();
    this.bloxity.gameplayStart();
  }

  stop(): void {
    this.input.detach();
    this.bloxity.gameplayEnd();
    this.bloxity.updateRoom('');
    void this.network.disconnect();
  }

  update(delta: number, _now: number): void {
    this.input.setSuppressed(anyPanelOpen());
    const sampled = this.input.sample();
    // The fallen lie still: no movement, no jump, no swings until the respawn.
    const input = this.local?.dead ? DEAD_INPUT : sampled;
    const player = this.localPlayer;
    const world = this.world;
    const enemyStates = this.network.enemies;

    this.camera.setOrbit(this.input.look.yaw, this.input.look.pitch);
    this.camera.setZoom(this.input.look.zoom);

    if (player && world) {
      player.update(delta, input, this.input.look.yaw);
      this.updateSwing(delta, input.attack, input.attackHeld, player);
      this.interactions.update(delta, player.position.x, player.position.y, player.position.z, player.isGrounded, this.local?.killMasks ?? null);

      const placement = player.consumePlacement();
      if (placement !== 'none') this.camera.snapTo(player.position, placement === 'respawn');
      this.camera.setTarget(player.position);
      this.camera.setCollision(world.collision, this.local?.runStage ?? 0);
      this.sceneManager.followShadow(player.position.x, player.position.y, player.position.z);
      this.flushInput();
      this.playerAudio.update(delta, {
        horizontalSpeed: player.horizontalSpeed,
        isGrounded: player.isGrounded,
        verticalVelocity: player.velocity.y,
        jumpedEdge: player.jumpedEdge,
        landedEdge: player.landedEdge,
      });
      this.selector.tick(delta);
      this.target.show(this.selector.focus(player.position.x, player.position.z, enemyStates, this.local));
      this.updateHint(player);
      world.update(delta, player.position.x, player.position.z, this.camera.camera.position.z);
    }

    const forge = this.network.forge;
    if (forge && this.local) {
      this.forgePanel?.setState(forge.rotation, forge.secondsLeft, this.local.wins, this.local.forgeBought, this.local.forgePercent, this.local.forgeRotation);
    }
    this.world?.setBoards(this.network.leaderboard);
    this.enemies?.update(delta, enemyStates, player?.position.z ?? SPAWN.z, this.local?.killMasks ?? null);
    this.remotePlayers.advance(delta, player?.position ?? null);
    this.slashes?.update(delta);
    this.camera.update(delta, player?.horizontalSpeed ?? 0);
    this.damagePopups.update(this.camera.camera, this.renderer.width, this.renderer.height);
    if (player) this.trophyBurst.update(this.camera.camera, this.renderer.width, this.renderer.height, player.position.x, player.position.y, player.position.z);
    if (player) this.xpPopups.update(this.camera.camera, this.renderer.width, this.renderer.height, player.position.x, player.position.y, player.position.z);
    this.tickFps(delta);
    this.renderer.renderer.render(this.sceneManager.scene, this.camera.camera);
  }

  /**
   * THE SWING: a click, a held SLASH button or auto click, once the previous
   * swing has played. It plays at once for feel, aims at the best target in
   * reach, and asks the server - which decides whether it landed and for how
   * much. Auto click swings at a slower, fixed rate.
   */
  private updateSwing(delta: number, pressed: boolean, held: boolean, player: LocalPlayer): void {
    this.swingCooldown = Math.max(0, this.swingCooldown - delta);
    if (anyPanelOpen()) return;
    const wants = pressed || held || this.autoClick;
    if (!wants || this.swingCooldown > 0 || player.swinging) return;
    const auto = !pressed && !held;
    const enemyStates = this.network.enemies;
    const target = this.selector.aim(player.position.x, player.position.z, player.yaw, enemyStates, this.local);
    // Auto click only swings when there is something to hit.
    if (auto && target === NO_TARGET) return;
    let yaw: number | null = null;
    const at = this.targetPosition(target);
    if (at) yaw = Math.atan2(at.x - player.position.x, at.z - player.position.z);
    player.swing(yaw);
    this.swingCooldown = auto ? COMBAT.autoInterval : COMBAT.swingInterval;
    this.flushInput();
    this.network.attack(target);
    const facing = yaw ?? player.yaw;
    this.slashes?.play(player.position.x, player.position.y, player.position.z, facing, this.local?.katanaSlot ?? 1, false);
    this.audio.play('swing', 0.8);
  }

  private targetPosition(target: number): { x: number; z: number } | null {
    if (target === NO_TARGET) return null;
    if (isDummyTarget(target)) {
      const dummy = DUMMIES[target - DUMMY_TARGET_BASE];
      return dummy ? { x: dummy.x, z: dummy.z } : null;
    }
    const enemy = this.network.enemies?.[target];
    return enemy ? { x: enemy.x, z: enemy.z } : null;
  }

  /** One short line saying what to do next. */
  private updateHint(player: LocalPlayer): void {
    const state = this.local;
    if (!state) return;
    const stage = stageAt(player.position.z, STAGE_COUNT);
    let text = '';
    const next = KATANAS.find((tier) => !ownsKatana(state.ownedKatanas, tier.slot));
    if (stage > 0) {
      const def = STAGES[stage - 1]!;
      const mask = state.killMasks[stage - 1] ?? 0;
      if (mask === def.fullMask) {
        text = stage < STAGE_COUNT
          ? `Stage cleared! Go through the portal to Stage ${stage + 1}, or claim +${formatWins(def.reward)} Wins on the gold pad (ends the run)`
          : `Final stage cleared! Claim +${formatWins(def.reward)} Wins on the gold pad`;
      }
      else if (state.damage < def.recommendedDamage) text = `Recommended damage here is ${formatWins(def.recommendedDamage)}. Level up and buy stronger katanas!`;
    } else if (canRebirth(state.level, state.rebirths)) {
      text = 'Max Level reached! Open Rebirth (R) for x' + (state.rebirths + 2) + ' Speed';
    } else if (state.lifetimeWins === 0) {
      const touch = document.body.classList.contains('aoe-touch-mode');
      text = touch ? 'Walk through the torii ahead to Stage 1 and tap SLASH to fight!' : 'Walk through the torii ahead to Stage 1 and click to swing your katana!';
    } else if (next && state.wins >= next.cost) {
      text = `You can buy the ${next.name} at the Katana Stage (to your right)!`;
    }
    this.hint.set(text);
  }

  private flushInput(): void {
    const player = this.localPlayer;
    if (!player) return;
    for (const message of player.drainOutgoing()) this.network.sendInput(message);
  }

  private onRespawn(message: RespawnMessage): void {
    this.localPlayer?.teleport(message.x, message.y, message.z, message.rotationY);
    this.interactions.reset();
    if (message.reason === 'death') {
      // The fall already played; home, standing again.
      this.localPlayer?.setDead(false);
      this.toasts.show('Back at base - the stages have reset', 'bad');
    } else if (message.reason === 'claim') {
      this.toasts.show('Run complete! Back at base - the stages have reset', 'gold');
    }
  }

  private onPlayerAdded(sessionId: string, state: NetPlayerState): void {
    if (sessionId === this.localSessionId) {
      this.applyLocalState(state);
      return;
    }
    this.remotePlayers.add(sessionId, state);
    this.bloxity.playerJoined(sessionId);
    this.bloxity.playerInRoom(sessionId);
  }

  private onPlayerChanged(sessionId: string, state: NetPlayerState): void {
    if (sessionId === this.localSessionId) {
      this.applyLocalState(state);
      return;
    }
    this.remotePlayers.update(sessionId, state);
  }

  /** Everything the server says about the local player. It derives none of it. */
  private applyLocalState(state: NetPlayerState): void {
    const player = this.localPlayer;
    if (!player) return;
    this.local = state;

    player.setParams(state.moveSpeed, state.jumpVelocity, state.runStage);
    player.setKatana(state.katanaSlot);
    player.setDisplayName(state.displayName, state.avatarUrl);
    this.petIds.length = 0;
    for (let i = 0; i < state.pets.length; i += 1) {
      const pet = state.pets[i];
      if (pet?.equipped) this.petIds.push(pet.petId);
    }
    player.setPets(this.petIds);
    if (state.ready) {
      player.reconcile({
        x: state.x,
        y: state.y,
        z: state.z,
        rotationY: state.rotationY,
        velocityX: state.velocityX,
        velocityY: state.velocityY,
        velocityZ: state.velocityZ,
        grounded: state.grounded,
        jumpLatched: state.jumpLatched,
        jumpCount: state.jumpCount,
        lastInputSeq: state.lastInputSeq,
      });
    }

    this.stats.update(state.level, state.maxLevel, state.xp, state.damage, state.speedStat);
    this.stats.setHealth(state.hp, state.maxHp);
    // Falling in battle: the animation, the sound and the word - this player's own, once.
    if (state.dead && !this.lastDead) {
      this.audio.play('death');
      this.popup.message('DEFEATED!', 'Back to base - the stages will reset', 'Level up and get stronger, then try again!');
    }
    this.lastDead = state.dead === true;
    player.setDead(this.lastDead);
    // An enemy swing that landed: a dull thud under the red flash.
    if (this.lastHp >= 0 && state.hp < this.lastHp && state.hp > 0) this.audio.play('hit', 0.45);
    this.lastHp = state.hp;
    this.counters.update(state.wins, state.rebirths);
    this.world?.katanaStage.setInventory(state.wins, state.ownedKatanas, state.katanaSlot);
    this.world?.training.setProgress(state.rebirths, state.trainingTier, state.trainingHits);
    this.world?.road.setProgress(state.runStage, state.killMasks);

    // Every XP gain - a stride or a swing - pops a katana "+N!" beside the player.
    if (this.lastLifetimeXp >= 0 && state.lifetimeXp > this.lastLifetimeXp) this.xpPopups.show(state.lifetimeXp - this.lastLifetimeXp);
    this.lastLifetimeXp = state.lifetimeXp;

    // A level-up - not the level drop of a rebirth - pops the popup.
    if (this.lastLevel >= 0 && state.level > this.lastLevel && state.rebirths === this.lastRebirths) {
      this.audio.play('level');
      this.popup.levelUp(this.lastLevel, this.lastDamage, this.lastSpeed, state.level, state.damage, state.speedStat);
    }
    if (this.lastRebirths >= 0 && state.rebirths > this.lastRebirths) this.audio.play('rebirth');
    this.lastLevel = state.level;
    this.lastDamage = state.damage;
    this.lastSpeed = state.speedStat;
    this.lastRebirths = state.rebirths;
    // Which stages are open and which the Wins can pay for; cheap when neither changed.
    this.teleportPanel.setState(state.bestStage, state.wins);

    this.rebirthPanel.setProgress(state.level, state.rebirths);
    this.rebirthButton.setState(this.rebirthPanel.isEligible, false);
    this.hatchPanel?.setInventory(state.wins, state.pets.length);
    this.petsPanel?.setPets(state.pets);
    const inputs: DamageInputs = {
      katanaSlot: state.katanaSlot,
      ownedKatanas: state.ownedKatanas,
      trainingTier: state.trainingTier,
      level: state.level,
      forgePercent: state.forgePercent,
      equippedPetIds: this.petIds.slice(),
      rebirths: state.rebirths,
    };
    this.bagPanel.setState(inputs, state.damage, state.speedStat);
  }

  private onHit(message: HitMessage): void {
    this.selector.noteHit(message.target);
    let x = 0;
    let y = 3;
    let z = 0;
    if (isDummyTarget(message.target)) {
      const dummy = DUMMIES[message.target - DUMMY_TARGET_BASE];
      if (dummy) {
        x = dummy.x;
        z = dummy.z;
        y = 4.2;
        this.world?.training.hit(dummy.tier);
      }
    } else {
      const def = ENEMIES[message.target];
      const at = this.enemies?.positionOf(message.target) ?? this.targetPosition(message.target);
      if (at) {
        x = at.x;
        z = at.z;
      }
      y = 3.4 * (def?.scale ?? 1);
    }
    this.damagePopups.show(message.damage, x, y, z, message.killed);
    this.audio.play(message.killed ? 'kill' : 'hit', 0.9);
  }

  private onStageCleared(message: StageClearedMessage): void {
    this.audio.play('clear');
    const stage = STAGES[message.stage - 1];
    const last = message.stage >= STAGE_COUNT;
    this.popup.message(
      `STAGE ${message.stage} CLEARED!`,
      last ? `Claim +${formatWins(stage?.reward ?? 0)} Wins on the gold pad` : `Portal open: continue to Stage ${message.stage + 1}`,
      last ? '' : `...or claim +${formatWins(stage?.reward ?? 0)} Wins on the gold pad and head home`,
    );
  }

  private onStageAwarded(message: StageAwardedMessage): void {
    this.counters.update(message.total, this.local?.rebirths ?? 0);
    this.audio.play('win');
    // Trophies ring the player and fly into them - at base, where the claim sends them.
    this.trophyBurst.play();
    this.toasts.show(`+${formatWins(message.wins)} Win${message.wins === 1 ? '' : 's'}!`, 'gold');
  }

  private onHatched(message: HatchedMessage): void {
    this.audio.play('hatch');
    this.hatchReveal?.show(message.pets.map((pet) => pet.petId));
  }

  private onNotice(message: NoticeMessage): void {
    switch (message.kind) {
      case 'bought':
        this.audio.play('unlock');
        this.toasts.show(message.text, 'good');
        break;
      case 'equipped':
        this.audio.play('buy');
        this.toasts.show(message.text, 'good');
        break;
      case 'rebirth':
        this.toasts.show(message.text, 'gold');
        break;
      case 'info':
        this.toasts.show(message.text, 'pink');
        break;
      case 'defeated':
        this.toasts.show(message.text, 'bad');
        break;
      case 'refused':
      case 'locked':
        this.audio.play('refuse');
        this.toasts.show(message.text, 'bad');
        break;
    }
  }

  private onStatusChange(status: ConnectionStatus): void {
    if (clientConfig.debug) logger.info(SCOPE, `connection: ${status}`);
  }

  private tickFps(delta: number): void {
    if (this.fpsReadout.hidden) return;
    this.fpsAccum += delta;
    this.fpsFrames += 1;
    if (this.fpsAccum < 0.5) return;
    this.fpsReadout.textContent = `${Math.round(this.fpsFrames / this.fpsAccum)} FPS`;
    this.fpsAccum = 0;
    this.fpsFrames = 0;
  }

  dispose(): void {
    this.stop();
    for (const panel of this.panels) panel.dispose();
    this.stats.dispose();
    this.target.dispose();
    this.counters.dispose();
    this.hint.dispose();
    this.toasts.dispose();
    this.popup.dispose();
    this.damagePopups.dispose();
    this.xpPopups.dispose();
    this.trophyBurst.dispose();
    this.hatchReveal?.dispose();
    this.thumbnails?.dispose();
    window.removeEventListener('keydown', this.onHotkey);
    window.removeEventListener('keydown', this.onGesture);
    window.removeEventListener('mousedown', this.onGesture);
    window.removeEventListener('touchstart', this.onGesture);
    this.bloxity.dispose();
    this.bloxityPanel.dispose();
    this.dresser?.dispose();
    this.fpsReadout.remove();
    this.audio.dispose();
    for (const button of [this.storeButton, this.rebirthButton, this.petsButton, this.teleportButton, this.bagButton, this.audioButton]) button.dispose();
    this.rail.remove();
    this.remotePlayers.dispose();
    this.enemies?.dispose();
    this.slashes?.dispose();
    this.world?.dispose();
    this.renderer.dispose();
  }
}
