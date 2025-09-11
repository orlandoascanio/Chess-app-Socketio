import { Chess } from "chess.js";

export class Game {
  constructor() {
    this.chess = new Chess();
    this.history = [];
  }

  /**
   * Attempts to make a move in the game.
   * @param {Object} move - { from: "e2", to: "e4", promotion?: "q" }
   * @returns {Object|null} - The move result if valid, null if invalid.
   */
  makeMove(move) {
    try {
      // auto-promote pawns to queen if not specified
      if (
        move.promotion === undefined &&
        this.chess.moves({ square: move.from, verbose: true })
          .some(m => m.flags.includes("p"))
      ) {
        move.promotion = "q";
      }

      const result = this.chess.move(move);
      if (result) {
        this.history.push(result);
        return result;
      }
      return null; // invalid move
    } catch (err) {
      console.error("Error applying move:", move, err);
      return null;
    }
  }

  /** Gets the current board state in FEN notation. */
  fen() {
    return this.chess.fen();
  }

  /** Gets the full move history in PGN notation. */
  pgn() {
    return this.chess.pgn();
  }

  /** Gets the current valid moves (useful for frontend UI). */
  moves(options = {}) {
    return this.chess.moves({ verbose: true, ...options });
  }

  /** Gets the last move played. */
  getLastMove() {
    return this.history[this.history.length - 1] || null;
  }

  /** Checks if the game has ended. */
  getStatus() {
    return {
      gameOver: this.chess.isGameOver(),
      checkmate: this.chess.isCheckmate(),
      draw: this.chess.isDraw(),
      stalemate: this.chess.isStalemate(),
      insufficientMaterial: this.chess.isInsufficientMaterial(),
      threefoldRepetition: this.chess.isThreefoldRepetition(),
      turn: this.chess.turn(),
    };
  }

  /** Resets the game to a new start position. */
  reset() {
    this.chess.reset();
    this.history = [];
  }

  /** Serialize game state for API or frontend sync. */
  serialize() {
    return {
      fen: this.fen(),
      pgn: this.pgn(),
      history: this.history,
      lastMove: this.getLastMove(),
      status: this.getStatus(),
    };
  }
}
