import type {
  GameMessage,
  GameOverMessage,
  GameStartMessage,
  LobbyStatusMessage,
  RematchStatusMessage,
  ShotMessage,
  TurnChangeMessage
} from '../contract/messages';
import type { PrivateGame, RematchAnswer } from '../types/private-game';

export type GamePlayerState = GameStartMessage['players'][number];

export class GameMessageFactory {
  public gameStart(game: PrivateGame): GameStartMessage {
    return {
      type: 'game_start',
      gameId: game.id,
      players: this.playerStates(game),
      battlefield: game.battlefield!,
      round: game.round
    };
  }

  public turnChange(game: PrivateGame): TurnChangeMessage {
    return { type: 'turn_change', turnId: game.currentTurn, players: this.playerStates(game) };
  }

  public gameOver(game: PrivateGame, winnerId: number): GameOverMessage {
    return { type: 'game_over', winnerId, players: this.playerStates(game) };
  }

  public shot(playerId: number, angle: number, velocity: number, direction: 'Left' | 'Right'): ShotMessage {
    return { type: 'shot', playerId, angle, velocity, direction };
  }

  public lobbyStatus(game: PrivateGame, playersConnected: number, required: number): LobbyStatusMessage {
    return {
      type: 'lobby_status',
      status: game.status,
      playersConnected,
      required,
      slots: game.lobbySlots.map(slot => ({
        playerId: slot.playerId,
        ...(slot.session.name ? { name: slot.session.name } : {}),
        status: slot.status === 'skipped'
          ? 'skipped'
          : slot.session.connection?.isOpen() && slot.session.name ? 'ready' : 'waiting'
      }))
    };
  }

  public rematchStatus(game: PrivateGame, answers: Array<RematchAnswer | null>): RematchStatusMessage {
    return {
      type: 'rematch_status',
      answered: answers.filter(answer => answer !== null).length,
      required: game.lobbySlots.length,
      players: game.lobbySlots.map((slot, index) => ({
        playerId: slot.playerId,
        name: slot.session.name ?? `Player ${slot.playerId + 1}`,
        ...(answers[index] ? { answer: answers[index]! } : {})
      }))
    };
  }

  public playerStates(game: PrivateGame): GamePlayerState[] {
    return game.lobbySlots.map(slot => ({
      playerId: slot.playerId,
      name: slot.session.name ?? `Player ${slot.playerId + 1}`,
      active: slot.active && !slot.eliminated && slot.status !== 'skipped',
      connected: slot.session.connection?.isOpen() ?? false,
      frags: game.frags[slot.playerId] ?? 0
    }));
  }

  public sendToConnectedPlayers(game: PrivateGame, message: GameMessage): void {
    const connections = new Set(game.lobbySlots
      .map(slot => slot.session.connection)
      .filter((connection): connection is NonNullable<typeof connection> => !!connection?.isOpen()));
    connections.forEach(connection => connection.send(message));
  }
}