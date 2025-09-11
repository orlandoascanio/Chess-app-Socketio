import { connectDB } from "./connection.js";

/**
 * Get the MongoDB collection for rooms.
 */
export async function getRoomCollection() {
  const db = await connectDB();
  return db.collection("rooms");
}

/**
 * Save or update a room in the database.
 * @param {Room} room
 */
export async function saveRoom(room) {
  const rooms = await getRoomCollection();
  await rooms.updateOne(
    { id: room.id },
    { $set: room.serialize() },
    { upsert: true }
  );
}

/**
 * Load a room by its ID.
 * @param {string} roomId
 * @returns {Promise<Object|null>} - The room document, or null if not found.
 */
export async function loadRoom(roomId) {
  const rooms = await getRoomCollection();
  return rooms.findOne({ id: roomId });
}

/**
 * Delete a room by its ID.
 * @param {string} roomId
 * @returns {Promise<boolean>} - True if a room was deleted.
 */
export async function deleteRoom(roomId) {
  const rooms = await getRoomCollection();
  const result = await rooms.deleteOne({ id: roomId });
  return result.deletedCount > 0;
}
