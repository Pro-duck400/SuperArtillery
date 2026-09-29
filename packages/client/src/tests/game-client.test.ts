import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameClient } from '../ts/game-client';
import { Game } from '../ts/game';
import type { GameGateway } from '../ts/network/game-gateway';

function createGateway(): GameGateway {
  return {
    healthCheckWithRetry: vi.fn(async () => ({
      status: 'ok' as const,
      timestamp: new Date().toISOString(),
      uptime: '0.00:00:01.000',
      games: 0,
      invites: 0,
      version: '1.0.0',
      coreVersion: '1.0.0',
      contractVersion: '1.0.0'
    })),
    getStats: vi.fn(async () => ({
      status: 'ok' as const,
      timestamp: new Date().toISOString(),
      uptime: '0.00:00:01.000',
      games: 0,
      invites: 0,
      webSockets: 0,
      totals: { games: 0, rematches: 0 },
      version: '1.0.0',
      coreVersion: '1.0.0',
      contractVersion: '1.0.0'
    })),
    createGame: vi.fn(async () => ({
      gameId: 'game-123',
      playerToken: 'token-a',
      inviteUrl: 'https://example.com/?invite=token-a',
      inviteCode: 'ABCD',
      playerCount: 2
    })),
    createLocalGame: vi.fn(async () => ({
      gameId: 'local-game',
      players: [
        { playerId: 0, name: 'Alice', playerToken: 'token-a' },
        { playerId: 1, name: 'Bob', playerToken: 'token-b' }
      ]
    })),
    acceptInvitation: vi.fn(async () => ({ gameId: 'game-123', playerToken: 'token-b', playerId: 1 })),
    getGameStatus: vi.fn(async () => ({
      status: 'pending' as const,
      playersConnected: 1,
      required: 2,
      ready: false,
      readyCount: 0,
      slots: [],
      canSkipWaiting: false
    })),
    skipWaiting: vi.fn(async () => ({ started: false, playersConnected: 1, required: 2, slots: [] })),
    fire: vi.fn(async () => {}),
    requestRematch: vi.fn(async () => ({ answer: 'play_again' as const, answered: 1, required: 2, players: [], roundStarted: false })),
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(),
    onMessage: vi.fn(),
    onError: vi.fn()
  };
}

describe('GameClient private-game flow', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('stores a create-game session and exposes it', async () => {
    const game = new Game();
    const gateway = createGateway();
    const client = new GameClient(gateway, game);

    await client.createGame('Alice');

    expect(gateway.healthCheckWithRetry).toHaveBeenCalled();
    expect(gateway.createGame).toHaveBeenCalledWith('Alice', window.location.href);
    expect(client.getGameSession()?.gameId).toBe('game-123');
    expect(client.hasActiveSession()).toBe(true);
  });

  it('restores a previously saved session from storage', () => {
    sessionStorage.setItem(
      'gameSession',
      JSON.stringify({
        gameId: 'saved-game',
        sessionToken: 'saved-token',
        playerName: 'Alice'
      })
    );

    const game = new Game();
    const client = new GameClient(createGateway(), game);

    expect(client.hasActiveSession()).toBe(true);
    expect(client.getGameSession()?.gameId).toBe('saved-game');
  });

  it('returns player id from the stored session when available', () => {
    const game = new Game();
    const client = new GameClient(createGateway(), game);

    game.setPlayer(0, 'Alice');
    expect(client.getPlayerId()).toBe(0);
  });

  it('records only local player shots received from the server', () => {
    const game = new Game();
    game.setPlayer(0, 'Alice');
    const client = new GameClient(createGateway(), game);

    (client as any).handleMessage({ type: 'shot', playerId: 1, angle: 20, velocity: 100 });
    (client as any).handleMessage({ type: 'shot', playerId: 0, angle: 45, velocity: 150 });

    expect(game.getShotHistory()).toEqual([{ angle: 45, velocity: 150 }]);
  });

  it('dispatches rematch readiness updates from the server', () => {
    const game = new Game();
    const client = new GameClient(createGateway(), game);
    const statusSpy = vi.fn();

    client.onRematchStatus(statusSpy);
    (client as any).handleMessage({
      type: 'rematch_status',
      playersReady: 1,
      required: 2
    });

    expect(statusSpy).toHaveBeenCalledWith(1);
  });

  it('applies consecutive turn changes for both players', () => {
    const game = new Game();
    game.setPlayer(0, 'Alice');
    const client = new GameClient(createGateway(), game);
    const players = [
      { playerId: 0, name: 'Alice', active: true, connected: true },
      { playerId: 1, name: 'Bob', active: true, connected: true }
    ];

    (client as any).handleMessage({ type: 'turn_change', turnId: 1, players });
    expect(game.getState()).toMatchObject({ currentTurn: 1, isMyTurn: false });

    (client as any).handleMessage({ type: 'turn_change', turnId: 0, players });
    expect(game.getState()).toMatchObject({ currentTurn: 0, isMyTurn: true });
  });
});
