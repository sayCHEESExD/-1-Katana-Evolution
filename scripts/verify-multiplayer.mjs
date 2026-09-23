/**
 * The stage run, end to end, against a RUNNING server with two real clients.
 *
 *   enter a stage -> its whole wave comes for you and hits -> you can die ->
 *   kill every enemy -> the portal opens -> continue OR claim the Wins ->
 *   a claim or a death returns you to base -> the run (and its enemies) reset.
 *
 * A fighter plays that run; a watcher checks that the fighter's enemies are
 * the fighter's ALONE (never replicated to the watcher, never touching the
 * watcher's own run), then stands in Stage 1 until its own wave kills it.
 * Attack XP (grounded and mid-jump) and the forgeries a client might try are
 * checked too.
 *
 * Needs a running server (`npm run dev`), default ws://localhost:2587.
 */
import { Client } from 'colyseus.js';
import * as S from '../shared/dist/index.js';

const ENDPOINT = process.env.ENDPOINT ?? 'ws://localhost:2587';
let failures = 0;
const fail = (message) => {
  failures += 1;
  console.log(`  FAIL  ${message}`);
};
const pass = (message) => console.log(`  ok    ${message}`);
const check = (condition, message) => (condition ? pass(message) : fail(message));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const hits = [];
const cleared = [];
const awarded = [];
const respawns = [];
const notices = [];
const join = async (id) => {
  const client = new Client(ENDPOINT);
  const room = await client.joinOrCreate(S.ROOM_NAME, { playerId: id });
  for (const type of ['authState', 'hatched']) room.onMessage(type, () => {});
  room.onMessage('respawn', (message) => respawns.push({ id, at: Date.now(), ...message }));
  room.onMessage('notice', (message) => notices.push({ id, at: Date.now(), ...message }));
  room.onMessage('hit', (message) => hits.push({ id, ...message }));
  room.onMessage('stageCleared', (message) => cleared.push({ id, ...message }));
  room.onMessage('stageAwarded', (message) => awarded.push({ id, ...message }));
  return room;
};

const stamp = Date.now().toString(36);
const fighter = await join(`mp-fighter-${stamp}`);
const watcher = await join(`mp-watcher-${stamp}`);
await sleep(600);
check(fighter.roomId === watcher.roomId, 'both clients share a room');

const me = () => fighter.state.players.get(fighter.sessionId);
const seen = () => watcher.state.players.get(fighter.sessionId);
const watcherSelf = () => watcher.state.players.get(watcher.sessionId);
const myEnemies = () => me().enemies;

const seqs = new Map();
/** Real-time input at 60 Hz, `frames` of it, toward a goal or with a fixed stick. */
const drive = async (room, input, seconds) => {
  const frames = Math.round(seconds * 60);
  for (let i = 0; i < frames; i += 1) {
    const seq = (seqs.get(room) ?? 0) + 1;
    seqs.set(room, seq);
    room.send(S.MessageType.Move, { seq, dt: 1 / 60, moveX: 0, moveZ: 0, jump: false, cameraYaw: 0, ...input });
    if (i % 4 === 3) await sleep(66);
  }
};
/** Walk toward a point: camera yaw 0, so the stick is (-dx, dz). */
const walkTo = async (room, player, x, z, within = 1.5, maxSeconds = 20) => {
  for (let t = 0; t < maxSeconds * 10; t += 1) {
    const p = player();
    const dx = x - p.x;
    const dz = z - p.z;
    const d = Math.hypot(dx, dz);
    if (d <= within) return true;
    await drive(room, { moveX: -dx / d, moveZ: dz / d }, 0.1);
  }
  return false;
};

// ------------------------------------------------------------- attack XP
{
  await drive(fighter, {}, 0.3);
  const xp0 = me().lifetimeXp;
  const seen0 = seen().lifetimeXp;
  fighter.send(S.MessageType.Attack, { target: S.NO_TARGET });
  await drive(fighter, {}, 0.4);
  const groundGain = me().lifetimeXp - xp0;
  check(groundGain === S.XP_PER_SWING, `a grounded swing at nothing pays ${S.XP_PER_SWING} XP (+${groundGain})`);
  const seq = (seqs.get(fighter) ?? 0) + 1;
  seqs.set(fighter, seq);
  fighter.send(S.MessageType.Move, { seq, dt: 1 / 60, moveX: 0, moveZ: 0, jump: true, cameraYaw: 0 });
  await drive(fighter, { jump: true }, 0.2);
  const airborne = !me().grounded && me().y > 1;
  const xp1 = me().lifetimeXp;
  fighter.send(S.MessageType.Attack, { target: S.NO_TARGET });
  await sleep(150);
  const airGain = me().lifetimeXp - xp1;
  check(airborne && airGain === S.XP_PER_SWING, `a swing mid-jump (y ${me().y.toFixed(1)}) pays ${S.XP_PER_SWING} XP too (+${airGain})`);
  await drive(fighter, {}, 1.2);
  await sleep(300);
  check(seen().lifetimeXp - seen0 >= groundGain + airGain, `the watcher sees the fighter's XP rise (+${seen().lifetimeXp - seen0})`);
}

// ------------------------------------------------------------ privacy
check(myEnemies()?.length === S.ENEMIES.length, `the fighter holds its own copy of every enemy (${myEnemies()?.length})`);
check(!seen()?.enemies || seen().enemies.length === 0, "the fighter's enemies are never sent to the watcher");
check(me().hp === me().maxHp && me().maxHp === S.maxHealthFor(me().damage), `the fighter starts the run at full health (${me().hp})`);

// ------------------------------------------------- enter: the wave attacks
const stage = S.STAGES[0];
const start = S.arenaStartZ(1);
check(await walkTo(fighter, me, 0, start + 6, 2), `the fighter walks through the Stage 1 portal (z ${me().z.toFixed(1)})`);
const gap = () => stage.enemies.map((def) => Math.hypot(myEnemies()[def.id].x - me().x, myEnemies()[def.id].z - me().z));
const gap0 = gap();
const hp0 = me().hp;
let hurt = false;
for (let i = 0; i < 40 && !hurt; i += 1) {
  await drive(fighter, {}, 0.25);
  if (me().hp < hp0) hurt = true;
}
const gap1 = gap();
check(gap1.every((d, i) => d < gap0[i]), `every Stage 1 enemy came for the fighter at once (${gap0.map((d) => d.toFixed(0)).join('/')} -> ${gap1.map((d) => d.toFixed(0)).join('/')})`);
check(hurt, `and they hit: health ${hp0} -> ${me().hp}`);

// ------------------------------------------------------- kill every enemy
const watchedOwn = () => stage.enemies.every((def) => watcherSelf().enemies?.[def.id]?.alive && watcherSelf().enemies[def.id].hp === def.maxHp);
let swings = 0;
for (let round = 0; round < 400 && me().killMasks[0] !== stage.fullMask; round += 1) {
  // The nearest live enemy of the fighter's own run.
  let target = null;
  let best = Infinity;
  for (const def of stage.enemies) {
    const enemy = myEnemies()[def.id];
    if (!enemy.alive) continue;
    const d = Math.hypot(enemy.x - me().x, enemy.z - me().z);
    if (d < best) {
      best = d;
      target = def;
    }
  }
  if (!target) break;
  if (best > 5) {
    const enemy = myEnemies()[target.id];
    await walkTo(fighter, me, enemy.x, enemy.z, 3.5, 1);
    continue;
  }
  fighter.send(S.MessageType.Attack, { target: target.id });
  swings += 1;
  await drive(fighter, {}, 0.2);
}
await sleep(400);
const fighterHits = hits.filter((h) => h.id.startsWith('mp-fighter') && h.target < 1000);
check(me().killMasks[0] === stage.fullMask, `the fighter killed all ${stage.enemies.length} enemies (${fighterHits.length} hits from ${swings} swings, health left ${me().hp})`);
check(fighterHits.every((h) => h.xp >= S.XP_PER_SWING + S.XP_PER_HIT), 'every landed hit paid swing + hit XP');
check(cleared.some((c) => c.id.startsWith('mp-fighter') && c.stage === 1) && me().runStage === 1, 'Stage 1 is cleared for the fighter: its portal is open for this run (runStage 1)');
check(watchedOwn() && watcherSelf().runStage === 0, "the watcher's own Stage 1 wave is untouched and its portal shut");

// ------------------------------------------------ the watcher: locked, then killed
await walkTo(watcher, watcherSelf, 0, S.arenaEndZ(1) - 4, 2, 25);
await drive(watcher, { moveZ: 1 }, 1.2);
await sleep(200);
const watcherDied = () => respawns.some((r) => r.id.startsWith('mp-watcher') && r.reason === 'death');
check(watcherSelf().z < S.gateZ(1) || watcherDied(), `the watcher, who cleared nothing, is stopped at the red portal (z ${watcherSelf().z.toFixed(1)})`);
// Watch for the fall: the watcher is marked dead (the death animation) BEFORE it is sent home,
// and meanwhile it cannot move - and the fighter, a bystander, sees it fall too.
let sawDead = false;
let bystanderSawDead = false;
let deadZ = null;
let movedWhileDead = false;
for (let i = 0; i < 600 && !watcherDied(); i += 1) {
  await drive(watcher, watcherSelf().dead ? { moveX: 1, moveZ: -1 } : {}, 0.25);
  if (watcherSelf().dead) {
    sawDead = true;
    if (deadZ === null) deadZ = watcherSelf().z;
    else if (Math.abs(watcherSelf().z - deadZ) > 0.5 && !watcherDied()) movedWhileDead = true;
  }
  if (fighter.state.players.get(watcher.sessionId)?.dead) bystanderSawDead = true;
}
await sleep(300);
check(watcherDied(), 'standing in Stage 1, the watcher is killed by its own wave');
{
  const fell = notices.find((n) => n.id.startsWith('mp-watcher') && n.kind === 'defeated');
  const home = respawns.find((r) => r.id.startsWith('mp-watcher') && r.reason === 'death');
  const held = fell && home ? (home.at - fell.at) / 1000 : 0;
  check(sawDead && held >= S.DEATH_ANIMATION_SECONDS, `it falls first (dead), and is sent home only after the ${S.DEATH_ANIMATION_SECONDS}s death animation (${held.toFixed(2)}s later)`);
  check(!movedWhileDead, 'while fallen, its movement input moves nothing');
  check(bystanderSawDead, 'another player sees it fall (the same replicated dead flag drives its animation there)');
  check(!watcherSelf().dead, 'and it stands again at base');
}
check(watcherSelf().z < S.arenaStartZ(1) - 10 && watcherSelf().hp === watcherSelf().maxHp, `a death returns the watcher to base at full health (z ${watcherSelf().z.toFixed(1)}, ${watcherSelf().hp} hp)`);
check(watchedOwn() && watcherSelf().runStage === 0, "and the watcher's stages reset: every enemy back at full health");
check(notices.some((n) => n.id.startsWith('mp-watcher') && n.kind === 'defeated'), 'the watcher was told who defeated it');

// --------------------------------------------- continue, then claim
check(stage.enemies.every((def) => !myEnemies()[def.id].alive), "the fighter's cleared enemies have not respawned mid-run");
await walkTo(fighter, me, 0, S.arenaStartZ(2) + 3, 2, 25);
check(me().z > S.arenaStartZ(2), `CONTINUE: the fighter walks through the open portal into Stage 2 (z ${me().z.toFixed(1)})`);
check(me().runStage === 1 && me().killMasks[1] !== S.STAGES[1].fullMask, 'Stage 2 is not cleared: its own portal stays shut');
const pad = S.rewardPadOf(1);
const winsBefore = me().wins;
await walkTo(fighter, me, pad.x, pad.z, 1, 25);
check(stage.enemies.every((def) => !myEnemies()[def.id].alive), 'back in Stage 1, its enemies are still down');
fighter.send(S.MessageType.ClaimStage, { stage: 1 });
await sleep(600);
check(me().wins === winsBefore + stage.reward && awarded.some((a) => a.id.startsWith('mp-fighter')), `CLAIM: the reward pad banks +${stage.reward} Win (wins ${me().wins})`);
check(respawns.some((r) => r.id.startsWith('mp-fighter') && r.reason === 'claim') && me().z < S.arenaStartZ(1) - 10, `the claim returns the fighter to base (z ${me().z.toFixed(1)})`);
check(
  me().runStage === 0 &&
    me().killMasks[0] === 0 &&
    S.ENEMIES.every((def) => myEnemies()[def.id].alive && myEnemies()[def.id].hp === def.maxHp) &&
    me().hp === me().maxHp,
  'the run resets: every enemy back at full health, every portal shut, full health',
);
check(me().bestStage >= 1, 'bestStage (the teleport reach) keeps the clear');

// ---------------------------------------------------- paid stage teleports
{
  const cost1 = S.stageTeleportCost(1);
  const before = { wins: me().wins, z: me().z };
  fighter.send(S.MessageType.Teleport, { to: 'stage1' });
  await sleep(600);
  check(before.wins < cost1 && me().wins === before.wins && Math.abs(me().z - before.z) < 1, `a Stage 1 teleport costs ${cost1} Wins: with ${before.wins} it is refused and nothing is spent`);
  check(notices.some((n) => n.id.startsWith('mp-fighter') && n.kind === 'refused' && /costs/.test(n.text)), 'and the player is told the price');

  // A second run of Stage 1 earns the second Win.
  await walkTo(fighter, me, 0, S.arenaStartZ(1) + 6, 2, 25);
  for (let round = 0; round < 400 && me().killMasks[0] !== stage.fullMask && !me().dead; round += 1) {
    let target = null;
    let best = Infinity;
    for (const def of stage.enemies) {
      const enemy = myEnemies()[def.id];
      if (!enemy.alive) continue;
      const d = Math.hypot(enemy.x - me().x, enemy.z - me().z);
      if (d < best) {
        best = d;
        target = def;
      }
    }
    if (!target) break;
    if (best > 5) {
      await walkTo(fighter, me, myEnemies()[target.id].x, myEnemies()[target.id].z, 3.5, 1);
      continue;
    }
    fighter.send(S.MessageType.Attack, { target: target.id });
    await drive(fighter, {}, 0.2);
  }
  await walkTo(fighter, me, S.rewardPadOf(1).x, S.rewardPadOf(1).z, 1, 25);
  fighter.send(S.MessageType.ClaimStage, { stage: 1 });
  await sleep(700);
  const wins = me().wins;
  check(wins >= cost1, `a second run pays the second Win (wins ${wins})`);

  fighter.send(S.MessageType.Teleport, { to: 'stage1' });
  await sleep(700);
  const entry = S.stageEntry(1);
  check(me().wins === wins - cost1 && Math.abs(me().z - entry.z) < 1.5, `with ${wins} Wins the Stage 1 teleport goes through: -${cost1} Wins (now ${me().wins}), placed at the Stage 1 entry (z ${me().z.toFixed(1)})`);
  check(me().runStage === 0 && S.ENEMIES.filter((d) => d.stage === 1).every((d) => myEnemies()[d.id].alive), 'and it starts a fresh run there, as before');
  fighter.send(S.MessageType.Teleport, { to: 'stage2' });
  await sleep(600);
  check(me().wins === wins - cost1 && me().z < S.arenaStartZ(2), `Stage 2 (${S.stageTeleportCost(2)} Wins, unaffordable) is refused`);
  fighter.send(S.MessageType.Teleport, { to: 'spawn' });
  await sleep(500);
  check(me().wins === wins - cost1 && me().z < S.arenaStartZ(1), 'village teleports stay free');
}

// ------------------------------------------------------------ forgeries
const w = watcherSelf();
const before = { wins: w.wins, katanas: w.ownedKatanas, pets: w.pets.length, rebirths: w.rebirths, forge: w.forgePercent };
watcher.send(S.MessageType.ClaimStage, { stage: 1 });
watcher.send(S.MessageType.KatanaPad, { slot: 14 });
watcher.send(S.MessageType.ForgeBuy, { rotation: watcher.state.forgeRotation, slot: 3 });
watcher.send(S.MessageType.Hatch, { egg: 4, count: 3 });
watcher.send(S.MessageType.Rebirth, {});
watcher.send(S.MessageType.Teleport, { to: 'stage7' });
const hitsBefore = hits.length;
watcher.send(S.MessageType.Attack, { target: S.STAGES[5].enemies[0].id });
await sleep(700);
const after = watcherSelf();
check(after.wins === before.wins, 'an unearned stage claim pays nothing');
check(after.ownedKatanas === before.katanas, 'a katana asked for from off its pad (and unaffordable) is not granted');
check(after.forgePercent === before.forge, 'a forge purchase away from the forge is refused');
check(after.pets.length === before.pets, 'an unaffordable hatch away from the egg hatches nothing');
check(after.rebirths === before.rebirths, 'a rebirth below the level cap is refused');
check(after.z < S.arenaStartZ(7), 'a teleport to a locked stage is refused');
check(hits.length === hitsBefore, 'a swing naming an enemy in a far stage deals nothing');

await fighter.leave();
await watcher.leave();
if (failures > 0) {
  console.log(`\n${failures} multiplayer check(s) failed.`);
  process.exit(1);
}
console.log('\nmultiplayer OK');
process.exit(0);
