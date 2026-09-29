// Main entry point for SuperArtillery
import '../css/style.css';
import { Game } from './game';
import { Renderer } from './renderer';
import { ProjectileAnimator } from './projectile-animator';
import { UIManager } from './ui-manager';
import { GameClient } from './game-client';
import { LocalGameGateway } from './network/local-game-gateway';
import { RemoteGameGateway } from './network/remote-game-gateway';
import { getDirectionPolicy } from './direction-policy';
import { parseInviteInput, parseInviteLink } from './invite-link';
import { createRosterPositions, createRosterView } from './roster-view';
import { getDefaultServerAddress, resolveServerBaseUrls } from './server-address';
import { PendingPresentationQueue } from './pending-presentation-queue';
import { CONTRACT_VERSION, CORE_VERSION } from '@superartillery/core';
import clientPackage from '../../package.json';
import type { HistoricalTrajectory, TrajectoryPoint } from './trajectory';
import { createHistoricalTrajectories } from './trajectory';

console.log('SuperArtillery initializing...');

const clientVersion = document.getElementById('clientVersion');
if (clientVersion) {
  clientVersion.textContent = `Client v${clientPackage.version} | Core v${CORE_VERSION} | Contract v${CONTRACT_VERSION}`;
}

const defaultServerAddress = getDefaultServerAddress(import.meta.env.VITE_SERVER_URL, window.location.hostname);

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
const uiManager = new UIManager(defaultServerAddress);
let gameClient: GameClient | null = null;
let clientName = '';
let opponentName = '';
let hotSeatNames: string[] | null = null;
let historicalTrajectories: HistoricalTrajectory[] = [];
let activeTrajectory: TrajectoryPoint[] = [];
let activeShotIsLocal = false;
let animationActive = false;
const pendingPresentations = new PendingPresentationQueue();

function refreshRosterPositions(): void {
  if (!game.getBattlefield()) return;
  const players = game.getPlayers();
  uiManager.setRosterNames(
    createRosterView(players),
    createRosterPositions(players, playerId => renderer.getCastleLabelPosition(playerId))
  );
}

function applyDirectionPolicy(playerId: number | null): void {
  const policy = getDirectionPolicy(game.getBattlefield(), playerId);
  uiManager.setDirectionVisible(policy.visible);
  if (policy.defaultDirection) uiManager.setDirectionDefault(policy.defaultDirection);
}

// Browser zoom/viewport changes can change the canvas's displayed CSS size
// without re-triggering game events, so name labels must be recomputed.
window.addEventListener('resize', refreshRosterPositions);
if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(refreshRosterPositions).observe(canvas);
}

function schedulePendingRip(): void {
  if (!pendingPresentations.hasPendingRip()) return;
  const ripPlayerIds = pendingPresentations.takeRipPlayerIds();
  window.setTimeout(() => {
    renderer.setRIPPlayers(ripPlayerIds);
    renderer.render({ projectile: null, activeTrajectory, historicalTrajectories });
    const players = game.getPlayers();
    uiManager.setRosterNames(
      createRosterView(players),
      createRosterPositions(players, playerId => renderer.getCastleLabelPosition(playerId))
    );
  }, 1000);
}

function applyPendingPresentation(): void {
  if (animationActive) return;

  if (pendingPresentations.takeGameOver()) {
    pendingPresentations.clearTurn();
    const defeatedPlayerIds = pendingPresentations.takeDefeatedPlayerIds();
    if (defeatedPlayerIds.length > 0) {
      renderer.setDefeatedPlayers(defeatedPlayerIds);
      renderer.render({ projectile: null, activeTrajectory, historicalTrajectories });
    }
    schedulePendingRip();
    const winnerName = game.getPlayers().find(player => player.active)?.name ?? 'Unknown player';
    uiManager.showGameOver(winnerName);
    return;
  }

  const defeatedPlayerIds = pendingPresentations.takeDefeatedPlayerIds();
  if (defeatedPlayerIds.length > 0) {
    renderer.setDefeatedPlayers(defeatedPlayerIds);
    renderer.render({ projectile: null, activeTrajectory, historicalTrajectories });
  }

  if (pendingPresentations.pendingHitName && !pendingPresentations.hasPendingTurn()) {
    uiManager.setMessage(`${pendingPresentations.pendingHitName} hit`);
    pendingPresentations.clearHitName();
  }

  if (pendingPresentations.hasPendingRip()) {
    schedulePendingRip();
  }

  const turn = pendingPresentations.takeTurn();
  if (turn) {
    renderer.setActiveTurn(turn.playerId);
    renderer.render({ projectile: null, activeTrajectory, historicalTrajectories });
    const localNames = game.isHotSeat() ? hotSeatNames : null;
    const rosterPlayerName = game.getPlayers().find(player => player.playerId === turn.playerId)?.name;
    const turnPlayerName = localNames
      ? localNames[turn.playerId]
      : (rosterPlayerName ?? (turn.isMyTurn ? clientName : opponentName));
    const hitName = pendingPresentations.pendingHitName;
    uiManager.setMessage(hitName
      ? `${hitName} hit. ${turnPlayerName} turn`
      : `${turnPlayerName} turn`);
    pendingPresentations.clearHitName();
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
  client.onLobbyStatus((status) => {
    if (status.status === 'pending') {
      uiManager.showLobbyStatus(status.slots, status.canSkipWaiting);
      uiManager.setMessage(`${status.playersConnected}/${status.required} players connected`);
    }
  });

  client.onGameStart((_gameId: string, battlefield) => {
    uiManager.hideLobbyStatus();
    renderer.setDefeatedPlayer(null);
    uiManager.prepareForNewRound();
    renderer.applyBattlefield(battlefield);
    uiManager.setRosterNames(
      game.getPlayers().map(player => ({ playerId: player.playerId, name: player.name, active: player.active })),
      new Map(game.getPlayers().map(player => [player.playerId, renderer.getCastleLabelPosition(player.playerId)]))
    );
    historicalTrajectories = [];
    activeTrajectory = [];
    activeShotIsLocal = false;
    animationActive = false;
    pendingPresentations.reset();
    uiManager.setWindLabel(battlefield.wind);
    animator.configureScene(
      renderer.getCanvasWidth(),
      renderer.getGroundY(),
      renderer.getCastleTopY(),
      battlefield.gravity,
      battlefield.wind
    );

    const playerId = client.getPlayerId();
    const targetPlayerId = client.isHotSeat() ? 0 : playerId;
    applyDirectionPolicy(targetPlayerId);
    // Get opponent name from GameStartMessage if available
    opponentName = '';
    const localNames = client.getLocalPlayerNames();
    if (localNames) {
      clientName = localNames[0];
      opponentName = localNames[1];
    }
    const lastGameStartMessage = client.getLastGameStartMessage();
    if (lastGameStartMessage) {
      const opponent = lastGameStartMessage.players.find(player => player.playerId !== playerId);
      opponentName = opponent?.name ?? opponentName;
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
        client.isHotSeat() ? game.getShotHistoryForPlayer(data.playerId) : game.getShotHistory()
      );
      const battlefield = game.getBattlefield();
      if (battlefield) {
        historicalTrajectories = createHistoricalTrajectories(
          battlefield,
          client.isHotSeat()
            ? game.getShotHistoryForPlayer(data.playerId).slice(1)
            : game.getShotHistory().slice(1),
          data.playerId
        );
      }
    } else {
      activeShotIsLocal = false;
    }

    const shooterId = data.playerId;
    const startX = renderer.getCastleMuzzleX(shooterId);
    animator.fire(data.angle, data.velocity, startX, shooterId, data.direction);
  });

  client.onTurnChange((playerId: number, isMyTurn: boolean) => {
    const activePlayerId = playerId;
    const battlefield = game.getBattlefield();
    const localPlayerId = client.getPlayerId();
    const targetPlayerId = client.isHotSeat() ? activePlayerId : localPlayerId;

    applyDirectionPolicy(targetPlayerId);

    const inputHistory = game.isHotSeat()
      ? game.getShotHistoryForPlayer(activePlayerId)
      : game.getShotHistory();
    uiManager.renderShotHistory(inputHistory);
    uiManager.setShotInputs(inputHistory[0]);
    const players = game.getPlayers();
    uiManager.setRosterNames(
      createRosterView(players, players.filter(player => pendingPresentations.isDefeated(player.playerId)).map(player => player.playerId)),
      createRosterPositions(players, playerId => renderer.getCastleLabelPosition(playerId))
    );
    uiManager.updateTurnUI(activePlayerId, isMyTurn);
    pendingPresentations.queueTurn({ playerId, isMyTurn });
    if (isMyTurn && localPlayerId !== null && battlefield && !activeShotIsLocal) {
        historicalTrajectories = createHistoricalTrajectories(
        battlefield,
          game.isHotSeat() ? game.getShotHistoryForPlayer(activePlayerId) : game.getShotHistory(),
        activePlayerId
      );
    }
    applyPendingPresentation();
  });

  client.onPlayerHit((playerId, playerName) => pendingPresentations.queuePlayerHit(playerId, playerName));

  client.onGameOver((_winnerId: number, _didIWin: boolean) => {
    uiManager.disableFireButton();
    const defeatedPlayerIds = game.getPlayers()
      .filter(player => !player.active)
      .map(player => player.playerId);
    pendingPresentations.queueGameOver(defeatedPlayerIds);
    applyPendingPresentation();
  });

  client.onRematchStatus((answered, requiredPlayers, players) => {
    uiManager.renderRematchStatus(players);
    uiManager.setRematchWaiting(answered);
    uiManager.setMessage(`Rematch responses (${answered}/${requiredPlayers})`);
  });
}

// Wire up UI events
const lobbyState = {
  lastInviteUrl: '',
  lastInviteCode: ''
};

// If the page was opened via an invite link, only the name + Join controls are relevant.
const inviteLink = parseInviteLink(window.location.search);
const inviteFromUrl = inviteLink.inviteCode;
if (inviteFromUrl) {
  if (inviteLink.serverAddress) {
    uiManager.setServerAddress(inviteLink.serverAddress);
  }
  uiManager.enterJoinOnlyMode(inviteFromUrl);
}

uiManager.onCreateGame(async (playerName: string, serverAddress: string) => {
  try {
    const { apiBaseUrl, wsBaseUrl } = resolveServerBaseUrls(serverAddress, defaultServerAddress);
    gameClient = new GameClient(new RemoteGameGateway(apiBaseUrl, wsBaseUrl), game);
    wireGameClientEvents(gameClient);

    clientName = playerName;
    hotSeatNames = null;
    uiManager.showRegistering();
    const playerCount = uiManager.getPlayerCount();
    if (playerCount === null) return;
    const createResult = await gameClient.createGame(playerName, playerCount);
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

uiManager.onSkipWaiting(async () => {
  try {
    if (!gameClient) throw new Error('Not connected yet');
    await gameClient.skipWaiting();
  } catch (error) {
    uiManager.setMessage(error instanceof Error ? error.message : 'Unable to skip waiting players');
  }
});

uiManager.onJoinGame(async (inviteCode: string, playerName: string, serverAddress: string) => {
  try {
    const { apiBaseUrl, wsBaseUrl } = resolveServerBaseUrls(serverAddress, defaultServerAddress);
    gameClient = new GameClient(new RemoteGameGateway(apiBaseUrl, wsBaseUrl), game);
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

uiManager.onHotSeat(async (names: string[]) => {
  try {
    gameClient = new GameClient(new LocalGameGateway(), game);
    wireGameClientEvents(gameClient);
    clientName = names[0];
    opponentName = names[1] ?? '';
    hotSeatNames = names;
    uiManager.showRegistering();
    await gameClient.createHotSeatGame(names);
    await gameClient.connectToGame();
  } catch (error) {
    console.error('Hot-seat game creation failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Hot-seat game creation failed. Please try again.';
    uiManager.showRegistrationError(errorMessage);
  }
});

uiManager.onFire(async (angle: number, velocity: number, direction?: 'Left' | 'Right') => {
  try {
    if (!gameClient) {
      throw new Error('Not connected yet');
    }

    uiManager.disableFireButton();
    uiManager.setMessage('Firing...');
    await gameClient.fire(angle, velocity, direction);
    // Server will send WebSocket messages (shot + turn_change) to update state
  } catch (error) {
    console.error('Fire failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Fire action failed';
    uiManager.setMessage(errorMessage);
    uiManager.updateTurnUI(game.getState().currentTurn, game.getState().isMyTurn);
  }
});

uiManager.onRematchAnswer(async (answer) => {
  try {
    if (!gameClient) throw new Error('Not connected yet');
    uiManager.setRematchAnswerSubmitted();
    await gameClient.requestRematch(answer);
  } catch (error) {
    uiManager.showRematchAvailable();
    uiManager.setMessage(error instanceof Error ? error.message : 'Rematch response failed');
  }
});

