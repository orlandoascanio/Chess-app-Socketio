# Socket.IO protocol reference

The server registers its real-time contract in `chess-app/server/socket.js`. Clients connect to the URL defined by `VITE_SERVER_URL`, which defaults to `http://localhost:3000`.

## Connection model

- Transport identity is `socket.id`.
- Each application game uses a Socket.IO room named after the supplied `roomId`.
- The first player receives White (`"w"`); the second receives Black (`"b"`).
- A room accepts at most two current player records.
- The server removes a player on disconnect and deletes an empty room.

## Client-to-server events

### `create-room`

Create a new application room and join the sending socket to it.

```js
socket.emit("create-room", {
  roomId: "abc123",
});
```

Payload:

| Field | Type | Required | Constraint |
| --- | --- | --- | --- |
| `roomId` | `string` | Yes | Must be non-empty and not already stored |

Success:

- creator is assigned White;
- room snapshot is saved;
- sender joins the Socket.IO room;
- `room-updated` is emitted to that room.

Failure:

- `error: "Room ID is required"` when missing;
- `error: "Room abc123 already exists"` when already stored;
- a formatted storage error when persistence fails.

### `join-room`

Join an existing room.

```js
socket.emit("join-room", {
  roomId: "abc123",
});
```

Payload:

| Field | Type | Required | Constraint |
| --- | --- | --- | --- |
| `roomId` | `string` | Yes | Must reference a stored room with an open seat |

Success:

- player is assigned the next color by seat order;
- room snapshot is saved;
- sender joins the Socket.IO room;
- `room-updated` is emitted to the room.

Failure:

- `error: "Room ID is required"` when missing;
- `error: "Room not found"` when absent;
- `error: "Room is full"` when two players already exist.

### `move`

Request a board state transition.

```js
socket.emit("move", {
  roomId: "abc123",
  move: {
    from: "e2",
    to: "e4",
    promotion: "q",
  },
});
```

Payload:

| Field | Type | Required | Constraint |
| --- | --- | --- | --- |
| `roomId` | `string` | Yes | Must reference a stored room |
| `move` | `object` | Yes | Passed to `chess.js` after membership and turn checks |
| `move.from` | `string` | Yes | Algebraic square such as `"e2"` |
| `move.to` | `string` | Yes | Algebraic square such as `"e4"` |
| `move.promotion` | `string` | No | Defaults to queen when a promotion move omits it |

Validation order:

1. payload includes `roomId` and `move`;
2. stored room exists;
3. sending socket is a room player;
4. player color matches the current turn;
5. `chess.js` accepts the move.

An accepted move is saved before `move` is broadcast. Commentary work starts after the move broadcast.

## Server-to-client events

### `room-updated`

Sent to every current socket in a room after create or join.

```js
{
  id: "abc123",
  players: [
    {
      id: "socket-id",
      name: "Guest",
      color: "w",
      isConnected: true,
      isReady: false,
      joinedAt: "2026-07-30T09:00:00.000Z"
    }
  ],
  fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  history: [],
  status: {
    gameOver: false,
    checkmate: false,
    draw: false,
    stalemate: false,
    insufficientMaterial: false,
    threefoldRepetition: false,
    inCheck: false,
    turn: "w"
  },
  commentary: []
}
```

`history` contains verbose `chess.js` move objects after play begins.

### `move`

Broadcast to the room after the server accepts and saves a move.

```js
{
  move: {
    from: "e2",
    to: "e4",
    promotion: "q",
    san: "e4"
  },
  sender: "socket-id"
}
```

The current client ignores a broadcast whose `sender` matches its own socket ID because it has already applied the move optimistically.

### `commentary`

Broadcast after the accepted move's commentary is generated and saved.

```js
{
  text: "e4 claims the center. Old reliable, still booking gigs.",
  moveSan: "e4",
  timestamp: 1785402000000,
  roomId: "abc123"
}
```

Constraints:

- `text` is plain text;
- server output is capped at 160 characters;
- `moveSan` identifies the accepted move;
- `timestamp` is Unix time in milliseconds;
- the entry is appended to the room's commentary history before emission.

### `invalid-move`

Sent only to the requesting socket when the room does not exist, the socket is not a player, the turn belongs to the other color, or `chess.js` rejects the move.

The payload is the original `move` object:

```js
{
  from: "e7",
  to: "e5",
  promotion: "q"
}
```

The client uses this event to restore the last room FEN or undo its optimistic move.

### `error`

Sent only to the requesting socket for malformed requests and operational failures. The current payload is a string, not an `Error` object.

```js
"Room not found"
```

## Event ordering

For one accepted move, the server intends this order:

```text
save room snapshot
  → emit move
  → generate commentary
  → save commentary
  → emit commentary
```

The protocol does not currently include sequence numbers, acknowledgments, or move request IDs. Consumers should use the room snapshot for join-time synchronization and treat the `move` stream as the live path.

## HTTP endpoints

The same server also exposes:

| Method | Path | Response |
| --- | --- | --- |
| `GET` | `/health` | `{ "status": "ok" }` |
| `GET` | `/api/games/:roomId` | Stored serialized room or `404` |

These endpoints are separate from the Socket.IO contract. Express CORS uses `CORS_ORIGINS`; the Socket.IO server currently uses `CORS_ORIGIN` and defaults to `"*"`.

## Related

- [Architecture: decisions and trade-offs](architecture.md)
- [How to run the project locally](local-development.md)
- [Testing and verification](testing.md)
