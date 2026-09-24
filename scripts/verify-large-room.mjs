/**
 * A PLAYER JOINING A BUSY ROOM MUST RECEIVE ITS OWN STATE, against a RUNNING server.
 *
 * The full state a joining client is sent is encoded into a fixed-size buffer.
 * In @colyseus/schema 3.0.x, when that state is larger than the buffer AND the
 * client has a StateView (our private per-player enemies), `encodeAllView`
 * re-slices the ORIGINAL buffer after the encoder has grown into a new one - so
 * the joiner is silently sent only the first BUFFER_SIZE bytes. The joiner's own
 * player is encoded last, so it is what gets cut: no enemies, no level-ups.
 *
 * Locally the join handshake is so fast that the joiner's player still rides the
 * next patch and the bug hides. Across the internet it does not. So this test
 * (1) fills a room until the state is past the old 8 KB limit and (2) delays the
 * joiner's handshake like a real network, then checks the joiner got everything.
 *
 * Needs a running server (`npm run dev`), default ws://localhost:2587.
 */
import { Client, Room } from 'colyseus.js';
import * as S from '../shared/dist/index.js';

const ENDPOINT = process.env.ENDPOINT ?? 'ws://localhost:2587';
/** Players already in the room before the joiner arrives. */
const HOLDERS = Number(process.env.HOLDERS ?? 13);
/** How late the joiner acknowledges JOIN_ROOM, like a client across the internet. */
const JOIN_DELAY_MS = Number(process.env.JOIN_DELAY_MS ?? 300);
/** The encoder's old default buffer: the state must be bigger than this to prove anything. */
const OLD_LIMIT = 8 * 1024;
/** Colyseus protocol codes. */
const JOIN_ROOM = 10;
const ROOM_STATE = 14;

let failures = 0;
const check = (condition, message) => {
  if (condition) console.log(`  ok    ${message}`);
  else {
    failures += 1;
    console.log(`  FAIL  ${message}`);
  }
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Measure each room's full state, and hold back the joiner's JOIN_ROOM acknowledgement.
const fullStateBytes = new Map();
const delayed = new Set();
const original = Room.prototype.onMessageCallback;
Room.prototype.onMessageCallback = function (event) {
  const data = event?.data;
  const bytes = new Uint8Array(data instanceof ArrayBuffer ? data : (data?.buffer ?? data));
  if (bytes[0] === ROOM_STATE && !fullStateBytes.has(this)) fullStateBytes.set(this, bytes.byteLength);
  if (bytes[0] === JOIN_ROOM && delayed.has(this.name)) {
    setTimeout(() => original.call(this, event), JOIN_DELAY_MS);
    return;
  }
  return original.call(this, event);
};

const quiet = (room) => {
  for (const type of ['respawn', 'authState', 'hit', 'stageCleared', 'stageAwarded', 'hatched', 'notice']) room.onMessage(type, () => {});
};

// Anonymous clients (no playerId): nothing is saved and nothing reaches the leaderboards.
const holders = [];
for (let i = 0; i < HOLDERS; i += 1) {
  const room = await new Client(ENDPOINT).joinOrCreate(S.ROOM_NAME, {});
  quiet(room);
  holders.push(room);
  await sleep(120);
}
await sleep(600);

delayed.add(S.ROOM_NAME);
const joiner = await new Client(ENDPOINT).joinOrCreate(S.ROOM_NAME, {});
quiet(joiner);
await sleep(1500);

const size = fullStateBytes.get(joiner) ?? 0;
const inRoom = joiner.state.players.size;
check(size > OLD_LIMIT, `the joiner's full state is past the old ${OLD_LIMIT}-byte limit (${size} B, ${inRoom} players in the room)`);

const me = () => joiner.state.players.get(joiner.sessionId);
check(me() !== undefined && me().z !== undefined && me().level >= 1, `the joiner's OWN player decoded (level ${me()?.level}, z ${me()?.z})`);
check(me()?.enemies?.length === S.ENEMIES.length, `the joiner received all of its own enemies (${me()?.enemies?.length ?? 'none'} / ${S.ENEMIES.length})`);

// And it keeps receiving its own updates: walking pays XP it can see.
const xp0 = me()?.lifetimeXp ?? 0;
let seq = 0;
for (let i = 0; i < 90; i += 1) {
  seq += 1;
  joiner.send(S.MessageType.Move, { seq, dt: 1 / 60, moveX: 0, moveZ: 1, jump: false, cameraYaw: 0 });
  if (i % 4 === 3) await sleep(66);
}
await sleep(600);
check((me()?.lifetimeXp ?? 0) > xp0, `the joiner sees its own XP rise (${xp0} -> ${me()?.lifetimeXp})`);

for (const room of [...holders, joiner]) await room.leave();
if (failures > 0) {
  console.log(`\n${failures} large-room check(s) failed.`);
  process.exit(1);
}
console.log('\nlarge room OK');
process.exit(0);
