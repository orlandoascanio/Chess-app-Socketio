# Testing and verification

The repository has one focused end-to-end socket verifier plus static checks for the React client. Together they cover the main demo path without requiring PostgreSQL or an OpenRouter key.

## Verify the Socket.IO flow

Install both package dependency trees, then run:

```bash
cd chess-app/server
node scripts/verify-socket-flow.mjs
```

The script:

1. forces memory storage;
2. starts an isolated Socket.IO server on port `3099`;
3. connects two real `socket.io-client` instances;
4. creates a room and joins the second client;
5. sends `e2` to `e4`;
6. observes the move and commentary events;
7. attempts an out-of-turn move.

Successful output ends with:

```text
verify:create true
verify:commentaryHistoryEmpty true
verify:join true
verify:moveShape true
verify:moveSan true
verify:moveSender true
verify:moveBeforeCommentary true
verify:commentary true
verify:commentaryLengthCap true
verify:wrongTurnRejected true
verify:allPassed true
```

The rule-based commentary text is intentionally variable. The assertions check shape, ordering, and length rather than one exact sentence.

## Check the client

```bash
cd chess-app/client
npm run lint
npm run build
```

`npm run lint` checks the React source with ESLint. `npm run build` verifies that Vite can create a production bundle.

## Manual browser checklist

Run the server and client, then verify:

### Lobby and room setup

- creating a room assigns the first socket White;
- joining from a second tab assigns Black;
- both tabs show `Players 2/2`;
- the room ID button copies the displayed ID.

### Shared state

- a legal White move appears in both tabs;
- Black's board is oriented from Black's side;
- turn labels update after each move;
- a wrong-turn drag is blocked locally;
- a server-rejected move restores the last synchronized position.

### Commentary

- the accepted move appears as a loading row first;
- both players receive the same final commentary entry;
- rule-based commentary works without `OPENROUTER_API_KEY`;
- prior entries render after joining a room that still exists.

### Failure states

- joining an unknown room displays `Room not found`;
- joining a full room displays `Room is full`;
- stopping the server exposes the connection failure in the browser console;
- restarting the server in memory mode removes previous rooms.

## What is not covered yet

The current verifier is valuable but narrow. High-value additions would be:

- unit tests for `Game`, `Room`, and commentary sanitization;
- malformed and missing event payload cases;
- room-full and duplicate-room cases;
- concurrent move requests against one room;
- PostgreSQL integration tests for migrations and upserts;
- browser tests for optimistic rollback and responsive layout;
- explicit OpenRouter timeout and unsafe-output fallback tests;
- reconnect tests built around a future durable seat token.

## Related

- [How to run the project locally](local-development.md)
- [Socket.IO protocol reference](socket-protocol.md)
- [Architecture: decisions and trade-offs](architecture.md)
