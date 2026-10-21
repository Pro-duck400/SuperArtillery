import { Router } from 'express';
import type {
  CreateGameRequest,
  CreateGameResponse,
  ErrorResponse,
  GameStatusResponse,
  RematchRequest,
  RematchResponse,
  SkipWaitingResponse
} from '@superartillery/core';
import { HTTP_STATUS } from '../httpStatus';
import { errorCodeToHttpStatus } from '../http/errorMapper';
import type { ContractRouteHandler } from '../http/contract-route-handler';
import { GameManager } from '../services/gameManager';
import { getClientBaseUrl } from './client-base-url';

export function createGamesRouter(game: GameManager): Router {
  const router = Router();

  const createGameHandler: ContractRouteHandler<
    '/v1/games',
    CreateGameRequest,
    CreateGameResponse | ErrorResponse
  > = (req, res) => {
    const { name, playerCount, clientUrl } = req.body;
    const clientOrigin = typeof clientUrl === 'string' ? clientUrl : getClientBaseUrl(req);
    const forwardedProto = req.headers['x-forwarded-proto'];
    const protocol = typeof forwardedProto === 'string'
      ? forwardedProto.split(',')[0].trim()
      : req.protocol;
    const serverOrigin = process.env.SERVER_URL || `${protocol}://${req.get('host')}`;
    const result = game.createGame(name, clientOrigin, serverOrigin, playerCount ?? 2);
    if ('error' in result) {
      const errorResponse: ErrorResponse = { code: result.code, message: result.error };
      return res.status(errorCodeToHttpStatus(result.code)).json(errorResponse);
    }
    return res.status(HTTP_STATUS.CREATED).json(result);
  };
  router.post('/v1/games', createGameHandler);

  const skipWaitingHandler: ContractRouteHandler<
    '/v1/games/:gameId/skip-waiting',
    unknown,
    SkipWaitingResponse | ErrorResponse
  > = (req, res) => {
    const { gameId } = req.params;
    const sessionToken = typeof req.query.sessionToken === 'string' ? req.query.sessionToken : undefined;
    if (!sessionToken) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        code: GameManager.ERROR_CODES.MISSING_SESSION_TOKEN,
        message: GameManager.ERROR_MESSAGES.MISSING_SESSION_TOKEN
      });
    }
    const result = game.skipWaiting(gameId, sessionToken);
    if ('error' in result) {
      return res.status(errorCodeToHttpStatus(result.code)).json({ code: result.code, message: result.error });
    }
    return res.status(HTTP_STATUS.OK).json(result);
  };
  router.post('/v1/games/:gameId/skip-waiting', skipWaitingHandler);

  const gameStatusHandler: ContractRouteHandler<
    '/v1/games/:gameId/status',
    unknown,
    GameStatusResponse | ErrorResponse
  > = (req, res) => {
    const { gameId } = req.params;
    const sessionToken = typeof req.query.sessionToken === 'string' ? req.query.sessionToken : undefined;
    if (!sessionToken) {
      const errorResponse: ErrorResponse = {
        code: GameManager.ERROR_CODES.MISSING_SESSION_TOKEN,
        message: GameManager.ERROR_MESSAGES.MISSING_SESSION_TOKEN
      };
      return res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse);
    }
    const result = game.getGameStatus(gameId, sessionToken);
    if ('error' in result) {
      const errorResponse: ErrorResponse = { code: result.code, message: result.error };
      return res.status(errorCodeToHttpStatus(result.code, HTTP_STATUS.UNAUTHORIZED)).json(errorResponse);
    }
    return res.status(HTTP_STATUS.OK).json(result);
  };
  router.get('/v1/games/:gameId/status', gameStatusHandler);

  const rematchHandler: ContractRouteHandler<
    '/v1/games/:gameId/rematch',
    RematchRequest | undefined,
    RematchResponse | ErrorResponse
  > = (req, res) => {
    const { gameId } = req.params;
    const sessionToken = typeof req.query.sessionToken === 'string' ? req.query.sessionToken : undefined;
    if (!sessionToken) {
      const errorResponse: ErrorResponse = {
        code: GameManager.ERROR_CODES.MISSING_SESSION_TOKEN,
        message: GameManager.ERROR_MESSAGES.MISSING_SESSION_TOKEN
      };
      return res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse);
    }
    const result = game.requestRematch(gameId, sessionToken, req.body?.answer);
    if ('error' in result) {
      const errorResponse: ErrorResponse = { code: result.code, message: result.error };
      return res.status(result.statusCode).json(errorResponse);
    }
    const response: RematchResponse = {
      answer: result.answer,
      answered: result.answered,
      required: result.required,
      players: result.players,
      roundStarted: result.roundStarted
    };
    return res.status(HTTP_STATUS.OK).json(response);
  };
  router.post('/v1/games/:gameId/rematch', rematchHandler);

  return router;
}