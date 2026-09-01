import { WebSocket } from 'ws';
import type {
  Battlefield,
  GameStartMessage,
  TurnChangeMessage,
  GameOverMessage,
  ShotMessage
} from '../types/messages';
import type {
  PrivateGame,
  CreateGameResponse,
  AcceptInvitationResponse,
  GameStatusResponse
} from '../types/private-game';
import { calculateVelocityComponents, checkCastleCollision } from '../utils/physics';
import { TokenService } from './tokenService';

// Fallback used only when a request has no Origin/Referer header (e.g. direct API calls/tests)
const DEFAULT_CLIENT_ORIGIN = process.env.CLIENT_URL || 'http://localhost:5173';


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
  private games: Map<string, PrivateGame> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Configuration
  private readonly INVITATION_TTL_MS = 30 * 60 * 1000; // 30 minutes
  private readonly ACTIVE_GAME_TTL_MS = 30 * 60 * 1000; // 30 minutes
  private readonly FINISHED_GAME_GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_ACTIVE_GAMES = 100;
  private readonly CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

  constructor() {
    this.startCleanupTimer();
  }

  /**
   * Start periodic cleanup of expired games and invitations
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL_MS);
  }

  /**
   * Stop cleanup timer (for graceful shutdown)
   */
  public shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Create a new private game
   * @param playerName The initiator's display name
   * @returns Game creation response with tokens and invite code
   */
  public createGame(playerName: string, clientOrigin: string = DEFAULT_CLIENT_ORIGIN): CreateGameResponse | { error: string; code: string } {
    // Validate and normalize player name
    const normalizedName = TokenService.normalizeName(playerName);
    if (!normalizedName) {
      return {
        error: 'Player name must be 15 characters or less and start with a letter or number',
        code: 'INVALID_PLAYER_NAME'
      };
    }

    // Check if max games reached
    if (this.games.size >= this.MAX_ACTIVE_GAMES) {
      return {
        error: 'Server is at maximum capacity. Please try again later.',
        code: 'MAX_GAMES_REACHED'
      };
    }

    // Generate secure tokens and IDs
    const gameId = TokenService.generateGameId();
    const sessionToken = TokenService.generateSessionToken();
    const inviteToken = TokenService.generateInviteToken();
    const inviteCode = TokenService.generateInviteCode();

    const now = Date.now();

    // Create the game record
    const game: PrivateGame = {
      id: gameId,
      status: 'pending',
      createdAt: now,
      expiresAt: now + this.INVITATION_TTL_MS,
      lastActivityAt: now,
      invitation: {
        invitationTokenHash: TokenService.hashToken(inviteToken),
        inviteCode,
        inviteCodeHash: TokenService.hashToken(inviteCode),
        expiresAt: now + this.INVITATION_TTL_MS,
        accepted: false
      },
      initiator: {
        name: normalizedName,
        sessionTokenHash: TokenService.hashToken(sessionToken),
        websocket: null
      },
      invited: {
        name: null,
        sessionTokenHash: '',
        websocket: null
      },
      currentTurn: 0,
      gameStarted: false
    };

    this.games.set(gameId, game);
    console.log(`✅ Game ${gameId} created by ${normalizedName}`);

    // Build invite URL using the base URL the request came from (origin + pathname when
    // available). This preserves GitHub Pages paths like /SuperArtillery/ instead of
    // linking to the root of the domain.
    // The token is base64 (+, /, =), so it must be percent-encoded.
    let inviteUrl: string;
    const base = clientOrigin || DEFAULT_CLIENT_ORIGIN;
    try {
      const u = new URL(base);
      if (!u.pathname.endsWith('/')) {
        u.pathname = `${u.pathname}/`;
      }
      u.search = `invite=${encodeURIComponent(inviteToken)}`;
      inviteUrl = u.toString();
    } catch (e) {
      // Fallback: naive join
      inviteUrl = `${base.endsWith('/') ? base : `${base}/`}?invite=${encodeURIComponent(inviteToken)}`;
    }

    return {
      gameId,
      playerToken: sessionToken, // Only return plain token to initiator
      inviteUrl,
      inviteCode
    };
  }

  /**
   * Accept an invitation via token or code
   * @param inviteTokenOrCode Either the full invitation token or 4-char code
   * @param playerName The invited player's display name
   * @returns Invitation acceptance response with game ID and session token
   */
  public acceptInvitation(
    inviteTokenOrCode: string | undefined,
    playerName: string
  ): AcceptInvitationResponse | { error: string; code: string } {
    // Validate and normalize player name
    const normalizedName = TokenService.normalizeName(playerName);
    if (!normalizedName) {
      return {
        error: 'Player name must be 15 characters or less and start with a letter or number',
        code: 'INVALID_PLAYER_NAME'
      };
    }

    if (!inviteTokenOrCode) {
      return {
        error: 'Invitation token or code is required',
        code: 'MISSING_INVITE'
      };
    }

    // Find the game matching the invitation
    let game: PrivateGame | undefined;
    
    if (inviteTokenOrCode.length === 4) {
      // Short code provided
      const codeHash = TokenService.hashToken(inviteTokenOrCode.toUpperCase());
      game = Array.from(this.games.values()).find(
        g => g.invitation.inviteCodeHash === codeHash
      );
    } else {
      // Full token provided
      const tokenHash = TokenService.hashToken(inviteTokenOrCode);
      game = Array.from(this.games.values()).find(
        g => g.invitation.invitationTokenHash === tokenHash
      );
    }

    if (!game) {
      return {
        error: 'Invitation not found or has expired',
        code: 'INVALID_INVITATION'
      };
    }

    // Check if invitation is still valid
    if (game.invitation.accepted) {
      return {
        error: 'This invitation has already been accepted',
        code: 'INVITATION_ALREADY_ACCEPTED'
      };
    }

    if (game.invitation.expiresAt < Date.now()) {
      game.status = 'expired';
      return {
        error: 'Invitation has expired. Create a new game.',
        code: 'INVITATION_EXPIRED'
      };
    }

    if (game.status !== 'pending') {
      return {
        error: 'This game is no longer available',
        code: 'GAME_UNAVAILABLE'
      };
    }

    // Generate session token for invited player
    const sessionToken = TokenService.generateSessionToken();

    // Mark invitation as accepted
    game.invitation.accepted = true;
    game.invited.name = normalizedName;
    game.invited.sessionTokenHash = TokenService.hashToken(sessionToken);

    console.log(`✅ Invitation accepted for game ${game.id} by ${normalizedName}`);

    return {
      gameId: game.id,
      playerToken: sessionToken // Only return plain token to invited player
    };
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
        error: 'Game not found or has expired',
        code: 'GAME_NOT_FOUND'
      };
    }

    // Verify session token belongs to this game
    const isInitiator = TokenService.verifyToken(sessionToken, game.initiator.sessionTokenHash);
    const isInvited = TokenService.verifyToken(sessionToken, game.invited.sessionTokenHash);

    if (!isInitiator && !isInvited) {
      return {
        error: 'Invalid session token for this game',
        code: 'INVALID_SESSION_TOKEN'
      };
    }

    const playersConnected = [game.initiator.websocket, game.invited.websocket].filter(
      ws => ws !== null && ws.readyState === WebSocket.OPEN
    ).length;

    return {
      status: game.status,
      playersConnected,
      requiredPlayers: 2
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
        error: 'Game not found or has expired',
        code: 'GAME_NOT_FOUND'
      };
    }

    // Determine which player this is by validating session token
    const isInitiator = TokenService.verifyToken(sessionToken, game.initiator.sessionTokenHash);
    const isInvited = TokenService.verifyToken(sessionToken, game.invited.sessionTokenHash);

    if (!isInitiator && !isInvited) {
      return {
        error: 'Invalid session token for this game',
        code: 'INVALID_SESSION_TOKEN'
      };
    }

    const playerId = isInitiator ? 0 : 1;

    // Store WebSocket connection
    if (playerId === 0) {
      game.initiator.websocket = ws;
    } else {
      game.invited.websocket = ws;
    }

    console.log(`✅ Player ${playerId} (${isInitiator ? game.initiator.name : game.invited.name}) connected to game ${gameId}`);

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
  public disconnectPlayer(gameId: string, playerId: 0 | 1): void {
    const game = this.games.get(gameId);
    if (!game) return;

    if (playerId === 0) {
      game.initiator.websocket = null;
    } else {
      game.invited.websocket = null;
    }

    console.log(`Player ${playerId} disconnected from game ${gameId}`);

    // End game if it was in progress
    if (game.gameStarted) {
      game.status = 'finished';
      game.gameFinishedAt = Date.now();
    } else if (game.status === 'pending') {
      // If game is still pending and initiator disconnects, mark as expired
      if (playerId === 0) {
        game.status = 'expired';
      }
    }
  }

  /**
   * Try to start a game when both players are connected
   */
  private tryStartGame(game: PrivateGame): void {
    if (
      game.gameStarted ||
      game.initiator.websocket === null ||
      game.invited.websocket === null ||
      game.initiator.websocket.readyState !== WebSocket.OPEN ||
      game.invited.websocket.readyState !== WebSocket.OPEN
    ) {
      return;
    }

    game.status = 'active';
    game.gameStarted = true;
    game.currentTurn = 0;
    game.lastActivityAt = Date.now();

    const battlefield = this.createBattlefield();

    console.log(
      `🎮 Game ${game.id} started: ${game.initiator.name} vs ${game.invited.name}`
    );

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
        battlefield
      };

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(startMessage));
      }
    }

    // Send initial turn change
    const turnMessage: TurnChangeMessage = {
      type: 'turn_change',
      playerId_turn: 0
    };
    this.broadcastToGame(game, turnMessage);
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
        error: 'Game not found or has expired',
        code: 'GAME_NOT_FOUND',
        statusCode: 404
      };
    }

    // Derive player ID from session token
    const playerId = this.getPlayerIdFromToken(gameId, sessionToken);
    if (playerId === null) {
      return {
        success: false,
        error: 'Invalid session token for this game',
        code: 'INVALID_SESSION_TOKEN',
        statusCode: 401
      };
    }

    if (!game.gameStarted || game.status !== 'active') {
      return {
        success: false,
        error: 'Game has not started or has ended',
        code: 'GAME_NOT_ACTIVE',
        statusCode: 400
      };
    }

    if (playerId !== game.currentTurn) {
      return {
        success: false,
        error: 'Wait for your turn',
        code: 'NOT_YOUR_TURN',
        statusCode: 400
      };
    }

    // Validate angle
    if (typeof angle !== 'number' || angle < 0 || angle > 360) {
      return {
        success: false,
        error: 'Angle must be between 0 and 360 degrees',
        code: 'INVALID_ANGLE',
        statusCode: 400
      };
    }

    // Validate velocity
    if (typeof velocity !== 'number' || velocity <= 0) {
      return {
        success: false,
        error: 'Velocity must be positive',
        code: 'INVALID_VELOCITY',
        statusCode: 400
      };
    }

    // Update activity timestamp
    game.lastActivityAt = Date.now();

    // Get battlefield for physics calculation
    const battlefield = this.createBattlefield();
    const targetPlayerId = playerId === 0 ? 1 : 0;
    const targetCastle = battlefield.castles[targetPlayerId];
    const firingCastle = battlefield.castles[playerId];

    // Adjust angle for player 1 (shoots left)
    const adjustedAngle = playerId === 1 ? 180 - angle : angle;
    const { vx, vy } = calculateVelocityComponents(adjustedAngle, velocity);

    // Starting position (top of firing castle)
    const x0 = firingCastle.left_x + battlefield.castleWidth / 2;
    const y0 = battlefield.groundY - battlefield.castleHeight;

    // Check collision with target castle
    const hitTime = checkCastleCollision(
      x0,
      y0,
      vx,
      vy,
      battlefield.gravity,
      targetCastle.left_x + battlefield.castleWidth / 2,
      battlefield.castleWidth,
      battlefield.castleHeight,
      battlefield.groundY
    );

    // Broadcast shot
    const shotMessage: ShotMessage = {
      type: 'shot',
      playerId,
      angle,
      velocity
    };
    this.broadcastToGame(game, shotMessage);

    if (hitTime !== null) {
      // Hit! Game over
      const gameOverMessage: GameOverMessage = {
        type: 'game_over',
        playerId_winner: playerId
      };
      game.status = 'finished';
      game.gameFinishedAt = Date.now();
      this.broadcastToGame(game, gameOverMessage);
      return { success: true };
    }

    // Miss - switch turns
    game.currentTurn = game.currentTurn === 0 ? 1 : 0;
    const turnMessage: TurnChangeMessage = {
      type: 'turn_change',
      playerId_turn: game.currentTurn
    };
    this.broadcastToGame(game, turnMessage);

    return { success: true };
  }

  /**
   * Broadcast a message to both players in a game
   */
  private broadcastToGame(game: PrivateGame, message: any): void {
    const messageStr = JSON.stringify(message);

    [game.initiator, game.invited].forEach((player) => {
      if (player.websocket && player.websocket.readyState === WebSocket.OPEN) {
        player.websocket.send(messageStr);
      }
    });
  }

  /**
   * Create a battlefield for the game
   */
  private createBattlefield(): Battlefield {
    return {
      canvasWidth: 280,
      canvasHeight: 160,
      gravity: 100,
      groundY: 140,
      castleWidth: 10,
      castleHeight: 10,
      castles: [
        { playerId: 0, left_x: 20 },
        { playerId: 1, left_x: 250 }
      ]
    };
  }

  /**
   * Cleanup expired games and invitations
   * Runs periodically to free memory
   */
  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    this.games.forEach((game, gameId) => {
      // Expire pending games with expired invitations
      if (
        game.status === 'pending' &&
        game.invitation.expiresAt < now
      ) {
        game.status = 'expired';
      }

      // Expire active games with no activity for TTL
      if (
        game.status === 'active' &&
        game.lastActivityAt + this.ACTIVE_GAME_TTL_MS < now
      ) {
        game.status = 'expired';
      }

      // Remove finished games after grace period
      if (
        game.status === 'finished' &&
        game.gameFinishedAt &&
        game.gameFinishedAt + this.FINISHED_GAME_GRACE_PERIOD_MS < now
      ) {
        toDelete.push(gameId);
      }

      // Remove expired games
      if (game.status === 'expired' && game.expiresAt < now) {
        toDelete.push(gameId);
      }
    });

    // Clean up
    toDelete.forEach(gameId => {
      const game = this.games.get(gameId);
      if (game) {
        console.log(
          `🧹 Cleaning up game ${gameId} (status: ${game.status})`
        );
        // Close WebSocket connections
        if (game.initiator.websocket) {
          game.initiator.websocket.close();
        }
        if (game.invited.websocket) {
          game.invited.websocket.close();
        }
        this.games.delete(gameId);
      }
    });

    if (toDelete.length > 0) {
      console.log(`Cleaned up ${toDelete.length} games. Active games: ${this.games.size}`);
    }
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
    this.games.forEach(game => {
      if (game.status === 'pending' && !game.invitation.accepted) {
        invitationCount++;
      }
    });

    return {
      gameCount: this.games.size,
      invitationCount,
      maxGamesReached: this.games.size >= this.MAX_ACTIVE_GAMES
    };
  }

  /**
   * Get player count (for backward compatibility)
   */
  public getPlayerCount(): number {
    return this.games.size;
  }
}
