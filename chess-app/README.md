# Real-Time Chess Game

A multiplayer chess game built with React, Socket.IO, and Express — with server-authoritative move validation and AI commentary after every legal move.

## Features

- Real-time multiplayer chess gameplay
- Room-based game sessions with reconnect history
- AI commentary after each valid move (shared for both players)
- Loading and fallback states when commentary is slow or unavailable
- Connection status indicators
- Game state synchronization
- Move validation and error handling

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation

1. Install server dependencies:

```bash
cd chess-app/server
npm install
```

2. Install client dependencies:

```bash
cd chess-app/client
npm install
```

### Running the Application

#### Ports (keep these aligned)

| Service | Default port | Config |
|---------|--------------|--------|
| **Client (Vite)** | `5173` | Vite default — open `http://localhost:5173` |
| **Server (Express + Socket.IO)** | `3000` | `PORT` in `chess-app/server/.env` |
| **Client → server socket** | must match server | `VITE_SERVER_URL` in `chess-app/client/.env` (defaults to `http://localhost:3000`) |

If you change `PORT` on the server (e.g. to `8000`), set `VITE_SERVER_URL=http://localhost:8000` in the client `.env` and restart `npm run dev` in both folders.

1. Copy env templates and edit as needed:

```bash
cp chess-app/server/.env.example chess-app/server/.env
cp chess-app/client/.env.example chess-app/client/.env
```

2. Start PostgreSQL and set a connection URL (or use in-memory mode for quick tests — see below).

```bash
# Example local Postgres URL (also in server/.env.example)
DATABASE_URL=postgresql://localhost:5432/chess_app
```

The server runs migrations automatically on first connect.

3. Start the server (from `chess-app/server`):

```bash
npm run dev
```

4. Start the client (in a new terminal, from `chess-app/client`):

```bash
npm run dev
```

5. Open your browser at `http://localhost:5173`

### PostgreSQL setup (local)

Create a database, then point the server at it:

```bash
createdb chess_app
export DATABASE_URL=postgresql://localhost:5432/chess_app
```

On first request the server applies `server/db/migrations/001_create_rooms.sql` (rooms table with JSONB columns for `players`, `history`, `status`, and `commentary`).

For tests and the socket verification script, skip Postgres entirely:

```bash
# In chess-app/server/.env:
USE_MEMORY_STORE=1
PORT=3000
```

Then `npm run dev` from `chess-app/server`.

### Optional: AI Commentary (LLM)

By default, the server generates witty rule-based commentary with no API key. To use OpenRouter instead:

```bash
OPENROUTER_API_KEY=sk-or-...
# optional:
OPENROUTER_MODEL=deepseek/deepseek-v4-flash
```

Add these to a `.env` file in `chess-app/server/` (or export them before `npm run dev`).

### Verify socket flow

From `chess-app/server`:

```bash
USE_MEMORY_STORE=1 node scripts/verify-socket-flow.mjs
```

## Portfolio demo

This project is designed as a single cohesive demo: validated moves, room sync, and AI commentary working together end-to-end.

### Architecture (prose)

1. **Client** — React + react-chessboard; optimistic local moves with client-side legality checks; listens for `move`, `commentary`, `invalid-move`, and `room-updated` socket events.
2. **Socket layer** — Express + Socket.IO; rooms are the broadcast channel; every valid move is validated server-side before any client sees it.
3. **Game manager** — Loads/saves room state; `chess.js` is the source of truth for legality, turn order, and FEN.
4. **Commentary pipeline** — After a valid move, the server immediately broadcasts `move`, then asynchronously builds structured context (SAN, FEN, turn, status, history) and generates one commentary line (LLM or rule-based fallback), capped at 160 characters.
5. **Persistence** — Room state (FEN, players, commentary history) is stored in PostgreSQL (or in-memory with `USE_MEMORY_STORE=1`) so join/reconnect replays prior commentary from `room-updated`.

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes | Server port (e.g. `3000`) |
| `DATABASE_URL` | Yes* | PostgreSQL connection string |
| `POSTGRES_URL` | Yes* | Alias for `DATABASE_URL` |
| `USE_MEMORY_STORE` | No | Set to `1` for in-memory rooms (no database) |
| `OPENROUTER_API_KEY` | No | Enables LLM commentary via OpenRouter; falls back to rules if missing/fails |
| `OPENROUTER_MODEL` | No | Default `deepseek/deepseek-v4-flash` |
| `VITE_SERVER_URL` | No | Client socket URL (default `http://localhost:3000`) |

\* Not required when `USE_MEMORY_STORE=1`.

### Two-tab test (recruiter walkthrough)

1. Start server and client as above.
2. **Tab A** — Click **Create Room**; note the room ID in the status bar (click to copy).
3. **Tab B** — Paste the room ID and click **Join**; confirm "Players 2/2" and opposite colors.
4. **Tab A (White)** — Play `e2→e4`; watch the commentary panel show "Generating commentary…" then a quip with move label `e4`.
5. **Tab B (Black)** — Reply `e7→e5`; both tabs should show the same new commentary line in real time.
6. **Wrong turn** — Try moving as White again in Tab A; board rejects locally ("Not your turn") or server sends `invalid-move`.
7. **Reconnect** — Refresh Tab B; re-join the same room; prior commentary history should appear from `room-updated`.

### What to highlight in an interview

- **Server authority** — Clients never decide legality; invalid moves never mutate shared state.
- **Non-blocking commentary** — `move` broadcasts immediately; AI work is async with timeout + rule-based fallback.
- **Structured context** — Commentary receives SAN, FEN, check/status flags, and recent history — not raw user prompts.
- **UX resilience** — Loading spinner per move, client-side timeout fallback, bounded output length.
- **Real-time sync** — Socket rooms keep both boards and the shared commentary feed aligned.

## How to Play

1. **Create or Join a Room** — Create a private room or join by ID
2. **Wait for Players** — Two players per room; status bar shows count and your color
3. **Play Chess** — Drag pieces; commentary appears in the side panel after each valid move

## Technical Details

- **Frontend**: React with Vite, react-chessboard, chess.js
- **Backend**: Express.js with Socket.IO
- **Chess Engine**: chess.js (server + client)
- **Storage**: PostgreSQL (or in-memory with `USE_MEMORY_STORE=1`)

## Troubleshooting

### Ports and socket connection

- Client dev server: `http://localhost:5173` (Vite)
- Server API + Socket.IO: `http://localhost:3000` by default (`PORT` in `server/.env`)
- If the server logs a different port (e.g. `8000`), set `VITE_SERVER_URL=http://localhost:8000` in `client/.env` and restart the client

### Database connection failed

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `DATABASE_URL or POSTGRES_URL is not set` | No DB URL in `.env` | Copy `server/.env.example` → `.env`, or set `USE_MEMORY_STORE=1` |
| `ECONNREFUSED` | Postgres not running locally | `brew services start postgresql` (or your install), `createdb chess_app` |
| `ECONNRESET` / `ETIMEDOUT` | Remote/stale URL (e.g. old Prisma/Supabase project) | Replace `DATABASE_URL` with a working local URL or `USE_MEMORY_STORE=1` |
| `authentication failed` | Wrong user/password in URL | Fix credentials in `DATABASE_URL` |

Quick dev without any database:

```bash
# chess-app/server/.env
USE_MEMORY_STORE=1
PORT=3000
```

### General

- Ensure server and client are both running
- Check browser console for socket connection errors
- Run `verify-socket-flow.mjs` to confirm server events without the UI
