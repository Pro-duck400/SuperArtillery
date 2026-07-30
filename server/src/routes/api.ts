import { Router } from 'express';
import { GameManager } from '../services/gameManager';

export function createApiRouter(game: GameManager): Router {
  const router = Router();

  router.get('/v1/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      players: game.getPlayerCount(),
      version: '1.0.0'
    });
  });

  router.post('/v1/register', (req, res) => {
    const { name } = req.body;

    // Validate that name is provided
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ details: 'Name is required' });
    }

    // Register the player (HTTP only, no WebSocket yet)
    const result = game.registerPlayer(name);

    if (result.success) {
      return res.status(200).json({ playerId: result.playerId });
    } else {
      return res.status(result.statusCode).json({ details: result.error });
    }
  });

  router.post('/v1/fire', (req, res) => {
    const { gameId, playerId, angle, velocity } = req.body;

    // Validate required fields
    if (gameId === undefined || playerId === undefined || angle === undefined || velocity === undefined) {
      return res.status(400).json({ details: 'Missing required fields' });
    }

    // Validate types
    if (typeof gameId !== 'number' || typeof playerId !== 'number' || typeof angle !== 'number' || typeof velocity !== 'number') {
      return res.status(400).json({ details: 'Invalid field types' });
    }

    // Call game manager to handle fire
    const result = game.fire(gameId, playerId as 0 | 1, angle, velocity);

    if (result.success) {
      return res.status(200).send();
    } else {
      return res.status(result.statusCode).json({ details: result.error });
    }
  });

  return router;
}
