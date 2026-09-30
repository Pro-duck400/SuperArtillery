import type { Game } from './game';
import type { GameMessage, GameStartMessage } from './types/messages';
import type { GameClientEventMap, TypedEventEmitter } from './game-client-events';

export class GameMessageDispatcher {
  private lastGameStartMessage: GameStartMessage | null = null;
  private readonly game: Game;
  private readonly events: TypedEventEmitter<GameClientEventMap>;

  constructor(
    game: Game,
    events: TypedEventEmitter<GameClientEventMap>
  ) {
    this.game = game;
    this.events = events;
  }

  public dispatch(message: GameMessage): void {
    switch (message.type) {
      case 'game_start': {
        this.game.resetShotHistory();
        this.game.setPlayers(message.players);
        const localPlayerId = this.game.getPlayerId();
        const opponent = message.players.find(player => player.playerId !== localPlayerId);
        this.game.setOpponentName(opponent?.name ?? 'Opponent');
        this.game.setGameId(message.gameId);
        this.game.setBattlefield(message.battlefield);
        this.lastGameStartMessage = message;
        this.events.emit('gameStart', message.gameId, message.battlefield);
        break;
      }
      case 'shot':
        if (this.game.isHotSeat() || message.playerId === this.game.getPlayerId()) {
          this.game.addShotToHistory(
            message.angle,
            message.velocity,
            this.game.isHotSeat() ? message.playerId : undefined,
            message.direction
          );
        }
        this.events.emit('shot', {
          playerId: message.playerId,
          angle: message.angle,
          velocity: message.velocity,
          direction: message.direction
        });
        break;
      case 'turn_change': {
        const previousPlayers = this.game.getPlayers();
        const previousById = new Map(previousPlayers.map(player => [player.playerId, player]));
        this.game.setPlayers(message.players);
        message.players
          .filter(player => !player.active && previousById.get(player.playerId)?.active)
          .forEach(player => this.events.emit('playerHit', player.playerId, player.name));
        this.game.setCurrentTurn(message.turnId);
        this.events.emit('turnChange', message.turnId, this.game.getState().isMyTurn);
        console.log(`Turn changed to Player ${message.turnId}`);
        break;
      }
      case 'game_over': {
        const previousPlayers = this.game.getPlayers();
        const previousById = new Map(previousPlayers.map(player => [player.playerId, player]));
        this.game.setPlayers(message.players);
        message.players
          .filter(player => !player.active && previousById.get(player.playerId)?.active)
          .forEach(player => this.events.emit('playerHit', player.playerId, player.name));
        const localPlayerId = this.game.getState().playerId;
        const didIWin = this.game.isHotSeat()
          ? true
          : localPlayerId !== null && localPlayerId === message.winnerId;
        this.events.emit('gameOver', message.winnerId, didIWin);
        break;
      }
      case 'rematch_status': {
        const legacyStatus = message as typeof message & { playersReady?: number };
        const answered = message.answered ?? legacyStatus.playersReady ?? 0;
        const players = (message.players ?? []).map(player => ({
          playerId: player.playerId,
          playerName: player.name,
          answer: player.answer
        }));
        this.events.emit('rematchStatus', answered, message.required, players);
        break;
      }
      case 'lobby_status':
        this.events.emit('lobbyStatus', {
          status: message.status,
          playersConnected: message.playersConnected,
          required: message.required,
          slots: message.slots,
          ready: false,
          readyCount: 0,
          canSkipWaiting: this.game.getPlayerId() === 0 && message.status === 'pending' && message.playersConnected >= 2
        });
        break;
    }
  }

  public getLastGameStartMessage(): GameStartMessage | null {
    return this.lastGameStartMessage;
  }
}