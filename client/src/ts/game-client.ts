// Coordinates network communication (HTTP + WebSocket)
import { Game } from './game';
import { WebSocketClient } from './network/websocket';
import { ApiClient, type CreateGameResponse, type AcceptInvitationResponse } from './network/api';
import type { BattlefieldConfig, GameMessage, GameStartMessage } from './types/messages';

export interface ShotEventData {
  playerId: number;
  angle: number;
  velocity: number;
}

/**
 * Game session data persisted in sessionStorage
 */
interface GameSession {
  gameId: string;
  sessionToken: string;
  playerName: string;
}

export class GameClient {
  private game: Game;
  private apiClient: ApiClient;
  private wsClient: WebSocketClient | null = null;
  private wsBaseUrl: string;
  private lastGameStartMessage: GameStartMessage | null = null;
  private gameSession: GameSession | null = null;
  private statusPollInterval: NodeJS.Timeout | null = null;
  private onShotCallback: ((data: ShotEventData) => void) | null = null;
  private onTurnChangeCallback: ((playerId: number, isMyTurn: boolean) => void) | null = null;
  private onGameOverCallback: ((winnerId: number, didIWin: boolean) => void) | null = null;
  private onConnectedCallback: (() => void) | null = null;

  constructor(apiBaseUrl: string, wsBaseUrl: string, game: Game) {
    this.game = game;
    this.apiClient = new ApiClient(apiBaseUrl);
    this.wsBaseUrl = wsBaseUrl;

    // Try to restore session from storage
    this.restoreSession();
  }

  /**
   * Create a new private game
   */
  public async createGame(playerName: string): Promise<CreateGameResponse> {
    try {
      // Wake server with health check
      await this.apiClient.healthCheckWithRetry();
    } catch (error) {
      console.error('Server health check failed:', error);
      throw new Error(
        'Server is not responding. Please check your connection and try again.'
      );
    }

    // Create the game
    const response = await this.apiClient.createGame(playerName);
    
    // Store session
    this.gameSession = {
      gameId: response.gameId,
      sessionToken: response.playerToken,
      playerName
    };
    this.saveSession();

    // Set up game state
    this.game.setGameId(response.gameId);
    this.game.setPlayer(0, playerName); // Initiator is always player 0

    console.log(`✅ Game created: ${response.gameId}`);
    return response;
  }

  /**
   * Accept an invitation via token or code
   */
  public async acceptInvitation(
    inviteTokenOrCode: string,
    playerName: string
  ): Promise<AcceptInvitationResponse> {
    try {
      // Wake server with health check
      await this.apiClient.healthCheckWithRetry();
    } catch (error) {
      console.error('Server health check failed:', error);
      throw new Error(
        'Server is not responding. Please check your connection and try again.'
      );
    }

    // Accept the invitation
    const response = await this.apiClient.acceptInvitation(inviteTokenOrCode, playerName);

    // Store session
    this.gameSession = {
      gameId: response.gameId,
      sessionToken: response.playerToken,
      playerName
    };
    this.saveSession();

    // Set up game state
    this.game.setGameId(response.gameId);
    this.game.setPlayer(1, playerName); // Invited player is always player 1

    console.log(`✅ Invitation accepted: ${response.gameId}`);
    return response;
  }

  /**
   * Connect to a game and start polling for status
   */
  public async connectToGame(): Promise<void> {
    if (!this.gameSession) {
      throw new Error('No game session found');
    }

    // Start polling game status until both players are connected
    await this.pollGameStatus();

    // Connect WebSocket with gameId and sessionToken
    const wsUrl = `${this.wsBaseUrl}?gameId=${encodeURIComponent(
      this.gameSession.gameId
    )}&sessionToken=${encodeURIComponent(this.gameSession.sessionToken)}`;

    this.wsClient = new WebSocketClient(wsUrl);
    this.wsClient.onMessage((message) => this.handleMessage(message));

    try {
      await this.wsClient.connect();
      if (this.onConnectedCallback) {
        this.onConnectedCallback();
      }
    } catch (error) {
      throw new Error(
        `Failed to connect to game: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Poll game status until both players are connected
   */
  private async pollGameStatus(): Promise<void> {
    if (!this.gameSession) {
      throw new Error('No game session found');
    }

    const maxWaitTime = 5 * 60 * 1000; // 5 minutes
    const startTime = Date.now();
    const pollInterval = 1000; // 1 second

    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const status = await this.apiClient.getGameStatus(
            this.gameSession!.gameId,
            this.gameSession!.sessionToken
          );

          console.log(`Game status: ${status.playersConnected}/${status.requiredPlayers} connected`);

          if (status.status === 'expired') {
            reject(
              new Error('Game expired. The server may have restarted.')
            );
            return;
          }

          if (status.playersConnected === status.requiredPlayers) {
            clearInterval(this.statusPollInterval!);
            this.statusPollInterval = null;
            resolve();
            return;
          }

          if (Date.now() - startTime > maxWaitTime) {
            clearInterval(this.statusPollInterval as unknown as NodeJS.Timeout);
            this.statusPollInterval = null;
            reject(new Error('Game connection timeout'));
            return;
          }
        } catch (error) {
          console.error('Status poll error:', error);
          // Continue polling even if one request fails
        }
      };

      // First poll immediately
      poll();

      // Then poll periodically
      this.statusPollInterval = window.setInterval(poll, pollInterval);
    });
  }

  /**
   * Register a player (legacy, for backward compatibility)
   */
  public async register(playerName: string): Promise<void> {
    try {
      const { playerId } = await this.apiClient.register(playerName);
      this.game.setPlayer(playerId, playerName);
      console.log(`Registered as Player ${playerId} (${playerName})`);

      // Connect WebSocket with playerId (legacy)
      const wsUrl = `${this.wsBaseUrl}?playerId=${playerId}`;
      this.wsClient = new WebSocketClient(wsUrl);
      this.wsClient.onMessage((message) => this.handleMessage(message));
      await this.wsClient.connect();

      if (this.onConnectedCallback) {
        this.onConnectedCallback();
      }
    } catch (error) {
      throw new Error(
        `Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Fire a shot
   */
  public async fire(angle: number, velocity: number): Promise<void> {
    if (!this.gameSession) {
      throw new Error('No active game session');
    }

    const gameId = this.game.getGameId();
    if (!gameId || gameId !== this.gameSession.gameId) {
      throw new Error('Game ID mismatch');
    }

    await this.apiClient.fire(
      this.gameSession.gameId,
      this.gameSession.sessionToken,
      angle,
      velocity
    );
    // Server will send WebSocket messages (shot + turn_change) to update state
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: GameMessage): void {
    switch (message.type) {
      case 'game_start':
        this.game.setOpponentName(message.opponentName);
        // gameId might be a number or string depending on server version
        const gameId = typeof message.gameId === 'number' ? message.gameId.toString() : message.gameId;
        this.game.setGameId(gameId);
        this.game.setBattlefield(message.battlefield);
        this.lastGameStartMessage = message;
        if (this.onGameStartCallback) {
          this.onGameStartCallback(gameId, message.battlefield);
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
        const didIWin =
          myPlayerId !== null && myPlayerId === message.playerId_winner;
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

  public onGameStart(
    callback: (gameId: string, battlefield: BattlefieldConfig) => void
  ): void {
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

  public getLastGameStartMessage(): GameStartMessage | null {
    return this.lastGameStartMessage;
  }

  /**
   * Session storage management
   */
  private saveSession(): void {
    if (this.gameSession) {
      sessionStorage.setItem('gameSession', JSON.stringify(this.gameSession));
    }
  }

  private restoreSession(): void {
    const stored = sessionStorage.getItem('gameSession');
    if (stored) {
      try {
        this.gameSession = JSON.parse(stored) as GameSession;
        console.log(`Restored game session: ${this.gameSession.gameId}`);
      } catch (error) {
        console.error('Failed to restore session:', error);
        sessionStorage.removeItem('gameSession');
      }
    }
  }

  public clearSession(): void {
    this.gameSession = null;
    sessionStorage.removeItem('gameSession');
  }

  public hasActiveSession(): boolean {
    return this.gameSession !== null;
  }

  public getGameSession(): GameSession | null {
    return this.gameSession;
  }
}
