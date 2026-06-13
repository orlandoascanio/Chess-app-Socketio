import pg from "pg";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

export function isMemoryStore() {
  return process.env.USE_MEMORY_STORE === "1";
}

export function enableMemoryStore(reason) {
  process.env.USE_MEMORY_STORE = "1";
  if (reason) {
    console.warn(`⚠️  ${reason}`);
  }
}

function dbHostLabel() {
  if (!databaseUrl) return "unknown";
  try {
    return new URL(databaseUrl).host;
  } catch {
    return "invalid URL";
  }
}

export function formatDbConnectionError(err) {
  if (!databaseUrl) {
    return [
      "DATABASE_URL or POSTGRES_URL is not set.",
      "Add one to chess-app/server/.env, or set USE_MEMORY_STORE=1 to run without Postgres.",
    ].join(" ");
  }

  const host = dbHostLabel();
  const code = err?.code;

  if (code === "ECONNREFUSED") {
    return [
      `PostgreSQL connection refused at ${host}.`,
      "Start Postgres locally (e.g. createdb chess_app) or set USE_MEMORY_STORE=1.",
    ].join(" ");
  }

  if (code === "ECONNRESET" || code === "ETIMEDOUT" || code === "ENOTFOUND") {
    const prismaHint = host.includes("prisma.io")
      ? "Prisma pooled URLs often fail outside Prisma deployments — use a direct Postgres URL or USE_MEMORY_STORE=1."
      : "";
    return [
      `Cannot reach database at ${host} (${code || err.message}).`,
      prismaHint,
      "Check DATABASE_URL is valid and the host is reachable.",
      "For local dev without Postgres, set USE_MEMORY_STORE=1 in chess-app/server/.env.",
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (code === "28P01" || code === "28000") {
    return [
      `PostgreSQL authentication failed for ${host}.`,
      "Verify username/password in DATABASE_URL.",
    ].join(" ");
  }

  if (code === "3D000") {
    return [
      `Database does not exist on ${host}.`,
      "Create it (e.g. createdb chess_app) or update DATABASE_URL.",
    ].join(" ");
  }

  return `PostgreSQL error (${code || "unknown"}): ${err.message}`;
}

const pool = databaseUrl
  ? new Pool({ connectionString: databaseUrl, max: 10 })
  : null;

let schemaReady = false;

const __dirname = dirname(fileURLToPath(import.meta.url));

async function runMigrations(client) {
  const sql = await readFile(
    join(__dirname, "migrations", "001_create_rooms.sql"),
    "utf8"
  );
  await client.query(sql);
}

/**
 * Connect to PostgreSQL and ensure schema is ready.
 */
export async function connectDB() {
  if (isMemoryStore()) {
    return null;
  }

  if (!databaseUrl) {
    throw new Error(formatDbConnectionError());
  }

  if (!schemaReady) {
    const client = await pool.connect();
    try {
      await runMigrations(client);
      schemaReady = true;
      console.log("✅ Connected to PostgreSQL");
    } catch (err) {
      const detail = formatDbConnectionError(err);
      console.error("❌ PostgreSQL connection error:", detail);
      err.dbDetail = detail;
      throw err;
    } finally {
      client.release();
    }
  }

  return pool;
}

/**
 * Get the connection pool. Call `connectDB()` first in your server entrypoint.
 */
export function getPool() {
  if (!pool) {
    throw new Error("Database not connected. Call connectDB() first.");
  }
  return pool;
}
