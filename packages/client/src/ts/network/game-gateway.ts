import type { GameMessage, WebSocketErrorMessage } from '../types/messages';
import type {
  AcceptInvitationResponse,
  CreateGameResponse,
  GameStatusResponse,
  HealthResponse,
  RematchResponse,
  SkipWaitingResponse,
  StatsResponse
} from './api';
import type { CreateHotSeatResponse } from '@superartillery/core';

export interface GameGateway {
  healthCheckWithRetry(): Promise<HealthResponse>;
  getStats(): Promise<StatsResponse>;
  createGame(playerName: string, clientUrl: string, playerCount?: number): Promise<CreateGameResponse>;
  createLocalGame?: (names: string[]) => Promise<CreateHotSeatResponse>;
  acceptInvitation(inviteCode: string, playerName: string): Promise<AcceptInvitationResponse>;
  getGameStatus(gameId: string, sessionToken: string): Promise<GameStatusResponse>;
  skipWaiting(gameId: string, sessionToken: string): Promise<SkipWaitingResponse>;
  fire(gameId: string, sessionToken: string, angle: number, velocity: number, direction?: 'Left' | 'Right'): Promise<void>;
  requestRematch(gameId: string, sessionToken: string, answer: 'play_again' | 'had_enough'): Promise<RematchResponse>;
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
  StatsResponse
};