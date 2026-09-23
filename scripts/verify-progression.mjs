/**
 * The progression rules, exercised in-process against the server's own
 * services.
 *
 * Every figure the specification pins down is asserted EXACTLY: the fourteen
 * katanas' damage and prices, the training tiers and their rebirth gates, the
 * Level 9 / Level 10 reference points, the rebirth caps and speed ladder, the
 * forge restock and the eggs. Then the services are driven through what a
 * client can reach - including every refusal - so "the server decides" is
 * proven, not claimed.
 *
 * Run after `npm run build:server`.
 */
import * as S from '../shared/dist/index.js';
import { PlayerState } from '../server/dist/rooms/state/PlayerState.js';
import { GameState } from '../server/dist/rooms/state/GameState.js';
import { ProgressionService } from '../server/dist/progression/ProgressionService.js';
import { CombatService } from '../server/dist/progression/CombatService.js';
import { KatanaService } from '../server/dist/progression/KatanaService.js';
import { StageService } from '../server/dist/progression/StageService.js';
import { ForgeService } from '../server/dist/progression/ForgeService.js';
import { PetService } from '../server/dist/progression/PetService.js';
import { RebirthService } from '../server/dist/progression/RebirthService.js';
import { profileStore } from '../server/dist/progression/ProfileStore.js';

let failures = 0;
const fail = (message) => {
  failures += 1;
  console.log(`  FAIL  ${message}`);
};
const pass = (message) => console.log(`  ok    ${message}`);
const check = (condition, message) => (condition ? pass(message) : fail(message));

let clockOffset = 0;
const realNow = Date.now;
Date.now = () => realNow() + clockOffset;
const later = (ms = 1000) => {
  clockOffset += ms;
};

const progression = new ProgressionService();
const fresh = (id = 'p1') => {
  const player = new PlayerState();
  player.sessionId = id;
  progression.initialise(player);
  return player;
};
/** Give a player exactly the XP to be at `level`. */
const setLevel = (player, level) => {
  player.xp = S.totalXpToReach(level);
  progression.syncDerived(player);
};
const place = (player, x, y, z) => {
  player.x = x;
  player.y = y;
  player.z = z;
};

console.log('\nKatanas (Katana Stage)');
{
  const expected = [
    [1, 0], [2, 1], [5, 25], [12, 100], [50, 750], [125, 3_500], [250, 18_000], [500, 90_000],
    [850, 450_000], [3_000, 3_500_000], [7_000, 25_000_000], [35_000, 115_000_000], [135_000, 500_000_000], [500_000, 1_000_000_000_000],
  ];
  check(S.KATANAS.length === 14 && S.KATANA_PADS.length === 14, 'fourteen katanas, fourteen pads');
  check(S.KATANAS.every((k, i) => k.damage === expected[i][0] && k.cost === expected[i][1]), 'every katana has the specified damage per click and Wins requirement');
  check(S.KATANAS[0].name === 'Bamboo Starter', 'katana 1 is the Bamboo Starter');
  const tiers = [0, 0, 0];
  for (const pad of S.KATANA_PADS) tiers[S.KATANA_STAGE.tiers.findIndex((t) => t.top === pad.y)] += 1;
  check(tiers.join(',') === '5,5,4', `pads over three storeys (${tiers.join('/')})`);
}

console.log('\nLevel curve and the reference points');
{
  check(S.xpForNextLevel(9) === 520, `Level 9 needs 520 XP for the next level (got ${S.xpForNextLevel(9)})`);
  check(S.xpForNextLevel(10) === 799, `Level 10 needs 799 XP for the next level (got ${S.xpForNextLevel(10)})`);
  let increasing = true;
  for (let l = 1; l < 300; l += 1) if (S.xpForNextLevel(l + 1) <= S.xpForNextLevel(l)) increasing = false;
  check(increasing, 'the curve is strictly increasing to Level 300');
  const p = fresh('ref');
  p.ownedKatanas |= 2;
  p.katanaSlot = 2;
  setLevel(p, 9);
  const d9 = p.damage;
  const s9 = p.speedStat;
  check(p.level === 9 && S.formatAmount(d9) === '1.4K' && s9 === 25, `Level 9 with Katana 2: ${S.formatAmount(d9)} damage (${d9}), speed ${s9}`);
  setLevel(p, 10);
  check(p.level === 10 && S.formatAmount(p.damage) === '1.7K' && p.speedStat === 26, `Level 10 with Katana 2: ${S.formatAmount(p.damage)} damage (${p.damage}), speed ${p.speedStat}`);
  check(p.damage > d9 * 1.1 && p.speedStat - s9 === 1, 'damage grows much faster than speed');
  const newbie = fresh('new');
  check(newbie.level === 1 && newbie.xp === 0 && newbie.damage === 12 && newbie.speedStat === 17, `a new player: Level 1, 0 XP, 12 damage, 17 speed (got L${newbie.level} ${newbie.damage} ${newbie.speedStat})`);
}

console.log('\nThe one damage formula');
{
  const p = fresh('formula');
  p.ownedKatanas = (1 << 5) - 1;
  p.katanaSlot = 5;
  p.trainingTier = 3;
  p.forgePercent = 29.4;
  p.rebirths = 3;
  setLevel(p, 20);
  const expected = Math.floor(50 * 5 * S.levelDamageFactor(20) * 1.294 * 1 * 1.3);
  check(p.damage === expected, `katana x training x level x forge x pets x rebirth = ${expected} (server ${p.damage})`);
  const b = S.damageBreakdown({ katanaSlot: 5, ownedKatanas: p.ownedKatanas, trainingTier: 3, level: 20, forgePercent: 29.4, equippedPetIds: [4, 4], rebirths: 3 });
  check(b.pets === 1.3 && b.total === Math.floor(50 * 5 * S.levelDamageFactor(20) * 1.294 * 1.3 * 1.3), 'equipped pets add their bonuses into the pet factor');
  const unowned = fresh('unowned');
  unowned.katanaSlot = 14;
  progression.syncDerived(unowned);
  check(unowned.damage === 12, 'wearing a katana you do not own counts as the starter');
}

console.log('\nXP from moving and attacking');
{
  const p = fresh('xp');
  progression.creditMovement('xp', p, 1 / 60, 0.3, true); // first step after a placement pays nothing
  let gained = 0;
  for (let i = 0; i < 60; i += 1) gained += progression.creditMovement('xp', p, 1 / 60, p.moveSpeed / 60, true);
  check(gained === Math.floor((p.moveSpeed * 59) / 60 / S.STRIDE_DISTANCE) * S.XP_PER_STRIDE, `a second of running pays one XP per ${S.STRIDE_DISTANCE}-unit stride (${gained})`);
  const teleport = progression.creditMovement('xp', p, 1 / 60, 500, true);
  check(teleport === 0, 'a teleport-sized step pays nothing');
  const air = progression.creditMovement('xp', p, 1 / 60, p.moveSpeed / 60, false);
  check(air === 0, 'movement in the air pays nothing');
  const hit = progression.creditHit(p, 1);
  check(hit === S.XP_PER_HIT, `a landed hit pays ${S.XP_PER_HIT} XP at Rebirth 0`);
  p.rebirths = 1;
  check(progression.creditHit(p, 1) === S.XP_PER_HIT * 2, 'Rebirth 1 doubles XP gains');
  const capped = fresh('cap');
  setLevel(capped, 15);
  const before = capped.xp;
  progression.creditHit(capped, 10);
  check(capped.level === 15 && capped.xp === before, 'at the Rebirth 0 cap (Level 15) XP stops');

  // Swings: every accepted swing pays, landed or not, grounded or airborne.
  const state = new GameState();
  const combat = new CombatService();
  const s = fresh('swinger');
  state.players.set('swinger', s);
  place(s, 0, 6, 0);
  s.grounded = false;
  const xp0 = s.xp;
  const whiff = combat.attack('swinger', s, S.NO_TARGET, state, progression);
  check(!whiff.ok && whiff.xp === S.XP_PER_SWING && s.xp === xp0 + S.XP_PER_SWING, `a swing at nothing, mid-jump, pays ${S.XP_PER_SWING} XP (got ${s.xp - xp0})`);
  const def = S.STAGES[0].enemies[0];
  place(s, def.x, 3, def.z - 3);
  later(400);
  const xp1 = s.xp;
  const airHit = combat.attack('swinger', s, def.id, state, progression);
  check(airHit.ok && airHit.xp === s.xp - xp1 && s.xp - xp1 > S.XP_PER_SWING, `an airborne hit lands and pays swing + hit XP (+${s.xp - xp1})`);
  let paid = 0;
  place(s, 0, 0, -30);
  const xp2 = s.xp;
  for (let i = 0; i < 20; i += 1) combat.attack('swinger', s, S.NO_TARGET, state, progression);
  paid = s.xp - xp2;
  check(paid <= S.COMBAT.burst * S.XP_PER_SWING, `twenty instant swings pay swing XP only for the rate limit's ${S.COMBAT.burst} (+${paid})`);
}

console.log('\nRebirth');
{
  check(S.maxLevelFor(0) === 15 && S.maxLevelFor(1) === 30 && S.maxLevelFor(2) === 45, 'max level 15 / 30 / 45');
  check(S.rebirthSpeedMultiplier(0) === 1 && S.rebirthSpeedMultiplier(1) === 2 && S.rebirthSpeedMultiplier(4) === 5, 'speed x1, x2 ... x5');
  const rebirths = new RebirthService();
  const p = fresh('rb');
  setLevel(p, 14);
  check(!rebirths.rebirth(p, progression).ok && p.rebirths === 0, 'Level 14 cannot rebirth (needs 15)');
  setLevel(p, 15);
  p.wins = 777;
  p.ownedKatanas = 7;
  p.katanaSlot = 3;
  const speedBefore = p.speedStat;
  const result = rebirths.rebirth(p, progression);
  check(result.ok && p.rebirths === 1 && p.level === 1 && p.xp === 0 && p.maxLevel === 30, 'Level 15 rebirths: Rebirth 1, back to Level 1, max level 30');
  check(p.wins === 777 && p.ownedKatanas === 7 && p.katanaSlot === 3, 'Wins and katanas are kept');
  check(p.speedStat === S.baseSpeedFor(1) * 2 && speedBefore === S.baseSpeedFor(15), `speed is x2 after the first rebirth (${p.speedStat})`);
  setLevel(p, 29);
  check(!rebirths.rebirth(p, progression).ok, 'Rebirth 1 needs Level 30');
}

console.log('\nTraining dummies (rebirth gates enforced per hit)');
{
  const expected = [[1, 0], [2, 1], [3, 2], [5, 3], [10, 9], [25, 15]];
  check(S.TRAINING_TIERS.every((t, i) => t.multiplier === expected[i][0] && t.rebirthsRequired === expected[i][1]), 'Basic x1/0 x2/1, Dojo x3/2 x5/3, Cultist x10/9 x25/15');
  const zones = S.TRAINING_TIERS.map((t) => t.zone).join(',');
  check(zones === 'basic,basic,dojo,dojo,cultist,cultist', 'two dummies in each of the three zones');
  const state = new GameState();
  const combat = new CombatService();
  const p = fresh('trainee');
  state.players.set('trainee', p);
  const dummy = S.DUMMIES[1];
  place(p, dummy.x + 2.5, S.TRAINING.floorTop, dummy.z);
  const locked = combat.attack('trainee', p, S.dummyTarget(1), state, progression);
  check(!locked.ok && locked.reason === 'locked-dummy' && p.trainingHits[1] === 0, 'the x2 dummy refuses a player with 0 rebirths, even standing beside it');
  p.rebirths = 1;
  progression.syncDerived(p);
  let mastered = -1;
  for (let i = 0; i < S.TRAINING_TIERS[1].hitsToMaster; i += 1) {
    later(400);
    const out = combat.attack('trainee', p, S.dummyTarget(1), state, progression);
    if (out.ok && out.mastered >= 0) mastered = out.mastered;
  }
  check(mastered === 1 && p.trainingTier === 1, `${S.TRAINING_TIERS[1].hitsToMaster} hits master the x2 dummy`);
  check(p.damage === Math.floor(1 * 2 * S.levelDamageFactor(p.level) * 1.1), `the training multiplier is now x2 in the damage formula (${p.damage} at Level ${p.level})`);
  const far = S.DUMMIES[3];
  place(p, far.x + 20, S.TRAINING.floorTop, far.z);
  later(400);
  const tooFar = combat.attack('trainee', p, S.dummyTarget(3), state, progression);
  check(!tooFar.ok, 'a dummy out of reach cannot be hit');
}

console.log('\nEnemies, stage locks and rewards');
{
  check(S.STAGES[0].enemies.length === 5 && S.STAGES[0].reward === 1 && S.STAGES[0].enemies.every((e) => !e.boss), 'Stage 1: five easy enemies, +1 Win');
  check(S.STAGES[1].recommendedDamage === 300, 'Stage 2 recommends 300 damage');
  const boss = S.STAGES[2].enemies.find((e) => e.boss);
  check(!!boss && S.STAGES[2].enemies.length > 2 && boss.maxHp > S.STAGES[2].enemies[0].maxHp, 'Stage 3: a wave, then a bigger boss');
  check(S.ENEMIES.every((e) => e.name.length > 2), 'every enemy is named');

  // Enemy damage and health climb stage by stage, deterministically, from the recommendation.
  let climbing = true;
  for (let i = 1; i < S.STAGES.length; i += 1) {
    const prev = S.STAGES[i - 1];
    const cur = S.STAGES[i];
    const hit = (st) => Math.max(...st.enemies.filter((e) => !e.boss).map((e) => e.damage));
    const hp = (st) => Math.max(...st.enemies.filter((e) => !e.boss).map((e) => e.maxHp));
    if (!(hit(cur) > hit(prev) && hp(cur) > hp(prev))) climbing = false;
  }
  check(climbing, `enemy damage and health rise every stage (Stage 1 hits for ${S.STAGES[0].enemies[0].damage}, Stage 10 for ${S.formatAmount(S.STAGES[9].enemies[0].damage)})`);
  check(
    S.ENEMIES.every((e) => e.damage === Math.max(1, Math.round(S.stageByIndex(e.stage).recommendedDamage * (e.boss ? S.BOSS_HIT_SHARE : S.ENEMY_HIT_SHARE)))),
    `every enemy hits for ${S.ENEMY_HIT_SHARE * 100}% of its stage's recommended damage (a boss ${S.BOSS_HIT_SHARE * 100}%)`,
  );
  check(S.maxHealthFor(12) === 160 && S.maxHealthFor(40) === 300, `health is 100 + 5 x damage (a new player: ${S.maxHealthFor(12)})`);

  const state = new GameState();
  const combat = new CombatService();
  const a = fresh('a');
  const b = fresh('b');
  state.players.set('a', a);
  state.players.set('b', b);
  a.ownedKatanas = 0b11;
  a.katanaSlot = 2;
  setLevel(a, 5);
  combat.resetRun('a', a);
  combat.resetRun('b', b);
  check(a.hp === a.maxHp && a.maxHp === S.maxHealthFor(a.damage), `a run starts at full health (${a.hp})`);

  // Entering a stage turns the whole wave on the player, wherever they stand in it.
  const stage = S.STAGES[0];
  place(a, 20, 0, S.arenaStartZ(1) + 4);
  place(b, 0, 0, -20);
  const dist = (p, def) => Math.hypot(p.enemies[def.id].x - p.x, p.enemies[def.id].z - p.z);
  const before = stage.enemies.map((def) => dist(a, def));
  for (let i = 0; i < 20; i += 1) combat.tick(0.05, state);
  const after = stage.enemies.map((def) => dist(a, def));
  check(after.every((d, i) => d < before[i] - 1), `every Stage 1 enemy closes in on A the moment A enters (${before.map((d) => d.toFixed(0)).join('/')} -> ${after.map((d) => d.toFixed(0)).join('/')})`);
  check(stage.enemies.every((def) => b.enemies[def.id].x === def.x && b.enemies[def.id].z === def.z), "B's own copy of the wave has not moved: A's fight is A's alone");

  // A brand-new player standing in Stage 1 is worn down - and killed.
  const c = fresh('c');
  state.players.set('c', c);
  combat.resetRun('c', c);
  place(c, -20, 0, S.arenaStartZ(1) + 60);
  const hp0 = c.hp;
  let death = null;
  let seconds = 0;
  for (let i = 0; i < 20 * 60 && !death; i += 1) {
    combat.tick(0.05, state);
    seconds += 0.05;
    for (const hurt of combat.drainHurts()) if (hurt.sessionId === 'c' && hurt.killed) death = hurt;
  }
  check(!!death && c.hp === 0, `a new player (${hp0} health) left standing in Stage 1 is defeated in ${seconds.toFixed(0)}s (by ${death ? S.ENEMIES[death.enemy].name : 'nobody'})`);
  check(a.hp < a.maxHp, `A, in the same stage, has taken hits too (${a.hp} / ${a.maxHp})`);
  state.players.delete('c');
  combat.resetRun('a', a);
  check(
    a.hp === a.maxHp && stage.enemies.every((def) => a.enemies[def.id].alive && a.enemies[def.id].x === def.x) && a.runStage === 0,
    'returned to base: full health, every enemy back at its post, the run reset',
  );

  // A clears the wave.
  let cleared = null;
  for (const def of stage.enemies) {
    const enemy = a.enemies[def.id];
    let guard = 0;
    while (enemy.alive && guard < 50) {
      place(a, enemy.x, 0, enemy.z - 3);
      later(250);
      a.hp = a.maxHp;
      const out = combat.attack('a', a, def.id, state, progression);
      if (out.ok && out.target === def.id && out.damage !== a.damage) fail('a hit dealt something other than the server damage figure');
      combat.tick(0.05, state);
      guard += 1;
    }
    for (const clear of combat.drainClears()) if (clear.sessionId === 'a') cleared = clear;
  }
  combat.drainHurts();
  check(a.killMasks[0] === stage.fullMask, 'A defeats all five enemies');
  check(cleared && cleared.stage === 1 && a.runStage === 1 && a.bestStage === 1, 'the stage is cleared for A: its portal opens for this run (runStage 1)');
  check(b.killMasks[0] === 0 && b.runStage === 0 && stage.enemies.every((def) => b.enemies[def.id].alive), "B's run is untouched: B's wave stands and B's portal stays shut");
  for (let i = 0; i < 20 * 30; i += 1) combat.tick(0.05, state);
  check(stage.enemies.every((def) => !a.enemies[def.id].alive), 'thirty seconds on, nothing has respawned mid-run');

  // The gate is solid for B and open for A: the same shared collision.
  const collision = new S.WorldCollision();
  const walk = (openedStage) => {
    const m = S.createMotion();
    S.resetMotion(m, 0, 0, S.arenaEndZ(1) - 3, 0);
    const params = { moveSpeed: 20, jumpVelocity: 24, openedStage };
    const events = S.createSimEvents();
    for (let i = 0; i < 90; i += 1) S.stepPlayer(m, { moveX: 0, moveZ: 1, jump: false, cameraYaw: 0 }, params, 1 / 60, collision, events);
    return m.z;
  };
  check(walk(b.runStage) < S.gateZ(1) - 0.5, `a player who has not cleared Stage 1 this run is stopped by its portal (z ${walk(b.runStage).toFixed(1)})`);
  check(walk(a.runStage) > S.arenaStartZ(2), `a player who has walks through into Stage 2 (z ${walk(a.runStage).toFixed(1)})`);

  const stages = new StageService();
  const pad = S.rewardPadOf(1);
  place(b, pad.x, 0, pad.z);
  check(!stages.claim('b', b, 1).granted && b.wins === 0, 'B cannot claim the reward without clearing the wave');
  place(a, 0, 0, 60);
  check(!stages.claim('a', a, 1).granted, 'A cannot claim from off the pad');
  place(a, pad.x, 0, pad.z);
  const award = stages.claim('a', a, 1);
  check(award.granted && a.wins === 1 && a.lifetimeWins === 1, 'A banks +1 Win on the pad');
  // The room now returns A to base, which resets the run.
  combat.resetRun('a', a);
  check(a.killMasks[0] === 0 && a.runStage === 0 && stage.enemies.every((def) => a.enemies[def.id].alive), 'back at base the run resets: the wave is back and the portal shut');
  later(1000);
  check(!stages.claim('a', a, 1).granted && a.wins === 1, 'a second claim pays nothing: the next reward needs the next clear');

  // A boss is sealed until its wave is done.
  const s3 = S.STAGES[2];
  const bossDef = s3.enemies.find((e) => e.boss);
  const bossState = a.enemies[bossDef.id];
  place(a, bossState.x, 0, bossState.z - 3);
  later(400);
  const sealed = combat.attack('a', a, bossDef.id, state, progression);
  check(!sealed.ok && bossState.hp === bossDef.maxHp, 'the Stage 3 boss cannot be hurt before its wave is defeated');
  a.killMasks[2] = s3.waveMask;
  later(400);
  const open = combat.attack('a', a, bossDef.id, state, progression);
  check(open.ok && bossState.hp < bossDef.maxHp, 'once the wave is defeated the boss takes damage');

  // Balance: at the recommended damage a stage is survivable; far below it, it is not.
  const duel = (stageIndex, damage) => {
    const st = S.STAGES[stageIndex - 1];
    const hp = S.maxHealthFor(damage);
    let health = hp;
    const wave = st.enemies.filter((e) => !e.boss);
    // Worst case: the whole wave on the player, felled one at a time at the auto-click rate.
    for (let i = 0; i < wave.length; i += 1) {
      const seconds = Math.ceil(wave[i].maxHp / damage) * S.COMBAT.autoInterval;
      for (let j = i; j < wave.length; j += 1) health -= Math.floor(seconds / S.ENEMY_AI.swingSeconds) * wave[j].damage;
    }
    const boss = st.enemies.find((e) => e.boss);
    if (boss) health -= Math.floor((Math.ceil(boss.maxHp / damage) * S.COMBAT.autoInterval) / (S.ENEMY_AI.swingSeconds * 1.3)) * boss.damage;
    return health / hp;
  };
  const atRecommended = S.STAGES.map((st) => duel(st.index, st.recommendedDamage));
  check(atRecommended.every((left) => left > 0), `at each stage's recommended damage the whole wave (and boss) is survivable (health left: ${atRecommended.map((v) => Math.round(v * 100) + '%').join(' ')})`);
  const underpowered = S.STAGES.map((st) => duel(st.index, st.recommendedDamage / 3));
  check(underpowered.every((left) => left <= 0), `at a third of it the stage is lethal (${underpowered.map((v) => Math.round(v * 100) + '%').join(' ')})`);
}

console.log('\nRate limit and reach');
{
  const state = new GameState();
  const combat = new CombatService();
  const p = fresh('spam');
  state.players.set('spam', p);
  const def = S.STAGES[0].enemies[0];
  place(p, def.x, 0, def.z - 3);
  let landed = 0;
  for (let i = 0; i < 20; i += 1) if (combat.attack('spam', p, def.id, state, progression).ok) landed += 1;
  check(landed <= S.COMBAT.burst, `twenty swings in one instant land at most ${S.COMBAT.burst} (${landed})`);
  const reachState = new GameState();
  const reach = new CombatService();
  const q = fresh('reach');
  reachState.players.set('reach', q);
  place(q, def.x, 0, def.z - 20);
  check(!reach.attack('reach', q, def.id, reachState, progression).ok, 'an enemy twenty units away cannot be hit, whatever the client names');
}

console.log('\nStage teleport prices');
{
  const expected = [2, 6, 20, 50, 200, 800, 3e3, 1e4, 4e4, 1e5, 3e5, 1e6, 3e6, 1e7, 7e7, 1e8, 1.5e8, 2.2e8, 3.2e8];
  check(S.STAGE_TELEPORT_COSTS.length === 19 && S.STAGE_TELEPORT_COSTS.every((c, i) => c === expected[i]), 'Stages 1-19 cost 2 / 6 / 20 / 50 / 200 / 800 / 3K / 10K / 40K / 100K / 300K / 1M / 3M / 10M / 70M / 100M / 150M / 220M / 320M Wins');
  check(S.TELEPORT_STAGE_COUNT === Math.min(S.STAGE_COUNT, 20) && S.MAX_TELEPORT_STAGE === 20, `the menu lists the game's ${S.TELEPORT_STAGE_COUNT} stages and never goes past Stage 20`);
  check(S.stageTeleportCost(0) === null && S.stageTeleportCost(S.TELEPORT_STAGE_COUNT + 1) === null && S.stageTeleportCost(21) === null, 'no price (no teleport) outside the listed stages');
}

console.log('\nKatana pads');
{
  const katanas = new KatanaService();
  const p = fresh('shop');
  const pad2 = S.KATANA_PADS[1];
  p.wins = 10;
  place(p, 0, 0, 0);
  check(!katanas.pad(p, 2, progression).ok && p.wins === 10, 'a pad asked for from across the map does nothing');
  place(p, pad2.x, pad2.y, pad2.z);
  const bought = katanas.pad(p, 2, progression);
  check(bought.ok && bought.action === 'bought' && p.wins === 9 && p.katanaSlot === 2 && S.ownsKatana(p.ownedKatanas, 2), 'standing on the pad buys Katana 2 for 1 Win and wears it');
  const pad3 = S.KATANA_PADS[2];
  place(p, pad3.x, pad3.y, pad3.z);
  const poor = katanas.pad(p, 3, progression);
  check(!poor.ok && poor.reason === 'too-few-wins' && p.katanaSlot === 2, 'Katana 3 (25 Wins) is refused with 9 Wins');
  const pad1 = S.KATANA_PADS[0];
  place(p, pad1.x, pad1.y, pad1.z);
  const worn = katanas.pad(p, 1, progression);
  check(worn.ok && worn.action === 'equipped' && p.katanaSlot === 1 && p.wins === 9, 'an owned katana is re-equipped for free');
}

console.log('\nForge');
{
  check(S.RESTOCK_SECONDS === 300, 'the stock turns over every five minutes');
  const a = S.forgeOffers(1234);
  const b = S.forgeOffers(1234);
  check(JSON.stringify(a) === JSON.stringify(b) && a.length === 4, 'a rotation offers the same four items everywhere');
  check(a.map((o) => o.item.rarity).join(',') === 'common,rare,legendary,mythic', 'one item per rarity');
  const seen = new Set();
  for (let r = 0; r < 200; r += 1) for (const offer of S.forgeOffers(r)) seen.add(offer.item.id);
  check(seen.size === S.FORGE_ITEMS.length, 'every item in the pool turns up across rotations');
  const forge = new ForgeService();
  const p = fresh('smith');
  const rotation = forge.rotation;
  const offer = S.forgeOffers(rotation)[0];
  p.wins = offer.item.cost * 10;
  place(p, 0, 0, 0);
  check(!forge.buy(p, rotation, 0, progression).ok, 'buying away from the forge is refused');
  place(p, S.FORGE.anvil.x, 0, -52);
  check(!forge.buy(p, rotation - 1, 0, progression).ok, 'buying from a stale rotation is refused');
  let bought = 0;
  for (let i = 0; i < offer.item.stock + 2; i += 1) if (forge.buy(p, rotation, 0, progression).ok) bought += 1;
  check(bought === offer.item.stock, `the Common slot sells exactly its stock of ${offer.item.stock}`);
  check(Math.abs(p.forgePercent - offer.bonus * offer.item.stock) < 1e-6, `the bonus is added to the forge total (${p.forgePercent}%)`);
  check(S.FORGE_ITEMS.find((i) => i.name === 'Iron Bar')?.cost === 500 && S.FORGE_ITEMS.find((i) => i.name === 'Blue Flame')?.bonus === 45, 'the pool holds the reference items');
}

console.log('\nPets');
{
  check(S.EGGS.map((e) => e.cost).join(',') === '500,35000,2000000,350000000', 'eggs cost 500 / 35K / 2M / 350M');
  check(S.EGGS.every((e) => e.pool.reduce((sum, [, c]) => sum + c, 0) === 100), "every egg's chances sum to 100%");
  check(S.EGGS[0].pool.map(([, c]) => c).join(',') === '60,15,15,10', 'the Bamboo Egg: Rare 60%, Epic 15% + 15%, Legendary 10%');
  const pets = new PetService();
  const p = fresh('pets');
  const egg = S.EGG_PLACEMENTS[0];
  p.wins = 500 * 40;
  place(p, 0, 0, 0);
  check(!pets.hatch(p, 1, 1, progression).ok, 'hatching away from the egg is refused');
  place(p, egg.x, 0, S.PETS_SHOP.padZ);
  const one = pets.hatch(p, 1, 1, progression);
  check(one.ok && p.pets.length === 1 && p.pets[0].equipped && p.wins === 500 * 39, 'a hatch spends 500 Wins, adds a pet and equips it into a free slot');
  const three = pets.hatch(p, 1, 3, progression);
  check(three.ok && p.pets.length === 4 && p.pets.filter((x) => x.equipped).length === 3, 'Hatch 3 adds three; only three can be equipped');
  const extra = p.pets.find((x) => !x.equipped);
  check(!pets.act(p, 'equip', extra.uid, progression).ok, 'a fourth pet cannot be equipped');
  pets.act(p, 'equipBest', undefined, progression);
  const bestIds = p.pets.filter((x) => x.equipped).map((x) => S.petById(x.petId).bonus).sort((x, y) => y - x);
  const allIds = p.pets.map((x) => S.petById(x.petId).bonus).sort((x, y) => y - x).slice(0, 3);
  check(JSON.stringify(bestIds) === JSON.stringify(allIds), 'Equip Best equips the three strongest');
  const count = p.pets.length;
  check(pets.act(p, 'delete', p.pets[0].uid, progression).ok && p.pets.length === count - 1, 'a pet can be deleted');
  check(!pets.act(p, 'delete', 99999, progression).ok, 'deleting a pet you do not own does nothing');
  p.wins = 0;
  check(!pets.hatch(p, 1, 1, progression).ok, 'no Wins, no hatch');
  const full = fresh('full');
  full.wins = 1e12;
  place(full, egg.x, 0, S.PETS_SHOP.padZ);
  for (let i = 0; i < 12; i += 1) pets.hatch(full, 1, 3, progression);
  check(full.pets.length === S.PET_INVENTORY_MAX && !pets.hatch(full, 1, 1, progression).ok, `the inventory stops at ${S.PET_INVENTORY_MAX}`);
  // Rolls follow the chances.
  const counts = new Map();
  for (let i = 0; i < 100; i += 1) {
    const pet = S.rollEgg(S.EGGS[0], (i + 0.5) / 100);
    counts.set(pet.id, (counts.get(pet.id) ?? 0) + 1);
  }
  check(counts.get(1) === 60 && counts.get(2) === 15 && counts.get(3) === 15 && counts.get(4) === 10, 'rolls land in proportion to the chances');
}

console.log('\nSave and restore');
{
  const p = fresh('save');
  p.wins = 1234;
  p.lifetimeWins = 5000;
  p.rebirths = 2;
  p.ownedKatanas = 0b1111;
  p.katanaSlot = 4;
  p.trainingTier = 2;
  p.trainingHits[3] = 7;
  p.forgePercent = 51.5;
  p.bestStage = 3;
  p.petsHatched = 9;
  setLevel(p, 22);
  const pets = new PetService();
  p.wins += 500 * 2;
  place(p, S.EGG_PLACEMENTS[0].x, 0, S.PETS_SHOP.padZ);
  pets.hatch(p, 1, 1, progression);
  pets.hatch(p, 1, 1, progression);
  const snapshot = profileStore.snapshot(p);
  const restored = new PlayerState();
  restored.sessionId = 'restored';
  profileStore.applyTo(restored, snapshot);
  progression.initialise(restored);
  const same = ['wins', 'lifetimeWins', 'rebirths', 'ownedKatanas', 'katanaSlot', 'trainingTier', 'forgePercent', 'bestStage', 'petsHatched', 'xp', 'level', 'damage', 'speedStat'].every((key) => restored[key] === p[key]);
  check(same, 'every progression field survives a save and restore');
  check(restored.pets.length === 2 && restored.pets.every((x, i) => x.uid === p.pets[i].uid && x.equipped === p.pets[i].equipped), 'pets and their equipment survive');
  check(restored.trainingHits[3] === 7 && restored.nextPetUid === p.nextPetUid, 'training progress and the next pet id survive');
}

if (failures > 0) {
  console.log(`\n${failures} progression check(s) failed.`);
  process.exit(1);
}
console.log('\nprogression OK');
process.exit(0);
