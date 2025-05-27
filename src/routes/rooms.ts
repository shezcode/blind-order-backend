import { Router } from "express";
import { RoomService } from "../services/roomService";

const router = Router();

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// GET all rooms
router.get("/", (req, res) => {
  try {
    const allRooms = RoomService.getAllRooms();
    res.json({ rooms: allRooms });
  } catch (error) {
    console.error("Error fetching rooms:", error);
    res.status(500).json({ error: "Failed to fetch rooms" });
  }
});

// POST create room
router.post("/", (req, res) => {
  try {
    const roomId = generateRoomCode();
    const { maxLives = 3, numbersPerPlayer = 6 } = req.body;

    // Validate input
    if (maxLives < 1 || maxLives > 10) {
      res.status(400).json({ error: "Max lives must be between 1 and 10" });
    }

    if (numbersPerPlayer < 1 || numbersPerPlayer > 20) {
      res
        .status(400)
        .json({ error: "Numbers per player must be between 1 and 20" });
    }

    const room = RoomService.createRoom(roomId, maxLives, numbersPerPlayer);
    res.json({ roomId, room });
  } catch (error) {
    console.error("Error creating room:", error);
    res.status(500).json({ error: "Failed to create room" });
  }
});

// GET room by id
router.get("/:roomId", (req, res) => {
  try {
    const { roomId } = req.params;
    const room = RoomService.getRoom(roomId);

    if (!room) {
      res.status(404).json({ error: "Room not found" });
    }

    res.json({ room });
  } catch (error) {
    console.error("Error fetching room:", error);
    res.status(500).json({ error: "Failed to fetch room" });
  }
});

// DELETE room by id (for admin purposes or cleanup)
router.delete("/:roomId", (req, res) => {
  try {
    const { roomId } = req.params;
    const room = RoomService.getRoom(roomId);

    if (!room) {
      res.status(404).json({ error: "Room not found" });
    }

    RoomService.deleteRoom(roomId);
    res.json({ message: "Room deleted successfully" });
  } catch (error) {
    console.error("Error deleting room:", error);
    res.status(500).json({ error: "Failed to delete room" });
  }
});

export default router;
