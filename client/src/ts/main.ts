// Main entry point for SuperArtillery
import '../css/style.css';
import { Game } from './game';
import { Renderer } from './renderer';
import { ProjectileAnimator } from './projectile-animator';
import { UIManager } from './ui-manager';
import { GameClient } from './game-client';
import { CONTRACT_VERSION } from './contract-version';
import clientPackage from '../../package.json';
import type { HistoricalTrajectory, TrajectoryPoint } from './trajectory';
import { createHistoricalTrajectories } from './trajectory';

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
renderer.render({ projectile: null, activeTrajectory: [], historicalTrajectories: [] });
console.log('Renderer initialized');

// Create core components
const game = new Game();
const animator = new ProjectileAnimator(renderer, canvas.width);
const uiManager = new UIManager(getDefaultServerAddress());
let gameClient: GameClient | null = null;
let clientName = '';
let opponentName = '';
let hotSeatNames: [string, string] | null = null;
let historicalTrajectories: HistoricalTrajectory[] = [];
let activeTrajectory: TrajectoryPoint[] = [];
let activeShotIsLocal = false;
let animationActive = false;
let pendingVisualTurn: { playerId: 0 | 1; isMyTurn: boolean } | null = null;
let pendingGameOver: { didIWin: boolean } | null = null;
let pendingDefeatedPlayerId: 0 | 1 | null = null;
let rematchRequested = false;

function applyPendingPresentation(): void {
  if (animationActive) return;

  if (pendingGameOver) {
    const result = pendingGameOver;
    pendingGameOver = null;
    pendingVisualTurn = null;
    if (pendingDefeatedPlayerId !== null) {
      renderer.setDefeatedPlayer(pendingDefeatedPlayerId);
      pendingDefeatedPlayerId = null;
      renderer.render({ projectile: null, activeTrajectory, historicalTrajectories });
    }
    uiManager.showGameOver(result.didIWin, clientName, opponentName);
    return;
  }

  if (pendingVisualTurn) {
    const turn = pendingVisualTurn;
    pendingVisualTurn = null;
    renderer.setActiveTurn(turn.playerId);
    renderer.render({ projectile: null, activeTrajectory, historicalTrajectories });
    const localNames = game.isHotSeat() ? hotSeatNames : null;
    const turnPlayerName = localNames
      ? localNames[turn.playerId]
      : (turn.isMyTurn ? clientName : opponentName);
    uiManager.setMessage(`${turnPlayerName} turn`);
  }
}

animator.onFrame(({ projectile, trajectory }) => {
  activeTrajectory = trajectory;
  renderer.render({ projectile, activeTrajectory, historicalTrajectories });
});

animator.onComplete(() => {
  const localPlayerId = gameClient?.getPlayerId();
  const battlefield = game.getBattlefield();
  if (activeShotIsLocal && localPlayerId !== null && localPlayerId !== undefined && battlefield) {
    historicalTrajectories = createHistoricalTrajectories(
      battlefield,
      game.getShotHistory(),
      localPlayerId as 0 | 1
    );
  }
  activeShotIsLocal = false;
  activeTrajectory = [];
  animationActive = false;
  renderer.render({ projectile: null, activeTrajectory, historicalTrajectories });
  applyPendingPresentation();
});

function wireGameClientEvents(client: GameClient): void {
  client.onGameStart((_gameId: string, battlefield) => {
    rematchRequested = false;
    renderer.setDefeatedPlayer(null);
    uiManager.prepareForNewRound();
    renderer.applyBattlefield(battlefield);
    historicalTrajectories = [];
    activeTrajectory = [];
    activeShotIsLocal = false;
    animationActive = false;
    pendingVisualTurn = null;
    pendingGameOver = null;
    pendingDefeatedPlayerId = null;
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
    const localNames = client.getLocalPlayerNames();
    if (localNames) {
      clientName = localNames[0];
      opponentName = localNames[1];
    }
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
    renderer.render({ projectile: null, activeTrajectory, historicalTrajectories });
    uiManager.setMessage('Game starting! Waiting for first turn...');
  });

  client.onShot((data) => {
    animationActive = true;
    const playerId = client.getPlayerId();
    const isMyShot = client.isHotSeat() || (playerId !== null && data.playerId === playerId);
    if (isMyShot) {
      activeShotIsLocal = true;
      uiManager.renderShotHistory(
        client.isHotSeat() ? game.getShotHistoryForPlayer(data.playerId as 0 | 1) : game.getShotHistory()
      );
      const battlefield = game.getBattlefield();
      if (battlefield) {
        historicalTrajectories = createHistoricalTrajectories(
          battlefield,
          client.isHotSeat()
            ? game.getShotHistoryForPlayer(data.playerId as 0 | 1).slice(1)
            : game.getShotHistory().slice(1),
          data.playerId as 0 | 1
        );
      }
    } else {
      activeShotIsLocal = false;
    }

    const shooterId = data.playerId === 0 ? 0 : 1;
    const startX = renderer.getCastleMuzzleX(shooterId);
    animator.fire(data.angle, data.velocity, startX, shooterId);
  });

  client.onTurnChange((playerId: number, isMyTurn: boolean) => {
    const activePlayerId = playerId as 0 | 1;
    const inputHistory = game.isHotSeat()
      ? game.getShotHistoryForPlayer(activePlayerId)
      : game.getShotHistory();
    uiManager.renderShotHistory(inputHistory);
    uiManager.setShotInputs(inputHistory[0]);
    uiManager.updateTurnUI(activePlayerId, isMyTurn);
    pendingVisualTurn = { playerId: playerId as 0 | 1, isMyTurn };
    const localPlayerId = client.getPlayerId();
    const battlefield = game.getBattlefield();
    if (isMyTurn && localPlayerId !== null && battlefield && !activeShotIsLocal) {
        historicalTrajectories = createHistoricalTrajectories(
        battlefield,
          game.isHotSeat() ? game.getShotHistoryForPlayer(activePlayerId) : game.getShotHistory(),
        activePlayerId
      );
    }
    applyPendingPresentation();
  });

  client.onGameOver((winnerId: number, didIWin: boolean) => {
    uiManager.disableFireButton();
    const defeatedPlayerId = winnerId === 0 ? 1 : 0;
    pendingDefeatedPlayerId = defeatedPlayerId;
    if (client.isHotSeat()) {
      const localNames = client.getLocalPlayerNames();
      if (localNames) {
        pendingGameOver = { didIWin: true };
        clientName = localNames[winnerId as 0 | 1];
        opponentName = localNames[(winnerId === 0 ? 1 : 0) as 0 | 1];
        applyPendingPresentation();
        return;
      }
    }
    pendingGameOver = { didIWin };
    applyPendingPresentation();
  });

  client.onRematchStatus((playersReady) => {
    if (rematchRequested) {
      uiManager.setRematchWaiting(playersReady);
      uiManager.setMessage(`Waiting for opponent (${playersReady}/2)`);
    } else {
      uiManager.showRematchAvailable();
      uiManager.setMessage('Opponent wants to play again');
    }
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
    hotSeatNames = null;
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
    hotSeatNames = null;
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

uiManager.onHotSeat(async (firstName: string, secondName: string, serverAddress: string) => {
  try {
    const { apiBaseUrl, wsBaseUrl } = resolveServerBaseUrls(serverAddress);
    gameClient = new GameClient(apiBaseUrl, wsBaseUrl, game);
    wireGameClientEvents(gameClient);
    clientName = firstName;
    opponentName = secondName;
    hotSeatNames = [firstName, secondName];
    uiManager.showRegistering();
    await gameClient.createHotSeatGame(firstName, secondName);
    await gameClient.connectToGame();
  } catch (error) {
    console.error('Hot-seat game creation failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Hot-seat game creation failed. Please try again.';
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

uiManager.onRematch(async () => {
  try {
    if (!gameClient) {
      throw new Error('Not connected yet');
    }

    rematchRequested = true;
    uiManager.setRematchWaiting(1);
    await gameClient.requestRematch();
  } catch (error) {
    rematchRequested = false;
    uiManager.showRematchAvailable();
    const errorMessage = error instanceof Error ? error.message : 'Rematch request failed';
    uiManager.setMessage(errorMessage);
  }
});

