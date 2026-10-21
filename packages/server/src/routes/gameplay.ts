import { Router } from 'express';
import type { ErrorResponse, FireRequest } from '@superartillery/core';
import { HTTP_STATUS } from '../httpStatus';
import type { ContractRouteHandler } from '../http/contract-route-handler';
import { GameManager } from '../services/gameManager';

export function createGameplayRouter(game: GameManager): Router {
  const router = Router();
  const fireHandler: ContractRouteHandler<'/v1/fire', FireRequest, ErrorResponse | undefined> = (req, res) => {
    const { gameId, angle, velocity, direction } = req.body;
    const sessionToken = typeof req.query.sessionToken === 'string' ? req.query.sessionToken : undefined;
    if (!gameId || !sessionToken || angle === undefined || velocity === undefined) {
      const errorResponse: ErrorResponse = {
        code: GameManager.ERROR_CODES.MISSING_FIELDS,
        message: GameManager.ERROR_MESSAGES.MISSING_FIELDS
      };
      return res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse);
    }
    if (typeof gameId !== 'string' || typeof angle !== 'number' || typeof velocity !== 'number') {
      const errorResponse: ErrorResponse = {
        code: GameManager.ERROR_CODES.INVALID_FIELD_TYPES,
        message: GameManager.ERROR_MESSAGES.INVALID_FIELD_TYPES
      };
      return res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse);
    }
    if (direction !== undefined && direction !== 'Left' && direction !== 'Right') {
      const errorResponse: ErrorResponse = {
        code: GameManager.ERROR_CODES.INVALID_FIELD_TYPES,
        message: 'direction must be Left or Right'
      };
      return res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse);
    }
    const result = game.fire(gameId, sessionToken, angle, velocity, direction);
    if ('error' in result) {
      const errorResponse: ErrorResponse = { code: result.code, message: result.error };
      return res.status(result.statusCode).json(errorResponse);
    }
    return res.status(HTTP_STATUS.OK).send();
  };
  router.post('/v1/fire', fireHandler);
  return router;
}