import { db } from "../database/database";
import { GameRoom, Player, GameEvent } from "../lib/types";

export class RoomService {
  // Prepared statements - will be initialized after database setup
  private static createRoomStmt: any;
  private static getRoomStmt: any;
  private static updateRoomStmt: any;
  private static deleteRoomStmt: any;
  private static getRoomsStmt: any;
  private static addPlayerStmt: any;
  private static removePlayerStmt: any;
  private static getPlayersStmt: any;
  private static updatePlayerNumbersStmt: any;
  private static initialized = false;

  // Initialize prepared statements after database is ready
  static initialize() {
    if (this.initialized) return;

    this.createRoomStmt = db.prepare(`
      INSERT INTO rooms (id, max_lives, numbers_per_player, lives, host_id)
      VALUES (?, ?, ?, ?, ?)
    `);

    this.getRoomStmt = db.prepare(`
      SELECT * FROM rooms WHERE id = ?
    `);

    this.updateRoomStmt = db.prepare(`
      UPDATE rooms 
      SET lives = ?, state = ?, timeline = ?, game_events = ?, host_id = ?
      WHERE id = ?
    `);

    this.deleteRoomStmt = db.prepare(`
      DELETE FROM rooms WHERE id = ?
    `);

    this.getRoomsStmt = db.prepare(`
      SELECT r.*, COUNT(p.id) as player_count
      FROM rooms r
      LEFT JOIN players p ON r.id = p.room_id
      GROUP BY r.id
      ORDER BY r.created_at DESC
    `);

    this.addPlayerStmt = db.prepare(`
      INSERT OR REPLACE INTO players (id, room_id, username, numbers)
      VALUES (?, ?, ?, ?)
    `);

    this.removePlayerStmt = db.prepare(`
      DELETE FROM players WHERE id = ?
    `);

    this.getPlayersStmt = db.prepare(`
      SELECT * FROM players WHERE room_id = ? ORDER BY joined_at ASC
    `);

    this.updatePlayerNumbersStmt = db.prepare(`
      UPDATE players SET numbers = ? WHERE id = ?
    `);

    this.initialized = true;
    console.log("RoomService initialized with prepared statements");
  }

  static createRoom(
    roomId: string,
    maxLives: number,
    numbersPerPlayer: number,
  ): GameRoom {
    this.initialize(); // Ensure initialized
    try {
      this.createRoomStmt.run(roomId, maxLives, numbersPerPlayer, maxLives, "");

      return {
        id: roomId,
        players: [],
        timeline: [],
        lives: maxLives,
        maxLives: maxLives,
        numbersPerPlayer: numbersPerPlayer,
        state: "lobby",
        hostId: "",
        gameEvents: [],
      };
    } catch (error) {
      console.error("Error creating room:", error);
      throw new Error("Failed to create room");
    }
  }

  static getRoom(roomId: string): GameRoom | null {
    this.initialize(); // Ensure initialized
    try {
      const roomRow = this.getRoomStmt.get(roomId) as any;
      if (!roomRow) return null;

      const playersRows = this.getPlayersStmt.all(roomId) as any[];

      const players: Player[] = playersRows.map((row) => ({
        id: row.id,
        username: row.username,
        numbers: JSON.parse(row.numbers || "[]"),
      }));

      return {
        id: roomRow.id,
        players: players,
        timeline: JSON.parse(roomRow.timeline || "[]"),
        lives: roomRow.lives,
        maxLives: roomRow.max_lives,
        numbersPerPlayer: roomRow.numbers_per_player,
        state: roomRow.state,
        hostId: roomRow.host_id || "",
        gameEvents: JSON.parse(roomRow.game_events || "[]"),
      };
    } catch (error) {
      console.error("Error getting room:", error);
      return null;
    }
  }

  static updateRoom(room: GameRoom): void {
    try {
      this.updateRoomStmt.run(
        room.lives,
        room.state,
        JSON.stringify(room.timeline),
        JSON.stringify(room.gameEvents),
        room.hostId,
        room.id,
      );

      // Update all players
      for (const player of room.players) {
        this.updatePlayerNumbersStmt.run(
          JSON.stringify(player.numbers),
          player.id,
        );
      }
    } catch (error) {
      console.error("Error updating room:", error);
      throw new Error("Failed to update room");
    }
  }

  static deleteRoom(roomId: string): void {
    try {
      this.deleteRoomStmt.run(roomId);
    } catch (error) {
      console.error("Error deleting room:", error);
      throw new Error("Failed to delete room");
    }
  }

  static getAllRooms(): Array<{
    id: string;
    playerCount: number;
    state: string;
  }> {
    try {
      const rows = this.getRoomsStmt.all() as any[];
      return rows.map((row) => ({
        id: row.id,
        playerCount: row.player_count || 0,
        state: row.state,
      }));
    } catch (error) {
      console.error("Error getting all rooms:", error);
      return [];
    }
  }

  static addPlayer(roomId: string, player: Player): void {
    try {
      this.addPlayerStmt.run(
        player.id,
        roomId,
        player.username,
        JSON.stringify(player.numbers),
      );
    } catch (error) {
      console.error("Error adding player:", error);
      throw new Error("Failed to add player");
    }
  }

  static removePlayer(playerId: string): void {
    try {
      this.removePlayerStmt.run(playerId);
    } catch (error) {
      console.error("Error removing player:", error);
      throw new Error("Failed to remove player");
    }
  }

  static setHost(roomId: string, hostId: string): void {
    try {
      db.prepare("UPDATE rooms SET host_id = ? WHERE id = ?").run(
        hostId,
        roomId,
      );
    } catch (error) {
      console.error("Error setting host:", error);
      throw new Error("Failed to set host");
    }
  }

  // Get rooms that haven't been updated recently (for cleanup)
  static getInactiveRooms(hoursAgo: number = 24): string[] {
    try {
      const stmt = db.prepare(`
        SELECT id FROM rooms 
        WHERE updated_at < datetime('now', '-${hoursAgo} hours')
      `);
      const rows = stmt.all() as any[];
      return rows.map((row) => row.id);
    } catch (error) {
      console.error("Error getting inactive rooms:", error);
      return [];
    }
  }
}
