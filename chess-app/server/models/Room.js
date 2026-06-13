import { Game } from "./Game.js";
import { Player } from "./Player.js";

export class Room {
  constructor(id) {
    if (!id || typeof id !== "string") {
      throw new Error("Room must have a valid string ID");
    }

    this.id = id;
    /** @type {Player[]} */
    this.players = [];
    this.game = new Game();
    /** @type {Array<{ text: string, moveSan: string, timestamp: number, roomId: string }>} */
    this.commentary = [];
  }

  /**
   * Add a new player to the room.
   * @param {string} socketId
   * @param {string} [name="Guest"]
   */
  addPlayer(socketId, name = "Guest") {
    if (this.players.length >= 2) {
      throw new Error("Room is full");
    }

    if (!this.players.find((p) => p.id === socketId)) {
      const color = this.players.length === 0 ? "w" : "b"; // auto-assign color
      const player = new Player(socketId, name, color);
      this.players.push(player);
    }
  }

  /**
   * Remove a player by socket ID.
   * @param {string} socketId
   */
  removePlayer(socketId) {
    this.players = this.players.filter((p) => p.id !== socketId);
  }

  /**
   * Handle a chess move if valid.
   * @param {string} socketId
   * @param {Object} move
   * @returns {Object|null}
   */
  makeMove(socketId, move) {
    const player = this.players.find((p) => p.id === socketId);
    if (!player) return null;
    if (this.game.getStatus().turn !== player.color) return null;
    return this.game.makeMove(move);
  }

  buildCommentaryContext(moveResult) {
    const status = this.game.getStatus();
    const recentHistory = this.game.history.slice(-8).map((m) => m.san);

    return {
      move: {
        from: moveResult.from,
        to: moveResult.to,
        promotion: moveResult.promotion ?? null,
      },
      san: moveResult.san,
      fen: this.game.fen(),
      turn: status.turn,
      status: {
        check: status.inCheck,
        checkmate: status.checkmate,
        draw: status.draw,
        stalemate: status.stalemate,
        gameOver: status.gameOver,
      },
      captured: moveResult.captured ?? null,
      piece: moveResult.piece,
      flags: moveResult.flags,
      history: recentHistory,
      recentCommentary: this.commentary
        .slice(-6)
        .map(({ moveSan, text }) => ({ moveSan, text }))
        .filter((entry) => entry.text),
    };
  }

  /**
   * @param {{ text: string, moveSan: string, timestamp: number }} entry
   */
  addCommentary(entry) {
    this.commentary.push(entry);
  }

  /**
   * Serialize safe room data for API/clients.
   * @returns {Object}
   */
  serialize() {
    return {
      id: this.id,
      players: this.players.map((p) => p.toJSON()),
      fen: this.game.fen(),
      history: this.game.history,
      status: this.game.getStatus(),
      commentary: this.commentary,
    };
  }

  /**
   * Restore a Room from JSON (e.g., from DB).
   * @param {Object} json
   * @returns {Room}
   */
  static fromJSON(json) {
    const room = new Room(json.id);
    room.players = (json.players || []).map((p) => Player.fromJSON(p));
    if (json.fen) {
      room.game.chess.load(json.fen);
    }
    room.game.history = json.history || [];
    room.commentary = json.commentary || [];
    return room;
  }
}
