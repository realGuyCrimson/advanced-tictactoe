You are an expert full-stack TypeScript engineer. Build a complete, production-ready, real-time multiplayer web game: **Advanced Tic-Tac-Toe** (commercially known as *Gobblet Junior*). 

The repository must contain both the server and client codebase with complete game engine logic, server-authoritative validation, WebSocket synchronization, and a high-performance pseudo-3D (2.5D isometric) interface with elevation physics and animations.

---

### 1. Game Rules & Mechanics Specification

#### A. Components & Setup
- **Board:** $3 \times 3$ grid (indices 0 to 8).
- **Players:** 2 players (Host = Red, Joiner = Blue).
- **Inventory (Reserve):** Exactly 6 pieces per player:
  - 2 Large (tier 3)
  - 2 Medium (tier 2)
  - 2 Small (tier 1)
- **Hierarchy:** Strict dominance:
  - Large (3) covers Medium (2) or Small (1).
  - Medium (2) covers Small (1).
  - Small (1) cannot cover anything.
  - Pieces of equal size CANNOT cover each other.
  - Self-gobbling is legal (a player can cover their own smaller piece).
- **Cell Structure:** Each cell is a LIFO stack supporting up to 3 nested layers. Only the top piece controls the cell and counts toward winning lines.

#### B. Turn Actions
On their turn, the active player must perform exactly ONE action:
1. **Action A (Spawn from Reserve):** Select an available piece from their reserve and place it on an empty cell OR over a strictly smaller top piece.
2. **Action B (Move on Board):** Select one of their own visible/top pieces currently on the board and move it to any other empty cell OR over a strictly smaller top piece.
   - Moving a piece uncovers whatever was underneath it, immediately reactivating that underlying piece.

#### C. Win & Draw Conditions
- **Win:** First player to form an unbroken orthogonal or diagonal line of 3 visible pieces of their color (horizontal, vertical, diagonal). Size does not matter for the line.
- **Uncovering Rules (Crucial Edge Cases):**
  - If a player lifts a piece from cell A to cell B, and uncovering cell A reveals an opponent's piece that completes 3-in-a-row for the opponent:
    - If the piece moved to cell B does NOT cover another piece in that winning line to break it, the opponent immediately wins.
  - If uncovering cell A reveals the moving player's own piece completing 3-in-a-row, the moving player wins immediately.
- **Simultaneous Win:** If a completed move results in both players having 3-in-a-row at the same time, the game ends in a **Draw**.
- **Exhausted Reserves:** When a player has 0 reserve pieces, they continue playing using Action B (moving pieces on the board).

---

### 2. Architecture & Tech Stack

#### Tech Stack Documentation References
- **Backend:** Node.js, Express, TypeScript, and [Socket.IO Docs](https://socket.io/docs/v4/).
- **Frontend:** React, TypeScript, [Vite Documentation](https://vite.dev/guide/), and [Tailwind CSS Documentation](https://tailwindcss.com/docs).
- **Motion & Physics:** [Framer Motion Docs](https://motion.dev/) for 2.5D spring elevation and arc animations.
- **Icons & Polish:** [Lucide Icons](https://lucide.dev/) and [Canvas Confetti GitHub](https://github.com/catdad/canvas-confetti).

#### Official GitHub Repositories for Reference
- **Real-Time WebSockets:** [Socket.IO Repository](https://github.com/socketio/socket.io)
- **Animation & Physics Engine:** [Motion / Framer Motion Repository](https://github.com/motiondivision/motion)
- **UI Celebration Effects:** [Canvas Confetti Repository](https://github.com/catdad/canvas-confetti)
- **Frontend Build Tool:** [Vite Repository](https://github.com/vitejs/vite)
- **Styling Framework:** [Tailwind CSS Repository](https://github.com/tailwindlabs/tailwindcss)
- **UI Icon Set:** [Lucide Icons Repository](https://github.com/lucide-icons/lucide)

#### Project Structure (Monorepo)
```text
├── server/
│   ├── src/
│   │   ├── engine/       # Pure TypeScript game engine & rule validators
│   │   │   ├── types.ts
│   │   │   ├── Board.ts
│   │   │   └── GameEngine.ts
│   │   ├── rooms/        # Room manager & connection lifecycle
│   │   │   └── RoomManager.ts
│   │   ├── sockets/      # Socket.IO handlers
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
├── client/
│   ├── public/assets/    # Preloaded isometric piece and board sprites
│   ├── src/
│   │   ├── components/   # Board, Reserve, RoomLobby, GameOverModal, Cell
│   │   ├── hooks/        # useGameSocket
│   │   ├── types/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── package.json          # Root scripts (build, dev, start)
└── tsconfig.base.json

```

---

### 3. Multiplayer Flow & Room Specification

1. **Lobby & Identification:**
* Prompt user for a username (store in `localStorage`).
* Options: "Host Game" or "Join Game".
* If "Host Game": Server generates an uppercase 5-character room code (avoiding ambiguous chars like `0`, `O`, `1`, `I`).
* Room URL support: Direct navigation to `website.tld/<roomcode>` automatically opens the room and prompts to join.


2. **Room Capacity & Player Allocation:**
* Maximum 2 players per room:
* Creator = **Red** (goes first in Round 1).
* 1st Joiner = **Blue** (goes second in Round 1).


* Reject any 3rd connections with a "Room Full" error message.
* Implement a 20-second reconnection grace period using a session token stored in `sessionStorage` to prevent match termination on accidental refresh.


3. **Authoritative Server Game Loop:**
* The server maintains the true game state.
* The active client sends move intents (`PLACE_PIECE` or `MOVE_PIECE`).
* Inactive client input is locked on the frontend and rejected if received on the server.
* On a valid move, the server updates state, evaluates win/draw conditions, and broadcasts `GAME_STATE_UPDATE` to both clients.
* On an invalid move, emit `MOVE_ERROR` to the active client without desyncing state.


4. **Match Termination, Rematch & Teardown:**
* After a game finishes (`WIN` or `DRAW`), display a Game Over modal with "Rematch" and "Leave Room".
* **Leave Room:** If EITHER player clicks "Leave Room" (or disconnects beyond the grace period), the room shuts down immediately, and both players return to the lobby.
* **Rematch:** ONLY when BOTH players click "Rematch":
* The game board and reserves reset to initial empty states.
* **Colors Swap:** The player who was Red becomes Blue; the player who was Blue becomes Red.
* The new Red player starts the new round.





---

### 4. Pseudo-3D (2.5D) Visuals & Animation Requirements

1. **Isometric Board Presentation:**
* Tilt the $3 \times 3$ board container using CSS perspective: `perspective: 1000px; transform: rotateX(25deg);`.
* Style board cells as beveled tiles with dark wood grain and inset drop-shadows (`box-shadow: inset 0 2px 5px rgba(0,0,0,0.4)`) to simulate recessed physical slots.


2. **Cylindrical Piece Assets & Styling:**
* Provide standalone SVG or styled component fallbacks with gradient shading, top rim highlights, and contact shadows for each tier if PNG assets are absent:
* Small: 48px width / height
* Medium: 72px width / height
* Large: 96px width / height


* When multiple pieces occupy a cell, render the top piece at `z-index: 30`, completely concealing any smaller pieces underneath (`z-index: 20` or `10`).


3. **Elevation & Motion Physics (Framer Motion):**
* **Tap-to-Lift (Step 1):**
* Clicking an available reserve piece or owned board cell lifts it up:
* `scale: 1.15`
* `y: -32`
* Transition: `{ type: "spring", stiffness: 450, damping: 25 }`
* Shadow expands and softens: `filter: drop-shadow(0 25px 15px rgba(0,0,0,0.25))`


* Highlight legal destination cells on the board with a soft animated pulse ring.


* **Parabolic Arc Jump (Step 2):**
* When the destination is tapped, animate the piece along an arc path peaking at `y: -50` before dropping onto the target cell with a subtle landing bounce (`scale: [1.15, 0.95, 1.0]`).


* If a piece movement uncovers an underlying piece, animate the revealed piece fading/growing slightly into active view.


4. **Instant Asset Caching:**
* Preload all images and assets in `App.tsx` on initial mount via `new Image().src = ...` so move animations never drop frames.



---

### 5. Implementation Steps Required

1. **Implement Core Engine (`server/src/engine/`):**
* Implement typed stack representations for cells and reserves.
* Implement pure validators: `isValidPlacement`, `isValidMove`, `checkWinCondition`, `getLegalMoves`.
* Include unit tests covering self-gobbling, uncovering an opponent's win, uncovering own win, and simultaneous wins.


2. **Implement Server & Sockets (`server/src/`):**
* Build Express server with Socket.IO integration.
* Build `RoomManager` handling room code generation, matchmaking, grace periods, turn validation, and rematch color swaps.


3. **Implement Client App (`client/src/`):**
* Build Landing/Lobby view with Room Code input and URL param listener.
* Build 2.5D Game Screen with Reserves, 3x3 Isometric Board, and Status HUD.
* Build Game Over modal with rematch acceptance toggles and canvas-confetti victory fanfare.


4. **Build & Verify:**
* Ensure `npm run build` cleanly compiles both server and client without TypeScript errors.
* Verify that all edge cases pass tests before finalizing.



```

---