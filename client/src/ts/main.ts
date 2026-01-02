// Main entry point for SuperArtillery
import '../css/style.css';
import { Game } from './game';
import { Renderer } from './renderer';
import { WebSocketClient } from './network/websocket';
import type { GameMessage } from './types/messages';

console.log('SuperArtillery initializing...');

// Game state
const game = new Game();
let renderer: Renderer | null = null;
let wsClient: WebSocketClient | null = null;

// WebSocket URL (will be updated for production)
const WS_URL = 'ws://localhost:3000';

// DOM elements
const statusEl = document.getElementById('status') as HTMLDivElement;
const messageEl = document.getElementById('message') as HTMLDivElement;
const angleInput = document.getElementById('angleInput') as HTMLInputElement;
const velocityInput = document.getElementById('velocityInput') as HTMLInputElement;
const fireButton = document.getElementById('fireButton') as HTMLButtonElement;
const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;

// Initialize renderer
if (canvas) {
  renderer = new Renderer(canvas);
  renderer.render(null);
  console.log('Renderer initialized');
} else {
  console.error('Canvas element not found');
}

// WebSocket message handler
function handleMessage(message: GameMessage): void {
  console.log('Received message:', message);

  switch (message.type) {
    case 'game_start':
      game.setPlayerId(message.playerId);
      game.setCurrentTurn(message.turn);
      updateUI();
      statusEl.textContent = `You are Player ${message.playerId + 1}`;
      messageEl.textContent = game.getState().isMyTurn ? 'Your turn!' : "Opponent's turn";
      fireButton.disabled = !game.getState().isMyTurn;
      break;

    case 'fire':
      // Handle fire event
      console.log(`Shot fired: angle=${message.angle}, velocity=${message.velocity}`);
      // Show that opponent fired (for the player who didn't fire)
      const fireState = game.getState();
      if (!fireState.isMyTurn) {
        // This was the opponent's shot
        messageEl.textContent = `Opponent fired: angle=${message.angle}°, velocity=${message.velocity}`;
      }
      // TODO: Animate projectile
      break;

    case 'turn_change':
      game.setCurrentTurn(message.turn);
      updateUI();
      const currentState = game.getState();
      messageEl.textContent = currentState.isMyTurn ? 'Your turn!' : "Opponent's turn";
      console.log(`Turn changed to Player ${message.turn}`);
      break;

    case 'game_over':
      const gameOverState = game.getState();
      const won = gameOverState.playerId === message.winner;
      messageEl.textContent = won ? '🎉 You won!' : '😔 You lost';
      fireButton.disabled = true;
      break;
  }
}

// Update UI based on game state
function updateUI(): void {
  const state = game.getState();
  fireButton.disabled = !state.isMyTurn;
  
  if (state.isMyTurn) {
    statusEl.textContent = 'Your Turn';
    angleInput.disabled = false;
    velocityInput.disabled = false;
  } else {
    statusEl.textContent = "Opponent's Turn";
    angleInput.disabled = true;
    velocityInput.disabled = true;
  }
}

// Fire button handler
fireButton.addEventListener('click', () => {
  const angle = parseInt(angleInput.value, 10);
  const velocity = parseInt(velocityInput.value, 10);

  if (isNaN(angle) || isNaN(velocity)) {
    messageEl.textContent = 'Invalid input';
    return;
  }

  if (angle < 0 || angle > 90) {
    messageEl.textContent = 'Angle must be between 0 and 90';
    return;
  }

  if (velocity < 0 || velocity > 300) {
    messageEl.textContent = 'Velocity must be between 0 and 300';
    return;
  }

  // Send fire message
  if (wsClient) {
    wsClient.send({
      type: 'fire',
      angle,
      velocity,
    });
    fireButton.disabled = true;
    messageEl.textContent = 'Shot fired! Waiting for opponent...';
  }
});

// Connect to WebSocket
async function connectWebSocket(): Promise<void> {
  try {
    statusEl.textContent = 'Connecting to server...';
    wsClient = new WebSocketClient(WS_URL);
    wsClient.onMessage(handleMessage);
    await wsClient.connect();
    statusEl.textContent = 'Connected! Waiting for opponent...';
  } catch (error) {
    console.error('Failed to connect:', error);
    statusEl.textContent = 'Connection failed. Server not running?';
    messageEl.textContent = 'Backend server is not yet implemented. Coming soon!';
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void connectWebSocket();
  });
} else {
  void connectWebSocket();
}

