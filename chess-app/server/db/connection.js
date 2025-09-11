import { MongoClient } from "mongodb";

const uri = process.env.MONGO_URI;
if (!uri) {
  throw new Error("❌ MONGO_URI is not defined in environment variables");
}

const client = new MongoClient(uri, {
  maxPoolSize: 10, // good default for small apps
});

let db = null;

/**
 * Connect to MongoDB and return the database instance.
 */
export async function connectDB() {
  if (!db) {
    try {
      await client.connect();
      db = client.db("chessApp"); // adjust DB name if needed
      console.log("✅ Connected to MongoDB Atlas");
    } catch (err) {
      console.error("❌ MongoDB connection error:", err.message);
      throw err;
    }
  }
  return db;
}

/**
 * Get an already connected DB instance.
 * Call `connectDB()` first in your server entrypoint.
 */
export function getDB() {
  if (!db) {
    throw new Error("Database not connected. Call connectDB() first.");
  }
  return db;
}
