import { Encoder } from '@colyseus/schema';

/**
 * THE STATE ENCODER'S BUFFER, sized so the full state can never overflow it.
 *
 * Every room encodes its state into buffers of `Encoder.BUFFER_SIZE` bytes
 * (Node's 8 KB pool size by default). @colyseus/schema 3.0.x is supposed to
 * grow into a bigger buffer when the state does not fit, but for a client with
 * a StateView - every client here, for its private enemies - `encodeAllView`
 * re-slices the ORIGINAL buffer after the encoder has grown into a new one.
 * A player joining a busy room is then silently sent only the first 8 KB of
 * the state; its own player is encoded last, so that is what gets cut: no
 * enemies, no level-ups, `"refId" not found` in the client's decoder.
 *
 * So the overflow path must never run. A full 15-player room with logged-in
 * players and full leaderboards is on the order of 20 KB; 128 KB leaves ample
 * headroom for both the full state and any single patch. Two such buffers per
 * room is a trivial amount of memory.
 *
 * Must be set before the first room is created: each room sizes its buffers
 * from this static when it starts. `index.ts` imports this module first.
 * `npm run verify:large-room` guards it.
 */
export const STATE_BUFFER_BYTES = 128 * 1024;

Encoder.BUFFER_SIZE = STATE_BUFFER_BYTES;
