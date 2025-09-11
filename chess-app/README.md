# Real-Time Chess Game

A multiplayer chess game built with React, Socket.IO, and Express.

## Features

- Real-time multiplayer chess gameplay
- Room-based game sessions
- Connection status indicators
- Game state synchronization
- Move validation and error handling

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Install server dependencies:
```bash
cd chess-app
npm install
```

2. Install client dependencies:
```bash
cd client
npm install
```

### Running the Application

1. Start the server:
```bash
# From the chess-app directory
npm run dev
```

2. Start the client (in a new terminal):
```bash
# From the chess-app/client directory
npm run dev
```

3. Open your browser and navigate to `http://localhost:5173`

## How to Play

1. **Create or Join a Room**: 
   - Click "Create New Room" to create a private room
   - Click "Join Default Room" to join the public room

2. **Wait for Players**: 
   - The game supports 2 players per room
   - You'll see the player count in the top status bar

3. **Play Chess**: 
   - Drag and drop pieces to make moves
   - The game will validate moves and sync across all players
   - Game status (check, checkmate, etc.) is displayed above the board

## Technical Details

- **Frontend**: React with Vite
- **Backend**: Express.js with Socket.IO
- **Chess Engine**: chess.js
- **UI**: react-chessboard

## Troubleshooting

- Make sure both server (port 3000) and client (port 5173) are running
- Check browser console for connection errors
- Ensure no firewall is blocking the ports
