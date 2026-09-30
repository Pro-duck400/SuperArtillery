import type { BattlefieldConfig, GameStartMessage } from './types/messages';
import type { GameStatusResponse } from './network/game-gateway';

export interface ShotEventData {
  playerId: number;
  angle: number;
  velocity: number;
  direction: 'Left' | 'Right';
}

export interface GameClientEventMap {
  gameStart: [gameId: string, battlefield: BattlefieldConfig];
  shot: [data: ShotEventData];
  turnChange: [playerId: number, isMyTurn: boolean];
  gameOver: [winnerId: number, didIWin: boolean];
  playerHit: [playerId: number, playerName: string];
  rematchStatus: [answered: number, requiredPlayers: number, players: Array<{ playerId: number; playerName: string; answer?: 'play_again' | 'had_enough' | 'not_sure' }>];
  lobbyStatus: [status: GameStatusResponse];
}

export class TypedEventEmitter<Events extends { [Key in keyof Events]: unknown[] }> {
  private readonly listeners = new Map<keyof Events, Array<(...args: never[]) => void>>();

  public on<Key extends keyof Events>(event: Key, listener: (...args: Events[Key]) => void): void {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(listener as unknown as (...args: never[]) => void);
    this.listeners.set(event, listeners);
  }

  public emit<Key extends keyof Events>(event: Key, ...args: Events[Key]): void {
    this.listeners.get(event)?.forEach(listener => listener(...args as unknown as never[]));
  }
}

export type LastGameStartMessage = GameStartMessage;