import { WebSocket } from 'ws';
import type { Battlefield } from '../types/messages';
import type { GameStatus, PrivateGame } from '../types/private-game';
import { createBattlefield } from '../utils/battlefield';
import { calculateCastleHitTime } from '../utils/shotResolver';

export type FireTransition =
  | { kind: 'hit'; hitTime: number }
  | { kind: 'miss'; nextPlayerId: 0 | 1 };

export class GameRules {
  public startIfReady(game: PrivateGame, now: number = Date.now()): { battlefield: Battlefield } | null {
    if (
      game.gameStarted ||
      game.initiator.websocket === null ||
      game.invited.websocket === null ||
      game.initiator.websocket.readyState !== WebSocket.OPEN ||
      game.invited.websocket.readyState !== WebSocket.OPEN
    ) {
      return null;
    }

    game.status = 'active';
    game.gameStarted = true;
    game.currentTurn = 0;
    game.lastActivityAt = now;

    return { battlefield: createBattlefield() };
  }

  public disconnect(
    game: PrivateGame,
    playerId: 0 | 1,
    now: number = Date.now()
  ): { statusChanged: boolean; status: GameStatus } {
    if (playerId === 0) {
      game.initiator.websocket = null;
    } else {
      game.invited.websocket = null;
    }

    if (game.gameStarted) {
      game.status = 'finished';
      game.gameFinishedAt = now;
      return { statusChanged: true, status: game.status };
    }

    if (game.status === 'pending' && playerId === 0) {
      game.status = 'expired';
      return { statusChanged: true, status: game.status };
    }

    return { statusChanged: false, status: game.status };
  }

  public fire(
    game: PrivateGame,
    playerId: 0 | 1,
    angle: number,
    velocity: number,
    now: number = Date.now()
  ): FireTransition {
    game.lastActivityAt = now;
    const hitTime = calculateCastleHitTime(createBattlefield(), playerId, angle, velocity);

    if (hitTime !== null) {
      game.status = 'finished';
      game.gameFinishedAt = now;
      return { kind: 'hit', hitTime };
    }

    game.currentTurn = game.currentTurn === 0 ? 1 : 0;
    return { kind: 'miss', nextPlayerId: game.currentTurn };
  }
}
