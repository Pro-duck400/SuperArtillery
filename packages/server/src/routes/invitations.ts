import { Router } from 'express';
import type { ErrorResponse } from '../types/private-game';
import { HTTP_STATUS } from '../httpStatus';
import { errorCodeToHttpStatus } from '../http/errorMapper';
import { GameManager } from '../services/gameManager';

export function createInvitationsRouter(game: GameManager): Router {
  const router = Router();
  router.post('/v1/invitations/accept', (req, res) => {
    const { inviteCode, name } = req.body;
    const result = game.acceptInvitation(inviteCode, name);
    if ('error' in result) {
      const errorResponse: ErrorResponse = { code: result.code, message: result.error };
      return res.status(errorCodeToHttpStatus(result.code)).json(errorResponse);
    }
    return res.status(HTTP_STATUS.OK).json(result);
  });
  return router;
}