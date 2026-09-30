import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import { CONTRACT_VERSION } from '@superartillery/core';
import { GameManager } from '../services/gameManager';
import { WebSocketPlayerConnection } from './webSocketPlayerConnection';

interface ConnectionMetadata {
  gameId: string;
  playerId: number;
  connection: WebSocketPlayerConnection;
}

export class WsConnectionHandler {
  private readonly connectionMetadata = new WeakMap<WebSocket, ConnectionMetadata>();

  constructor(
    private readonly webSocketServer: WebSocketServer,
    private readonly game: GameManager
  ) {
    this.webSocketServer.on('connection', (socket, request) => this.handleConnection(socket, request));
    this.webSocketServer.on('error', error => console.error('WebSocket server error:', error));
  }

  private handleConnection(socket: WebSocket, request: IncomingMessage): void {
    console.log('📡 New WebSocket connection attempt...');
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const gameId = url.searchParams.get('gameId');
    const sessionToken = url.searchParams.get('sessionToken');
    const contractVersion = url.searchParams.get('contractVersion');

    if (contractVersion !== CONTRACT_VERSION) {
      this.reject(socket, {
        type: 'error',
        code: 'CONTRACT_VERSION_MISMATCH',
        message: `Client contract version ${contractVersion || 'missing'} is not supported. Server requires ${CONTRACT_VERSION}.`,
        details: { expected: CONTRACT_VERSION, received: contractVersion }
      }, 'Contract version mismatch', gameId ?? undefined);
      return;
    }

    if (!gameId || !sessionToken) {
      console.log('❌ Connection rejected: missing gameId or sessionToken');
      this.reject(socket, {
        type: 'error',
        code: 'MISSING_AUTH',
        message: 'gameId and sessionToken are required'
      }, 'Missing authentication parameters', gameId ?? undefined);
      return;
    }

    const connection = new WebSocketPlayerConnection(socket);
    const result = this.game.connectPlayer(gameId, sessionToken, connection);
    if ('error' in result) {
      console.log(`❌ Connection rejected: ${result.error}`);
      this.reject(socket, { type: 'error', code: result.code, message: result.error }, 'Authentication failed', gameId);
      return;
    }

    const playerId = result.playerId;
    this.connectionMetadata.set(socket, { gameId, playerId, connection });
    const playerName = this.game.getPlayerName(gameId, playerId) ?? `Player ${playerId + 1}`;
    console.log(`✅ Player ${playerId} (${playerName}) connected to game ${gameId}`);

    socket.on('close', () => {
      const metadata = this.connectionMetadata.get(socket);
      if (!metadata) return;
      const disconnectedName = this.game.getPlayerName(metadata.gameId, metadata.playerId) ?? `Player ${metadata.playerId + 1}`;
      console.log(`❌ Player ${metadata.playerId} (${disconnectedName}) disconnected from game ${metadata.gameId}`);
      this.game.disconnectPlayer(metadata.gameId, metadata.playerId, metadata.connection);
    });

    socket.on('message', rawMessage => {
      const metadata = this.connectionMetadata.get(socket);
      const name = metadata
        ? this.game.getPlayerName(metadata.gameId, metadata.playerId) ?? `Player ${metadata.playerId + 1}`
        : 'unknown';
      this.logMessage('received', rawMessage.toString(), name, metadata?.gameId);
    });

    socket.on('error', error => console.error('WebSocket error:', error));
  }

  private reject(socket: WebSocket, message: unknown, reason: string, gameId?: string): void {
    const payload = JSON.stringify(message);
    this.logMessage('sent', payload, 'unknown', gameId);
    socket.send(payload);
    socket.close(1008, reason);
  }

  private logMessage(direction: 'sent' | 'received', message: unknown, playerName: string, gameId?: string): void {
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    console.log(`📡 WebSocket ${direction} player=${playerName} game=${gameId ?? 'unknown'} payload=${payload}`);
  }
}