import { Router } from 'express';
import { GameManager } from '../services/gameManager';
import { createHealthRouter } from './health';
import { createGamesRouter } from './games';
import { createInvitationsRouter } from './invitations';
import { createGameplayRouter } from './gameplay';
import { createRequestLoggingMiddleware } from '../http/request-logging-middleware';

export function createApiRouter(game: GameManager, getWebSocketCount: () => number = () => 0): Router {
  const router = Router();

  router.use(createRequestLoggingMiddleware(game));
  router.use(createHealthRouter(game, getWebSocketCount));
  router.use(createGamesRouter(game));
  router.use(createInvitationsRouter(game));
  router.use(createGameplayRouter(game));

  return router;
}
