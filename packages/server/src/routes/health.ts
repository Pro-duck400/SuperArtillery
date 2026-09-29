import { Router } from 'express';
import { CONTRACT_VERSION, CORE_VERSION } from '@superartillery/core';
import type { HealthResponse, StatsResponse } from '../types/private-game';
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
      uptime: formatUptime(process.uptime()),
      games: stats.games,
      invites: stats.invites,
      version: serverVersion,
      coreVersion: CORE_VERSION,
      contractVersion: CONTRACT_VERSION
    };
    return res.status(HTTP_STATUS.OK).json(response);
  });

  router.get('/v1/stats', (_req, res) => {
    const stats = game.getStats();
    const response: StatsResponse = {
      status: stats.maxReached ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      uptime: formatUptime(process.uptime()),
      games: stats.games,
      invites: stats.invites,
      webSockets: getWebSocketCount(),
      totals: stats.totals,
      version: serverVersion,
      coreVersion: CORE_VERSION,
      contractVersion: CONTRACT_VERSION
    };
    return res.status(HTTP_STATUS.OK).json(response);
  });

  return router;
}