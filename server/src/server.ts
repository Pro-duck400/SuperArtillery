import { WebSocketServer, WebSocket } from 'ws';
import * as dotenv from 'dotenv';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { createServer } from 'http';
import { GameManager } from './services/gameManager';
import { GameMessage, FireMessage, GameOverMessage } from './types/messages';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);

// Single game instance (MVP: only one game at a time)
const game = new GameManager();

// Create Express app for HTTP endpoints
const app = express();

// Swagger setup
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SuperArtillery API',
      version: '1.0.0',
      description: 'API documentation for SuperArtillery game server',
    },
    servers: [
      { url: `http://localhost:${PORT}` }
    ],
  },
  apis: ['./src/server.ts'], // Use JSDoc comments in this file
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api/swagger', swaggerUi.serve, swaggerUi.setup(swaggerSpec));


// Middleware to parse JSON bodies
app.use(express.json());


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
app.get('/api/v1/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    players: game.getPlayerCount(),
    version: '1.0.0'
  });
});

// In-memory map to track registered player names to player IDs
const playerNames: (string | null)[] = [null, null];

// Create HTTP server
const httpServer = createServer(app);

// Swagger JSDoc for /api/v1/register
/**
 * @openapi
 * /api/v1/register:
 *   post:
 *     summary: Register a player by name
 *     description: Register the player on the server. Responds with playerId if successful.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
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
 *                   example: 0
 *       409:
 *         description: Player already registered
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 details:
 *                   type: string
 *                   example: Player Alice already registered
 *       403:
 *         description: Server full or bad request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 details:
 *                   type: string
 *                   example: Server is full
 */

// write to register endpoint
app.post('/api/v1/register', (req, res) => {
  const name = req.body || {};
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(403).json({ details: 'name is required' });
  }
  // check for duplicate name
  const existingId = playerNames.findIndex(n => n === name);
  if (existingId !== -1) {
    return res.status(409).json({ details: 'Player ${name} is already registered' });
  }
  // Check for available slot
  const slot = playerNames.findIndex(n => n === null);
  if (slot === -1) {
    return res.status(403).json({ details: 'Server is full'});
  }
  // Assign playerId (0 or 1) on successful registration
  playerNames[slot] = name;
  return res.status(200).json({ playerId: slot });
});

// Create WebSocket server attached to HTTP server
const wss = new WebSocketServer({ server: httpServer });

// Map to track which WebSocket belongs to which player
const playerMap = new WeakMap<WebSocket, number>();

// Start HTTP server
httpServer.listen(PORT, () => {
  console.log(`🚀 SuperArtillery server running on port ${PORT}`);
  console.log(`   HTTP API: http://localhost:${PORT}/api/health`);
  console.log(`   WebSocket: ws://localhost:${PORT}`);
  console.log(`Waiting for 2 players to connect...`);
});

wss.on('connection', (ws: WebSocket) => {
  console.log('New connection attempt...');

  // Try to add player to the game
  const playerId = game.addPlayer(ws);

  if (playerId === null) {
    // Game is full, reject connection
    console.log('Connection rejected: game is full');
    ws.send(JSON.stringify({ type: 'error', message: 'Game is full' }));
    ws.close();
    return;
  }

  // Store player ID for this connection
  playerMap.set(ws, playerId);

  console.log(`Player ${playerId} assigned. Total players: ${game.getPlayerCount()}/2`);

  // Handle incoming messages
  ws.on('message', (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString()) as GameMessage;
      console.log(`Received message from Player ${playerId}:`, message.type);

      switch (message.type) {
        case 'fire':
          game.handleFire(message as FireMessage);
          break;

        case 'game_over':
          game.handleGameOver(message as GameOverMessage);
          break;

        default:
          console.log('Unknown message type:', message);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  // Handle disconnection
  ws.on('close', () => {
    const pid = playerMap.get(ws);
    console.log(`Player ${pid} connection closed`);
    game.removePlayer(ws);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Handle server errors
wss.on('error', (error) => {
  console.error('WebSocket server error:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\nShutting down server...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
