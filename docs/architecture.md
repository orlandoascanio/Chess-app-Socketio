# Architecture: decisions and trade-offs

Real-time chess is a shared-state problem. Two clients need the same board, turn, player assignment, and commentary history, even though their network messages arrive independently.

This project uses a server-authoritative room model: clients request actions, while the server owns the state transition that everyone else is allowed to observe.

## System map

```text
┌─────────────────────── Browser ───────────────────────┐
│ React UI                                               │
│  ├─ local chess.js copy for immediate move feedback    │
│  ├─ Socket.IO client                                   │
│  └─ room, board, connection, and commentary views      │
└──────────────────────────┬────────────────────────────┘
                           │ Socket.IO events
┌──────────────────────────▼────────────────────────────┐
│ Node.js server                                         │
│  ├─ socket.js: event boundary and room broadcasts      │
│  ├─ GameManager: application operations                │
│  ├─ Room / Game / Player: domain rules                 │
│  └─ commentary pipeline: context, generation, fallback │
└──────────────┬──────────────────────────┬─────────────┘
               │                          │
       ┌───────▼────────┐         ┌──────▼──────────┐
       │ Room store     │         │ Commentary      │
       │ PostgreSQL or  │         │ OpenRouter or   │
       │ in-memory Map  │         │ local rules     │
       └────────────────┘         └─────────────────┘
```

## Move lifecycle

An accepted move follows one path:

```text
drag piece
  ↓
client checks local legality
  ↓
client emits move request
  ↓
server loads room snapshot
  ↓
Room verifies membership and turn
  ↓
Game asks chess.js to apply the move
  ↓
server saves the new room snapshot
  ↓
server broadcasts move
  ↓
server generates and persists commentary
  ↓
server broadcasts commentary
```

The client-side legality check is a responsiveness feature. It is not an authorization boundary. A client can bypass its UI and emit any payload, so the server repeats the checks against its own state.

## Why the move and commentary are separate events

Commentary can require an external model call. Blocking the move broadcast on that call would make gameplay latency depend on a third-party service.

`socket.js` emits the accepted `move` first and starts commentary work without awaiting it. `emitCommentary` then:

1. races commentary generation against an eight-second server timeout;
2. falls back to a local rule-based generator on failure;
3. stores the final line in the room snapshot;
4. emits one shared `commentary` entry to the room.

The OpenRouter call has its own four-second abort timer, so the eight-second outer timeout is a second safety boundary rather than the normal path.

This split gives the UI two useful states: the board can advance immediately, and the commentary panel can show a loading row for the accepted move.

## Why rooms are the broadcast boundary

Every game maps to a Socket.IO room whose name is the application room ID. After create or join, the socket joins that channel. Accepted moves and commentary use `io.to(roomId).emit(...)`, which prevents unrelated games from receiving one another's state.

The room object contains:

- up to two players;
- the current FEN string;
- verbose move history;
- derived game status;
- commentary history.

The same serialized shape is used by the in-memory and PostgreSQL stores. This keeps persistence concerns out of the socket handlers and domain model.

## Persistence model

PostgreSQL stores one row per room:

| Column | Shape | Purpose |
| --- | --- | --- |
| `id` | `TEXT` | Application room ID |
| `players` | `JSONB` | Current socket-backed player records |
| `fen` | `TEXT` | Canonical board snapshot |
| `history` | `JSONB` | Verbose accepted moves |
| `status` | `JSONB` | Derived game status saved with the snapshot |
| `commentary` | `JSONB` | Shared commentary entries |
| `updated_at` | `TIMESTAMPTZ` | Last upsert time |

The migration runs during the first database connection. `roomStore.saveRoom` uses an upsert, so every accepted state change replaces the room snapshot atomically at the row level.

Memory mode implements the same functions with a process-local `Map`. It is fast enough for development and the socket verification script, but all rooms disappear on restart.

## Commentary as structured downstream work

The commentary generator does not receive a raw chat transcript. `buildCommentaryContext` constructs a bounded object:

- source and destination squares;
- Standard Algebraic Notation (SAN);
- current FEN and next turn;
- check, checkmate, draw, stalemate, and game-over flags;
- moved and captured piece data;
- the last eight moves;
- the last six commentary entries.

The generator sanitizes model output, blocks a small set of disallowed terms, removes hashtags, and caps the final line at 160 characters. If no API key exists or generation fails, the local rules use the same structured fields.

## Trade-offs and next steps

### Socket IDs are identities

The model is simple because a player's Socket.IO connection ID is also the player ID. A refresh creates a new identity. There is no signed resume token that proves the returning browser owns the previous seat.

A production version should separate durable player identity from transport identity:

```text
authenticated player ID + signed room seat token + replaceable socket ID
```

### Rooms are active sessions, not archives

`handleDisconnect` removes the socket from every room and deletes a room when no players remain. PostgreSQL therefore protects active state from ordinary process memory loss, but it is not a permanent match-history system.

A production archive would store games separately from active presence and would define explicit retention rules.

### Read-modify-write has a concurrency ceiling

The current flow loads a room, mutates it in memory, and upserts it. Two concurrent move handlers could read the same version before either write finishes.

For multi-instance or high-concurrency deployment, add:

- a room version column and optimistic concurrency check;
- a transaction or per-room command queue;
- a shared Socket.IO adapter such as Redis;
- idempotency keys or client sequence numbers for move requests.

### Optimistic UI needs correlation

The sender updates its board before the server responds and ignores its own broadcast. Rejection rolls the local state back. This feels fast, but the protocol has no request ID tying an acknowledgment to the optimistic action.

A stronger contract would return `move-accepted` or include a `clientMoveId` in the broadcast, allowing precise acknowledgment, retry, and latency measurement.

## Related

- [Socket.IO protocol reference](socket-protocol.md)
- [How to run the project locally](local-development.md)
- [Testing and verification](testing.md)
