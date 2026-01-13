import { WebSocketServer, WebSocket } from 'ws';
import * as dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { createServer } from 'http';
import { GameManager } from './services/gameManager';
import { createApiRouter } from './routes/api';

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
  apis: ['./src/routes/*.ts'], // Scan route files for OpenAPI comments
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api/swagger', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Enable CORS for all routes
app.use(cors());

// Middleware to parse JSON bodies
app.use(express.json());

// Mount API routes
app.use('/api', createApiRouter(game));

// Create HTTP server
const httpServer = createServer(app);

// Create WebSocket server attached to HTTP server
const wss = new WebSocketServer({ server: httpServer });

// Map to track which WebSocket belongs to which player
const playerMap = new WeakMap<WebSocket, number>();

// Start HTTP server
httpServer.listen(PORT, () => {
  console.log(`🚀 SuperArtillery server running on port ${PORT}`);
  console.log(`   HTTP API: http://localhost:${PORT}/api/swagger`);
  console.log(`   WebSocket: ws://localhost:${PORT}`);
  console.log(`Waiting for 2 players to connect...`);
});

wss.on('connection', (ws: WebSocket, req) => {
  console.log('New WebSocket connection attempt...');

  // Extract playerId from query string (e.g., ws://localhost:3000?playerId=0)
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const playerIdParam = url.searchParams.get('playerId');

  if (!playerIdParam || (playerIdParam !== '0' && playerIdParam !== '1')) {
    console.log('Connection rejected: missing or invalid playerId');
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid or missing playerId' }));
    ws.close();
    return;
  }

  const playerId = parseInt(playerIdParam) as 0 | 1;

  // Connect the player
  const connected = game.connectPlayer(playerId, ws);

  if (!connected) {
    console.log(`Connection rejected: Player ${playerId} not registered`);
    ws.send(JSON.stringify({ type: 'error', message: 'Player not registered' }));
    ws.close();
    return;
  }

  // Store player ID for this connection
  playerMap.set(ws, playerId);

  console.log(`Player ${playerId} WebSocket connected. Registered players: ${game.getPlayerCount()}/2`);

  // Note: Clients don't send WebSocket messages - they use HTTP endpoints instead
  // WebSocket is used only for server -> client broadcasts (game_start, shot, turn_change, game_over)

  // Handle disconnection
  ws.on('close', () => {
    const pid = playerMap.get(ws);
    console.log(`Player ${pid} WebSocket connection closed`);
    game.disconnectPlayer(ws);
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
