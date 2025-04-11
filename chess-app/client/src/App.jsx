import './App.css'
import { useEffect } from "react";
import socket from "./socket";
import Board from "./Board";

function App() {
  useEffect(() => {
    socket.on("connect", () => {
      console.log("🟢 Connected:", socket.id);
    });

    return () => {
      socket.off("connect");
    };
  }, []);

  return (
    <div>
      <h1>♟️ Real-Time Chess</h1>
      <Board />
    </div>
  );
}

export default App;
