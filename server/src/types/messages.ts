// Shared message types between client and server

export interface GameStartMessage {
  type: "game_start";
  playerId: 0 | 1;
  turn: 0 | 1;
}

export interface FireMessage {
  type: "fire";
  angle: number;
  velocity: number;
}

export interface GameOverMessage {
  type: "game_over";
  winner: 0 | 1;
}

export interface TurnChangeMessage {
  type: "turn_change";
  turn: 0 | 1;
}

export type GameMessage = GameStartMessage | FireMessage | GameOverMessage | TurnChangeMessage;
