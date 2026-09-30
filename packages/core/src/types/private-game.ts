import type { PlayerConnection } from '../ports/player-connection';
import type { Battlefield } from '../contract/messages';

export type GameStatus = 'pending' | 'active' | 'finished' | 'expired';

export interface PlayerSession {
  name: string | null;
  sessionTokenHash: string;
  connection: PlayerConnection | null;
}

export interface Invitation {
  inviteCode: string;
  inviteCodeHash: string;
  expiresAt: number;
  accepted: boolean;
}

export type LobbySlotStatus = 'waiting' | 'ready' | 'skipped';
export type RematchAnswer = 'play_again' | 'had_enough' | 'not_sure';

export interface LobbySlot {
  playerId: number;
  session: PlayerSession;
  status: LobbySlotStatus;
  active: boolean;
  eliminated: boolean;
}

export interface PrivateGame {
  id: string;
  status: GameStatus;
  createdAt: number;
  expiresAt: number;
  lastActivityAt: number;
  invitation: Invitation;
  hotSeat?: boolean;
  playerCount: number;
  lobbySlots: LobbySlot[];
  waitingSkipped?: boolean;
  initiator: PlayerSession;
  invited: PlayerSession;
  currentTurn: number;
  gameStarted: boolean;
  round: number;
  frags: number[];
  rematchReady: boolean[];
  rematchAnswers?: Array<RematchAnswer | null>;
  battlefield?: Battlefield;
  gameFinishedAt?: number;
}

export interface CreateGameResponse {
  gameId: string;
  playerToken: string;
  inviteUrl: string;
  inviteCode: string;
  playerCount: number;
}

export interface AcceptInvitationResponse {
  gameId: string;
  playerToken: string;
  playerId: number;
}

export interface CreateHotSeatResponse {
  gameId: string;
  players: Array<{ playerId: number; name: string; playerToken: string }>;
}

export interface GameStatusResponse {
  status: GameStatus;
  playersConnected: number;
  required: number;
  ready: boolean;
  readyCount: number;
  slots: Array<{ playerId: number; name?: string; status: LobbySlotStatus }>;
  canSkipWaiting: boolean;
}

export interface SkipWaitingResponse {
  started: boolean;
  playersConnected: number;
  required: number;
  slots: Array<{ playerId: number; name?: string; status: LobbySlotStatus }>;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime: string;
}

export interface StatusResponse {
  games: number;
  invites: number;
  webSockets: number;
  totals: {
    games: number;
    rematches: number;
  };
}

export interface VersionResponse {
  serverVersion: string;
  coreVersion: string;
  contractVersion: string;
}

export interface ErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}