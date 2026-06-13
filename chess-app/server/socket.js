import { gameManager } from "./gameManager.js";
import { buildCommentaryContext } from "./services/commentaryContext.js";
import {
  generateCommentary,
  ruleBasedCommentary,
} from "./services/commentaryService.js";
import { formatDbConnectionError } from "./db/connection.js";
import { log } from "./utils/logger.js";

const COMMENTARY_TIMEOUT_MS = 8000;

async function emitCommentary(io, roomId, commentaryContext) {
  const moveSan = commentaryContext.san;
  let text;

  try {
    text = await Promise.race([
      generateCommentary(commentaryContext),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("commentary timeout")), COMMENTARY_TIMEOUT_MS);
      }),
    ]);
  } catch (err) {
    log.warn("Commentary fallback used", { roomId, moveSan, reason: err.message });
    text = ruleBasedCommentary(commentaryContext);
  }

  const entry = {
    text,
    moveSan,
    timestamp: Date.now(),
    roomId,
  };

  try {
    await gameManager.addCommentary(roomId, entry);
    io.to(roomId).emit("commentary", entry);
    log.debug("Commentary emitted", { roomId, moveSan });
  } catch (err) {
    log.error("Commentary persistence failed", {
      error: err.message,
      stack: err.stack,
      roomId,
    });
  }
}

export default function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    log.info("🔌 New connection", { socketId: socket.id });

    socket.on("create-room", async ({ roomId }) => {
      if (!roomId) {
        log.warn("Create-room missing roomId", { socketId: socket.id });
        return socket.emit("error", "Room ID is required");
      }

      try {
        const room = await gameManager.createRoom(roomId, socket.id);
        socket.join(room.id);
        io.to(room.id).emit("room-updated", room.serialize());
        log.info("Room created", { roomId, socketId: socket.id });
      } catch (err) {
        const detail = err.dbDetail || formatDbConnectionError(err);
        log.error("Failed to create room", { error: err.message, stack: err.stack, roomId, socketId: socket.id, detail });
        socket.emit("error", detail || err.message || "Could not create room");
      }
    });

    socket.on("join-room", async ({ roomId }) => {
      if (!roomId) {
        log.warn("Join-room missing roomId", { socketId: socket.id });
        return socket.emit("error", "Room ID is required");
      }

      try {
        const room = await gameManager.joinRoom(roomId, socket.id);
        if (!room) {
          log.warn("Join failed: room not found", { roomId, socketId: socket.id });
          return socket.emit("error", "Room not found");
        }

        socket.join(room.id);
        io.to(room.id).emit("room-updated", room.serialize());
        log.info("Joined room", { roomId, socketId: socket.id });
      } catch (err) {
        log.error("Failed to join room", { error: err.message, stack: err.stack, roomId, socketId: socket.id });
        socket.emit("error", err.message || "Could not join room");
      }
    });

    socket.on("move", async (payload) => {
      const { roomId, move } = payload || {};
      if (!roomId || !move) {
        log.warn("Move event missing params", { socketId: socket.id, roomId, move });
        return socket.emit("error", "Invalid move payload");
      }

      try {
        const result = await gameManager.handleMove(roomId, socket.id, move);
        if (!result) {
          log.warn("Invalid move", { roomId, move, socketId: socket.id });
          return socket.emit("invalid-move", move);
        }

        // Validate → broadcast move → async commentary (one comment per room)
        const commentaryContext = buildCommentaryContext(
          result.room.game,
          result.moveResult,
          result.room.commentary
        );

        const broadcast = {
          move: {
            from: move.from,
            to: move.to,
            promotion: move.promotion,
            san: result.moveResult.san,
          },
          sender: socket.id,
        };
        io.to(roomId).emit("move", broadcast);
        void emitCommentary(io, roomId, commentaryContext);
        log.debug("Move processed", { roomId, move, socketId: socket.id });
      } catch (err) {
        log.error("Error handling move", { error: err.message, stack: err.stack, roomId, socketId: socket.id });
        socket.emit("error", "Failed to process move");
      }
    });

    socket.on("disconnect", async (reason) => {
      try {
        await gameManager.handleDisconnect(socket.id);
        log.info("🔌 Disconnected", { socketId: socket.id, reason });
      } catch (err) {
        log.error("Error handling disconnect", { error: err.message, stack: err.stack, socketId: socket.id });
      }
    });
  });
}
