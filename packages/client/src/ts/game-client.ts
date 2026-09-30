// Coordinates network communication (HTTP + WebSocket)
import { Game } from './game';
import type { GameGateway } from './network/game-gateway';
import type {
  AcceptInvitationResponse,
  CreateGameResponse,
  CreateHotSeatResponse,
  GameStatusResponse
} from './network/game-gateway';
import type {
  BattlefieldConfig,
  GameStartMessage
} from './types/messages';
import { SessionStore, type GameSession } from './session-store';
import { GameMessageDispatcher } from './game-message-dispatcher';
import { TypedEventEmitter, type GameClientEventMap, type ShotEventData } from './game-client-events';

export type { ShotEventData } from './game-client-events';

export class GameClient {
  private game: Game;
  private gateway: GameGateway;
  private readonly sessionStore: SessionStore;
  private readonly events: TypedEventEmitter<GameClientEventMap>;
  private readonly messageDispatcher: GameMessageDispatcher;
  private pendingConnectResolve: (() => void) | null = null;
  private pendingConnectReject: ((error: Error) => void) | null = null;

  constructor(gateway: GameGateway, game: Game) {
    this.game = game;
    this.gateway = gateway;
    this.sessionStore = new SessionStore();
    this.events = new TypedEventEmitter<GameClientEventMap>();
    this.messageDispatcher = new GameMessageDispatcher(game, this.events);
    this.events.on('gameStart', () => this.pendingConnectResolve?.());
    this.events.on('lobbyStatus', status => {
      if (status.status === 'expired') {
        this.pendingConnectReject?.(new Error('Game expired. The server may have restarted.'));
      }
    });
  }

  private get gameSession(): GameSession | null {
    return this.sessionStore.get();
  }

  private set gameSession(session: GameSession | null) {
    this.sessionStore.set(session);
  }

  /**
   * Create a new private game
   */
  public async createGame(playerName: string, playerCount: number = 2): Promise<CreateGameResponse> {
    try {
      // Wake server with health check
      await this.gateway.healthCheckWithRetry();
    } catch (error) {
      console.error('Server health check failed:', error);
      throw new Error(
        'Server is not responding. Please check your connection and try again.'
      );
    }

    // Create the game
    const response = playerCount === 2
      ? await this.gateway.createGame(playerName, window.location.href)
      : await this.gateway.createGame(playerName, window.location.href, playerCount);
    
    // Store session
    this.gameSession = {
      gameId: response.gameId,
      sessionToken: response.playerToken,
      playerName
    };
    // Set up game state
    this.game.setGameId(response.gameId);
    this.game.setPlayer(0, playerName); // Initiator is always player 0

    console.log(`✅ Game created: ${response.gameId}`);
    return response;
  }

  /**
  * Accept an invitation via invite code
   */
  public async acceptInvitation(
    inviteCode: string,
    playerName: string
  ): Promise<AcceptInvitationResponse> {
    try {
      // Wake server with health check
      await this.gateway.healthCheckWithRetry();
    } catch (error) {
      console.error('Server health check failed:', error);
      throw new Error(
        'Server is not responding. Please check your connection and try again.'
      );
    }

    // Accept the invitation
    const response = await this.gateway.acceptInvitation(inviteCode, playerName);

    // Store session
    this.gameSession = {
      gameId: response.gameId,
      sessionToken: response.playerToken,
      playerName
    };
    // Set up game state
    this.game.setGameId(response.gameId);
    this.game.setPlayer(response.playerId, playerName);

    console.log(`✅ Invitation accepted: ${response.gameId}`);
    return response;
  }

  public async createHotSeatGame(playerNames: string[]): Promise<CreateHotSeatResponse> {
    const createLocalGame = this.gateway.createLocalGame;
    if (!createLocalGame) throw new Error('On-this-device games require a local gateway');
    await this.gateway.healthCheckWithRetry();
    const response = await createLocalGame.call(this.gateway, playerNames);
    this.gameSession = {
      gameId: response.gameId,
      sessionToken: response.players[0].playerToken,
      playerName: response.players[0].name,
      hotSeat: true,
      players: response.players.map(player => ({ playerId: player.playerId, playerName: player.name, sessionToken: player.playerToken }))
    };
    this.game.setGameId(response.gameId);
    this.game.setPlayer(0, response.players[0].name);
    this.game.setOpponentName(response.players[1].name);
    this.game.setHotSeat(true);
    return response;
  }

  /**
   * Connect to a game and wait for the WebSocket roster/start updates
   */
  public async connectToGame(): Promise<void> {
    if (!this.gameSession) {
      throw new Error('No game session found');
    }

    // Connect WebSocket with gameId and sessionToken first - the server only counts
    // a player as "connected" once its socket is open, so waiting on status beforehand
    // would deadlock (both clients waiting for a count that never increments).
    let rejectProtocolError: ((error: Error) => void) | null = null;
    const protocolError = new Promise<never>((_, reject) => {
      rejectProtocolError = reject;
    });
    this.gateway.onMessage(message => this.handleMessage(message));
    this.gateway.onError((error) => {
      rejectProtocolError?.(new Error(error.message));
    });

    try {
      await this.gateway.connect(this.gameSession.gameId, this.gameSession.sessionToken);
    } catch (error) {
      throw new Error(
        `Failed to connect to game: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    // Now wait until the server pushes a game_start (roster updates arrive via lobby_status)
    await Promise.race([this.waitForGameStart(), protocolError]);
  }

  /**
   * Wait for the server to push game_start over the already-open WebSocket. The server
   * broadcasts a lobby_status message on every roster change while pending, so the client
   * no longer needs to poll GET /games/{gameId}/status - it only fetches one snapshot up
   * front to render the lobby immediately, in case it joins after other players are ready.
   */
  private async waitForGameStart(): Promise<void> {
    if (!this.gameSession) {
      throw new Error('No game session found');
    }

    try {
      const status = await this.gateway.getGameStatus(
        this.gameSession.gameId,
        this.gameSession.sessionToken
      );
      this.events.emit('lobbyStatus', status);

      if (status.status === 'expired') {
        throw new Error('Game expired. The server may have restarted.');
      }
      if (status.playersConnected === status.required) {
        return;
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Game expired')) throw error;
      console.error('Initial lobby status fetch failed:', error);
    }

    const maxWaitTime = 5 * 60 * 1000; // 5 minutes

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        window.clearTimeout(timeoutId);
        this.pendingConnectResolve = null;
        this.pendingConnectReject = null;
      };
      const timeoutId = window.setTimeout(() => {
        cleanup();
        reject(new Error('Game connection timeout'));
      }, maxWaitTime);

      this.pendingConnectResolve = () => {
        cleanup();
        resolve();
      };
      this.pendingConnectReject = (error: Error) => {
        cleanup();
        reject(error);
      };
    });
  }

  /**
   * Fire a shot
   */
  public async fire(angle: number, velocity: number, direction?: 'Left' | 'Right'): Promise<void> {
    if (!this.gameSession) {
      throw new Error('No active game session');
    }

    const gameId = this.game.getGameId();
    if (!gameId || gameId !== this.gameSession.gameId) {
      throw new Error('Game ID mismatch');
    }

    const sessionToken = this.getTokenForPlayer(this.game.getState().currentTurn);
    await this.gateway.fire(
      this.gameSession.gameId,
      sessionToken,
      angle,
      velocity,
      direction
    );
    // Server will send WebSocket messages (shot + turn_change) to update state
  }

  public async requestRematch(answer: 'play_again' | 'had_enough'): Promise<void> {
    if (!this.gameSession) {
      throw new Error('No active game session');
    }

    if (this.gameSession.hotSeat && this.gameSession.players) {
      for (const player of this.gameSession.players) {
        await this.gateway.requestRematch(this.gameSession.gameId, player.sessionToken, answer);
      }
      return;
    }
    await this.gateway.requestRematch(this.gameSession.gameId, this.gameSession.sessionToken, answer);
  }

  public async skipWaiting(): Promise<void> {
    if (!this.gameSession) throw new Error('No active game session');
    await this.gateway.skipWaiting(this.gameSession.gameId, this.gameSession.sessionToken);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: import('./types/messages').GameMessage): void {
    this.messageDispatcher.dispatch(message);
  }

  /**
   * Event callback registrations
   */
  public onGameStart(
    callback: (gameId: string, battlefield: BattlefieldConfig) => void
  ): void {
    this.events.on('gameStart', callback);
  }

  public onShot(callback: (data: ShotEventData) => void): void {
    this.events.on('shot', callback);
  }

  public onTurnChange(callback: (playerId: number, isMyTurn: boolean) => void): void {
    this.events.on('turnChange', callback);
  }

  public onGameOver(callback: (winnerId: number, didIWin: boolean) => void): void {
    this.events.on('gameOver', callback);
  }

  public onPlayerHit(callback: (playerId: number, playerName: string) => void): void {
    this.events.on('playerHit', callback);
  }

  public onRematchStatus(callback: (answered: number, requiredPlayers: number, players: Array<{ playerId: number; playerName: string; answer?: 'play_again' | 'had_enough' | 'not_sure' }>) => void): void {
    this.events.on('rematchStatus', (answered, requiredPlayers, players) => {
      if (callback.length <= 1) {
        (callback as unknown as (answered: number) => void)(answered);
      } else {
        callback(answered, requiredPlayers, players);
      }
    });
  }

  public onLobbyStatus(callback: (status: GameStatusResponse) => void): void {
    this.events.on('lobbyStatus', callback);
  }

  /**
   * Get current player ID
   */
  public getPlayerId(): number | null {
    return this.game.getPlayerId();
  }

  public isHotSeat(): boolean {
    return this.game.isHotSeat();
  }

  public getLocalPlayerNames(): string[] | null {
    if (!this.gameSession?.players) return null;
    return this.gameSession.players.map(player => player.playerName);
  }

  private getTokenForPlayer(playerId: number): string {
    if (this.gameSession?.hotSeat && this.gameSession.players) {
      const player = this.gameSession.players.find(candidate => candidate.playerId === playerId);
      return player?.sessionToken ?? '';
    }
    return this.gameSession?.sessionToken ?? '';
  }

  public getLastGameStartMessage(): GameStartMessage | null {
    return this.messageDispatcher.getLastGameStartMessage();
  }

  public clearSession(): void {
    this.gateway.disconnect();
    this.gameSession = null;
  }

  public hasActiveSession(): boolean {
    return this.sessionStore.hasSession();
  }

  public getGameSession(): GameSession | null {
    return this.gameSession;
  }
}
