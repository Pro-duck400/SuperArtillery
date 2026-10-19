import type { GameMessage, WebSocketErrorMessage } from '../types/messages';
import type {
  CreateHotSeatResponse,
  RematchAnswer,
  ShotDirection
} from '@superartillery/core';
import type {
  AcceptInvitationResponse,
  CreateGameResponse,
  GameStatusResponse,
  HealthResponse,
  RematchResponse,
  SkipWaitingResponse,
  StatusResponse,
  VersionResponse
} from './api';

export interface GameGateway {
  healthCheckWithRetry(): Promise<HealthResponse>;
  getStatus(): Promise<StatusResponse>;
  getVersion(): Promise<VersionResponse>;
  createGame(playerName: string, clientUrl: string, playerCount?: number): Promise<CreateGameResponse>;
  createLocalGame?: (names: string[]) => Promise<CreateHotSeatResponse>;
  acceptInvitation(inviteCode: string, playerName: string): Promise<AcceptInvitationResponse>;
  getGameStatus(gameId: string, sessionToken: string): Promise<GameStatusResponse>;
  skipWaiting(gameId: string, sessionToken: string): Promise<SkipWaitingResponse>;
  fire(gameId: string, sessionToken: string, angle: number, velocity: number, direction?: ShotDirection): Promise<void>;
  requestRematch(gameId: string, sessionToken: string, answer: RematchAnswer): Promise<RematchResponse>;
  connect(gameId: string, sessionToken: string): Promise<void>;
  disconnect(): void;
  onMessage(handler: (message: GameMessage) => void): void;
  onError(handler: (error: WebSocketErrorMessage) => void): void;
}

export type {
  AcceptInvitationResponse,
  CreateGameResponse,
  CreateHotSeatResponse,
  GameStatusResponse,
  HealthResponse,
  RematchResponse,
  SkipWaitingResponse,
  StatusResponse,
  VersionResponse
};