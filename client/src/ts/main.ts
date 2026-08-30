// Main entry point for SuperArtillery
import '../css/style.css';
import { Game } from './game';
import { Renderer } from './renderer';
import { ProjectileAnimator } from './projectile-animator';
import { UIManager } from './ui-manager';
import { GameClient } from './game-client';

console.log('SuperArtillery initializing...');

const DEFAULT_SERVER_ADDRESS = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

function resolveServerBaseUrls(serverAddress: string): { apiBaseUrl: string; wsBaseUrl: string } {
  const parsedUrl = new URL(serverAddress.trim() || DEFAULT_SERVER_ADDRESS);
  const apiBaseUrl = parsedUrl.origin;
  const wsProtocol = parsedUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsBaseUrl = `${wsProtocol}//${parsedUrl.host}`;
  return { apiBaseUrl, wsBaseUrl };
}

// Initialize canvas and renderer
const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
if (!canvas) {
  console.error('Canvas element not found');
  throw new Error('Canvas element not found');
}

const renderer = new Renderer(canvas);
renderer.render(null);
console.log('Renderer initialized');

// Create core components
const game = new Game();
const animator = new ProjectileAnimator(renderer, canvas.width);
const uiManager = new UIManager(DEFAULT_SERVER_ADDRESS);
let gameClient: GameClient | null = null;

function wireGameClientEvents(client: GameClient): void {
  client.onConnected(() => {
    uiManager.setStatus('Connected! Waiting for opponent...');
    uiManager.setMessage('Waiting for another player to join...');
  });

  client.onGameStart((gameId: string, battlefield) => {
    renderer.applyBattlefield(battlefield);
    animator.configureScene(
      renderer.getCanvasWidth(),
      renderer.getGroundY(),
      renderer.getCastleTopY(),
      battlefield.gravity
    );

    const playerId = client.getPlayerId();
    // Get opponent name from GameStartMessage if available
    let opponentName = '';
    const lastGameStartMessage = client.getLastGameStartMessage();
    if (lastGameStartMessage && typeof lastGameStartMessage.opponentName === 'string') {
      opponentName = lastGameStartMessage.opponentName;
    }
    // Set both names in DOM
    const leftNameEl = document.getElementById('playerNameLeft');
    const rightNameEl = document.getElementById('playerNameRight');
    if (playerId === 0) {
      if (rightNameEl) {
        rightNameEl.textContent = opponentName;
        rightNameEl.style.color = '#ffffff';
      }

    } else {
      if (leftNameEl) {
        leftNameEl.textContent = opponentName;
        leftNameEl.style.color = '#ffffff';
      }
    }

    uiManager.setStatus(`Game #${gameId} - You are Player ${(playerId ?? 0) + 1}`);
    uiManager.setMessage('Game starting! Waiting for first turn...');
  });

  client.onShot((data) => {
    const playerId = client.getPlayerId();
    const isMyShot = playerId !== null && data.playerId === playerId;
    uiManager.setMessage(
      isMyShot
        ? `You fired: angle=${data.angle}°, velocity=${data.velocity}`
        : `Opponent fired: angle=${data.angle}°, velocity=${data.velocity}`
    );

    const shooterId = data.playerId === 0 ? 0 : 1;
    const startX = renderer.getCastleMuzzleX(shooterId);
    animator.fire(data.angle, data.velocity, startX, shooterId);
  });

  client.onTurnChange((playerId: number, isMyTurn: boolean) => {
    uiManager.updateTurnUI(playerId as 0 | 1, isMyTurn);
    uiManager.setMessage(isMyTurn ? 'Your turn!' : "Opponent's turn");
  });

  client.onGameOver((_winnerId: number, didIWin: boolean) => {
    uiManager.showGameOver(didIWin);
  });
}

// Wire up UI events
let clientName = '';
uiManager.onRegister(async (playerName: string, serverAddress: string) => {
  try {
    const { apiBaseUrl, wsBaseUrl } = resolveServerBaseUrls(serverAddress);
    gameClient = new GameClient(apiBaseUrl, wsBaseUrl, game);
    wireGameClientEvents(gameClient);

    clientName = playerName;
    uiManager.showRegistering();
    await gameClient.register(playerName);
    const playerId = gameClient.getPlayerId();
    if (playerId !== null) {
      uiManager.showGamePanel(playerId);
      
      const lastGameStartMessage = gameClient.getLastGameStartMessage()
      const opponentName = (lastGameStartMessage && typeof lastGameStartMessage.opponentName === 'string')
        ? lastGameStartMessage. opponentName: 'connecting...';
      uiManager.setPlayerNames(playerId, clientName, opponentName)
    }
  } catch (error) {
    console.error('Registration failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Registration failed. Please try again.';
    uiManager.showRegistrationError(errorMessage);
  }
});

uiManager.onFire(async (angle: number, velocity: number) => {
  try {
    if (!gameClient) {
      throw new Error('Not connected yet');
    }

    uiManager.disableFireButton();
    uiManager.setMessage('Firing...');
    await gameClient.fire(angle, velocity);
    // Server will send WebSocket messages (shot + turn_change) to update state
  } catch (error) {
    console.error('Fire failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Fire action failed';
    uiManager.setMessage(errorMessage);
    uiManager.updateTurnUI(game.getState().currentTurn, game.getState().isMyTurn);
  }
});

