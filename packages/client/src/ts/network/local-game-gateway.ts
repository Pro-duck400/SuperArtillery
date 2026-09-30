import {
  CONTRACT_VERSION,
  CORE_VERSION,
  GameEngine,
  type PlayerConnection,
  type Result
} from '@superartillery/core';
import type { CreateHotSeatResponse } from '@superartillery/core';
import type { GameMessage, WebSocketErrorMessage } from '../types/messages';
import type { GameGateway } from './game-gateway';

export class LocalGameGateway implements GameGateway {
  private readonly engine: GameEngine;
  private readonly messageHandlers: Array<(message: GameMessage) => void> = [];
  private readonly errorHandlers: Array<(error: WebSocketErrorMessage) => void> = [];
  private connection: PlayerConnection | null = null;
  private gameId: string | null = null;
  private playerId: number | null = null;

  constructor(engine: GameEngine = new GameEngine()) {
    this.engine = engine;
  }

  public async healthCheckWithRetry() {
    const stats = this.engine.getStats();
    return {
      status: stats.maxReached ? 'degraded' as const : 'ok' as const,
      timestamp: new Date().toISOString(),
      uptime: '0.00:00:00.000'
    };
  }

  public async getStatus() {
    const stats = this.engine.getStats();
    return {
      games: stats.games,
      invites: stats.invites,
      webSockets: this.connection?.isOpen() ? 1 : 0,
      totals: stats.totals
    };
  }

  public async getVersion() {
    return {
      serverVersion: CORE_VERSION,
      coreVersion: CORE_VERSION,
      contractVersion: CONTRACT_VERSION
    };
  }

  public async createGame(playerName: string, clientUrl: string, playerCount: number = 2) {
    return this.unwrap(this.engine.createGame(playerName, clientUrl, undefined, playerCount));
  }

  public async createLocalGame(names: string[]): Promise<CreateHotSeatResponse> {
    return this.unwrap(this.engine.createLocalGame(names));
  }

  public async acceptInvitation(inviteCode: string, playerName: string) {
    return this.unwrap(this.engine.acceptInvitation(inviteCode, playerName));
  }

  public async getGameStatus(gameId: string, sessionToken: string) {
    return this.unwrap(this.engine.getGameStatus(gameId, sessionToken));
  }

  public async skipWaiting(gameId: string, sessionToken: string) {
    return this.unwrap(this.engine.skipWaiting(gameId, sessionToken));
  }

  public async fire(
    gameId: string,
    sessionToken: string,
    angle: number,
    velocity: number,
    direction?: 'Left' | 'Right'
  ): Promise<void> {
    this.unwrap(this.engine.fire(gameId, sessionToken, angle, velocity, direction));
  }

  public async requestRematch(gameId: string, sessionToken: string, answer: 'play_again' | 'had_enough') {
    return this.unwrap(this.engine.requestRematch(gameId, sessionToken, answer));
  }

  public async connect(gameId: string, sessionToken: string): Promise<void> {
    if (this.connection?.isOpen()) throw new Error('A local game connection is already active');
    let open = true;
    const connection: PlayerConnection = {
      isOpen: () => open,
      send: message => {
        queueMicrotask(() => this.messageHandlers.forEach(handler => handler(message)));
      },
      close: () => { open = false; }
    };
    const result = this.engine.connect(gameId, sessionToken, connection);
    if (!result.ok) {
      connection.close();
      throw new Error(result.error.message);
    }
    this.connection = connection;
    this.gameId = gameId;
    this.playerId = result.value.playerId;
  }

  public disconnect(): void {
    if (this.connection && this.gameId && this.playerId !== null) {
      this.engine.disconnect(this.gameId, this.playerId, this.connection);
      this.connection.close();
    }
    this.connection = null;
    this.gameId = null;
    this.playerId = null;
  }

  public onMessage(handler: (message: GameMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  public onError(handler: (error: WebSocketErrorMessage) => void): void {
    this.errorHandlers.push(handler);
  }

  private unwrap<T>(result: Result<T>): T {
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  }
}