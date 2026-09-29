import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Game } from '../ts/game';
import { GameClient } from '../ts/game-client';
import { LocalGameGateway } from '../ts/network/local-game-gateway';

describe('LocalGameGateway', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates, connects, and plays a local game without fetch or WebSocket', async () => {
    const fetchSpy = vi.fn();
    const webSocketSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('WebSocket', webSocketSpy);

    const game = new Game();
    const client = new GameClient(new LocalGameGateway(), game);
    const gameStarted = vi.fn();
    const turnChanged = vi.fn();
    client.onGameStart(gameStarted);
    client.onTurnChange(turnChanged);

    const created = await client.createHotSeatGame(['Alice', 'Bob', 'Charlie']);
    expect(created.players.map(player => player.name)).toEqual(['Alice', 'Bob', 'Charlie']);
    await client.connectToGame();
    await vi.waitFor(() => expect(gameStarted).toHaveBeenCalledOnce());
    expect(game.isHotSeat()).toBe(true);
    expect(game.getPlayers()).toHaveLength(3);

    await client.fire(45, 30);
    await vi.waitFor(() => expect(turnChanged).toHaveBeenCalledWith(1, true));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(webSocketSpy).not.toHaveBeenCalled();

    client.clearSession();
  });
});