import { arenaStartZ } from './map.js';

/**
 * THE ENEMY STAGES: ten arenas down the stage road, each holding a small
 * group of named enemies, played as RUNS.
 *
 * Every player fights their OWN copy of every stage's enemies (replicated to
 * that player alone), so nobody else's fight touches theirs. A run starts
 * whenever the player is placed at base: every enemy of every stage stands at
 * its post at full health. Stepping into a stage turns all of that stage's
 * enemies on the player at once, wherever they stand in it; each swings for
 * the stage's own damage and the player can die. Defeating EVERY enemy of a
 * stage (its boss included) clears it for the rest of the run - nothing
 * respawns mid-run - which opens the portal to the next stage and arms the
 * stage's reward pad. Then the player either walks on through the portal or
 * claims the pad's Wins, which ends the run. A claim or a death returns the
 * player to base, and that starts a fresh run.
 *
 * A boss is SEALED until the rest of its wave is down: it waits at its post,
 * and hits on it are refused by the server.
 */
export type StageTheme =
  | 'bamboo'
  | 'temple'
  | 'oni'
  | 'sakura'
  | 'frost'
  | 'ember'
  | 'marsh'
  | 'thunder'
  | 'shadow'
  | 'shogun';

/** What an enemy looks like; the client builds it from this id. */
export type EnemyLook =
  | 'ronin'
  | 'bandit'
  | 'ashigaru'
  | 'oni'
  | 'kunoichi'
  | 'samurai'
  | 'frost'
  | 'monk'
  | 'fireoni'
  | 'kappa'
  | 'tengu'
  | 'raijin'
  | 'ninja'
  | 'guard'
  | 'hatamoto'
  | 'boss-oni'
  | 'boss-flame'
  | 'boss-storm'
  | 'boss-shogun';

export interface EnemyDef {
  /** Global id: the index into ENEMIES and the key of the replicated enemy. */
  readonly id: number;
  readonly stage: number;
  /** Bit of this enemy in its stage's kill mask. */
  readonly bit: number;
  readonly name: string;
  readonly look: EnemyLook;
  readonly boss: boolean;
  readonly maxHp: number;
  /** Home post: where it spawns, and where it walks back to. */
  readonly x: number;
  readonly z: number;
  /** Drawn size, relative to a player. */
  readonly scale: number;
  /** Walk speed, world units per second. */
  readonly speed: number;
  /** Radius the server tests a katana hit against. */
  readonly radius: number;
  /** Health one of its swings takes off the player. */
  readonly damage: number;
}

export interface StageDef {
  readonly index: number;
  readonly name: string;
  readonly theme: StageTheme;
  readonly recommendedDamage: number;
  /** Wins banked on the reward pad per clear. */
  readonly reward: number;
  readonly enemies: readonly EnemyDef[];
  /** Mask with every enemy's bit set: a full clear. */
  readonly fullMask: number;
  /** Mask of every non-boss enemy: what unseals the boss. */
  readonly waveMask: number;
}

interface StagePlan {
  readonly name: string;
  readonly theme: StageTheme;
  readonly recommendedDamage: number;
  readonly reward: number;
  readonly wave: readonly (readonly [string, EnemyLook, number])[];
  readonly boss?: readonly [string, EnemyLook];
}

/** Normal enemies take about six recommended-damage hits; a boss about forty-five. */
const HITS_PER_ENEMY = 6;
const HITS_PER_BOSS = 45;

/**
 * What an enemy swing takes off the player, as a share of its stage's
 * recommended damage. Player health is `100 + 5 x damage` (`maxHealthFor`),
 * so a player AT the recommended damage has ~5 x R health, and a wave hits
 * for a fifth of R a swing (a boss about a third): with the whole wave on them,
 * felled one at a time, a player at the recommendation ends a six-enemy stage
 * or a boss stage on 10-20% of their health, and anyone meaningfully below it
 * dies. A stage too far ahead is lethal in seconds. Enemy damage and health
 * both scale x7.5 to x10 per stage, exactly as the recommendations do.
 */
export const ENEMY_HIT_SHARE = 0.2;
export const BOSS_HIT_SHARE = 0.32;

const hitFor = (recommended: number, boss: boolean): number =>
  Math.max(1, Math.round(recommended * (boss ? BOSS_HIT_SHARE : ENEMY_HIT_SHARE)));

const PLANS: readonly StagePlan[] = [
  { name: 'Bamboo Grove', theme: 'bamboo', recommendedDamage: 40, reward: 1, wave: [['Rookie Ronin', 'ronin', 5]] },
  {
    name: 'Lantern Temple',
    theme: 'temple',
    recommendedDamage: 300,
    reward: 4,
    wave: [['Straw Hat Bandit', 'bandit', 3], ['Spear Ashigaru', 'ashigaru', 3]],
  },
  {
    name: 'Oni Fortress',
    theme: 'oni',
    recommendedDamage: 2_000,
    reward: 20,
    wave: [['Oni Grunt', 'oni', 5]],
    boss: ['Akaoni the Crusher', 'boss-oni'],
  },
  {
    name: 'Sakura Valley',
    theme: 'sakura',
    recommendedDamage: 15_000,
    reward: 150,
    wave: [['Kunoichi Shade', 'kunoichi', 3], ['Sakura Samurai', 'samurai', 3]],
  },
  {
    name: 'Frost Shrine',
    theme: 'frost',
    recommendedDamage: 150_000,
    reward: 1_200,
    wave: [['Frost Ashigaru', 'frost', 3], ['Yuki Monk', 'monk', 3]],
  },
  {
    name: 'Ember Forge',
    theme: 'ember',
    recommendedDamage: 1_500_000,
    reward: 12_000,
    wave: [['Fire Oni', 'fireoni', 5]],
    boss: ['Kagutsuchi, Flame Lord', 'boss-flame'],
  },
  {
    name: 'Spirit Marsh',
    theme: 'marsh',
    recommendedDamage: 15_000_000,
    reward: 150_000,
    wave: [['Kappa Warrior', 'kappa', 3], ['Swamp Tengu', 'tengu', 3]],
  },
  {
    name: 'Thunder Peaks',
    theme: 'thunder',
    recommendedDamage: 150_000_000,
    reward: 2_000_000,
    wave: [['Raijin Drummer', 'raijin', 5]],
    boss: ['Raijin, Storm King', 'boss-storm'],
  },
  {
    name: 'Shadow Castle',
    theme: 'shadow',
    recommendedDamage: 1_500_000_000,
    reward: 30_000_000,
    wave: [['Shadow Ninja', 'ninja', 3], ['Shogun Guard', 'guard', 3]],
  },
  {
    name: "Shogun's Keep",
    theme: 'shogun',
    recommendedDamage: 15_000_000_000,
    reward: 1_000_000_000,
    wave: [['Elite Hatamoto', 'hatamoto', 5]],
    boss: ['The Demon Shogun', 'boss-shogun'],
  },
];

/** Where the wave stands, relative to the arena's centre line: spread out, never in a file. */
const POSTS: readonly (readonly [number, number])[] = [
  [-15, -10],
  [15, -10],
  [0, -1],
  [-9, 11],
  [9, 11],
  [0, 22],
];
const BOSS_POST: readonly [number, number] = [0, 36];

const build = (): { stages: StageDef[]; enemies: EnemyDef[] } => {
  const stages: StageDef[] = [];
  const enemies: EnemyDef[] = [];
  PLANS.forEach((plan, index) => {
    const stage = index + 1;
    const centreZ = arenaStartZ(stage) + 40;
    const list: EnemyDef[] = [];
    let bit = 0;
    for (const [name, look, count] of plan.wave) {
      for (let i = 0; i < count; i += 1) {
        const post = POSTS[bit % POSTS.length]!;
        list.push({
          id: enemies.length + list.length,
          stage,
          bit,
          name,
          look,
          boss: false,
          maxHp: plan.recommendedDamage * HITS_PER_ENEMY,
          x: post[0],
          z: centreZ + post[1],
          scale: 1,
          speed: 7 + Math.min(stage, 8) * 0.25,
          radius: 1.2,
          damage: hitFor(plan.recommendedDamage, false),
        });
        bit += 1;
      }
    }
    const waveMask = (1 << bit) - 1;
    if (plan.boss) {
      list.push({
        id: enemies.length + list.length,
        stage,
        bit,
        name: plan.boss[0],
        look: plan.boss[1],
        boss: true,
        maxHp: plan.recommendedDamage * HITS_PER_BOSS,
        x: BOSS_POST[0],
        z: centreZ + BOSS_POST[1],
        scale: 2.4,
        speed: 6,
        radius: 2.6,
        damage: hitFor(plan.recommendedDamage, true),
      });
      bit += 1;
    }
    enemies.push(...list);
    stages.push({
      index: stage,
      name: plan.name,
      theme: plan.theme,
      recommendedDamage: plan.recommendedDamage,
      reward: plan.reward,
      enemies: list,
      fullMask: (1 << bit) - 1,
      waveMask,
    });
  });
  return { stages, enemies };
};

const BUILT = build();

export const STAGES: readonly StageDef[] = BUILT.stages;
export const ENEMIES: readonly EnemyDef[] = BUILT.enemies;
export const STAGE_COUNT = STAGES.length;

export const stageByIndex = (index: number): StageDef | undefined => STAGES[Math.floor(index) - 1];

/** XP factor of a hit on an enemy: its stage number, tripled for a boss. */
export const enemyXpFactor = (enemy: EnemyDef): number => enemy.stage * (enemy.boss ? 3 : 1);

/** How enemies close in and swing. */
export const ENEMY_AI = {
  /** How close an enemy walks to its target before it swings. */
  reach: 2.6,
  /** Slack on that reach for the swing to land (the player keeps moving). */
  hitSlack: 1.4,
  swingSeconds: 1.3,
  /** The first swing after closing in comes this much sooner. */
  firstSwingSeconds: 0.6,
} as const;
