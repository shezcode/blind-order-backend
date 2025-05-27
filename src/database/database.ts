import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// Ensure data directory exists
const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "blindorder.db");
export const db = new Database(dbPath);

// Enable foreign keys
db.pragma("foreign_keys = ON");

// Initialize database schema
export function initializeDatabase() {
  // Rooms table
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      max_lives INTEGER NOT NULL DEFAULT 3,
      numbers_per_player INTEGER NOT NULL DEFAULT 6,
      lives INTEGER NOT NULL DEFAULT 3,
      state TEXT NOT NULL DEFAULT 'lobby' CHECK (state IN ('lobby', 'playing', 'game-over', 'victory')),
      host_id TEXT,
      timeline TEXT DEFAULT '[]',
      game_events TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Players table
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      username TEXT NOT NULL,
      numbers TEXT DEFAULT '[]',
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE
    )
  `);

  // Create indexes for better performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_players_room_id ON players (room_id);
  `);

  // Create trigger to update updated_at on rooms
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_rooms_timestamp
    AFTER UPDATE ON rooms
    BEGIN
      UPDATE rooms SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
  `);

  console.log("Database initialized successfully");
}

// Cleanup old rooms (older than 24 hours with no activity)
export function cleanupOldRooms() {
  const stmt = db.prepare(`
    DELETE FROM rooms 
    WHERE updated_at < datetime('now', '-24 hours')
  `);

  const result = stmt.run();
  if (result.changes > 0) {
    console.log(`Cleaned up ${result.changes} old rooms`);
  }
}

// Run cleanup every hour
setInterval(cleanupOldRooms, 60 * 60 * 1000);
