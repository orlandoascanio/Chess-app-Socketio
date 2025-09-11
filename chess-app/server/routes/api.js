import express from "express";
import { log } from "../utils/logger.js";
import * as roomStore from "../db/roomStore.js";

const router = express.Router();

// GET game state by roomId
router.get("/games/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params;
    if (!roomId) {
      return res.status(400).json({ error: "Room ID is required" });
    }

    const data = await roomStore.loadRoom(roomId); 
    if (!data) {
      log.warn("Game not found", { roomId });
      return res.status(404).json({ error: "Game not found" });
    }

    log.info("Game retrieved", { roomId });
    res.json(data);
  } catch (err) {
    log.error("Error fetching game", { error: err.message, stack: err.stack, roomId: req.params.roomId });
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
