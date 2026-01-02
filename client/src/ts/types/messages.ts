// Message types for WebSocket communication

export interface GameStartMessage {
  type: 'game_start';
  playerId: 0 | 1;
  turn: 0 | 1;
}

export interface FireMessage {
  type: 'fire';
  angle: number;
  velocity: number;
}

export interface GameOverMessage {
  type: 'game_over';
  winner: 0 | 1;
}

export type GameMessage = GameStartMessage | FireMessage | GameOverMessage;
