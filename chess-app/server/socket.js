import { gameManager } from "./gameManager.js";
import { log } from "./utils/logger.js";

export default function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    log.info("🔌 New connection", { socketId: socket.id });

    // CREATE ROOM
    socket.on("create-room", ({ roomId }) => {
      if (!roomId) {
        log.warn("Create-room missing roomId", { socketId: socket.id });
        return socket.emit("error", "Room ID is required");
      }

      try {
        const room = gameManager.createRoom(roomId, socket.id);
        socket.join(room.id);
        io.to(room.id).emit("room-updated", room.serialize());
        log.info("Room created", { roomId, socketId: socket.id });
      } catch (err) {
        log.error("Failed to create room", { error: err.message, stack: err.stack, roomId, socketId: socket.id });
        socket.emit("error", "Could not create room");
      }
    });

    // JOIN ROOM
    socket.on("join-room", ({ roomId }) => {
      if (!roomId) {
        log.warn("Join-room missing roomId", { socketId: socket.id });
        return socket.emit("error", "Room ID is required");
      }

      try {
        const room = gameManager.joinRoom(roomId, socket.id);
        if (!room) {
          log.warn("Join failed: room not found", { roomId, socketId: socket.id });
          return socket.emit("error", "Room not found");
        }

        socket.join(room.id);
        io.to(room.id).emit("room-updated", room.serialize());
        log.info("Joined room", { roomId, socketId: socket.id });
      } catch (err) {
        log.error("Failed to join room", { error: err.message, stack: err.stack, roomId, socketId: socket.id });
        socket.emit("error", "Could not join room");
      }
    });

    // MOVE HANDLER
    socket.on("move", ({ roomId, move }) => {
      if (!roomId || !move) {
        log.warn("Move event missing params", { socketId: socket.id, roomId, move });
        return socket.emit("error", "Invalid move payload");
      }

      try {
        const result = gameManager.handleMove(roomId, socket.id, move);
        if (!result) {
          log.warn("Invalid move", { roomId, move, socketId: socket.id });
          return socket.emit("invalid-move", move);
        }

        io.to(roomId).emit("move", result);
        log.debug("Move processed", { roomId, move, socketId: socket.id });
      } catch (err) {
        log.error("Error handling move", { error: err.message, stack: err.stack, roomId, socketId: socket.id });
        socket.emit("error", "Failed to process move");
      }
    });

    // DISCONNECT
    socket.on("disconnect", (reason) => {
      try {
        gameManager.handleDisconnect(socket.id);
        log.info("🔌 Disconnected", { socketId: socket.id, reason });
      } catch (err) {
        log.error("Error handling disconnect", { error: err.message, stack: err.stack, socketId: socket.id });
      }
    });
  });
}
