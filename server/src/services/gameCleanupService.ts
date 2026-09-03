import type { GameRepository } from './gameRepository';
import { GAME_CONFIG } from './gameConfig';

export interface Clock {
  now(): number;
}

export interface TimerScheduler {
  setInterval(callback: () => void, milliseconds: number): NodeJS.Timeout;
  clearInterval(timer: NodeJS.Timeout): void;
}

export class SystemClock implements Clock {
  public now(): number {
    return Date.now();
  }
}

export class SystemTimerScheduler implements TimerScheduler {
  public setInterval(callback: () => void, milliseconds: number): NodeJS.Timeout {
    return setInterval(callback, milliseconds);
  }

  public clearInterval(timer: NodeJS.Timeout): void {
    clearInterval(timer);
  }
}

export interface GameCleanupOptions {
  activeGameTtlMs?: number;
  finishedGameGracePeriodMs?: number;
}

export class GameCleanupService {
  private readonly activeGameTtlMs: number;
  private readonly finishedGameGracePeriodMs: number;

  constructor(
    private readonly games: GameRepository,
    private readonly clock: Clock = new SystemClock(),
    options: GameCleanupOptions = {}
  ) {
    this.activeGameTtlMs = options.activeGameTtlMs ?? GAME_CONFIG.activeGameTtlMs;
    this.finishedGameGracePeriodMs =
      options.finishedGameGracePeriodMs ?? GAME_CONFIG.finishedGameGracePeriodMs;
  }

  public cleanup(): void {
    const now = this.clock.now();
    const toDelete: string[] = [];

    for (const [gameId, game] of this.games.entries()) {
      if (game.status === 'pending' && game.invitation.expiresAt < now) {
        game.status = 'expired';
      }

      if (game.status === 'active' && game.lastActivityAt + this.activeGameTtlMs < now) {
        game.status = 'expired';
      }

      if (
        game.status === 'finished' &&
        game.gameFinishedAt &&
        game.gameFinishedAt + this.finishedGameGracePeriodMs < now
      ) {
        toDelete.push(gameId);
      }

      if (game.status === 'expired' && game.expiresAt < now) {
        toDelete.push(gameId);
      }
    }

    toDelete.forEach(gameId => {
      const game = this.games.get(gameId);
      if (!game) return;

      if (game.initiator.websocket) {
        game.initiator.websocket.close();
      }
      if (game.invited.websocket) {
        game.invited.websocket.close();
      }
      this.games.delete(gameId);
    });
  }
}
