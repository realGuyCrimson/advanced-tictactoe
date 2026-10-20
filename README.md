# Advanced Tic-Tac-Toe

A real-time multiplayer version of *Gobblet Junior*. Each player has six pieces: two small, two medium and two large. You can put a bigger piece over a smaller one, move your pieces around the board, and try to get three in a row. The board is drawn in pseudo-3D, and pieces lift and arc between cells.

- **Server:** Node.js, Express 5, Socket.IO 4, TypeScript. The server holds the real game state and checks every move.
- **Client:** React 19, Vite 8, Tailwind CSS 4, Motion (Framer Motion), Lucide icons, canvas-confetti.
- **Engine:** plain TypeScript with no dependencies. The server uses it to check moves and the client uses it to highlight legal cells.

## Quick start

```bash
npm install
npm run dev        # game server on :3001 + Vite on :5173 (proxying /socket.io)
```

Open <http://localhost:5173> in two browser windows. Host a game in one and join from the other with the room code, or open the invite link `http://localhost:5173/<CODE>`.

| Script              | What it does                                               |
| ------------------- | ---------------------------------------------------------- |
| `npm run dev`       | Server (tsx watch) and client (Vite) together              |
| `npm run build`     | Compiles the server (`server/dist`) and client (`client/dist`) |
| `npm start`         | Runs the built server; it also serves `client/dist` if present |
| `npm test`          | Engine unit tests + Socket.IO multiplayer integration tests |
| `npm run typecheck` | Type-checks both packages, including tests                 |

## Project layout

```text
server/src/engine/      types.ts · Board.ts · GameEngine.ts   (pure rules + validators)
server/src/rooms/       RoomManager.ts   (codes, seating, 20s grace, turns, rematch swap)
server/src/sockets/     protocol.ts (shared wire types) · registerSocketHandlers.ts
server/src/app.ts       Express + Socket.IO factory · index.ts entry point
server/test/            engine.test.ts · multiplayer.test.ts
client/public/assets/   SVG piece and wood sprites (regenerate: npm run assets -w client)
client/src/components/  Board · Cell · Piece · Reserve · FlyingPiece · StatusHud ·
                        RoomLobby · WaitingRoom · GameScreen · GameOverModal · Toast
client/src/hooks/       useGameSocket · useNow
```

The client imports the engine and protocol directly from `server/src` through the `@shared` alias, so both sides always run the same rules.

## Rules

- On your turn, either **place** a piece from your reserve or **move** one of your visible pieces. The target cell must be empty or have a strictly smaller piece on top. You may cover your own pieces. Pieces of the same size can't cover each other.
- Only the top piece of a stack counts. Three of your visible pieces in a row, column or diagonal wins, whatever their sizes.
- The win check runs on the board after the moved piece has landed. This settles the uncovering cases:
  - If lifting a piece uncovers the opponent's line, the opponent wins, unless the moved piece lands on that line and breaks it.
  - If lifting a piece uncovers your own piece and that completes your line, you win.
  - If both players have a line after a move, the game is a draw.
- A player with no reserve pieces left keeps playing by moving pieces on the board.

## Multiplayer protocol

From client to server: `CREATE_ROOM`, `JOIN_ROOM`, `REJOIN_ROOM`, `PLACE_PIECE`, `MOVE_PIECE`, `SET_REMATCH`, `LEAVE_ROOM`.
From server to client: `ROOM_JOINED`, `GAME_STATE_UPDATE`, `MOVE_ERROR`, `ROOM_ERROR`, `ROOM_CLOSED`.

- Room codes are 5 uppercase characters with no `0`, `O`, `1` or `I`. The host plays Red and moves first. The first person to join plays Blue. Anyone else who tries to join gets a `ROOM_FULL` error.
- The session token is kept in `sessionStorage`. After a refresh or a dropped connection, the player has 20 seconds to take their seat back. If they don't, the room closes.
- After a game ends, a rematch starts only when both players accept it. Colours swap, and the new Red moves first. If either player leaves, the room closes and both players go back to the lobby.

## Deployment

Netlify only serves static files. It can't run a long-lived WebSocket server, so the game is deployed in two parts.

### 1. Game server on Render (free tier)

1. In Render, choose **New → Blueprint** and select this GitHub repo. Render reads `render.yaml`.
2. The service is named `tttadv-server`, so its address will be `https://tttadv-server.onrender.com`. If Render gives you a different address, note it down for step 2.
3. Open `https://<your-service>.onrender.com/health` and check that it returns `{"ok":true,...}`.

`tttadv.netlify.app`, its deploy previews and `localhost` are always allowed to connect. To allow other sites, add their addresses, separated by commas, to the `CLIENT_ORIGINS` setting. The Render service also serves the built client, so its own URL is a complete, playable copy of the game.

Any host that runs Docker will also work, using the `Dockerfile` in this repo (Fly.io, Railway, Koyeb, a VPS, and so on).

### 2. Client on Netlify

1. In Netlify, choose **Add new site → Import from Git** and select this repo. `netlify.toml` already sets:
   - the build command `npm run build:client`
   - the publish directory `client/dist`
   - Node 22
   - a fallback rule so links like `/ABCDE` load the app
2. `netlify.toml` points the client at `https://tttadv-server.onrender.com` through `VITE_SERVER_URL`. If your server has a different address, set `VITE_SERVER_URL` under **Site configuration → Environment variables**, then redeploy.
3. Set the site name to `tttadv` so it's served at <https://tttadv.netlify.app>.

Render's free tier puts the server to sleep when nobody is using it. The first visitor after a quiet period waits about 30 seconds, and the lobby shows a "Connecting to game server…" message during that time.
