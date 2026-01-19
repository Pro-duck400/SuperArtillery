// Main entry point for SuperArtillery
import '../css/style.css';
import { Game } from './game';
import { Renderer } from './renderer';
import { ProjectileAnimator } from './projectile-animator';
import { UIManager } from './ui-manager';
import { GameClient } from './game-client';

console.log('SuperArtillery initializing...');

// Server URLs (will be updated for production)
const API_BASE_URL = 'http://localhost:3000';
const WS_BASE_URL = 'ws://localhost:3000';

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
const uiManager = new UIManager();
const gameClient = new GameClient(API_BASE_URL, WS_BASE_URL, game);

// provide global access from game and gameClient to UIManager
// @ts-ignore
window.game = game;
// @ts-ignore
window.gameClient = gameClient;


// Wire up UI events
let clientName = '';
uiManager.onRegister(async (playerName: string) => {
  try {
    clientName = playerName;
    uiManager.showRegistering();
    await gameClient.register(playerName);
    const playerId = gameClient.getPlayerId();
    if (playerId !== null) {
      uiManager.showGamePanel(playerId);
      // Set left/right name immediately
      const leftNameEl = document.getElementById('playerNameLeft');
      const rightNameEl = document.getElementById('playerNameRight');

      if (leftNameEl) {
        const player0 = playerId === 0;
        leftNameEl.textContent = player0 ? clientName : 'connecting...';
        if (player0) leftNameEl.style.color = '#ffffff';
      }

      if (rightNameEl) {
        const player1 = playerId === 1;
        rightNameEl.textContent = player1 ? clientName : 'connecting...';
        if (player1) rightNameEl.style.color = '#ffffff';
      }
    }
    
  } catch (error) {
    console.error('Registration failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Registration failed. Please try again.';
    uiManager.showRegistrationError(errorMessage);
  }
});

uiManager.onFire(async (angle: number, velocity: number) => {
  try {
    uiManager.disableFireButton();
    uiManager.setMessage('Firing...');
    await gameClient.fire(angle, velocity);
    // Server will send WebSocket messages (shot + turn_change) to update state
  } catch (error) {
    console.error('Fire failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Fire action failed';
    uiManager.setMessage(errorMessage);
  }
});

// Wire up game client events
gameClient.onConnected(() => {
  uiManager.setStatus('Connected! Waiting for opponent...');
  uiManager.setMessage('Waiting for another player to join...');
});

gameClient.onGameStart((gameId: number) => {
  const playerId = gameClient.getPlayerId();
  // Get opponent name from GameStartMessage if available
  let opponentName = '';
  const lastGameStartMessage = gameClient.getLastGameStartMessage();
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

gameClient.onShot((data) => {
  const playerId = gameClient.getPlayerId();
  const isMyShot = playerId !== null && data.playerId === playerId;
  uiManager.setMessage(
    isMyShot 
      ? `You fired: angle=${data.angle}°, velocity=${data.velocity}`
      : `Opponent fired: angle=${data.angle}°, velocity=${data.velocity}`
  );
  
  // Fire from correct position based on which player fired (0 = left, 1 = right)
  const startX = data.playerId === 0 ? 20 : 260;
  animator.fire(data.angle, data.velocity, startX, data.playerId);
});

gameClient.onTurnChange((playerId: number, isMyTurn: boolean) => {
  uiManager.updateTurnUI(isMyTurn);
  uiManager.setMessage(isMyTurn ? 'Your turn!' : "Opponent's turn");
});

gameClient.onGameOver((winnerId: number, didIWin: boolean) => {
  uiManager.showGameOver(didIWin);
});

