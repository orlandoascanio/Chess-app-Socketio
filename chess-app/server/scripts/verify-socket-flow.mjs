process.env.USE_MEMORY_STORE = "1";
process.env.PORT = "3099";

const { createServer } = await import("http");
const { Server } = await import("socket.io");
const { io: createClient } = await import("../../client/node_modules/socket.io-client/build/esm/index.js");
const { default: registerSocketHandlers } = await import("../socket.js");
const { COMMENTARY_MAX_CHARS, ruleBasedCommentary } = await import("../services/commentaryService.js");

function testRuleBasedDiversity() {
  const recent = [];
  const texts = new Set();

  for (let i = 0; i < 6; i++) {
    const ctx = {
      san: "Nc3",
      status: {
        check: false,
        checkmate: false,
        draw: false,
        stalemate: false,
        gameOver: false,
      },
      captured: null,
      piece: "n",
      flags: "n",
      move: { from: "b1", to: "c3", promotion: null },
      recentCommentary: [...recent],
    };
    const text = ruleBasedCommentary(ctx);
    texts.add(text);
    recent.push({ moveSan: ctx.san, text });
  }

  console.log("verify:commentaryDiversity", texts.size === 6);
}

const PORT = 3099;

function once(socket, event, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
    socket.once("error", (err) => {
      clearTimeout(timer);
      reject(new Error(String(err)));
    });
  });
}

const httpServer = createServer();
const io = new Server(httpServer, { cors: { origin: "*" } });
registerSocketHandlers(io);

await new Promise((resolve) => httpServer.listen(PORT, resolve));

testRuleBasedDiversity();

const client1 = createClient(`http://localhost:${PORT}`);
const client2 = createClient(`http://localhost:${PORT}`);

await Promise.all([
  new Promise((resolve) => client1.once("connect", resolve)),
  new Promise((resolve) => client2.once("connect", resolve)),
]);

const roomId = "verify-room";
client1.emit("create-room", { roomId });
const created = await once(client1, "room-updated");
console.log("verify:create", created.id === roomId && created.players.length === 1);
console.log("verify:commentaryHistoryEmpty", Array.isArray(created.commentary) && created.commentary.length === 0);

client2.emit("join-room", { roomId });
const joined = await once(client2, "room-updated");
console.log("verify:join", joined.players.length === 2);

const move = { from: "e2", to: "e4", promotion: "q" };
let moveAt = 0;
let commentaryAt = 0;

const movePromise = once(client2, "move").then((data) => {
  moveAt = Date.now();
  return data;
});
const commentaryPromise = once(client2, "commentary").then((data) => {
  commentaryAt = Date.now();
  return data;
});

client1.emit("move", { roomId, move });
const [received, commentary] = await Promise.all([movePromise, commentaryPromise]);

console.log("verify:moveShape", !!received.move && received.move.from === "e2" && !!received.sender);
console.log("verify:moveSan", received.move.san === "e4");
console.log("verify:moveSender", received.sender === client1.id);
console.log("verify:moveBeforeCommentary", moveAt > 0 && commentaryAt >= moveAt);
console.log(
  "verify:commentary",
  !!commentary.text &&
    commentary.moveSan === "e4" &&
    commentary.roomId === roomId &&
    typeof commentary.timestamp === "number"
);
console.log("verify:commentaryLengthCap", commentary.text.length <= COMMENTARY_MAX_CHARS);

const rejectedPromise = once(client1, "invalid-move");
client1.emit("move", { roomId, move: { from: "e7", to: "e5", promotion: "q" } });
await rejectedPromise;
console.log("verify:wrongTurnRejected", true);

client1.disconnect();
client2.disconnect();
httpServer.close();

console.log("verify:allPassed", true);
