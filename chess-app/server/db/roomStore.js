import { connectDB } from "./connection.js";

const memoryRooms = new Map();

function useMemoryStore() {
  return process.env.USE_MEMORY_STORE === "1";
}

/**
 * Save or update a room in the database.
 * @param {Room} room
 */
export async function saveRoom(room) {
  if (useMemoryStore()) {
    memoryRooms.set(room.id, room.serialize());
    return;
  }

  const pool = await connectDB();
  const data = room.serialize();

  await pool.query(
    `INSERT INTO rooms (id, players, fen, history, status, commentary)
     VALUES ($1, $2::jsonb, $3, $4::jsonb, $5::jsonb, $6::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       players = EXCLUDED.players,
       fen = EXCLUDED.fen,
       history = EXCLUDED.history,
       status = EXCLUDED.status,
       commentary = EXCLUDED.commentary,
       updated_at = NOW()`,
    [
      data.id,
      JSON.stringify(data.players),
      data.fen,
      JSON.stringify(data.history),
      JSON.stringify(data.status),
      JSON.stringify(data.commentary),
    ]
  );
}

/**
 * Load a room by its ID.
 * @param {string} roomId
 * @returns {Promise<Object|null>} - The room document, or null if not found.
 */
export async function loadRoom(roomId) {
  if (useMemoryStore()) {
    return memoryRooms.get(roomId) || null;
  }

  const pool = await connectDB();
  const { rows } = await pool.query(
    `SELECT id, players, fen, history, status, commentary
     FROM rooms WHERE id = $1`,
    [roomId]
  );

  return rows[0] || null;
}

/**
 * Delete a room by its ID.
 * @param {string} roomId
 * @returns {Promise<boolean>} - True if a room was deleted.
 */
export async function deleteRoom(roomId) {
  if (useMemoryStore()) {
    return memoryRooms.delete(roomId);
  }

  const pool = await connectDB();
  const { rowCount } = await pool.query(`DELETE FROM rooms WHERE id = $1`, [
    roomId,
  ]);
  return rowCount > 0;
}

/**
 * Find all rooms containing a player with the given socket ID.
 * @param {string} socketId
 * @returns {Promise<Object[]>}
 */
export async function findRoomsByPlayerId(socketId) {
  if (useMemoryStore()) {
    return [...memoryRooms.values()].filter((room) =>
      room.players?.some((p) => p.id === socketId)
    );
  }

  const pool = await connectDB();
  const { rows } = await pool.query(
    `SELECT id, players, fen, history, status, commentary
     FROM rooms
     WHERE EXISTS (
       SELECT 1 FROM jsonb_array_elements(players) AS p
       WHERE p->>'id' = $1
     )`,
    [socketId]
  );

  return rows;
}
