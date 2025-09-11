import "dotenv/config";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import { v4 as uuid } from "uuid";
import registerSocketHandlers from "./socket.js";
import apiRouter from "./routes/api.js";
import logger from "./utils/logger.js";

const REQUIRED_ENVS = ["PORT"];
REQUIRED_ENVS.forEach((name) => {
  if (!process.env[name]) {
    console.error(`❌ Missing required env var: ${name}`);
    process.exit(1);
  }
});

const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: process.env.CORS_ORIGIN || "*" },
});

app.use(helmet());

app.use((req, res, next) => {
  req.id = uuid();
  res.setHeader("X-Request-Id", req.id);
  next();
});

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 600, 
  })
);

app.use(express.json());
app.use(morgan("dev"));

// ROUTES
app.use("/api", apiRouter);

// Healthcheck endpoint
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Error handler middleware
app.use((err, req, res, next) => {
  logger.error("Unhandled error", {
    error: err.message,
    stack: err.stack,
    requestId: req.id,
  });

  const status = err.status || 500;
  res.status(status).json({
    error:
      process.env.NODE_ENV === "production"
        ? "Internal Server Error"
        : err.message,
  });
});


registerSocketHandlers(io);


const PORT = process.env.PORT || 5000;
const httpServer = server.listen(PORT, () =>
  logger.info(`🚀 Server running on port ${PORT}`)
);

// Set server timeout (avoid hanging connections)
httpServer.setTimeout(10 * 1000);


function shutdown(signal) {
  logger.info(`${signal} received: closing server`);
  httpServer.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
}
["SIGINT", "SIGTERM"].forEach((sig) =>
  process.on(sig, () => shutdown(sig))
);

// Catch unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection", { reason, promise });
});
