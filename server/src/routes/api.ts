import { Router } from 'express';
import { GameManager } from '../services/gameManager';

export function createApiRouter(game: GameManager): Router {
  const router = Router();

  /**
   * @openapi
   * /api/v1/health:
   *   get:
   *     summary: Health check for the server
   *     description: Returns server status and basic info.
   *     responses:
   *       200:
   *         description: Server is healthy
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: ok
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   *                 uptime:
   *                   type: number
   *                   example: 123.45
   *                 players:
   *                   type: integer
   *                   example: 1
   *                 version:
   *                   type: string
   *                   example: 1.0.0
   */
  router.get('/v1/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      players: game.getPlayerCount(),
      version: '1.0.0'
    });
  });

  /**
   * @openapi
   * /api/v1/register:
   *   post:
   *     summary: Register a player
   *     description: Register a player on the server. Server responds with playerId if registration is successful.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *             properties:
   *               name:
   *                 type: string
   *                 example: Alice
   *     responses:
   *       200:
   *         description: Registration successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 playerId:
   *                   type: integer
   *                   enum: [0, 1]
   *                   example: 0
   *       400:
   *         description: Bad request - name is required
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 details:
   *                   type: string
   *                   example: Name is required
   *       403:
   *         description: Server is full
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 details:
   *                   type: string
   *                   example: Server is full
   *       409:
   *         description: Player name already registered
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 details:
   *                   type: string
   *                   example: Player Alice already registered
   */
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

/**
 * @openapi
 * /api/v1/fire:
 *   post:
 *     summary: Fire a shot
 *     description: >
 *       Sends the firing action for the current player's turn.
 *       On success, the server broadcasts WebSocket messages:
 *       `shot` followed by `turn_change` or `game_over`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [gameId, playerId, angle, velocity]
 *             properties:
 *               gameId:
 *                 type: integer
 *                 example: 1
 *               playerId:
 *                 type: integer
 *                 enum: [0, 1]
 *                 example: 0
 *               angle:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 360
 *                 example: 45
 *               velocity:
 *                 type: number
 *                 minimum: 0
 *                 example: 250
 *     responses:
 *       200:
 *         description: Fire action successful
 *       400:
 *         description: |
 *           Bad request. Possible errors:
 *           - Missing required fields (gameId, playerId, angle, velocity)
 *           - Invalid field types
 *           - GameId is unknown
 *           - PlayerId is unknown
 *           - Player should wait for its turn to fire
 *           - The angle should be within 0-360 degrees
 *           - The velocity should be positive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 details:
 *                   type: string
 *                   example: Player should wait for its turn to fire.
 */

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
