export class Player {
  /**
   * @param {string} id - Unique player ID (usually socket.id).
   * @param {string} [name="Guest"] - Display name.
   * @param {"w"|"b"|null} [color=null] - Assigned chess color.
   */
  constructor(id, name = "Guest", color = null) {
    if (!id || typeof id !== "string") {
      throw new Error("Player must have a valid string ID");
    }

    this.id = id;
    this.name = name.trim() || "Guest";
    this.color = color;
    this.isConnected = true;
    this.isReady = false;
    this.joinedAt = new Date();
  }

  /**
   * Assign a color to the player.
   * @param {"w"|"b"} color
   */
  setColor(color) {
    if (color !== "w" && color !== "b") {
      throw new Error(`Invalid color: ${color}. Must be "w" or "b".`);
    }
    this.color = color;
  }

  /**
   * Mark the player as ready or not.
   * @param {boolean} ready
   */
  setReady(ready) {
    this.isReady = Boolean(ready);
  }

  /**
   * Mark the player as connected/disconnected.
   * @param {boolean} status
   */
  setConnection(status) {
    this.isConnected = Boolean(status);
  }

  /**
   * Serialize safe player data for clients (no sensitive info).
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      color: this.color,
      isConnected: this.isConnected,
      isReady: this.isReady,
      joinedAt: this.joinedAt.toISOString(),
    };
  }

  /**
   * Reconstruct a Player from plain JSON (e.g., database).
   * @param {Object} data
   * @returns {Player}
   */
  static fromJSON(data) {
    const player = new Player(data.id, data.name, data.color);
    player.isConnected = Boolean(data.isConnected);
    player.isReady = Boolean(data.isReady);
    player.joinedAt = new Date(data.joinedAt);
    return player;
  }
}
