import { Router } from 'express';
import { CONTRACT_VERSION, CORE_VERSION } from '@superartillery/core';
import type { HealthResponse, StatusResponse, VersionResponse } from '../types/private-game';
import { HTTP_STATUS } from '../httpStatus';
import { formatUptime } from '../http/uptime';
import { getServerVersion } from '../http/server-version';
import type { GameManager } from '../services/gameManager';

export function createHealthRouter(game: GameManager, getWebSocketCount: () => number = () => 0): Router {
  const router = Router();
  const serverVersion = getServerVersion();

  router.get('/v1/health', (_req, res) => {
    const stats = game.getStats();
    const response: HealthResponse = {
      status: stats.maxReached ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      uptime: formatUptime(process.uptime())
    };
    return res.status(HTTP_STATUS.OK).json(response);
  });

  router.get('/v1/status', (_req, res) => {
    const stats = game.getStats();
    const response: StatusResponse = {
      games: stats.games,
      invites: stats.invites,
      webSockets: getWebSocketCount(),
      totals: stats.totals
    };
    return res.status(HTTP_STATUS.OK).json(response);
  });

  router.get('/v1/version', (_req, res) => {
    const response: VersionResponse = {
      serverVersion,
      coreVersion: CORE_VERSION,
      contractVersion: CONTRACT_VERSION
    };
    return res.status(HTTP_STATUS.OK).json(response);
  });

  return router;
}