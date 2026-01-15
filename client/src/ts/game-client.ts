// Coordinates network communication (HTTP + WebSocket)
import { Game } from './game';
import { WebSocketClient } from './network/websocket';
import { ApiClient } from './network/api';
import type { GameMessage } from './types/messages';

export interface ShotEventData {
  playerId: number;
  angle: number;
  velocity: number;
}

export class GameClient {
  private game: Game;
  private apiClient: ApiClient;
  private wsClient: WebSocketClient | null = null;
  private wsBaseUrl: string;

  // Event callbacks
  private onGameStartCallback: ((gameId: number) => void) | null = null;
  private onShotCallback: ((data: ShotEventData) => void) | null = null;
  private onTurnChangeCallback: ((playerId: number, isMyTurn: boolean) => void) | null = null;
  private onGameOverCallback: ((winnerId: number, didIWin: boolean) => void) | null = null;
  private onConnectedCallback: (() => void) | null = null;

  constructor(apiBaseUrl: string, wsBaseUrl: string, game: Game) {
    this.game = game;
    this.apiClient = new ApiClient(apiBaseUrl);
    this.wsBaseUrl = wsBaseUrl;
  }

  /**
   * Register a new player and connect to WebSocket
   */
  public async register(playerName: string): Promise<void> {
    // Step 1: Register via HTTP
    const { playerId } = await this.apiClient.register(playerName);
    this.game.setPlayerId(playerId);
    console.log(`Registered as Player ${playerId} (${playerName})`);

    // Step 2: Connect WebSocket with playerId
    const wsUrl = `${this.wsBaseUrl}?playerId=${playerId}`;
    this.wsClient = new WebSocketClient(wsUrl);
    this.wsClient.onMessage((message) => this.handleMessage(message));
    await this.wsClient.connect();
    
    if (this.onConnectedCallback) {
      this.onConnectedCallback();
    }
  }

  /**
   * Fire a shot
   */
  public async fire(angle: number, velocity: number): Promise<void> {
    const gameId = this.game.getGameId();
    const playerId = this.game.getPlayerId();

    if (gameId === null || playerId === null) {
      throw new Error('Game not started yet');
    }

    await this.apiClient.fire(gameId, playerId, angle, velocity);
    // Server will send WebSocket messages (shot + turn_change) to update state
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: GameMessage): void {
    switch (message.type) {
      case 'game_start':
        this.game.setGameId(message.gameId);
        if (this.onGameStartCallback) {
          this.onGameStartCallback(message.gameId);
        }
        break;

      case 'shot':
        if (this.onShotCallback) {
          this.onShotCallback({
            playerId: message.playerId,
            angle: message.angle,
            velocity: message.velocity
          });
        }
        break;

      case 'turn_change':
        this.game.setCurrentTurn(message.playerId_turn);
        const state = this.game.getState();
        if (this.onTurnChangeCallback) {
          this.onTurnChangeCallback(message.playerId_turn, state.isMyTurn);
        }
        console.log(`Turn changed to Player ${message.playerId_turn}`);
        break;

      case 'game_over':
        const gameOverState = this.game.getState();
        const myPlayerId = gameOverState.playerId;
        const didIWin = myPlayerId !== null && myPlayerId === message.playerId_winner;
        if (this.onGameOverCallback) {
          this.onGameOverCallback(message.playerId_winner, didIWin);
        }
        break;
    }
  }

  /**
   * Event callback registrations
   */
  public onConnected(callback: () => void): void {
    this.onConnectedCallback = callback;
  }

  public onGameStart(callback: (gameId: number) => void): void {
    this.onGameStartCallback = callback;
  }

  public onShot(callback: (data: ShotEventData) => void): void {
    this.onShotCallback = callback;
  }

  public onTurnChange(callback: (playerId: number, isMyTurn: boolean) => void): void {
    this.onTurnChangeCallback = callback;
  }

  public onGameOver(callback: (winnerId: number, didIWin: boolean) => void): void {
    this.onGameOverCallback = callback;
  }

  /**
   * Get current player ID
   */
  public getPlayerId(): number | null {
    return this.game.getPlayerId();
  }
}
