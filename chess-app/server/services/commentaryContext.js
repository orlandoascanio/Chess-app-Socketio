const RECENT_MOVES = 8;
export const RECENT_COMMENTARY_LIMIT = 6;

/**
 * @param {Array<{ moveSan?: string, text?: string }>} commentary
 * @param {number} [limit]
 */
export function sliceRecentCommentary(commentary = [], limit = RECENT_COMMENTARY_LIMIT) {
  return commentary
    .slice(-limit)
    .map(({ moveSan, text }) => ({ moveSan, text }))
    .filter((entry) => entry.text);
}

/**
 * Build structured chess context for commentary generation.
 * @param {import("../models/Game.js").Game} game
 * @param {Object} moveResult - chess.js move result after a valid move
 * @param {Array<{ moveSan?: string, text?: string }>} [commentary]
 */
export function buildCommentaryContext(game, moveResult, commentary = []) {
  const status = game.getStatus();

  return {
    move: {
      from: moveResult.from,
      to: moveResult.to,
      promotion: moveResult.promotion ?? null,
    },
    san: moveResult.san,
    fen: game.fen(),
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
    history: game.history.slice(-RECENT_MOVES).map((m) => m.san),
    recentCommentary: sliceRecentCommentary(commentary),
  };
}
