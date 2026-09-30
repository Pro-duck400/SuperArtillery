import { CONTRACT_VERSION } from '@superartillery/core';
import { ApiClient } from './api';
import type { GameGateway } from './game-gateway';
import { WebSocketClient } from './websocket';
import type { GameMessage, WebSocketErrorMessage } from '../types/messages';

export class RemoteGameGateway implements GameGateway {
  private readonly apiClient: ApiClient;
  private readonly wsBaseUrl: string;
  private wsClient: WebSocketClient | null = null;
  private readonly messageHandlers: Array<(message: GameMessage) => void> = [];
  private readonly errorHandlers: Array<(error: WebSocketErrorMessage) => void> = [];

  constructor(apiBaseUrl: string, wsBaseUrl: string) {
    this.apiClient = new ApiClient(apiBaseUrl);
    this.wsBaseUrl = wsBaseUrl;
  }

  public healthCheckWithRetry() {
    return this.apiClient.healthCheckWithRetry().then(async health => {
      const version = await this.apiClient.getVersion();
      if (version.contractVersion !== CONTRACT_VERSION) {
        throw new Error(`API contract mismatch: client ${CONTRACT_VERSION}, server ${version.contractVersion}`);
      }
      return health;
    });
  }

  public getStatus() {
    return this.apiClient.getStatus();
  }

  public getVersion() {
    return this.apiClient.getVersion();
  }

  public createGame(playerName: string, clientUrl: string, playerCount: number = 2) {
    return this.apiClient.createGame(playerName, clientUrl, playerCount);
  }

  public acceptInvitation(inviteCode: string, playerName: string) {
    return this.apiClient.acceptInvitation(inviteCode, playerName);
  }

  public getGameStatus(gameId: string, sessionToken: string) {
    return this.apiClient.getGameStatus(gameId, sessionToken);
  }

  public skipWaiting(gameId: string, sessionToken: string) {
    return this.apiClient.skipWaiting(gameId, sessionToken);
  }

  public fire(gameId: string, sessionToken: string, angle: number, velocity: number, direction?: 'Left' | 'Right') {
    return this.apiClient.fire(gameId, sessionToken, angle, velocity, direction);
  }

  public requestRematch(gameId: string, sessionToken: string, answer: 'play_again' | 'had_enough') {
    return this.apiClient.requestRematch(gameId, sessionToken, answer);
  }

  public async connect(gameId: string, sessionToken: string): Promise<void> {
    this.disconnect();
    const url = `${this.wsBaseUrl}?gameId=${encodeURIComponent(gameId)}&sessionToken=${encodeURIComponent(sessionToken)}&contractVersion=${encodeURIComponent(CONTRACT_VERSION)}`;
    const client = new WebSocketClient(url);
    this.wsClient = client;
    client.onMessage(message => this.messageHandlers.forEach(handler => handler(message)));
    client.onError(error => this.errorHandlers.forEach(handler => handler(error)));
    await client.connect();
  }

  public disconnect(): void {
    this.wsClient?.disconnect();
    this.wsClient = null;
  }

  public onMessage(handler: (message: GameMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  public onError(handler: (error: WebSocketErrorMessage) => void): void {
    this.errorHandlers.push(handler);
  }
}