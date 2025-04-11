const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("🔌 New client connected:", socket.id);

  socket.on("move", ({ move, sender }) => {
    socket.broadcast.emit("move", { move, sender });
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

server.listen(3000, () => {
  console.log("🚀 Server listening on http://localhost:3000");
});
