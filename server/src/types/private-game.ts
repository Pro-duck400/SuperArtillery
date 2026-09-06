import { WebSocket } from 'ws';
import type { Battlefield } from './messages';

/**
 * Game status lifecycle
 */
export type GameStatus = 'pending' | 'active' | 'finished' | 'expired';

/**
 * Player session with secure token storage
 * Token values are NEVER exposed to the other player or logs
 * Only hashes are stored in memory
 */
export interface PlayerSession {
  name: string | null;
  sessionTokenHash: string; // Hash of the player's session token
  websocket: WebSocket | null;
}

/**
 * Invitation record with one-time use tracking
 */
export interface Invitation {
  inviteCode: string; // 4-char alphanumeric code (user-typeable)
  inviteCodeHash: string; // Hash of the invite code for verification
  expiresAt: number; // Timestamp in ms when invitation expires
  accepted: boolean; // Track one-time acceptance
}

/**
 * Private game record
 * Maps to a specific in-memory game instance
 */
export interface PrivateGame {
  id: string; // Opaque game ID
  status: GameStatus;
  createdAt: number; // Timestamp when game was created
  expiresAt: number; // Timestamp when game expires (30 min from creation)
  lastActivityAt: number; // Timestamp of last action/message (for active game TTL)
  
  // Invitation details
  invitation: Invitation;
  hotSeat?: boolean;
  
  // Player sessions
  initiator: PlayerSession;
  invited: PlayerSession;
  
  // Game state
  currentTurn: 0 | 1;
  gameStarted: boolean;
  round: number;
  rematchReady: [boolean, boolean];
  battlefield?: Battlefield;
  gameFinishedAt?: number; // Timestamp when game finished (for grace period)
}

/**
 * Response types for API endpoints
 */

export interface CreateGameResponse {
  gameId: string;
  playerToken: string; // Only sent to initiator
  inviteUrl: string; // Full invitation link
  inviteCode: string; // 4-char short code
}

export interface AcceptInvitationResponse {
  gameId: string;
  playerToken: string; // Only sent to invited player
}

export interface CreateHotSeatResponse {
  gameId: string;
  players: [
    { playerId: 0; playerName: string; playerToken: string },
    { playerId: 1; playerName: string; playerToken: string }
  ];
}

export interface GameStatusResponse {
  status: GameStatus;
  playersConnected: number;
  requiredPlayers: 2;
  rematchReady: boolean;
  rematchPlayersReady: number;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime: string;
  gameCount: number;
  invitationCount: number;
  maxGamesReached: boolean;
  version: string;
  contractVersion: string;
}

/**
 * Error response for helpful client messages
 */
export interface ErrorResponse {
  code: string; // Machine-readable error code
  message: string; // Human-readable error message
  details?: Record<string, unknown>; // Additional context
}
