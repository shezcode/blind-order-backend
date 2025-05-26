export interface Player {
  id: string;
  username: string;
  numbers: number[];
}

export interface GameRoom {
  id: string;
  players: Player[];
  timeline: number[];
  lives: number;
  maxLives: number;
  state: "lobby" | "playing" | "game-over" | "victory";
  hostId: string;
}
