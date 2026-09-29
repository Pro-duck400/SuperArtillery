import type { GameMessage } from '../contract/messages';
import type { Clock } from '../ports/clock';
import type { TimerHandle, TimerScheduler } from '../ports/timer-scheduler';
import type { PlayerConnection } from '../ports/player-connection';
import { SystemClock } from '../ports/clock';
import { failure, success, type Result } from '../result';
import type {
  AcceptInvitationResponse,
  CreateGameResponse,
  CreateHotSeatResponse,
  GameStatusResponse,
  PrivateGame,
  RematchAnswer,
  SkipWaitingResponse
} from '../types/private-game';
import { GameCleanupService } from './gameCleanupService';
import { GAME_CONFIG } from './gameConfig';
import { GAME_ERROR_CODES, GAME_ERROR_MESSAGES } from './gameErrors';
import { GameMessageFactory } from './gameMessageFactory';
import { GameRules } from './gameRules';
import { InvitationService } from './invitationService';
import { InMemoryGameRepository, type GameRepository } from './gameRepository';
import { TokenService } from './tokenService';
import { getDefaultShotDirection } from '../utils/shotResolver';

export interface GameEngineOptions {
  games?: GameRepository;
  clock?: Clock;
  timerScheduler?: TimerScheduler;
  defaultClientOrigin?: string;
  defaultServerOrigin?: string;
}

export interface FireResponse {
  success: true;
}

export interface RematchResponse {
  answer: RematchAnswer;
  answered: number;
  playersReady: number;
  required: number;
  players: Array<{ playerId: number; name: string; answer?: RematchAnswer }>;
  roundStarted: boolean;
}

export interface EngineStats {
  games: number;
  invites: number;
  maxReached: boolean;
  totals: {
    internet: { games: number; rematches: number };
    device: { games: number; rematches: number };
  };
}

export class GameEngine {
  private readonly games: GameRepository;
  private readonly clock: Clock;
  private readonly invitationService: InvitationService;
  private readonly cleanupService: GameCleanupService;
  private readonly gameRules = new GameRules();
  private readonly messages = new GameMessageFactory();
  private readonly timerScheduler?: TimerScheduler;
  private readonly defaultClientOrigin: string;
  private readonly defaultServerOrigin: string;
  private cleanupInterval: TimerHandle | null = null;
  private internetGamesEverStarted = 0;
  private internetRematches = 0;
  private deviceGamesEverStarted = 0;
  private deviceRematches = 0;

  constructor(options: GameEngineOptions = {}) {
    this.games = options.games ?? new InMemoryGameRepository();
    this.clock = options.clock ?? new SystemClock();
    this.timerScheduler = options.timerScheduler;
    this.defaultClientOrigin = options.defaultClientOrigin ?? 'http://localhost:5173';
    this.defaultServerOrigin = options.defaultServerOrigin ?? 'http://localhost:3000';
    this.invitationService = new InvitationService(this.games, this.defaultClientOrigin);
    this.cleanupService = new GameCleanupService(this.games, this.clock);
    if (this.timerScheduler) {
      this.cleanupInterval = this.timerScheduler.setInterval(
        () => this.cleanupService.cleanup(),
        GAME_CONFIG.cleanupIntervalMs
      );
    }
  }

  public shutdown(): void {
    if (this.cleanupInterval !== null) {
      this.timerScheduler?.clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  public createGame(
    playerName: string,
    clientOrigin?: string,
    serverOrigin?: string,
    playerCount: number = 2
  ): Result<CreateGameResponse> {
    if (!TokenService.normalizeName(playerName)) return this.error('INVALID_PLAYER_NAME');
    if (this.games.size >= GAME_CONFIG.maxActiveGames) return this.error('MAX_GAMES_REACHED');
    const result = this.invitationService.createGame(
      playerName,
      clientOrigin ?? this.defaultClientOrigin,
      serverOrigin ?? this.defaultServerOrigin,
      this.clock.now(),
      playerCount
    );
    if ('error' in result) return failure(result.code, result.error);
    this.internetGamesEverStarted += 1;
    return success(result);
  }

  public acceptInvitation(inviteCode: string | undefined, playerName: string): Result<AcceptInvitationResponse> {
    const result = this.invitationService.acceptInvitation(inviteCode, playerName, this.clock.now());
    return 'error' in result ? failure(result.code, result.error) : success(result);
  }

  public createLocalGame(playerNames: string[]): Result<CreateHotSeatResponse> {
    if (!Array.isArray(playerNames) || playerNames.length < 2 || playerNames.length > 9) {
      return this.error('INVALID_PLAYER_COUNT');
    }
    const names = playerNames.map(name => TokenService.normalizeName(name));
    if (names.some(name => !name)) return this.error('INVALID_PLAYER_NAME');
    if (this.games.size >= GAME_CONFIG.maxActiveGames) return this.error('MAX_GAMES_REACHED');

    const tokens = names.map(() => TokenService.generateSessionToken());
    const now = this.clock.now();
    const game: PrivateGame = {
      id: TokenService.generateGameId(),
      status: 'pending',
      createdAt: now,
      expiresAt: now + GAME_CONFIG.invitationTtlMs,
      lastActivityAt: now,
      hotSeat: true,
      playerCount: names.length,
      lobbySlots: [],
      invitation: { inviteCode: '', inviteCodeHash: '', expiresAt: now, accepted: true },
      initiator: { name: names[0]!, sessionTokenHash: TokenService.hashToken(tokens[0]!), connection: null },
      invited: { name: names[1]!, sessionTokenHash: TokenService.hashToken(tokens[1]!), connection: null },
      currentTurn: 0,
      gameStarted: false,
      round: 1,
      rematchReady: names.map(() => false)
    };
    game.lobbySlots = names.map((name, playerId) => ({
      playerId,
      session: playerId === 0 ? game.initiator : playerId === 1 ? game.invited : {
        name: name!,
        sessionTokenHash: TokenService.hashToken(tokens[playerId]!),
        connection: null
      },
      status: 'waiting',
      active: true,
      eliminated: false
    }));
    this.games.set(game);
    this.deviceGamesEverStarted += 1;
    return success({
      gameId: game.id,
      players: names.map((name, playerId) => ({ playerId, name: name!, playerToken: tokens[playerId]! }))
    });
  }

  public getGameStatus(gameId: string, sessionToken: string): Result<GameStatusResponse> {
    const game = this.games.get(gameId);
    if (!game) return this.error('GAME_NOT_FOUND');
    const playerId = this.getLobbyPlayerId(game, sessionToken);
    if (playerId === null) return this.error('INVALID_SESSION_TOKEN');
    const playersConnected = this.getPlayersConnected(game);
    return success({
      status: game.status,
      playersConnected,
      required: this.getRequiredPlayers(game),
      ready: game.rematchReady[playerId] ?? false,
      readyCount: game.rematchReady.filter(Boolean).length,
      slots: this.getLobbySlotViews(game),
      canSkipWaiting: playerId === 0 && game.status === 'pending' && playersConnected >= 2
    });
  }

  public skipWaiting(gameId: string, sessionToken: string): Result<SkipWaitingResponse> {
    const game = this.games.get(gameId);
    if (!game) return this.error('GAME_NOT_FOUND');
    const playerId = this.getLobbyPlayerId(game, sessionToken);
    if (playerId === null) return this.error('INVALID_SESSION_TOKEN');
    if (playerId !== 0) return this.error('NOT_CREATOR');
    if (game.status !== 'pending' || game.waitingSkipped) return this.error('LOBBY_CLOSED');
    const connectedSlots = game.lobbySlots.filter(slot => slot.session.name && slot.session.connection?.isOpen());
    if (connectedSlots.length < 2) return this.error('NOT_ENOUGH_PLAYERS');
    game.waitingSkipped = true;
    game.lobbySlots.forEach(slot => {
      if (!connectedSlots.includes(slot)) slot.status = 'skipped';
    });
    this.tryStartGame(game);
    return success({
      started: game.gameStarted,
      playersConnected: connectedSlots.length,
      required: this.getRequiredPlayers(game),
      slots: game.lobbySlots.map(slot => ({
        playerId: slot.playerId,
        ...(slot.session.name ? { name: slot.session.name } : {}),
        status: slot.status
      }))
    });
  }

  public connect(gameId: string, sessionToken: string, connection: PlayerConnection): Result<{ playerId: number }> {
    const game = this.games.get(gameId);
    if (!game) return this.error('GAME_NOT_FOUND');
    const playerId = this.getLobbyPlayerId(game, sessionToken);
    if (playerId === null) return this.error('INVALID_SESSION_TOKEN');
    const slot = game.lobbySlots.find(candidate => candidate.playerId === playerId);
    if (!slot) return this.error('INVALID_SESSION_TOKEN');
    slot.session.connection = connection;
    slot.status = 'ready';
    if (playerId === 0) game.initiator.connection = connection;
    if (playerId === 1) game.invited.connection = connection;
    if (game.hotSeat && playerId === 0) {
      game.lobbySlots.forEach(candidate => {
        candidate.status = 'ready';
        candidate.session.connection = connection;
      });
    }
    if (!game.gameStarted) {
      this.tryStartGame(game);
      if (!game.gameStarted) this.broadcastLobbyStatus(game);
    }
    return success({ playerId });
  }

  public disconnect(gameId: string, playerId: number, connection: PlayerConnection): void {
    const game = this.games.get(gameId);
    if (!game) return;
    const slot = game.lobbySlots.find(candidate => candidate.playerId === playerId);
    if (!slot || slot.session.connection !== connection) return;
    if (game.hotSeat) {
      game.lobbySlots.forEach(candidate => {
        candidate.session.connection = null;
        candidate.active = false;
        candidate.eliminated = true;
      });
      if (game.status !== 'finished') {
        game.status = 'finished';
        game.gameFinishedAt = this.clock.now();
      }
      return;
    }
    slot.session.connection = null;
    if (game.status === 'pending') slot.status = 'waiting';
    this.gameRules.disconnect(game, playerId, this.clock.now());
    if (game.status === 'pending' || game.status === 'expired') this.broadcastLobbyStatus(game);
  }

  public fire(
    gameId: string,
    sessionToken: string,
    angle: number,
    velocity: number,
    direction?: 'Left' | 'Right'
  ): Result<FireResponse> {
    const game = this.games.get(gameId);
    if (!game) return this.error('GAME_NOT_FOUND');
    const playerId = this.getLobbyPlayerId(game, sessionToken);
    if (playerId === null) return this.error('INVALID_SESSION_TOKEN');
    if (!game.gameStarted || game.status !== 'active') return this.error('GAME_NOT_ACTIVE');
    if (playerId !== game.currentTurn) return this.error('NOT_YOUR_TURN');
    if (!Number.isInteger(angle) || angle < 0 || angle > 99) return this.error('INVALID_ANGLE');
    if (!Number.isInteger(velocity) || velocity < 30 || velocity > 999) return this.error('INVALID_VELOCITY');

    const shotDirection = direction ?? getDefaultShotDirection(game.battlefield!, playerId);
    const transition = this.gameRules.fire(game, playerId, angle, velocity, shotDirection, this.clock.now());
    this.broadcast(game, this.messages.shot(playerId, angle, velocity, shotDirection));
    if (transition.kind === 'hit' && transition.winnerPlayerId !== undefined) {
      this.broadcast(game, this.messages.gameOver(game, transition.winnerPlayerId));
    } else {
      this.broadcast(game, this.messages.turnChange(game));
    }
    return success({ success: true });
  }

  public requestRematch(
    gameId: string,
    sessionToken: string,
    answer: RematchAnswer = 'play_again'
  ): Result<RematchResponse> {
    const game = this.games.get(gameId);
    if (!game) return this.error('GAME_NOT_FOUND');
    const playerId = this.getLobbyPlayerId(game, sessionToken);
    if (playerId === null) return this.error('INVALID_SESSION_TOKEN');
    if (game.status !== 'finished') return this.error('REMATCH_NOT_AVAILABLE');
    if (answer !== 'play_again' && answer !== 'had_enough' && answer !== 'not_sure') {
      return failure('INVALID_REMATCH_ANSWER', 'Answer must be play_again, had_enough, or not_sure');
    }
    const transition = this.gameRules.requestRematch(game, playerId, answer, this.clock.now());
    if (transition.kind === 'started') {
      if (game.hotSeat) this.deviceRematches += 1;
      else this.internetRematches += 1;
    }
    const answers = transition.answers;
    const statusMessage = this.messages.rematchStatus(game, answers);
    this.broadcast(game, statusMessage);
    if (transition.kind === 'started') {
      this.broadcast(game, this.messages.gameStart(game));
      this.broadcast(game, this.messages.turnChange(game));
    }
    return success({
      answer,
      answered: transition.answered,
      playersReady: transition.playersReady,
      required: game.lobbySlots.length,
      players: statusMessage.players,
      roundStarted: transition.kind === 'started'
    });
  }

  public getStats(): EngineStats {
    let invites = 0;
    for (const game of this.games.values()) {
      if (game.status === 'pending' && !game.waitingSkipped && (!game.invitation.accepted || game.playerCount > 2)) invites += 1;
    }
    return {
      games: this.games.size,
      invites,
      maxReached: this.games.size >= GAME_CONFIG.maxActiveGames,
      totals: {
        internet: { games: this.internetGamesEverStarted, rematches: this.internetRematches },
        device: { games: this.deviceGamesEverStarted, rematches: this.deviceRematches }
      }
    };
  }

  public getPlayerName(gameId: string, playerId: number): string | null {
    return this.games.get(gameId)?.lobbySlots.find(slot => slot.playerId === playerId)?.session.name ?? null;
  }

  public getPlayerIdFromToken(gameId: string, sessionToken: string): number | null {
    const game = this.games.get(gameId);
    return game ? this.getLobbyPlayerId(game, sessionToken) : null;
  }

  public getPlayerNameFromToken(sessionToken: string, gameId?: string): string | null {
    const games = gameId ? [this.games.get(gameId)].filter((game): game is PrivateGame => !!game) : this.games.values();
    for (const game of games) {
      const slot = game.lobbySlots.find(candidate => TokenService.verifyToken(sessionToken, candidate.session.sessionTokenHash));
      if (slot?.session.name) return slot.session.name;
    }
    return null;
  }

  private getLobbyPlayerId(game: PrivateGame, sessionToken: string): number | null {
    const slot = game.lobbySlots.find(candidate => TokenService.verifyToken(sessionToken, candidate.session.sessionTokenHash));
    return slot?.playerId ?? null;
  }

  private getPlayersConnected(game: PrivateGame): number {
    return game.hotSeat
      ? (game.initiator.connection?.isOpen() ? game.playerCount : 0)
      : game.lobbySlots.filter(slot => slot.session.connection?.isOpen()).length;
  }

  private getRequiredPlayers(game: PrivateGame): number {
    return game.waitingSkipped
      ? game.lobbySlots.filter(slot => slot.status !== 'skipped').length
      : game.playerCount;
  }

  private getLobbySlotViews(game: PrivateGame): GameStatusResponse['slots'] {
    return game.lobbySlots.map(slot => ({
      playerId: slot.playerId,
      ...(slot.session.name ? { name: slot.session.name } : {}),
      status: slot.status === 'skipped'
        ? 'skipped'
        : slot.session.connection?.isOpen() && slot.session.name ? 'ready' : 'waiting'
    }));
  }

  private tryStartGame(game: PrivateGame): void {
    const start = this.gameRules.startIfReady(game, this.clock.now());
    if (!start) return;
    game.lobbySlots = game.lobbySlots.filter(slot => slot.status === 'ready');
    this.broadcast(game, this.messages.gameStart(game));
    this.broadcast(game, this.messages.turnChange(game));
  }

  private broadcastLobbyStatus(game: PrivateGame): void {
    this.broadcast(game, this.messages.lobbyStatus(game, this.getPlayersConnected(game), this.getRequiredPlayers(game)));
  }

  private broadcast(game: PrivateGame, message: GameMessage): void {
    this.messages.sendToConnectedPlayers(game, message);
  }

  private error<T = never>(code: keyof typeof GAME_ERROR_CODES): Result<T> {
    return failure(GAME_ERROR_CODES[code], GAME_ERROR_MESSAGES[code]);
  }
}