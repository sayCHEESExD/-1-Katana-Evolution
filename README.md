# +1 Katana Evolution

A browser multiplayer samurai "+1" game set in a Japanese open world. Walk and swing your katana to
level up, cut down enemy waves stage by stage for Wins, spend Wins on stronger katanas, train on
dummies, forge upgrades, hatch Yokai pets and rebirth for higher level caps.

Three.js client, authoritative Colyseus server (15 players per room), hosted on Bloxity.

## Play

| Action | PC | Mobile |
| --- | --- | --- |
| Walk | WASD / arrows | left stick |
| Look | mouse | drag |
| Jump | Space | JUMP button |
| Swing katana | left click | SLASH button |
| Auto click | G | AUTO CLICK toggle |
| Store / Rebirth / Pets / Teleport / Stats / Music | B / R / P / T / I / M | rail tiles |

## The game

- **Levels.** Walking and every katana swing (on the ground or mid-jump) earn XP; each gain pops a
  katana "+1!" beside you. Levels raise damage and speed.
- **Damage** = katana x training x level x forge x pets x rebirth, all decided by the server.
- **Katana Stage** (right of spawn): fourteen floating katanas on three storeys, bought with Wins.
- **Training** (directly left of spawn): three small pockets - Basic (x1, x2), Dojo (x3, x5) and Cultist
  (x10, x25) - with rebirth gates. Master a dummy by training on it.
- **Stages** (ahead, through the torii): ten arenas of named enemies and bosses, played as runs. Step into a
  stage and every enemy in it comes for you; they hit harder stage by stage and can kill you. Clear the
  whole wave to open the red portal, then walk on to the next stage or claim the stage's Wins on its reward
  pad. A claim or a death sends you home and resets the run.
- **Forge** (behind spawn): a rotating stock of permanent damage upgrades, restocked every 5 minutes.
- **Pets** (behind-right): four eggs of Yokai pets, up to three equipped.
- **Rebirth**: resets your level for a higher level cap, more speed, damage and XP.
- **Leaderboards**: Most Wins, Most Damage and Most Time (play time) on the back wall.

## Develop

```bash
npm install
npm run dev
```

Client on http://localhost:5187, server on :2587. See `CLAUDE.md` for the rules, verification scripts and
layout facts.

## Deploy (Bloxity Hosting)

`.github/workflows/deploy.yml` publishes on every push:

| Branch | Channel | Frontend | Backend (WebSocket) |
| --- | --- | --- | --- |
| `dev` | DEV | https://katana-evolution.dev.play.bloxity.io | wss://katana-evolution.dev.host.bloxity.io |
| `main` | PROD | https://katana-evolution.play.bloxity.io | wss://katana-evolution.host.bloxity.io |

Any other branch does not deploy. A manual run (Actions, "Run workflow") follows the same mapping.

- **Backend:** the Colyseus server is built from the root `Dockerfile` and pushed to
  `ghcr.io/<owner>/katana-evolution-server:<channel>-<sha>`. It is rolled with
  `POST https://legion.bloxity.io/v1/apps/katana-evolution/deploy`, using the commit SHA as the version,
  `seatCap` 15 (the room size) and `maxReplicas` 5. Legion injects `PORT` and `MONGODB_URI`, and
  probes `/health`.
- **Frontend:** `client/dist` is built with that channel's WebSocket URL baked in, zipped with
  `index.html` at the root, and uploaded raw to
  `POST https://api.bloxity.io/v1/hosting/games/katana-evolution/frontend?channel=<channel>&version=<sha>`.

One-time setup:

1. Create the game `katana-evolution` on https://hosting.bloxity.io (My Games).
2. Add the repository secret `LEGION_DEPLOY_TOKEN` (the token from My Games, behind the eye icon).
3. After the first run, make the GHCR package `katana-evolution-server` public so Legion can pull it:
   GitHub -> your profile -> Packages -> `katana-evolution-server` -> Package settings -> Change
   visibility -> Public. The repository itself can stay private; a package visibility is independent of it.

If the game loads but says **"Not connected to the game server"**, the FRONTEND is fine and the backend is
not running. Check it directly:

```bash
curl https://katana-evolution.dev.host.bloxity.io/health
```

- `503 game backend unreachable` - the pod is not up. In order of likelihood: the GHCR package is still
  **private** (Legion pulls anonymously, so it cannot start the image), the `server` job of the workflow
  failed, or the container exits on boot (the channel logs on the Bloxity dashboard say which). The
  workflow reports the first two itself - see "Check the image can be pulled anonymously" and "Wait for the
  backend to answer /health" in the run.
- `200` - the backend is live, and the problem is the `VITE_SERVER_URL` baked into the client.

Progress lives in the Legion-injected MongoDB, per channel, so deploys never reset players.
