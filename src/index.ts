import express, { Request, Response } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { GameRoom, Player } from "./lib/types";

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

const rooms = new Map<string, GameRoom>();

app.use(cors());
app.use(express.json());

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

app.get("/", (req, res) => {
  res.json({ message: "BlindOrder API running!" });
});

app.post("/room", (req, res) => {
  const roomId = generateRoomCode();
  const room: GameRoom = {
    id: roomId,
    players: [],
    timeline: [],
    lives: 3,
    maxLives: 3,
    state: "lobby",
  };

  rooms.set(roomId, room);
  res.json({ roomId, room });
  console.log(`room created: ${roomId}`);
  console.log(rooms.values());
});

app.get("/room/:roomId", (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);

  if (!room) {
    res.status(404).json({ error: "Room not found" });
  }

  res.json({ room });
});

app.get("/rooms", (req, res) => {
  const allRooms = Array.from(rooms.values()).map((room) => ({
    id: room.id,
    playerCount: room.players.length,
    state: room.state,
  }));

  res.json({ rooms: allRooms });
});

io.on("connection", (socket) => {
  console.log(`User connected:`, socket.id);

  socket.on("join-room", (data: { roomId: string; playerName: string }) => {
    const { roomId, playerName } = data;
    const room = rooms.get(roomId);

    if (!room) {
      socket.emit("error", "Room not found");
      return;
    }

    const player: Player = {
      id: socket.id,
      username: playerName,
      numbers: [],
    };

    room.players.push(player);
    socket.join(roomId);

    io.to(roomId).emit("room-updated", room);
    console.log(`${playerName} joined room ${roomId}`);
  });

  socket.on("leave-room", (data: { roomId: string }) => {
    const { roomId } = data;
    const room = rooms.get(roomId);

    if (!room) {
      return;
    }

    room.players = room.players.filter((p) => p.id !== socket.id);

    socket.leave(roomId);

    console.log(
      `Player ${socket.id} left room ${roomId}. Remaining players: ${room.players.length}`,
    );

    if (room.players.length === 0) {
      rooms.delete(roomId);
      console.log(`Room ${roomId} deleted - no players left`);
    } else {
      io.to(roomId).emit("room-updated", room);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected: ", socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
