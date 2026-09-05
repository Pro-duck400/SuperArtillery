// Main entry point for SuperArtillery
import '../css/style.css';
import { Game } from './game';
import { Renderer } from './renderer';
import { ProjectileAnimator } from './projectile-animator';
import { UIManager } from './ui-manager';
import { GameClient } from './game-client';
import { CONTRACT_VERSION } from './contract-version';
import clientPackage from '../../package.json';

console.log('SuperArtillery initializing...');

const clientVersion = document.getElementById('clientVersion');
if (clientVersion) {
  clientVersion.textContent = `Client v${clientPackage.version} | Contract v${CONTRACT_VERSION}`;
}

const BUILT_IN_DEFAULT = 'http://localhost:3000';

function getDefaultServerAddress(): string {
  const envUrl = import.meta.env.VITE_SERVER_URL;
  if (envUrl) return envUrl;

  // Runtime detection: local development uses the local server; hosted clients use Railway.
  const host = window.location.hostname || '';

  if (host === 'localhost' || host.startsWith('127.') || host === '') {
    return BUILT_IN_DEFAULT;
  }

  return 'https://superartillery-server-production.up.railway.app';
}

function resolveServerBaseUrls(serverAddress: string): { apiBaseUrl: string; wsBaseUrl: string } {
  const chosen = (serverAddress && serverAddress.trim()) || getDefaultServerAddress();
  const parsedUrl = new URL(chosen);
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
const uiManager = new UIManager(getDefaultServerAddress());
let gameClient: GameClient | null = null;
let clientName = '';
let opponentName = '';

function wireGameClientEvents(client: GameClient): void {
  client.onGameStart((_gameId: string, battlefield) => {
    renderer.applyBattlefield(battlefield);
    uiManager.setWindLabel(battlefield.wind);
    animator.configureScene(
      renderer.getCanvasWidth(),
      renderer.getGroundY(),
      renderer.getCastleTopY(),
      battlefield.gravity,
      battlefield.wind
    );

    const playerId = client.getPlayerId();
    // Get opponent name from GameStartMessage if available
    opponentName = '';
    const lastGameStartMessage = client.getLastGameStartMessage();
    if (lastGameStartMessage && typeof lastGameStartMessage.opponentName === 'string') {
      opponentName = lastGameStartMessage.opponentName;
    }

    // Switch from the registration/lobby panel (invite info) to the battlefield now that the opponent has joined.
    if (playerId !== null) {
      uiManager.showGamePanel();
      uiManager.setPlayerNames(playerId, clientName, opponentName, {
        left: renderer.getCastleLabelPosition(0),
        right: renderer.getCastleLabelPosition(1)
      });
    }

    uiManager.renderShotHistory(game.getShotHistory());
    uiManager.setMessage('Game starting! Waiting for first turn...');
  });

  client.onShot((data) => {
    const playerId = client.getPlayerId();
    const isMyShot = playerId !== null && data.playerId === playerId;
    if (isMyShot) {
      uiManager.renderShotHistory(game.getShotHistory());
    }
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
    renderer.setActiveTurn(playerId as 0 | 1);
    renderer.render(null);
    const turnPlayerName = isMyTurn ? clientName : opponentName;
    uiManager.setMessage(`${turnPlayerName} turn`);
  });

  client.onGameOver((_winnerId: number, didIWin: boolean) => {
    uiManager.showGameOver(didIWin, clientName, opponentName);
  });
}

// Wire up UI events
const lobbyState = {
  lastInviteUrl: '',
  lastInviteCode: ''
};

function parseInviteInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const match = trimmed.match(/[?&]invite=([^&]+)/i);
  return match ? decodeURIComponent(match[1]) : trimmed;
}

function getServerFromInviteUrl(): string | null {
  const server = new URLSearchParams(window.location.search).get('server');
  return server ? server : null;
}

// If the page was opened via an invite link, only the name + Join controls are relevant.
const inviteFromUrl = new URLSearchParams(window.location.search).get('invite');
if (inviteFromUrl) {
  const inviteServer = getServerFromInviteUrl();
  if (inviteServer) {
    uiManager.setServerAddress(inviteServer);
  }
  uiManager.enterJoinOnlyMode(inviteFromUrl);
}

uiManager.onCreateGame(async (playerName: string, serverAddress: string) => {
  try {
    const { apiBaseUrl, wsBaseUrl } = resolveServerBaseUrls(serverAddress);
    gameClient = new GameClient(apiBaseUrl, wsBaseUrl, game);
    wireGameClientEvents(gameClient);

    clientName = playerName;
    uiManager.showRegistering();
    const createResult = await gameClient.createGame(playerName);
    lobbyState.lastInviteUrl = createResult.inviteUrl;
    lobbyState.lastInviteCode = createResult.inviteCode;
    uiManager.showInviteInfo(createResult.inviteCode, createResult.inviteUrl);

    uiManager.setMessage(`Share this code: ${createResult.inviteCode}`);

    await gameClient.connectToGame();
  } catch (error) {
    console.error('Create game failed:', error);
    if (error instanceof Error && error.message === 'Game connection timeout') {
      uiManager.hideInviteInfo();
    }
    const errorMessage = error instanceof Error ? error.message : 'Game creation failed. Please try again.';
    uiManager.showRegistrationError(errorMessage);
  }
});

uiManager.onJoinGame(async (inviteCode: string, playerName: string, serverAddress: string) => {
  try {
    const { apiBaseUrl, wsBaseUrl } = resolveServerBaseUrls(serverAddress);
    gameClient = new GameClient(apiBaseUrl, wsBaseUrl, game);
    wireGameClientEvents(gameClient);

    clientName = playerName;
    uiManager.showRegistering();
    const inviteValue = parseInviteInput(inviteCode);
    const accepted = await gameClient.acceptInvitation(inviteValue, playerName);

    lobbyState.lastInviteCode = accepted.gameId;
    uiManager.setMessage('Connected to private game');

    await gameClient.connectToGame();
  } catch (error) {
    console.error('Join game failed:', error);
    if (error instanceof Error && error.message === 'Game connection timeout') {
      uiManager.hideInviteInfo();
    }
    const errorMessage = error instanceof Error ? error.message : 'Unable to join game. Please try again.';
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

