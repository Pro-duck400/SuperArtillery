// Main entry point for SuperArtillery
import '../css/style.css';
import { Game } from './game';
import { Renderer } from './renderer';
import { WebSocketClient } from './network/websocket';
import { ApiClient } from './network/api';
import type { GameMessage } from './types/messages';

console.log('SuperArtillery initializing...');

// Game state
const game = new Game();
let renderer: Renderer | null = null;
let wsClient: WebSocketClient | null = null;
let apiClient: ApiClient | null = null;

// Server URLs (will be updated for production)
const API_BASE_URL = 'http://localhost:3000';
const WS_BASE_URL = 'ws://localhost:3000';

// DOM elements
const registrationPanel = document.getElementById('registrationPanel') as HTMLDivElement;
const gamePanel = document.getElementById('gamePanel') as HTMLDivElement;
const playerNameInput = document.getElementById('playerNameInput') as HTMLInputElement;
const registerButton = document.getElementById('registerButton') as HTMLButtonElement;
const registrationError = document.getElementById('registrationError') as HTMLDivElement;
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

// Register and connect to server
async function registerAndConnect(): Promise<void> {
  // Get and validate player name from input
  const playerName = playerNameInput.value.trim();
  
  if (!playerName) {
    registrationError.textContent = 'Please enter your name';
    return;
  }

  if (playerName.length < 2) {
    registrationError.textContent = 'Name must be at least 2 characters';
    return;
  }

  try {
    // Clear any previous error
    registrationError.textContent = '';
    registerButton.disabled = true;
    registerButton.textContent = 'Registering...';

    // Initialize API client
    apiClient = new ApiClient(API_BASE_URL);

    // Step 1: Register via HTTP
    const { playerId } = await apiClient.register(playerName);
    game.setPlayerId(playerId);
    console.log(`Registered as Player ${playerId} (${playerName})`);

    // Hide registration panel, show game panel
    registrationPanel.style.display = 'none';
    gamePanel.style.display = 'block';

    statusEl.textContent = `Registered as Player ${playerId + 1}`;

    // Step 2: Connect WebSocket with playerId
    statusEl.textContent = 'Connecting to game server...';
    const wsUrl = `${WS_BASE_URL}?playerId=${playerId}`;
    wsClient = new WebSocketClient(wsUrl);
    wsClient.onMessage(handleMessage);
    await wsClient.connect();
    
    statusEl.textContent = `Connected! Waiting for opponent...`;
    messageEl.textContent = 'Waiting for another player to join...';
  } catch (error) {
    console.error('Registration failed:', error);
    registrationError.textContent = error instanceof Error ? error.message : 'Registration failed. Please try again.';
    registerButton.disabled = false;
    registerButton.textContent = 'Join Game';
  }
}

// Handle registration button click
registerButton.addEventListener('click', () => {
  void registerAndConnect();
});

// Handle Enter key in name input
playerNameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    registerButton.click();
  }
});

// WebSocket message handler
function handleMessage(message: GameMessage): void {

  switch (message.type) {
    case 'game_start':
      game.setGameId(message.gameId);
      statusEl.textContent = `Game #${message.gameId} - You are Player ${(game.getPlayerId() ?? 0) + 1}`;
      messageEl.textContent = 'Game starting! Waiting for first turn...';
      break;

    case 'shot':
      // Handle shot event - show which player fired
      const playerId = game.getPlayerId();
      if (playerId !== null && message.playerId !== playerId) {
        // This was the opponent's shot
        messageEl.textContent = `Opponent fired: angle=${message.angle}°, velocity=${message.velocity}`;
      } else {
        messageEl.textContent = `You fired: angle=${message.angle}°, velocity=${message.velocity}`;
      }
      // TODO: Animate projectile
      break;

    case 'turn_change':
      game.setCurrentTurn(message.playerId_turn);
      updateUI();
      const currentState = game.getState();
      messageEl.textContent = currentState.isMyTurn ? 'Your turn!' : "Opponent's turn";
      console.log(`Turn changed to Player ${message.playerId_turn}`);
      break;

    case 'game_over':
      const gameOverState = game.getState();
      const playerId2 = gameOverState.playerId;
      const won = playerId2 !== null && playerId2 === message.playerId_winner;
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
fireButton.addEventListener('click', async () => {
  const angle = parseInt(angleInput.value, 10);
  const velocity = parseInt(velocityInput.value, 10);

  if (isNaN(angle) || isNaN(velocity)) {
    messageEl.textContent = 'Invalid input';
    return;
  }

  if (angle < 0 || angle > 360) {
    messageEl.textContent = 'Angle must be between 0 and 360';
    return;
  }

  if (velocity <= 0) {
    messageEl.textContent = 'Velocity must be positive';
    return;
  }

  const gameId = game.getGameId();
  const playerId = game.getPlayerId();

  if (gameId === null || playerId === null) {
    messageEl.textContent = 'Game not started yet';
    return;
  }

  // Send fire action via HTTP API
  if (apiClient) {
    try {
      fireButton.disabled = true;
      messageEl.textContent = 'Firing...';
      await apiClient.fire(gameId, playerId, angle, velocity);
      // Server will send WebSocket messages (shot + turn_change) to update state
    } catch (error) {
      console.error('Fire failed:', error);
      messageEl.textContent = error instanceof Error ? error.message : 'Fire action failed';
      fireButton.disabled = false;
    }
  }
});

// Initialize when DOM is ready (just focus the input)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    playerNameInput.focus();
  });
} else {
  playerNameInput.focus();
}

