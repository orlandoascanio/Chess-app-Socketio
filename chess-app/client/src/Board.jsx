import { useEffect, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import socket from "./socket";

const MOVE_ERROR = {
  NOT_YOUR_TURN: "not-your-turn",
  ILLEGAL: "illegal",
  SERVER: "server-rejected",
  GAME_OVER: "game-over",
};

const MOVE_ERROR_COPY = {
  [MOVE_ERROR.NOT_YOUR_TURN]: {
    icon: "♞",
    title: "Not your turn",
    detail: "Wait for your opponent to move.",
  },
  [MOVE_ERROR.ILLEGAL]: {
    icon: "✕",
    title: "Illegal move",
    detail: "That square isn't allowed for this piece.",
  },
  [MOVE_ERROR.SERVER]: {
    icon: "⟳",
    title: "Move rejected",
    detail: "Board reset to the last synced position.",
  },
  [MOVE_ERROR.GAME_OVER]: {
    icon: "♔",
    title: "Game over",
    detail: "No more moves can be played.",
  },
};

const CHECKMATE_PARTICLES = [
  { glyph: "♔", left: "8%", delay: "0s", size: "1.1rem" },
  { glyph: "♟", left: "18%", delay: "0.4s", size: "0.85rem" },
  { glyph: "♜", left: "28%", delay: "0.8s", size: "0.9rem" },
  { glyph: "♞", left: "42%", delay: "0.2s", size: "1rem" },
  { glyph: "♛", left: "55%", delay: "0.6s", size: "1.05rem" },
  { glyph: "♝", left: "68%", delay: "1s", size: "0.8rem" },
  { glyph: "♚", left: "78%", delay: "0.3s", size: "1.15rem" },
  { glyph: "♟", left: "88%", delay: "0.7s", size: "0.75rem" },
  { glyph: "♜", left: "14%", delay: "1.1s", size: "0.7rem" },
  { glyph: "♞", left: "62%", delay: "1.3s", size: "0.85rem" },
  { glyph: "♝", left: "36%", delay: "1.5s", size: "0.75rem" },
  { glyph: "♔", left: "92%", delay: "0.9s", size: "0.8rem" },
];

function MoveErrorToast({ type, onDismiss }) {
  const copy = MOVE_ERROR_COPY[type];
  if (!copy) return null;

  return (
    <div
      className={`move-error-toast move-error-toast--${type}`}
      role="alert"
      aria-live="assertive"
    >
      <span className="move-error-toast__icon" aria-hidden="true">
        {copy.icon}
      </span>
      <div className="move-error-toast__body">
        <p className="move-error-toast__title">{copy.title}</p>
        <p className="move-error-toast__detail">{copy.detail}</p>
      </div>
      <button
        type="button"
        className="move-error-toast__dismiss"
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}

function CheckmateCelebration({ winnerLabel, youWon, playerColor }) {
  const outcome =
    playerColor == null
      ? null
      : youWon
        ? "Victory is yours"
        : "Better luck next game";

  return (
    <div className="checkmate-overlay" role="status" aria-live="polite">
      <div className="checkmate-particles" aria-hidden="true">
        {CHECKMATE_PARTICLES.map((p, i) => (
          <span
            key={i}
            className="checkmate-particle"
            style={{ left: p.left, animationDelay: p.delay, fontSize: p.size }}
          >
            {p.glyph}
          </span>
        ))}
      </div>
      <div className="checkmate-card">
        <span className="checkmate-crown" aria-hidden="true">
          ♔
        </span>
        <p className="checkmate-eyebrow">Game over</p>
        <h2 className="checkmate-title">Checkmate</h2>
        <p className="checkmate-winner">
          <span className="checkmate-winner-color">{winnerLabel}</span> wins
        </p>
        {outcome && <p className="checkmate-outcome">{outcome}</p>}
      </div>
    </div>
  );
}

export default function Board({ roomId, playerColor, fen, status, onMovePlayed, onMoveRejected }) {
  const [game, setGame] = useState(() => new Chess(fen || undefined));
  const [moveError, setMoveError] = useState(null);
  const [boardShaking, setBoardShaking] = useState(false);
  const [dragBlocked, setDragBlocked] = useState(false);

  useEffect(() => {
    if (!fen) return;
    setGame((current) => {
      if (current.fen() === fen) return current;
      return new Chess(fen);
    });
  }, [fen]);

  const showMoveError = (type) => {
    setMoveError({ type, id: Date.now() });
    setBoardShaking(true);
  };

  useEffect(() => {
    if (!moveError) return;
    const timer = setTimeout(() => setMoveError(null), 3400);
    return () => clearTimeout(timer);
  }, [moveError]);

  useEffect(() => {
    if (!boardShaking) return;
    const timer = setTimeout(() => setBoardShaking(false), 520);
    return () => clearTimeout(timer);
  }, [boardShaking]);

  const safeGameMutate = (modify) => {
    setGame((g) => {
      const updated = new Chess(g.fen());
      modify(updated);
      return updated;
    });
  };

  function onDrop(sourceSquare, targetSquare) {
    if (!roomId) return false;

    if (game.isGameOver()) {
      showMoveError(MOVE_ERROR.GAME_OVER);
      return false;
    }

    if (playerColor && game.turn() !== playerColor) {
      showMoveError(MOVE_ERROR.NOT_YOUR_TURN);
      return false;
    }

    const move = {
      from: sourceSquare,
      to: targetSquare,
      promotion: "q",
    };

    const trial = new Chess(game.fen());
    const result = trial.move(move);
    if (result === null) {
      showMoveError(MOVE_ERROR.ILLEGAL);
      return false;
    }

    socket.emit("move", { roomId, move });
    safeGameMutate((g) => g.move(move));
    onMovePlayed?.(result.san);
    return true;
  }

  useEffect(() => {
    const handleMove = (payload) => {
      const { move, sender } = payload || {};
      if (sender === socket.id) return;

      safeGameMutate((g) => {
        const preview = new Chess(g.fen());
        if (!preview.move(move)) return;
        g.move(move);
      });

      if (move?.san) {
        onMovePlayed?.(move.san);
      }
    };

    const handleInvalidMove = () => {
      if (fen) {
        setGame(new Chess(fen));
      } else {
        safeGameMutate((g) => {
          g.undo();
        });
      }
      onMoveRejected?.("Move rejected by server.");
      showMoveError(MOVE_ERROR.SERVER);
    };

    socket.on("move", handleMove);
    socket.on("invalid-move", handleInvalidMove);

    return () => {
      socket.off("move", handleMove);
      socket.off("invalid-move", handleInvalidMove);
    };
  }, [fen, onMovePlayed, onMoveRejected]);

  const isCheckmate = game.isCheckmate() || Boolean(status?.checkmate);
  const winnerColor = isCheckmate ? (game.turn() === "w" ? "b" : "w") : null;
  const winnerLabel = winnerColor === "w" ? "White" : winnerColor === "b" ? "Black" : null;
  const youWon = Boolean(playerColor && winnerColor && playerColor === winnerColor);

  const statusText = isCheckmate
    ? "Checkmate"
    : game.isStalemate()
      ? "Stalemate"
      : game.isDraw()
        ? "Draw"
        : game.inCheck()
          ? "Check"
          : game.turn() === "w"
            ? "White to move"
            : "Black to move";

  const isYourTurn = playerColor && game.turn() === playerColor && !game.isGameOver();
  const turnPillNudge = moveError?.type === MOVE_ERROR.NOT_YOUR_TURN;

  function onPieceDragBegin(_piece, _square) {
    if (game.isGameOver()) return;
    if (playerColor && game.turn() !== playerColor) {
      setDragBlocked(true);
    }
  }

  function onPieceDragEnd() {
    setDragBlocked(false);
  }

  function handleBoardShakeEnd(event) {
    if (event.target !== event.currentTarget) return;
    if (event.animationName === "board-reject-shake") {
      setBoardShaking(false);
    }
  }

  return (
    <div
      className={`board-wrap${isCheckmate ? " board-wrap--checkmate" : ""}${
        boardShaking ? " board-wrap--reject" : ""
      }`}
    >
      <div className="board-meta">
        <p
          className={`game-status${
            isCheckmate ? " game-status--checkmate" : game.inCheck() ? " game-status--check" : ""
          }`}
        >
          {statusText}
        </p>
        {playerColor && (
          <p
            className={`turn-pill${isYourTurn ? " turn-pill--active" : ""}${
              turnPillNudge ? " turn-pill--nudge" : ""
            }${dragBlocked ? " turn-pill--blocked" : ""}`}
          >
            {isYourTurn ? "Your turn" : "Opponent's turn"}
          </p>
        )}
      </div>

      <div
        className={`board-stage${boardShaking ? " board-stage--shake" : ""}${
          dragBlocked ? " board-stage--drag-blocked" : ""
        }`}
        onAnimationEnd={handleBoardShakeEnd}
      >
        {moveError && (
          <MoveErrorToast
            key={moveError.id}
            type={moveError.type}
            onDismiss={() => setMoveError(null)}
          />
        )}
        {isCheckmate && winnerLabel && (
          <CheckmateCelebration
            winnerLabel={winnerLabel}
            youWon={youWon}
            playerColor={playerColor}
          />
        )}
        <Chessboard
          position={game.fen()}
          onPieceDrop={onDrop}
          onPieceDragBegin={onPieceDragBegin}
          onPieceDragEnd={onPieceDragEnd}
          boardOrientation={playerColor === "b" ? "black" : "white"}
        />
      </div>
    </div>
  );
}
