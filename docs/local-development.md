# How to run the project locally

This guide starts the React client and Node.js server in memory mode, then shows how to switch to PostgreSQL or OpenRouter commentary.

## Prerequisites

- Node.js 18 or newer
- npm
- two terminal windows
- optional: PostgreSQL and its `createdb` command

## Run without PostgreSQL

### 1. Install both packages

From the repository root:

```bash
cd chess-app
npm install --prefix server
npm install --prefix client
```

The socket verification script imports the installed client package, so both installs are required even if you are only testing the server.

### 2. Create local environment files

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

The server template contains:

```dotenv
PORT=3000
USE_MEMORY_STORE=1
OPENROUTER_API_KEY=
```

The client template contains:

```dotenv
VITE_SERVER_URL=http://localhost:3000
```

The server requires `PORT` during startup. The client URL must use the same port.

### 3. Start the server

```bash
cd server
npm run dev
```

Expected log:

```text
Using in-memory room store (USE_MEMORY_STORE=1)
Server running on port 3000
```

### 4. Start the client

In the second terminal:

```bash
cd chess-app/client
npm run dev
```

Vite prints the local URL, normally `http://localhost:5173`.

### 5. Verify a two-player game

1. Open the Vite URL.
2. Select **Create room**.
3. Copy the six-character room ID from the status strip.
4. Open a second tab.
5. Enter the room ID and select **Join**.
6. Move White's pawn from `e2` to `e4`.
7. Confirm both tabs show the new position and one shared commentary entry.

## Use PostgreSQL

### 1. Create a database

```bash
createdb chess_app
```

### 2. Change `server/.env`

```dotenv
PORT=3000
USE_MEMORY_STORE=0
DATABASE_URL=postgresql://localhost:5432/chess_app
```

`POSTGRES_URL` is accepted as an alias for `DATABASE_URL`.

### 3. Restart the server

The first successful connection runs `server/db/migrations/001_create_rooms.sql`. You should see:

```text
Connected to PostgreSQL
Server running on port 3000
```

### 4. Verify the stored snapshot

After creating a room, request it by ID:

```bash
curl http://localhost:3000/api/games/ROOM_ID
```

You should receive its players, FEN, history, status, and commentary.

## Enable OpenRouter commentary

Rule-based commentary is the default and requires no external service.

To enable model-generated commentary, add to `server/.env`:

```dotenv
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=deepseek/deepseek-v4-flash
```

Optional attribution headers:

```dotenv
OPENROUTER_HTTP_REFERER=http://localhost:5173
OPENROUTER_APP_TITLE=Chess App
```

Restart the server after editing `.env`.

The server still falls back to local commentary when:

- the key is missing;
- the request exceeds its four-second abort limit;
- the provider returns a non-success response;
- the returned text is empty or rejected by sanitization.

## Configure CORS

For the Express API, list allowed browser origins:

```dotenv
CORS_ORIGINS=http://localhost:5173,https://example.com
```

The Socket.IO configuration reads the singular variable `CORS_ORIGIN` and defaults to `"*"`.

## Troubleshooting

### Server exits with `Missing required env var: PORT`

Copy `server/.env.example` to `server/.env`, or start explicitly:

```bash
PORT=3000 USE_MEMORY_STORE=1 npm run dev
```

### Client never connects

Check that:

- the server process is running;
- `client/.env` points to the server's exact scheme, host, and port;
- you restarted Vite after changing the environment file.

Then inspect the browser console for Socket.IO connection errors.

### `Room not found`

Room IDs are case-sensitive application strings. Copy the ID from the first tab and make sure the room still exists. In memory mode, restarting the server removes every room.

### `Room is full`

The stored room already contains two socket-backed player records. Disconnecting a player removes that record, but a refresh creates a new socket identity rather than resuming the prior seat.

### PostgreSQL connection fails

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `DATABASE_URL or POSTGRES_URL is not set` | Memory mode is off without a URL | Set a database URL or restore `USE_MEMORY_STORE=1` |
| `ECONNREFUSED` | PostgreSQL is not running | Start PostgreSQL and create `chess_app` |
| `ECONNRESET`, `ETIMEDOUT`, or `ENOTFOUND` | Remote host is stale or unreachable | Use a reachable direct PostgreSQL URL |
| `28P01` or `28000` | Credentials are wrong | Correct the username or password |
| `3D000` | Database does not exist | Run `createdb chess_app` or change the URL |

In non-production mode, the server falls back to memory storage when database startup fails. Read the warning before assuming persistence is active.

## Related

- [Socket.IO protocol reference](socket-protocol.md)
- [Testing and verification](testing.md)
- [Architecture: decisions and trade-offs](architecture.md)
