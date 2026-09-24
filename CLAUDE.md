# +1 Katana Evolution

Browser multiplayer samurai "+1" game: Three.js client, Colyseus server, npm workspaces
(`shared` / `server` / `client`). Infrastructure (Bloxity auth, persistence, Bux grants, deploy)
follows the earlier Bloxity "+1" games; gameplay, world and UI are this game's own.

## Commands

```bash
npm run dev                 # builds shared, then server (tsx watch, :2587) + Vite client (:5187)
npm run build               # shared + server + client (client/dist)
npm run typecheck           # all workspaces
npm run verify              # verify:progression + verify:assets
npm run verify:capacity     # needs a running server on :2587; expects 15-per-room routing
npm run verify:multiplayer  # needs a running server; the full stage run (attack, death, clear, continue, claim, reset), privacy, forgeries
npm run verify:persistence  # identity/storage/migration/purchases, JSON and Mongo (if mongod is found)
npm run size:client         # client/dist size against the 12 MB budget
npm run verify:docker       # applies .dockerignore and proves every Dockerfile COPY source is in the context
```

Do NOT use python from the Bash tool on this machine (Windows Store stub stalls). Use node/sed/perl.
Never commit or push: the user handles git.

## Non-negotiable rules

- Ports: server **2587**, Vite **5187**, preview 4187. Room `katanaevolution`, 15 per room.
- **Bloxity game id `katana-evolve`**, set ONCE in `deploy.yml` (`BLOXITY_GAME_ID`). It reaches the client as
  `VITE_BLOXITY_GAME_ID` at build time and the server as the `BLOXITY_GAME_ID` Legion injects into the pod. The
  code fallbacks (`shared/src/config/accounts.ts`, `client/src/bloxity/Bloxity.ts`) still say `katana-evolution`
  and only apply when neither is set, i.e. local dev.
- **Client build must stay under 12 MB** (currently ~4.0 MB, 2.4 MB of it the music). World textures are canvas-drawn
  (`client/src/world/WorldTextures.ts`). Only `assets/` ships as files; `scripts/verify-assets.mjs` pins their digests.
- **Server-authoritative everything.** Clients send inputs and requests (move, attack hint, pad, buy, hatch,
  rebirth, teleport); the server simulates, validates and derives. `ProgressionService.syncDerived` is the ONLY
  writer of level/damage/speed; `ProgressionService` is the only XP granter.
- **XP**: walking (1 per 3.2-unit grounded stride) AND every katana swing the rate limit accepts
  (`XP_PER_SWING` = 1, grounded or airborne, landed or not) plus `XP_PER_HIT` x target factor on a landed hit.
  All x the rebirth XP multiplier, clamped at the rebirth's level cap. Hits reach mid-jump (|y| <= 10).
- **Damage = katana x training x level x forge x pets x rebirth** (`shared/src/config/damage.ts`). Pinned by
  `verify:progression`: L9 needs 520 XP (~1.4K damage with Katana 2, 25 speed), L10 799 (~1.7K, 26).
- The client XP popup (`client/src/combat/XpPopups.ts`, `assets/ui/Katana.png`) shows the rise of the
  replicated `lifetimeXp`, so it can never award or invent XP; rapid gains merge, at most 4 on screen.
- Client prediction replays `stepPlayer` and reconciles. Test harnesses must feed input at real-time pace.
- No health bars above enemies: the top-centre target bar shows name + health.
- **Responsive HUD: one unit** `--u` (`client/src/ui/hudStyles.ts`). The Wins/rebirth indicators and the button
  rail are ONE group, `.aoe-dock`: left edge, vertically centred, indicators above the tiles. The dock takes no
  pointer events; `.aoe-rail` re-enables them, so only the tiles are click targets.
- **No overlapping solids.** Every solid lives in `shared/src/config/map.ts` (`buildStaticSolids`) and
  `decor.ts` (`decorSolids`); the client draws to match.

## Layout facts (`shared/src/config/map.ts`)

- Spawn (0, 0, 0) faces +Z; the camera's RIGHT is world -X.
- Katana Stage on the RIGHT (x -38..-78): three storeys, 14 pads.
- **Training directly LEFT** (x 20..34, z -20..28): three small pockets open toward the spawn - Cultist (z<-4),
  Dojo, Basic (z>12) - each a U of raised dressing beds packed with its own biome around two dummies, low walls
  between, a stepped hill behind. Dressing is client-only in `client/src/world/TrainingArea.ts`.
- Scoreboards dead centre of the back wall (x -15/0/15, z -71.8), straight behind the spawn. Forge back-left
  (x 27..59) with an open lawn before its counter; Pets Shop back-right.
- Training meshes meet edge to edge (floor pieces, beds, trims, walls = exactly the solids): never let two
  faces share a plane, or they flicker.
- Stage road through the torii at z 40: 10 arenas, red portals until cleared.

## Stage runs (`server/src/progression/CombatService.ts`)

- Every player fights their OWN copy of every enemy: `PlayerState.enemies` is `@view()`, and each client's
  StateView holds only its own player, so nobody else's enemies are ever replicated to them or touched by them.
- A RUN starts at every placement (`GameRoom.placeAt` -> `combat.resetRun`): join, death, claim, teleport,
  rebirth. All enemies back at their posts at full health, `killMasks` 0, `runStage` 0, health full.
  A stage teleport then `startRunAt(k)`: stages before k count as cleared.
- In a stage (its arena plus its exit portal recess, `fightingStageAt`) every live enemy of that stage chases
  the player - no aggro radius, no leash; a sealed boss holds its post until its wave is down. Enemy swings
  take `def.damage` (20% of the stage's recommended damage, boss 32%) off `hp`; health = `maxHealthFor(damage)`
  = 100 + 5 x damage, refilled in the village. At 0 hp the player is `dead` (replicated): held still, no
  swings/claims/teleports, for `DEATH_RESPAWN_SECONDS` (2.4) so the client death animation
  (`DEATH_ANIMATION_SECONDS`, 2.1, `PlayerCharacter.setDead`: topple at the feet, sink, spirit lights) always
  finishes first; then `placeAt(SPAWN, 'death')`.
- Nothing respawns mid-run. A full wave sets `runStage` (the portal gate for movement, client prediction and
  camera) and arms the reward pad; a claim pays Wins, then `placeAt(SPAWN, 'claim')`. `bestStage` (persisted)
  is only how far the Teleport menu reaches. A stage teleport also COSTS Wins (`stageTeleportCost`,
  `shared/src/config/teleport.ts`: 2, 6, 20 ... 320M for Stages 1-19), spent server-side in `onTeleport`;
  the menu lists only the stages that exist and never goes past Stage 20. Village teleports are free.
- Win shrine (`REWARD_SHRINE` in map.ts, `buildShrine` in StageRoad): dais + torii pillars + lanterns are solids;
  a claim plays `TrophyBurst` (trophy.png ring flying into the player).
- Audio (`client/src/audio/AudioManager.ts`, local player only): music `samurai.mp3`, two crossfading `<audio>`
  voices (gapless loop); swing `katana.mp3`, enemy kill `enemy death.mp3`, death `fall.mp3` (also the hard landing).
  A sample replaces its own previous take (40 ms fade) and has a cooldown, so rapid swings never pile up.
- Rare-katana aura (`client/src/katana/KatanaFx.ts`): additive sprites in the shop halo colour, by band -
  1-2 none, 3-5 glow, 6-8 breathing glow, 9-11 + spiral sparks, 12-14 + tip flare and more sparks.
- Boards: Most Wins (`lifetimeWins`), Most Damage, Most Time (`playSeconds`, `formatPlayTime`).

## Deploy (Bloxity Hosting)

`.github/workflows/deploy.yml`: `dev` -> DEV, `main` -> PROD, nothing else. Server -> GHCR image
`ghcr.io/<owner>/katana-evolve-server:<channel>-<sha>`, rolled with `POST legion.bloxity.io/v1/apps/katana-evolve/deploy`
(channel, image, version = commit sha, seatCap 15, maxReplicas 5). Client -> Vite build with `VITE_SERVER_URL`
baked in, zipped with `index.html` AT THE ROOT, uploaded raw (`Content-Type: application/zip`) to
`POST api.bloxity.io/v1/hosting/games/katana-evolve/frontend?channel=<channel>&version=<sha>`. Both routes are
the documented ones and were checked live (401/400, not 404). The only secret is `LEGION_DEPLOY_TOKEN`; no
repository variables. `PORT` and `/health` are the host's contract - do not change them.

## Progress and identity

Per-key storage (`server/src/persistence/`), Mongo via `MONGODB_URI` else JSON (`KATANA_DATA_DIR`),
profile read at join, identity = Bloxity token verified server-side, guest -> account migration,
webhook-recorded Bux grants (`wins_small`, `wins_large`).

## Verification before calling anything done

`npm run typecheck && npm run verify && npm run build:client && npm run size:client`, then
`npm run verify:capacity` and `npm run verify:multiplayer` against a running dev server, and
`npm run verify:persistence` after any change to auth, persistence, join/leave/switch paths or the webhook.
