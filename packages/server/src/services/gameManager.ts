import {
  GAME_ERROR_CODES,
  GAME_ERROR_MESSAGES,
  GameEngine,
  InMemoryGameRepository,
  type AcceptInvitationResponse,
  type CreateGameResponse,
  type CreateHotSeatResponse,
  type GameRepository,
  type GameStatusResponse,
  type RematchAnswer,
  type Result,
  type SkipWaitingResponse,
  type TimerScheduler,
  type PlayerConnection
} from '@superartillery/core';
import { SystemTimerScheduler } from './gameCleanupService';
import { HTTP_STATUS } from '../httpStatus';
import { errorCodeToHttpStatus } from '../http/errorMapper';

export interface GameManagerOptions {
  defaultClientOrigin?: string;
  defaultServerOrigin?: string;
}

type LegacyError = { error: string; code: string };

export class GameManager {
  static readonly HTTP_STATUS = HTTP_STATUS;
  static readonly ERROR_CODES = GAME_ERROR_CODES;
  static readonly ERROR_MESSAGES = GAME_ERROR_MESSAGES;

  private readonly engine: GameEngine;
  private readonly defaultClientOrigin: string;
  private readonly defaultServerOrigin: string;

  constructor(
    games: GameRepository = new InMemoryGameRepository(),
    timerScheduler: TimerScheduler = new SystemTimerScheduler(),
    options: GameManagerOptions = {}
  ) {
    this.defaultClientOrigin = options.defaultClientOrigin ?? 'http://localhost:5173';
    this.defaultServerOrigin = options.defaultServerOrigin ?? 'http://localhost:3000';
    this.engine = new GameEngine({
      games,
      timerScheduler,
      defaultClientOrigin: this.defaultClientOrigin,
      defaultServerOrigin: this.defaultServerOrigin
    });
  }

  public shutdown(): void {
    this.engine.shutdown();
  }

  public createGame(
    playerName: string,
    clientOrigin?: string,
    serverOrigin?: string,
    playerCount: number = 2
  ): CreateGameResponse | LegacyError {
    return this.toLegacy(this.engine.createGame(
      playerName,
      clientOrigin ?? this.defaultClientOrigin,
      serverOrigin ?? this.defaultServerOrigin,
      playerCount
    ));
  }

  public acceptInvitation(inviteCode: string | undefined, playerName: string): AcceptInvitationResponse | LegacyError {
    return this.toLegacy(this.engine.acceptInvitation(inviteCode, playerName));
  }

  public createHotSeatGame(playerNames: string[]): CreateHotSeatResponse | LegacyError {
    return this.toLegacy(this.engine.createLocalGame(playerNames));
  }

  public getGameStatus(gameId: string, sessionToken: string): GameStatusResponse | LegacyError {
    return this.toLegacy(this.engine.getGameStatus(gameId, sessionToken));
  }

  public skipWaiting(gameId: string, sessionToken: string): SkipWaitingResponse | LegacyError {
    return this.toLegacy(this.engine.skipWaiting(gameId, sessionToken));
  }

  public connectPlayer(
    gameId: string,
    sessionToken: string,
    connection: PlayerConnection
  ): { playerId: number } | LegacyError {
    return this.toLegacy(this.engine.connect(gameId, sessionToken, connection));
  }

  public getPlayerIdFromToken(gameId: string, sessionToken: string): number | null {
    return this.engine.getPlayerIdFromToken(gameId, sessionToken);
  }

  public getPlayerNameFromToken(sessionToken: string, gameId?: string): string | null {
    return this.engine.getPlayerNameFromToken(sessionToken, gameId);
  }

  public getPlayerName(gameId: string, playerId: number): string | null {
    return this.engine.getPlayerName(gameId, playerId);
  }

  public disconnectPlayer(gameId: string, playerId: number, connection: PlayerConnection): void {
    this.engine.disconnect(gameId, playerId, connection);
  }

  public requestRematch(gameId: string, sessionToken: string, answer: RematchAnswer = 'play_again'):
    | {
        success: true;
        answer: RematchAnswer;
        answered: number;
        playersReady: number;
        required: number;
        players: Array<{ playerId: number; name: string; answer?: RematchAnswer }>;
        roundStarted: boolean;
      }
    | { success: false; error: string; code: string; statusCode: number } {
    const result = this.engine.requestRematch(gameId, sessionToken, answer);
    if (!result.ok) {
      return {
        success: false,
        error: result.error.message,
        code: result.error.code,
        statusCode: errorCodeToHttpStatus(result.error.code)
      };
    }
    return { success: true, ...result.value };
  }

  public fire(
    gameId: string,
    sessionToken: string,
    angle: number,
    velocity: number,
    direction?: 'Left' | 'Right'
  ): { success: true } | { success: false; error: string; code: string; statusCode: number } {
    const result = this.engine.fire(gameId, sessionToken, angle, velocity, direction);
    if (!result.ok) {
      return {
        success: false,
        error: result.error.message,
        code: result.error.code,
        statusCode: errorCodeToHttpStatus(result.error.code)
      };
    }
    return result.value;
  }

  public getStats(): ReturnType<GameEngine['getStats']> {
    return this.engine.getStats();
  }

  private toLegacy<T>(result: Result<T>): T | LegacyError {
    return result.ok
      ? result.value
      : { error: result.error.message, code: result.error.code };
  }
}