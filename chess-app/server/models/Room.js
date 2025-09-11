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
    return this.game.makeMove(move);
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
    room.game.history = json.history || [];
    return room;
  }
}
