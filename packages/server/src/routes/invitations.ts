import { Router } from 'express';
import type { AcceptInvitationRequest, AcceptInvitationResponse, ErrorResponse } from '@superartillery/core';
import { HTTP_STATUS } from '../httpStatus';
import { errorCodeToHttpStatus } from '../http/errorMapper';
import type { ContractRouteHandler } from '../http/contract-route-handler';
import { GameManager } from '../services/gameManager';

export function createInvitationsRouter(game: GameManager): Router {
  const router = Router();
  const acceptInvitationHandler: ContractRouteHandler<
    '/v1/invitations/accept',
    AcceptInvitationRequest,
    AcceptInvitationResponse | ErrorResponse
  > = (req, res) => {
    const { inviteCode, name } = req.body;
    const result = game.acceptInvitation(inviteCode, name);
    if ('error' in result) {
      const errorResponse: ErrorResponse = { code: result.code, message: result.error };
      return res.status(errorCodeToHttpStatus(result.code)).json(errorResponse);
    }
    return res.status(HTTP_STATUS.OK).json(result);
  };
  router.post('/v1/invitations/accept', acceptInvitationHandler);
  return router;
}