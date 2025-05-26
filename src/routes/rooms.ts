import { Router } from "express";
import { GameRoom } from "../lib/types";

const router = Router();

// migrate to db whenever
export const rooms = new Map<string, GameRoom>();

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// GET all rooms
router.get("/", (req, res) => {
  const allRooms = Array.from(rooms.values()).map((room) => ({
    id: room.id,
    playerCount: room.players.length,
    state: room.state,
  }));

  res.json({ rooms: allRooms });
});

// POST create room
router.post("/", (req, res) => {
  const roomId = generateRoomCode();
  const { maxLives = 3, numbersPerPlayer = 6 } = req.body;

  const room: GameRoom = {
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

  rooms.set(roomId, room);
  res.json({ roomId, room });
});

// GET room by id
router.get("/:roomId", (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);

  if (!room) {
    res.status(404).json({ error: "Room not found" });
  }

  res.json({ room });
});

export default router;
