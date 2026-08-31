import { Router } from 'express';
import type { Request } from 'express';
import { GameManager } from '../services/gameManager';
import type { HealthResponse, ErrorResponse } from '../types/private-game';

// Derives the origin the request actually came from (Origin header, then Referer),
// so invite links work in local dev, staging, and production without hardcoding a host.
function getClientOrigin(req: Request): string | undefined {
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin) {
    return origin;
  }

  const referer = req.headers.referer;
  if (typeof referer === 'string' && referer) {
    try {
      return new URL(referer).origin;
    } catch {
      // ignore malformed referer
    }
  }

  return undefined;
}

export function createApiRouter(game: GameManager): Router {
  const router = Router();

  // GET /api/v1/health - Enhanced health check
  router.get('/v1/health', (_req, res) => {
    const stats = game.getStats();
    const healthResponse: HealthResponse = {
      status: stats.maxGamesReached ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      gameCount: stats.gameCount,
      invitationCount: stats.invitationCount,
      maxGamesReached: stats.maxGamesReached,
      version: '1.0.0'
    };
    res.json(healthResponse);
  });

  // POST /api/v1/games - Create a private game
  router.post('/v1/games', (req, res) => {
    const { playerName } = req.body;
    const clientOrigin = getClientOrigin(req);

    const result = game.createGame(playerName, clientOrigin);

    if ('error' in result) {
      const statusCode = result.code === 'MAX_GAMES_REACHED' ? 503 : 400;
      const errorResponse: ErrorResponse = {
        code: result.code,
        message: result.error
      };
      return res.status(statusCode).json(errorResponse);
    }

    return res.status(201).json(result);
  });

  // POST /api/v1/invitations/accept - Accept an invitation
  router.post('/v1/invitations/accept', (req, res) => {
    const { inviteToken, inviteCode, playerName } = req.body;

    // Accept either token or code
    const inviteTokenOrCode = inviteToken || inviteCode;

    const result = game.acceptInvitation(inviteTokenOrCode, playerName);

    if ('error' in result) {
      const statusCode = result.code === 'INVITATION_EXPIRED' ? 410 : 400;
      const errorResponse: ErrorResponse = {
        code: result.code,
        message: result.error
      };
      return res.status(statusCode).json(errorResponse);
    }

    return res.status(200).json(result);
  });

  // GET /api/v1/games/:gameId/status - Get game status (requires session token)
  router.get('/v1/games/:gameId/status', (req, res) => {
    const { gameId } = req.params;
    const sessionToken = req.query.sessionToken as string | undefined;

    if (!sessionToken) {
      const errorResponse: ErrorResponse = {
        code: 'MISSING_SESSION_TOKEN',
        message: 'Session token is required'
      };
      return res.status(401).json(errorResponse);
    }

    const result = game.getGameStatus(gameId, sessionToken);

    if ('error' in result) {
      const statusCode = result.code === 'GAME_NOT_FOUND' ? 404 : 401;
      const errorResponse: ErrorResponse = {
        code: result.code,
        message: result.error
      };
      return res.status(statusCode).json(errorResponse);
    }

    return res.status(200).json(result);
  });

  // POST /api/v1/fire - Fire a projectile (updated for session tokens)
  router.post('/v1/fire', (req, res) => {
    const { gameId, angle, velocity } = req.body;
    const sessionToken = req.query.sessionToken as string | undefined;

    // Validate required fields
    if (!gameId || !sessionToken || angle === undefined || velocity === undefined) {
      const errorResponse: ErrorResponse = {
        code: 'MISSING_FIELDS',
        message: 'gameId, sessionToken, angle, and velocity are required'
      };
      return res.status(400).json(errorResponse);
    }

    // Validate types
    if (typeof gameId !== 'string' || typeof angle !== 'number' || typeof velocity !== 'number') {
      const errorResponse: ErrorResponse = {
        code: 'INVALID_FIELD_TYPES',
        message: 'gameId must be string, angle and velocity must be numbers'
      };
      return res.status(400).json(errorResponse);
    }

    // Call game manager to handle fire
    const result = game.fire(gameId, sessionToken, angle, velocity);

    if ('error' in result) {
      const errorResponse: ErrorResponse = {
        code: result.code,
        message: result.error
      };
      return res.status(result.statusCode).json(errorResponse);
    }

    return res.status(200).send();
  });

  return router;
}
