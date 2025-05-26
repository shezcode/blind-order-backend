export interface Player {
  id: string;
  username: string;
  numbers: number[];
}

export interface GameEvent {
  id: string;
  type:
    | "move-made"
    | "move-failed"
    | "game-started"
    | "game-ended"
    | "game-reset";
  data: any;
  timestamp: number;
}

export interface GameRoom {
  id: string;
  players: Player[];
  timeline: number[];
  lives: number;
  maxLives: number;
  numbersPerPlayer: number;
  state: "lobby" | "playing" | "game-over" | "victory";
  hostId: string;
  gameEvents: GameEvent[];
}
