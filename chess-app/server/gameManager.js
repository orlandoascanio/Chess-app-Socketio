import { Room } from "./models/Room.js";
import * as roomStore from "./db/roomStore.js";

class GameManager {
  // CREATE ROOM
  async createRoom(roomId, socketId) {
    if (!roomId) throw new Error("Room ID is required");
    if (!socketId) throw new Error("Socket ID is required");

    const existing = await roomStore.loadRoom(roomId);
    if (existing) throw new Error(`Room ${roomId} already exists`);

    const room = new Room(roomId);
    room.addPlayer(socketId);

    await roomStore.saveRoom(room);
    return room;
  }

  // JOIN ROOM
  async joinRoom(roomId, socketId) {
    if (!roomId) throw new Error("Room ID is required");
    if (!socketId) throw new Error("Socket ID is required");

    const data = await roomStore.loadRoom(roomId);
    if (!data) return null;

    const room = Room.fromJSON(data);
    room.addPlayer(socketId);

    await roomStore.saveRoom(room);
    return room;
  }

  // HANDLE MOVE
  async handleMove(roomId, socketId, move) {
    if (!roomId || !socketId || !move) {
      throw new Error("Invalid move payload");
    }

    const data = await roomStore.loadRoom(roomId);
    if (!data) return null;

    const room = Room.fromJSON(data);
    const result = room.makeMove(socketId, move);

    if (!result) return null; // invalid move

    await roomStore.saveRoom(room);
    return result;
  }

  // HANDLE DISCONNECT
  async handleDisconnect(socketId) {
    if (!socketId) return;

    const rooms = await (await roomStore.getRoomCollection())
      .find({ players: socketId }) 
      .toArray();

    for (const data of rooms) {
      const room = Room.fromJSON(data);
      room.removePlayer(socketId);

      if (room.players.length === 0) {
        await roomStore.deleteRoom(room.id);
      } else {
        await roomStore.saveRoom(room);
      }
    }
  }
}

export const gameManager = new GameManager();
