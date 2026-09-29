import { describe, expect, it } from 'vitest';
import { PendingPresentationQueue } from '../ts/pending-presentation-queue';

describe('PendingPresentationQueue', () => {
  it('keeps the latest turn and consumes it once', () => {
    const queue = new PendingPresentationQueue();
    queue.queueTurn({ playerId: 0, isMyTurn: true });
    queue.queueTurn({ playerId: 1, isMyTurn: false });
    expect(queue.takeTurn()).toEqual({ playerId: 1, isMyTurn: false });
    expect(queue.takeTurn()).toBeNull();
  });

  it('accumulates hit, defeated, rip, and game-over presentation state', () => {
    const queue = new PendingPresentationQueue();
    queue.queuePlayerHit(1, 'Bob');
    queue.queueGameOver([1, 2]);
    expect(queue.takeGameOver()).toBe(true);
    expect(queue.takeGameOver()).toBe(false);
    expect(queue.pendingHitName).toBe('Bob');
    expect(queue.takeDefeatedPlayerIds()).toEqual([1, 2]);
    expect(queue.hasPendingRip()).toBe(true);
    expect(queue.takeRipPlayerIds()).toEqual([1]);
    expect(queue.hasPendingRip()).toBe(false);
    queue.clearHitName();
    expect(queue.pendingHitName).toBeNull();
  });

  it('resets all pending state between rounds', () => {
    const queue = new PendingPresentationQueue();
    queue.queueTurn({ playerId: 1, isMyTurn: true });
    queue.queuePlayerHit(0, 'Alice');
    queue.queueGameOver([0]);
    queue.reset();
    expect(queue.takeTurn()).toBeNull();
    expect(queue.takeGameOver()).toBe(false);
    expect(queue.takeDefeatedPlayerIds()).toEqual([]);
    expect(queue.pendingHitName).toBeNull();
    expect(queue.hasPendingRip()).toBe(false);
  });
});