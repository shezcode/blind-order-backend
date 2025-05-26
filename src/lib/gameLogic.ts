import { GameRoom, GameEvent } from "./types";

export interface GameConfig {
  maxLives: number;
  numbersPerPlayer: number;
  minNumber: number;
  maxNumber: number;
}

export interface GameMove {
  playerId: string;
  playerName: string;
  number: number;
  timestamp: number;
}

export class GameEngine {
  static generateAllPlayerNumbers(
    config: GameConfig,
    playerCount: number,
  ): number[][] {
    const totalNumbers = playerCount * config.numbersPerPlayer;
    const range = config.maxNumber - config.minNumber + 1;

    // Check if we have enough numbers in the range
    if (totalNumbers > range) {
      throw new Error(
        `Not enough unique numbers in range. Need ${totalNumbers}, but range only has ${range} numbers.`,
      );
    }

    // Generate all unique numbers we need
    const allNumbers: number[] = [];
    while (allNumbers.length < totalNumbers) {
      const num = Math.floor(Math.random() * range) + config.minNumber;
      if (!allNumbers.includes(num)) {
        allNumbers.push(num);
      }
    }

    // Shuffle the numbers to randomize distribution
    for (let i = allNumbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allNumbers[i], allNumbers[j]] = [allNumbers[j], allNumbers[i]];
    }

    // Distribute numbers to players
    const playerNumbers: number[][] = [];
    for (let playerIndex = 0; playerIndex < playerCount; playerIndex++) {
      const startIndex = playerIndex * config.numbersPerPlayer;
      const endIndex = startIndex + config.numbersPerPlayer;
      const numbers = allNumbers
        .slice(startIndex, endIndex)
        .sort((a, b) => a - b);
      playerNumbers.push(numbers);
    }

    return playerNumbers;
  }

  static initializeGame(room: GameRoom): void {
    const config: GameConfig = {
      maxLives: room.maxLives,
      numbersPerPlayer: room.numbersPerPlayer,
      minNumber: 1,
      maxNumber: 100,
    };

    try {
      // Generate all numbers ensuring no duplicates across players
      const allPlayerNumbers = this.generateAllPlayerNumbers(
        config,
        room.players.length,
      );

      // Assign numbers to each player
      room.players.forEach((player, index) => {
        player.numbers = allPlayerNumbers[index];
      });

      // Reset game state
      room.timeline = [];
      room.lives = room.maxLives;
      room.state = "playing";
    } catch (error) {
      console.error("Failed to initialize game:", error);
      throw error;
    }
  }

  static validateMove(
    room: GameRoom,
    playerId: string,
    number: number,
  ): {
    valid: boolean;
    error?: string;
  } {
    // Check if game is in playing state
    if (room.state !== "playing") {
      return { valid: false, error: "Game is not in playing state" };
    }

    // Find the player
    const player = room.players.find((p) => p.id === playerId);
    if (!player) {
      return { valid: false, error: "Player not found" };
    }

    // Check if player has this number
    if (!player.numbers.includes(number)) {
      return { valid: false, error: "Player does not have this number" };
    }

    // Check if number was already played
    if (room.timeline.includes(number)) {
      return { valid: false, error: "Number already played" };
    }

    // Check if this is the correct next number
    const expectedNumber = this.getNextExpectedNumber(room);
    if (number !== expectedNumber) {
      return {
        valid: false,
        error: `Expected ${expectedNumber}, got ${number}`,
      };
    }

    return { valid: true };
  }

  static getNextExpectedNumber(room: GameRoom): number {
    // Get all numbers from all players
    const allNumbers = room.players
      .flatMap((p) => p.numbers)
      .sort((a, b) => a - b);

    // Find the smallest number not yet played
    for (const num of allNumbers) {
      if (!room.timeline.includes(num)) {
        return num;
      }
    }

    // This shouldn't happen in normal gameplay
    return -1;
  }

  static makeMove(
    room: GameRoom,
    playerId: string,
    number: number,
  ): {
    success: boolean;
    gameOver?: boolean;
    victory?: boolean;
    error?: string;
    livesLost?: number;
  } {
    const validation = this.validateMove(room, playerId, number);

    if (!validation.valid) {
      // Wrong move - lose a life
      room.lives--;

      if (room.lives <= 0) {
        room.state = "game-over";
        return {
          success: false,
          gameOver: true,
          error: validation.error,
          livesLost: 1,
        };
      }

      return {
        success: false,
        error: validation.error,
        livesLost: 1,
      };
    }

    // Valid move
    room.timeline.push(number);

    // Remove number from player's hand
    const player = room.players.find((p) => p.id === playerId)!;
    player.numbers = player.numbers.filter((n) => n !== number);

    // Check for victory condition
    const allNumbersPlayed = room.players.every((p) => p.numbers.length === 0);
    if (allNumbersPlayed) {
      room.state = "victory";
      return { success: true, victory: true };
    }

    return { success: true };
  }

  static getGameState(room: GameRoom) {
    const allNumbers = room.players
      .flatMap((p) => p.numbers)
      .sort((a, b) => a - b);
    const totalNumbers = room.players.length * room.numbersPerPlayer;
    const playedNumbers = room.timeline.length;
    const progress =
      totalNumbers > 0 ? (playedNumbers / totalNumbers) * 100 : 0;

    return {
      state: room.state,
      lives: room.lives,
      maxLives: room.maxLives,
      timeline: room.timeline,
      progress: Math.round(progress),
      remainingNumbers: allNumbers.filter((n) => !room.timeline.includes(n)),
      gameEvents: room.gameEvents,
    };
  }

  static addGameEvent(room: GameRoom, event: Omit<GameEvent, "id">): void {
    const gameEvent: GameEvent = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...event,
    };

    room.gameEvents.push(gameEvent);

    // Keep only last 50 events to prevent memory issues
    if (room.gameEvents.length > 50) {
      room.gameEvents = room.gameEvents.slice(-50);
    }
  }

  static resetGame(room: GameRoom): void {
    room.players.forEach((player) => {
      player.numbers = [];
    });
    room.timeline = [];
    room.lives = room.maxLives;
    room.state = "lobby";
    room.gameEvents = []; // Clear game events on reset
  }
}
