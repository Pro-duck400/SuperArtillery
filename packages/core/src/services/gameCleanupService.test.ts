import { describe, expect, it, vi } from 'vitest';
import type { PlayerConnection } from '../ports/player-connection';
import type { Clock } from '../ports/clock';
import type { PrivateGame } from '../types/private-game';
import { GameCleanupService } from './gameCleanupService';
import { InMemoryGameRepository } from './gameRepository';

function createGame(overrides: Partial<PrivateGame> = {}): PrivateGame {
  return {
    id: 'game-1',
    status: 'pending',
    createdAt: 0,
    expiresAt: 100,
    lastActivityAt: 0,
    invitation: { inviteCode: 'ABCD', inviteCodeHash: 'code-hash', expiresAt: 100, accepted: false },
    initiator: { name: 'Alice', sessionTokenHash: 'alice-hash', connection: null },
    invited: { name: 'Bob', sessionTokenHash: 'bob-hash', connection: null },
    currentTurn: 0,
    gameStarted: false,
    round: 1,
    rematchReady: [false, false],
    lobbySlots: [],
    ...overrides
  };
}

function createClock(now: number): Clock {
  return { now: () => now };
}

describe('GameCleanupService', () => {
  it('removes an expired pending game and closes its connections', () => {
    const repository = new InMemoryGameRepository();
    const initiatorConnection = { close: vi.fn(), isOpen: () => true, send: vi.fn() } satisfies PlayerConnection;
    const invitedConnection = { close: vi.fn(), isOpen: () => true, send: vi.fn() } satisfies PlayerConnection;
    repository.set(createGame({
      initiator: { name: 'Alice', sessionTokenHash: 'alice-hash', connection: initiatorConnection },
      invited: { name: 'Bob', sessionTokenHash: 'bob-hash', connection: invitedConnection }
    }));
    new GameCleanupService(repository, createClock(101)).cleanup();
    expect(repository.size).toBe(0);
    expect(initiatorConnection.close).toHaveBeenCalledOnce();
    expect(invitedConnection.close).toHaveBeenCalledOnce();
  });

  it('marks an inactive active game expired without deleting it before its expiry', () => {
    const repository = new InMemoryGameRepository();
    repository.set(createGame({ status: 'active', gameStarted: true, expiresAt: 1_000, lastActivityAt: 0 }));
    new GameCleanupService(repository, createClock(31), { activeGameTtlMs: 30 }).cleanup();
    expect(repository.get('game-1')?.status).toBe('expired');
    expect(repository.size).toBe(1);
  });

  it('removes a finished game after its grace period', () => {
    const repository = new InMemoryGameRepository();
    repository.set(createGame({ status: 'finished', gameStarted: true, gameFinishedAt: 100 }));
    new GameCleanupService(repository, createClock(201), { finishedGameGracePeriodMs: 100 }).cleanup();
    expect(repository.size).toBe(0);
  });

  it('does not remove a game at the exact expiration boundary', () => {
    const repository = new InMemoryGameRepository();
    repository.set(createGame());
    new GameCleanupService(repository, createClock(100)).cleanup();
    expect(repository.size).toBe(1);
    expect(repository.get('game-1')?.status).toBe('pending');
  });
});