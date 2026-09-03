import { WebSocket } from 'ws';
import { describe, expect, it } from 'vitest';
import type { PrivateGame } from '../types/private-game';
import { GameRules } from '../services/gameRules';

function createGame(): PrivateGame {
  return {
    id: 'game-1',
    status: 'pending',
    createdAt: 100,
    expiresAt: 1_000,
    lastActivityAt: 100,
    invitation: {
      invitationTokenHash: 'invite-hash',
      inviteCode: 'ABCD',
      inviteCodeHash: 'code-hash',
      expiresAt: 1_000,
      accepted: true
    },
    initiator: {
      name: 'Alice',
      sessionTokenHash: 'alice-hash',
      websocket: null
    },
    invited: {
      name: 'Bob',
      sessionTokenHash: 'bob-hash',
      websocket: null
    },
    currentTurn: 0,
    gameStarted: false
  };
}

describe('GameRules', () => {
  it('starts a game when both players have open sockets', () => {
    const game = createGame();
    const socket = { readyState: WebSocket.OPEN } as WebSocket;
    game.initiator.websocket = socket;
    game.invited.websocket = socket;

    const result = new GameRules().startIfReady(game, 200);

    expect(result).not.toBeNull();
    expect(game.status).toBe('active');
    expect(game.gameStarted).toBe(true);
    expect(game.currentTurn).toBe(0);
    expect(game.lastActivityAt).toBe(200);
  });

  it('transitions a pending game to expired when the initiator disconnects', () => {
    const game = createGame();

    const result = new GameRules().disconnect(game, 0, 300);

    expect(result).toEqual({ statusChanged: true, status: 'expired' });
    expect(game.initiator.websocket).toBeNull();
  });

  it('finishes an active game when a player disconnects', () => {
    const game = createGame();
    game.status = 'active';
    game.gameStarted = true;

    const result = new GameRules().disconnect(game, 1, 400);

    expect(result).toEqual({ statusChanged: true, status: 'finished' });
    expect(game.gameFinishedAt).toBe(400);
  });

  it('switches turns after a miss and updates activity', () => {
    const game = createGame();
    game.status = 'active';
    game.gameStarted = true;

    const result = new GameRules().fire(game, 0, 45, 10, 500);

    expect(result).toEqual({ kind: 'miss', nextPlayerId: 1 });
    expect(game.currentTurn).toBe(1);
    expect(game.lastActivityAt).toBe(500);
  });

  it('finishes the game after a hit without switching turns', () => {
    const game = createGame();
    game.status = 'active';
    game.gameStarted = true;

    const result = new GameRules().fire(game, 0, 0, 550, 600);

    expect(result.kind).toBe('hit');
    expect(game.status).toBe('finished');
    expect(game.gameFinishedAt).toBe(600);
    expect(game.currentTurn).toBe(0);
  });
});
