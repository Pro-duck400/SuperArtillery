import type { PlayerConnection } from '../ports/player-connection';
import type { Battlefield } from '../contract/messages';
import type { GameStatus, LobbySlotStatus, RematchAnswer } from '../contract/api-types';

export type {
  AcceptInvitationRequest,
  AcceptInvitationResponse,
  CreateGameRequest,
  CreateGameResponse,
  ErrorResponse,
  FireRequest,
  GameStatus,
  GameStatusResponse,
  HealthResponse,
  LobbySlotResponse,
  LobbySlotStatus,
  RematchAnswer,
  RematchPlayerStatus,
  RematchRequest,
  RematchResponse,
  ShotDirection,
  SkipWaitingResponse,
  StatusResponse,
  VersionResponse
} from '../contract/api-types';

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

export interface CreateHotSeatResponse {
  gameId: string;
  players: Array<{ playerId: number; name: string; playerToken: string }>;
}