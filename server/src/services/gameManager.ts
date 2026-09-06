import { WebSocket } from 'ws';
import type {
  GameStartMessage,
  TurnChangeMessage,
  GameOverMessage,
  ShotMessage,
  GameMessage,
  RematchStatusMessage
} from '../types/messages';
import type {
  PrivateGame,
  CreateGameResponse,
  AcceptInvitationResponse,
  GameStatusResponse
} from '../types/private-game';
import { TokenService } from './tokenService';
import { InMemoryGameRepository, type GameRepository } from './gameRepository';
import {
  GameCleanupService,
  SystemTimerScheduler,
  type TimerScheduler
} from './gameCleanupService';
import { GAME_CONFIG } from './gameConfig';
import { GAME_ERROR_CODES, GAME_ERROR_MESSAGES } from './gameErrors';
import { InvitationService } from './invitationService';
import { GameRules } from './gameRules';
import { HTTP_STATUS } from '../httpStatus';

// Fallback used only when a request has no Origin/Referer header (e.g. direct API calls/tests)
const DEFAULT_CLIENT_ORIGIN = process.env.CLIENT_URL || 'http://localhost:5173';
const DEFAULT_SERVER_ORIGIN = process.env.SERVER_URL || 'http://localhost:3000';


/**
 * Multi-game manager supporting private, in-memory only games
 * 
 * Architecture:
 * - Map<gameId, PrivateGame> for multi-game support
 * - Session tokens for WebSocket authentication
 * - Token hashes stored in memory (never plain tokens)
 * - Automatic expiration of old games and invitations
 * - Activity-based TTL for active games
 */
export class GameManager {
  static readonly HTTP_STATUS = HTTP_STATUS;

  static readonly ERROR_CODES = GAME_ERROR_CODES;
  static readonly ERROR_MESSAGES = GAME_ERROR_MESSAGES;

  private readonly games: GameRepository;
  private readonly invitationService: InvitationService;
  private readonly cleanupService: GameCleanupService;
  private readonly gameRules: GameRules;
  private readonly timerScheduler: TimerScheduler;
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Configuration
  constructor(
    games: GameRepository = new InMemoryGameRepository(),
    timerScheduler: TimerScheduler = new SystemTimerScheduler()
  ) {
    this.games = games;
    this.timerScheduler = timerScheduler;
    this.invitationService = new InvitationService(games, DEFAULT_CLIENT_ORIGIN);
    this.cleanupService = new GameCleanupService(games);
    this.gameRules = new GameRules();
    this.startCleanupTimer();
  }

  /**
   * Start periodic cleanup of expired games and invitations
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = this.timerScheduler.setInterval(() => {
      this.cleanupService.cleanup();
    }, GAME_CONFIG.cleanupIntervalMs);
  }

  /**
   * Stop cleanup timer (for graceful shutdown)
   */
  public shutdown(): void {
    if (this.cleanupInterval) {
      this.timerScheduler.clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Create a new private game
   * @param playerName The initiator's display name
  * @returns Game creation response with an invite code
   */
  public createGame(playerName: string, clientOrigin: string = DEFAULT_CLIENT_ORIGIN, serverOrigin: string = DEFAULT_SERVER_ORIGIN): CreateGameResponse | { error: string; code: string } {
    const normalizedName = TokenService.normalizeName(playerName);
    if (!normalizedName) {
      return {
        error: GameManager.ERROR_MESSAGES.INVALID_PLAYER_NAME,
        code: GameManager.ERROR_CODES.INVALID_PLAYER_NAME
      };
    }

    // Check if max games reached
    if (this.games.size >= GAME_CONFIG.maxActiveGames) {
      return {
        error: GameManager.ERROR_MESSAGES.MAX_GAMES_REACHED,
        code: GameManager.ERROR_CODES.MAX_GAMES_REACHED
      };
    }

    return this.invitationService.createGame(playerName, clientOrigin, serverOrigin);
  }

  /**
  * Accept an invitation via invite code
  * @param inviteCode 4-char invite code
   * @param playerName The invited player's display name
   * @returns Invitation acceptance response with game ID and session token
   */
  public acceptInvitation(
    inviteCode: string | undefined,
    playerName: string
  ): AcceptInvitationResponse | { error: string; code: string } {
    return this.invitationService.acceptInvitation(inviteCode, playerName);
  }

  /**
   * Get non-sensitive game status (for polling before WebSocket connection)
   * @param gameId The game ID
   * @param sessionToken The player's session token (for authentication)
   * @returns Game status response
   */
  public getGameStatus(
    gameId: string,
    sessionToken: string
  ): GameStatusResponse | { error: string; code: string } {
    const game = this.games.get(gameId);
    if (!game) {
      return {
        error: GameManager.ERROR_MESSAGES.GAME_NOT_FOUND,
        code: GameManager.ERROR_CODES.GAME_NOT_FOUND
      };
    }

    // Verify session token belongs to this game
    const playerId = this.getPlayerIdFromToken(gameId, sessionToken);
    if (playerId === null) {
      return {
        error: GameManager.ERROR_MESSAGES.INVALID_SESSION_TOKEN,
        code: GameManager.ERROR_CODES.INVALID_SESSION_TOKEN
      };
    }

    const playersConnected = [game.initiator.websocket, game.invited.websocket].filter(
      ws => ws !== null && ws.readyState === WebSocket.OPEN
    ).length;

    return {
      status: game.status,
      playersConnected,
      requiredPlayers: 2,
      rematchReady: game.rematchReady[playerId],
      rematchPlayersReady: game.rematchReady.filter(Boolean).length
    };
  }

  /**
   * Connect a player via WebSocket using session token
   * @param gameId The game ID
   * @param sessionToken The player's session token
   * @param ws The WebSocket connection
   * @returns Player ID (0 or 1) if successful, error otherwise
   */
  public connectPlayer(
    gameId: string,
    sessionToken: string,
    ws: WebSocket
  ): { playerId: 0 | 1 } | { error: string; code: string } {
    const game = this.games.get(gameId);
    if (!game) {
      return {
        error: GameManager.ERROR_MESSAGES.GAME_NOT_FOUND,
        code: GameManager.ERROR_CODES.GAME_NOT_FOUND
      };
    }

    // Determine which player this is by validating session token
    const playerId = this.getPlayerIdFromToken(game.id, sessionToken);

    if (playerId == null) {
      return {
        error: GameManager.ERROR_MESSAGES.INVALID_SESSION_TOKEN,
        code: GameManager.ERROR_CODES.INVALID_SESSION_TOKEN
      };
    }

    // Store WebSocket connection
    if (playerId === 0) {
      game.initiator.websocket = ws;
    } else {
      game.invited.websocket = ws;
    }

    console.log(`✅ Player ${playerId} (${playerId == 0 ? game.initiator.name : game.invited.name}) connected to game ${gameId}`);

    // Try to start game if both players are connected
    if (!game.gameStarted) {
      this.tryStartGame(game);
    }

    return { playerId };
  }

  /**
   * Get player ID from session token
   * @param gameId The game ID
   * @param sessionToken The player's session token
   * @returns Player ID (0 or 1) or null if invalid
   */
  public getPlayerIdFromToken(gameId: string, sessionToken: string): 0 | 1 | null {
    const game = this.games.get(gameId);
    if (!game) return null;

    const isInitiator = TokenService.verifyToken(sessionToken, game.initiator.sessionTokenHash);
    if (isInitiator) return 0;

    const isInvited = TokenService.verifyToken(sessionToken, game.invited.sessionTokenHash);
    if (isInvited) return 1;

    return null;
  }

  /**
   * Handle player disconnect
   */
  public disconnectPlayer(gameId: string, playerId: 0 | 1, ws: WebSocket): void {
    const game = this.games.get(gameId);
    if (!game) return;

    const currentSocket = playerId === 0
      ? game.initiator.websocket
      : game.invited.websocket;
    if (currentSocket !== ws) return;

    this.gameRules.disconnect(game, playerId);
  }

  /**
   * Try to start a game when both players are connected
   */
  private tryStartGame(game: PrivateGame): void {
    const start = this.gameRules.startIfReady(game);
    if (!start) {
      return;
    }

    console.log(
      `🎮 Game ${game.id} started: ${game.initiator.name} vs ${game.invited.name}`
    );

    this.broadcastGameStart(game, start.battlefield);

    // Send initial turn change
    const turnMessage: TurnChangeMessage = {
      type: 'turn_change',
      playerId_turn: 0
    };
    this.broadcastToGame(game, turnMessage);
  }

  private broadcastGameStart(game: PrivateGame, battlefield: NonNullable<PrivateGame['battlefield']>): void {
    // Send game_start to both players
    for (let playerId = 0; playerId < 2; playerId++) {
      const ws = playerId === 0 ? game.initiator.websocket : game.invited.websocket;
      const opponentName =
        playerId === 0
          ? (game.invited.name ?? 'Opponent')
          : (game.initiator.name ?? 'Opponent');

      const startMessage: GameStartMessage = {
        type: 'game_start',
        gameId: game.id,
        opponentName,
        battlefield,
        round: game.round
      };

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(startMessage));
      }
    }

  }

  public requestRematch(
    gameId: string,
    sessionToken: string
  ): {
    success: true;
    ready: boolean;
    playersReady: number;
    roundStarted: boolean;
  } | { success: false; error: string; code: string; statusCode: number } {
    const game = this.games.get(gameId);
    if (!game) {
      return {
        success: false,
        error: GameManager.ERROR_MESSAGES.GAME_NOT_FOUND,
        code: GameManager.ERROR_CODES.GAME_NOT_FOUND,
        statusCode: HTTP_STATUS.NOT_FOUND
      };
    }

    const playerId = this.getPlayerIdFromToken(gameId, sessionToken);
    if (playerId === null) {
      return {
        success: false,
        error: GameManager.ERROR_MESSAGES.INVALID_SESSION_TOKEN,
        code: GameManager.ERROR_CODES.INVALID_SESSION_TOKEN,
        statusCode: HTTP_STATUS.UNAUTHORIZED
      };
    }

    if (game.status !== 'finished') {
      return {
        success: false,
        error: GameManager.ERROR_MESSAGES.REMATCH_NOT_AVAILABLE,
        code: GameManager.ERROR_CODES.REMATCH_NOT_AVAILABLE,
        statusCode: HTTP_STATUS.BAD_REQUEST
      };
    }

    const transition = this.gameRules.requestRematch(game, playerId);
    const statusMessage: RematchStatusMessage = {
      type: 'rematch_status',
      playersReady: transition.playersReady,
      requiredPlayers: 2
    };
    this.broadcastToGame(game, statusMessage);

    if (transition.kind === 'started') {
      this.broadcastGameStart(game, transition.battlefield);
      this.broadcastToGame(game, { type: 'turn_change', playerId_turn: 0 });
    }

    return {
      success: true,
      ready: transition.kind === 'waiting' ? game.rematchReady[playerId] : true,
      playersReady: transition.playersReady,
      roundStarted: transition.kind === 'started'
    };
  }

  /**
   * Handle fire action (from HTTP endpoint with session token)
   * @param gameId The game ID
   * @param sessionToken The player's session token
   * @param angle Projectile angle
   * @param velocity Projectile velocity
   * @returns Success or error
   */
  public fire(
    gameId: string,
    sessionToken: string,
    angle: number,
    velocity: number
  ): { success: true } | { success: false; error: string; code: string; statusCode: number } {
    const game = this.games.get(gameId);
    if (!game) {
      return {
        success: false,
        error: GameManager.ERROR_MESSAGES.GAME_NOT_FOUND,
        code: GameManager.ERROR_CODES.GAME_NOT_FOUND,
        statusCode: HTTP_STATUS.NOT_FOUND
      };
    }

    // Derive player ID from session token
    const playerId = this.getPlayerIdFromToken(gameId, sessionToken);
    if (playerId === null) {
      return {
        success: false,
        error: GameManager.ERROR_MESSAGES.INVALID_SESSION_TOKEN,
        code: GameManager.ERROR_CODES.INVALID_SESSION_TOKEN,
        statusCode: HTTP_STATUS.UNAUTHORIZED
      };
    }

    if (!game.gameStarted || game.status !== 'active') {
      return {
        success: false,
        error: GameManager.ERROR_MESSAGES.GAME_NOT_ACTIVE,
        code: GameManager.ERROR_CODES.GAME_NOT_ACTIVE,
        statusCode: HTTP_STATUS.BAD_REQUEST
      };
    }

    if (playerId !== game.currentTurn) {
      return {
        success: false,
        error: GameManager.ERROR_MESSAGES.NOT_YOUR_TURN,
        code: GameManager.ERROR_CODES.NOT_YOUR_TURN,
        statusCode: HTTP_STATUS.BAD_REQUEST
      };
    }

    // Validate angle
    if (typeof angle !== 'number' || !Number.isInteger(angle) || angle < 0 || angle > 99) {
      return {
        success: false,
        error: GameManager.ERROR_MESSAGES.INVALID_ANGLE,
        code: GameManager.ERROR_CODES.INVALID_ANGLE,
        statusCode: HTTP_STATUS.BAD_REQUEST
      };
    }

    // Validate velocity
    if (typeof velocity !== 'number' || !Number.isInteger(velocity) || velocity < 30 || velocity > 999) {
      return {
        success: false,
        error: GameManager.ERROR_MESSAGES.INVALID_VELOCITY,
        code: GameManager.ERROR_CODES.INVALID_VELOCITY,
        statusCode: HTTP_STATUS.BAD_REQUEST
      };
    }

    const transition = this.gameRules.fire(game, playerId, angle, velocity);

    // Broadcast shot
    const shotMessage: ShotMessage = {
      type: 'shot',
      playerId,
      angle,
      velocity
    };
    this.broadcastToGame(game, shotMessage);

    if (transition.kind === 'hit') {
      // Hit! Game over
      const gameOverMessage: GameOverMessage = {
        type: 'game_over',
        playerId_winner: playerId
      };
      this.broadcastToGame(game, gameOverMessage);
      return { success: true };
    }

    // Miss - switch turns
    const turnMessage: TurnChangeMessage = {
      type: 'turn_change',
      playerId_turn: transition.nextPlayerId
    };
    this.broadcastToGame(game, turnMessage);

    return { success: true };
  }

  /**
   * Broadcast a message to both players in a game
   */
  private broadcastToGame(game: PrivateGame, message: GameMessage): void {
    const messageStr = JSON.stringify(message);

    [game.initiator, game.invited].forEach((player) => {
      if (player.websocket && player.websocket.readyState === WebSocket.OPEN) {
        player.websocket.send(messageStr);
      }
    });
  }

  /**
   * Get game statistics for health check
   */
  public getStats(): {
    gameCount: number;
    invitationCount: number;
    maxGamesReached: boolean;
  } {
    let invitationCount = 0;
    for (const game of this.games.values()) {
      if (game.status === 'pending' && !game.invitation.accepted) {
        invitationCount++;
      }
    }

    return {
      gameCount: this.games.size,
      invitationCount,
      maxGamesReached: this.games.size >= GAME_CONFIG.maxActiveGames
    };
  }
}
