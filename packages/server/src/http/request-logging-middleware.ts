import type { RequestHandler } from 'express';
import type { GameManager } from '../services/gameManager';

export function createRequestLoggingMiddleware(game: GameManager): RequestHandler {
  return (req, res, next) => {
    const bodyPlayerName = typeof req.body?.name === 'string'
      ? req.body.name
      : Array.isArray(req.body?.names)
        ? req.body.names.filter((name: unknown): name is string => typeof name === 'string').join(', ')
        : undefined;
    const token = typeof req.query.sessionToken === 'string' ? req.query.sessionToken : undefined;
    const gameId = typeof req.params.gameId === 'string' ? req.params.gameId : undefined;
    const playerName = bodyPlayerName ?? (token ? game.getPlayerNameFromToken(token, gameId) : undefined) ?? 'anonymous';
    const endpoint = `${req.method} ${req.baseUrl}${req.path}`;
    console.log(`🌐 HTTP endpoint=${endpoint} player=${playerName}`);
    res.once('finish', () => {
      console.log(`🌐 HTTP response endpoint=${endpoint} player=${playerName} status=${res.statusCode}`);
    });
    next();
  };
}