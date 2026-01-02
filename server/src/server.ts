import { WebSocketServer, WebSocket } from 'ws';
import * as dotenv from 'dotenv';
import express from 'express';
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

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    players: game.getPlayerCount(),
    version: '1.0.0'
  });
});

// Create HTTP server
const httpServer = createServer(app);

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
