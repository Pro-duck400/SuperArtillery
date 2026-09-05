import { WebSocket } from 'ws';
import type { Battlefield } from '../types/messages';
import type { GameStatus, PrivateGame } from '../types/private-game';
import { createBattlefield } from '../utils/battlefield';
import { calculateCastleHitTime } from '../utils/shotResolver';

export type FireTransition =
  | { kind: 'hit'; hitTime: number }
  | { kind: 'miss'; nextPlayerId: 0 | 1 };

export type RematchTransition =
  | { kind: 'waiting'; playersReady: number }
  | { kind: 'started'; playersReady: number; battlefield: Battlefield; round: number };

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

      game.battlefield = createBattlefield();
      return { battlefield: game.battlefield };
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

    game.rematchReady[playerId] = false;

    if (game.status === 'finished') {
      return { statusChanged: false, status: game.status };
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

  public requestRematch(
    game: PrivateGame,
    playerId: 0 | 1,
    now: number = Date.now()
  ): RematchTransition {
    game.rematchReady[playerId] = true;
    game.lastActivityAt = now;

    const playersReady = game.rematchReady.filter(Boolean).length;
    const bothPlayersConnected =
      game.initiator.websocket?.readyState === WebSocket.OPEN &&
      game.invited.websocket?.readyState === WebSocket.OPEN;
    if (playersReady < 2 || !bothPlayersConnected) {
      return { kind: 'waiting', playersReady };
    }

    game.rematchReady = [false, false];
    game.round += 1;
    game.status = 'active';
    game.gameStarted = true;
    game.currentTurn = 0;
    game.gameFinishedAt = undefined;
    game.battlefield = createBattlefield();

    return {
      kind: 'started',
      playersReady,
      battlefield: game.battlefield,
      round: game.round
    };
  }

  public fire(
    game: PrivateGame,
    playerId: 0 | 1,
    angle: number,
    velocity: number,
    now: number = Date.now()
  ): FireTransition {
    game.lastActivityAt = now;
    const battlefield = game.battlefield ?? createBattlefield();
    game.battlefield = battlefield;
    const hitTime = calculateCastleHitTime(battlefield, playerId, angle, velocity);

    if (hitTime !== null) {
      game.status = 'finished';
      game.gameFinishedAt = now;
      return { kind: 'hit', hitTime };
    }

    game.currentTurn = game.currentTurn === 0 ? 1 : 0;
    return { kind: 'miss', nextPlayerId: game.currentTurn };
  }
}
