import { ArraySchema, Schema, type } from '@colyseus/schema';
import { ENEMIES } from '@katana/shared';

/**
 * One enemy of ONE player's run. Position and health are the server's;
 * `hits` and `swings` are counters so the client can play each flinch and
 * each attack exactly once.
 */
export class EnemyState extends Schema {
  @type('uint16') id = 0;
  @type('float32') x = 0;
  @type('float32') z = 0;
  @type('float32') yaw = 0;
  @type('float64') hp = 0;
  @type('boolean') alive = true;
  @type('boolean') moving = false;
  @type('uint16') hits = 0;
  @type('uint16') swings = 0;
}

/** A full set: every enemy of every stage, at its post, at full health. */
export const enemyStates = (): ArraySchema<EnemyState> => {
  const list = new ArraySchema<EnemyState>();
  for (const def of ENEMIES) {
    const enemy = new EnemyState();
    enemy.id = def.id;
    enemy.x = def.x;
    enemy.z = def.z;
    enemy.yaw = Math.PI;
    enemy.hp = def.maxHp;
    list.push(enemy);
  }
  return list;
};
