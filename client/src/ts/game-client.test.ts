import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameClient } from './game-client';
import { Game } from './game';

describe('GameClient private-game flow', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('stores a create-game session and exposes it', async () => {
    const game = new Game();
    const client = new GameClient('http://localhost:3000', 'ws://localhost:3000', game);

    const healthSpy = vi.spyOn((client as any).apiClient, 'healthCheckWithRetry').mockResolvedValue({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: 1,
      gameCount: 0,
      invitationCount: 0,
      maxGamesReached: false,
      version: '1.0.0'
    });
    const apiSpy = vi.spyOn((client as any).apiClient, 'createGame').mockResolvedValue({
      gameId: 'game-123',
      playerToken: 'token-a',
      inviteUrl: 'https://example.com/?invite=token-a',
      inviteCode: 'ABC123'
    });

    await client.createGame('Alice');

    expect(healthSpy).toHaveBeenCalled();
    expect(apiSpy).toHaveBeenCalledWith('Alice');
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
    const client = new GameClient('http://localhost:3000', 'ws://localhost:3000', game);

    expect(client.hasActiveSession()).toBe(true);
    expect(client.getGameSession()?.gameId).toBe('saved-game');
  });

  it('returns player id from the stored session when available', () => {
    const game = new Game();
    const client = new GameClient('http://localhost:3000', 'ws://localhost:3000', game);

    game.setPlayer(0, 'Alice');
    expect(client.getPlayerId()).toBe(0);
  });
});
