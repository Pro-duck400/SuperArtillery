import type { TimerHandle, TimerScheduler } from '@superartillery/core';

export { GameCleanupService, type GameCleanupOptions, SystemClock } from '@superartillery/core';
export type { Clock, TimerHandle, TimerScheduler } from '@superartillery/core';

export class SystemTimerScheduler implements TimerScheduler {
  public setInterval(callback: () => void, milliseconds: number): TimerHandle {
    return setInterval(callback, milliseconds);
  }

  public clearInterval(timer: TimerHandle): void {
    clearInterval(timer as ReturnType<typeof setInterval>);
  }
}