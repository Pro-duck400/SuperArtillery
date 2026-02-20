// Shared message types between client and server

export interface BattlefieldConfig {
  canvasWidth: number;
  canvasHeight: number;
  gravity: number;
  castles: [CastleConfig, CastleConfig];
} 

export interface CastleConfig {
  playerId: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GameStartMessage {
  type: "game_start";
  gameId: number;
  battlefield: BattlefieldConfig;
}

export interface ShotMessage {
  type: "shot";
  playerId: 0 | 1;
  angle: number;
  velocity: number;
}

export interface TurnChangeMessage {
  type: "turn_change";
  playerId_turn: 0 | 1;
}

export interface GameOverMessage {
  type: "game_over";
  playerId_winner: 0 | 1;
}


export type GameMessage = GameStartMessage | ShotMessage | TurnChangeMessage | GameOverMessage;
