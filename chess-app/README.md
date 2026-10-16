# Application workspace

This directory contains the React client and Node.js server for Real-Time Chess.

Start with the [repository README](../README.md) for the project overview, screenshot, architecture, verified behavior, and current engineering boundaries.

## Package map

- [`client/`](client/) contains the Vite and React interface.
- [`server/`](server/) contains Express, Socket.IO, chess rules, storage, and commentary.

## Quick start

```bash
npm install --prefix server
npm install --prefix client
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Start the server:

```bash
cd server
npm run dev
```

Start the client in another terminal:

```bash
cd client
npm run dev
```

The default local URLs are:

- client: `http://localhost:5173`
- server: `http://localhost:3000`

## Documentation

- [Architecture and trade-offs](../docs/architecture.md)
- [Socket.IO protocol reference](../docs/socket-protocol.md)
- [Local development](../docs/local-development.md)
- [Testing and verification](../docs/testing.md)
