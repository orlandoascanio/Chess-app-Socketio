import "./App.css";
import { useCallback, useEffect, useState } from "react";
import socket from "./socket";
import Board from "./Board";
import Commentary from "./Commentary";

function App() {
  const [room, setRoom] = useState(null);
  const [error, setError] = useState(null);
  const [joinRoomId, setJoinRoomId] = useState("");
  const [commentary, setCommentary] = useState([]);
  const [pendingSan, setPendingSan] = useState(null);

  const playerColor = room?.players?.find((p) => p.id === socket.id)?.color ?? null;
  const opponent = room?.players?.find((p) => p.id !== socket.id);

  const handleCommentaryFallback = useCallback((moveSan, text) => {
    setCommentary((prev) => {
      if (prev.some((c) => c.moveSan === moveSan)) return prev;
      return [...prev, { moveSan, text, timestamp: Date.now(), fallback: true }];
    });
    setPendingSan((current) => (current === moveSan ? null : current));
  }, []);

  useEffect(() => {
    const onRoomUpdated = (data) => {
      setRoom(data);
      setCommentary(data.commentary || []);
      setPendingSan(null);
      setError(null);
    };

    const onMove = (payload) => {
      const san = payload?.move?.san;
      if (san) setPendingSan(san);
    };

    const onCommentary = (entry) => {
      if (!entry?.text) return;
      setCommentary((prev) => {
        if (prev.some((c) => c.timestamp === entry.timestamp && c.moveSan === entry.moveSan)) {
          return prev;
        }
        return [...prev, entry];
      });
      setPendingSan((current) => (current === entry.moveSan ? null : current));
    };

    const onError = (msg) => {
      setError(typeof msg === "string" ? msg : "Something went wrong");
    };

    socket.on("room-updated", onRoomUpdated);
    socket.on("move", onMove);
    socket.on("commentary", onCommentary);
    socket.on("error", onError);

    return () => {
      socket.off("room-updated", onRoomUpdated);
      socket.off("move", onMove);
      socket.off("commentary", onCommentary);
      socket.off("error", onError);
    };
  }, []);

  const createRoom = () => {
    const roomId = Math.random().toString(36).slice(2, 8);
    socket.emit("create-room", { roomId });
  };

  const joinRoom = (roomId) => {
    if (!roomId?.trim()) {
      setError("Enter a room ID to join");
      return;
    }
    socket.emit("join-room", { roomId: roomId.trim() });
  };

  const copyRoomId = async () => {
    if (!room?.id) return;
    try {
      await navigator.clipboard.writeText(room.id);
    } catch {
      setError("Could not copy room ID");
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-icon" aria-hidden="true">♞</span>
          <div>
            <h1>Real-Time Chess</h1>
            <p className="tagline">Multiplayer sync · AI commentary</p>
          </div>
        </div>
      </header>

      {room && (
        <div className="status-strip">
          <div className="status-meta">
            <span className="status-chip">
              Room{" "}
              <button type="button" className="room-id-btn" onClick={copyRoomId} title="Copy room ID">
                {room.id}
              </button>
            </span>
            <span className="status-chip">Players {room.players.length}/2</span>
            {playerColor && (
              <span className="status-chip">
                You · <strong>{playerColor === "w" ? "White" : "Black"}</strong>
              </span>
            )}
            {opponent && <span className="status-chip status-chip--muted">Opponent connected</span>}
            {!opponent && room.players.length < 2 && (
              <span className="status-chip status-chip--waiting">Waiting for opponent…</span>
            )}
          </div>
        </div>
      )}

      <div className={`app-body${!room ? " app-body--lobby" : ""}`}>
        {!room && (
          <section className="lobby">
            <h2>Join a game</h2>
            <p className="lobby-lead">
              Create a private room or join an existing one. Open a second tab to play both sides.
            </p>
            <div className="lobby-actions">
              <button type="button" className="btn btn--primary" onClick={createRoom}>
                Create room
              </button>
              <button type="button" className="btn btn--secondary" onClick={() => joinRoom("default")}>
                Join default room
              </button>
            </div>
            <div className="join-row">
              <label className="join-label" htmlFor="room-id-input">
                Or enter a room ID
              </label>
              <div className="join-controls">
                <input
                  id="room-id-input"
                  type="text"
                  placeholder="e.g. abc123"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && joinRoom(joinRoomId)}
                />
                <button type="button" className="btn btn--secondary" onClick={() => joinRoom(joinRoomId)}>
                  Join
                </button>
              </div>
            </div>
          </section>
        )}

        {error && (
          <p className="banner banner--error" role="alert">
            {error}
          </p>
        )}

        {room && (
          <main className="game-layout">
            <Board
              roomId={room.id}
              playerColor={playerColor}
              fen={room.fen}
              status={room.status}
            />
            <Commentary
              entries={commentary}
              pendingSan={pendingSan}
              onFallback={handleCommentaryFallback}
            />
          </main>
        )}
      </div>
    </div>
  );
}

export default App;
