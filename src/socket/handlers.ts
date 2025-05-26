import { Server, Socket } from "socket.io";
import { rooms } from "../routes/rooms";
import { Player } from "../lib/types";
import { GameEngine } from "../lib/gameLogic";

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

        // Check if game is already in progress
        if (
          room.state === "playing" &&
          !room.players.find((p) => p.id === socket.id)
        ) {
          socket.emit("error", "Cannot join game in progress");
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

        // Send game state if game is in progress
        if (room.state !== "lobby") {
          socket.emit("game-state-updated", GameEngine.getGameState(room));
        }
      },
    );

    // Start game handler
    socket.on("start-game", (data: { roomId: string }) => {
      const { roomId } = data;
      const room = rooms.get(roomId);

      if (!room) {
        socket.emit("error", "Room not found");
        return;
      }

      // Only host can start game
      if (room.hostId !== socket.id) {
        socket.emit("error", "Only host can start the game");
        return;
      }

      // Need at least 2 players
      if (room.players.length < 2) {
        socket.emit("error", "Need at least 2 players to start");
        return;
      }

      // Check if we have enough unique numbers for all players
      const totalNumbersNeeded = room.players.length * room.numbersPerPlayer;
      const availableNumbers = 100; // 1-100 range

      if (totalNumbersNeeded > availableNumbers) {
        socket.emit(
          "error",
          `Not enough unique numbers available. Need ${totalNumbersNeeded} but only have ${availableNumbers}. Reduce players or numbers per player.`,
        );
        return;
      }

      try {
        // Initialize game
        GameEngine.initializeGame(room);

        // Add game started event to server-side events
        GameEngine.addGameEvent(room, {
          type: "game-started",
          data: {
            message:
              "Game started! Work together to play all numbers in ascending order. No communication allowed!",
          },
          timestamp: Date.now(),
        });

        // Notify all players with updated room state (includes events)
        io.to(roomId).emit("room-updated", room);
        io.to(roomId).emit("game-state-updated", GameEngine.getGameState(room));

        console.log(`Game started in room ${roomId}`);
      } catch (error: any) {
        console.error(`Failed to start game in room ${roomId}:`, error);
        socket.emit("error", `Failed to start game: ${error.message}`);
      }
    });

    // Play number handler
    socket.on("play-number", (data: { roomId: string; number: number }) => {
      const { roomId, number } = data;
      const room = rooms.get(roomId);

      if (!room) {
        socket.emit("error", "Room not found");
        return;
      }

      const result = GameEngine.makeMove(room, socket.id, number);
      const player = room.players.find((p) => p.id === socket.id);

      if (result.success) {
        // Successful move - add to server events
        GameEngine.addGameEvent(room, {
          type: "move-made",
          data: {
            playerId: socket.id,
            playerName: player?.username,
            number: number,
            timeline: room.timeline,
          },
          timestamp: Date.now(),
        });

        if (result.victory) {
          GameEngine.addGameEvent(room, {
            type: "game-ended",
            data: {
              result: "victory",
              message: "Congratulations! You completed the sequence!",
            },
            timestamp: Date.now(),
          });
        }
      } else {
        // Failed move - add to server events
        GameEngine.addGameEvent(room, {
          type: "move-failed",
          data: {
            playerId: socket.id,
            playerName: player?.username,
            number: number,
            error: result.error,
            livesLost: result.livesLost,
            lives: room.lives,
          },
          timestamp: Date.now(),
        });

        if (result.gameOver) {
          GameEngine.addGameEvent(room, {
            type: "game-ended",
            data: {
              result: "defeat",
              message: "Game Over! You ran out of lives.",
            },
            timestamp: Date.now(),
          });
        }
      }

      // Update all players with current game state (includes synchronized events)
      io.to(roomId).emit("room-updated", room);
      io.to(roomId).emit("game-state-updated", GameEngine.getGameState(room));
    });

    // Reset game handler
    socket.on("reset-game", (data: { roomId: string }) => {
      const { roomId } = data;
      const room = rooms.get(roomId);

      if (!room) {
        socket.emit("error", "Room not found");
        return;
      }

      // Only host can reset
      if (room.hostId !== socket.id) {
        socket.emit("error", "Only host can reset the game");
        return;
      }

      GameEngine.resetGame(room);

      // Add reset event to server-side events
      GameEngine.addGameEvent(room, {
        type: "game-reset",
        data: { message: "Game has been reset" },
        timestamp: Date.now(),
      });

      io.to(roomId).emit("room-updated", room);
      io.to(roomId).emit("game-state-updated", GameEngine.getGameState(room));

      console.log(`Game reset in room ${roomId}`);
    });

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

    // Update game state if game is in progress
    if (room.state !== "lobby") {
      io.to(roomId).emit("game-state-updated", GameEngine.getGameState(room));
    }
  }
};
