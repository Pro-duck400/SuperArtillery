import * as dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { createHttpApp } from './http/createHttpApp';
import { GameManager } from './services/gameManager';
import { WsConnectionHandler } from './transport/wsConnectionHandler';

dotenv.config();

const port = parseInt(process.env.PORT || '3000', 10);
const game = new GameManager(undefined, undefined, {
  defaultClientOrigin: process.env.CLIENT_URL,
  defaultServerOrigin: process.env.SERVER_URL
});

let webSocketServer: WebSocketServer | null = null;
const app = createHttpApp(game, () => webSocketServer
  ? Array.from(webSocketServer.clients).filter(client => client.readyState === WebSocket.OPEN).length
  : 0);
const httpServer = createServer(app);
webSocketServer = new WebSocketServer({ server: httpServer });
new WsConnectionHandler(webSocketServer, game);

httpServer.listen(port, () => {
  console.log(`🚀 SuperArtillery server running on port ${port}`);
  console.log(`   HTTP API: http://localhost:${port}/api/swagger`);
  console.log(`   WebSocket: wss://localhost:${port}`);
});

function shutdown(): void {
  console.log('\n🛑 Shutting down server...');
  game.shutdown();
  webSocketServer?.close();
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);