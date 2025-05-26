import { Server, Socket } from "socket.io";
import { rooms } from "../routes/rooms";
import { Player } from "../lib/types";

export const setupSocketHandlers = (io: Server) => {
  io.on("connection", (socket: Socket) => {
    console.log("User connected:", socket.id);

    // Join room handler
    socket.on(
      "join-room",
      (data: { roomId: string; playerName: string; isHost?: boolean }) => {
        const { roomId, playerName, isHost = false } = data;
        const room = rooms.get(roomId);

        if (!room) {
          socket.emit("error", "Room not found");
          return;
        }

        const player: Player = {
          id: socket.id,
          username: playerName || "Anonymous",
          numbers: [],
        };

        room.players.push(player);

        // Set host if this is the first player or explicitly marked as host
        if (isHost || room.hostId === "") {
          room.hostId = socket.id;
        }

        socket.join(roomId);

        console.log(
          `${playerName} joined room ${roomId}. Host: ${room.hostId === socket.id}`,
        );

        io.to(roomId).emit("room-updated", room);
      },
    );

    // Leave room handler
    socket.on("leave-room", (data: { roomId: string }) => {
      socket.leave(data.roomId);
      handlePlayerLeave(socket.id, data.roomId, io);
    });

    // Disconnect handler
    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      handlePlayerLeave(socket.id, undefined, io);
    });
  });
};

const handlePlayerLeave = (
  socketId: string,
  roomId: string | undefined,
  io: Server,
) => {
  // Find room if not provided
  if (!roomId) {
    for (const [id, room] of rooms.entries()) {
      if (room.players.some((p) => p.id === socketId)) {
        roomId = id;
        break;
      }
    }
  }

  if (!roomId) return;

  const room = rooms.get(roomId);
  if (!room) return;

  const isHost = room.hostId === socketId;
  const wasInLobby = room.state === "lobby";

  // Remove player
  room.players = room.players.filter((p) => p.id !== socketId);

  // If host left and game is in lobby, delete room and kick everyone
  if (isHost && wasInLobby) {
    console.log(`Host left room ${roomId} during lobby. Deleting room.`);

    // Notify all remaining players they're being kicked
    io.to(roomId).emit("room-deleted", { reason: "Host left during lobby" });

    // Remove room
    rooms.delete(roomId);
    return;
  }

  // Normal leave handling
  if (room.players.length === 0) {
    rooms.delete(roomId);
    console.log(`Room ${roomId} deleted - no players remaining`);
  } else {
    // If host left during game, assign new host
    if (isHost && room.players.length > 0) {
      room.hostId = room.players[0].id;
      console.log(`New host assigned: ${room.players[0].username}`);
    }

    io.to(roomId).emit("room-updated", room);
  }
};
