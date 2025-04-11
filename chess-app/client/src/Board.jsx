import { useEffect, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import socket from "./socket";

export default function Board() {
  const [game, setGame] = useState(new Chess());

  const safeGameMutate = (modify) => {
    setGame((g) => {
      const updated = new Chess(g.fen());
      modify(updated);
      return updated;
    });
  };

  function onDrop(sourceSquare, targetSquare) {
    const move = {
      from: sourceSquare,
      to: targetSquare,
      promotion: "q",
    };
  
    const result = game.move(move);
  
    if (result === null) return false;
  
    // Emit the raw move (not the result) to others
    socket.emit("move", { move, sender: socket.id });
  
    // Apply locally only if it succeeded
    safeGameMutate((g) => g.move(move));
    return true;
  }

  useEffect(() => {
    const handleMove = ({ move, sender }) => {
      if (sender === socket.id) return;
  
      safeGameMutate((g) => {
        const result = g.move(move);
        if (!result) console.warn("❌ Invalid move:", move);
      });
    };
  
    socket.on("move", handleMove);
  
    return () => socket.off("move", handleMove);
  }, []);

  return (
    <div style={{ maxWidth: 500, margin: "0 auto" }}>
      <Chessboard position={game.fen()} onPieceDrop={onDrop} />
    </div>
  );
}
