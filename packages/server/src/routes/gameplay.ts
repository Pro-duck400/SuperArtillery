import { Router } from 'express';
import type { ErrorResponse } from '../types/private-game';
import { HTTP_STATUS } from '../httpStatus';
import { GameManager } from '../services/gameManager';

export function createGameplayRouter(game: GameManager): Router {
  const router = Router();
  router.post('/v1/fire', (req, res) => {
    const { gameId, angle, velocity, direction } = req.body;
    const sessionToken = req.query.sessionToken as string | undefined;
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
  });
  return router;
}