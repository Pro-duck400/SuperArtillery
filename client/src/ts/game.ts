// Game state and turn management
import type { GameState } from './types/game';

export class Game {
  private state: GameState = {
    playerId: null,
    currentTurn: 0,
    isMyTurn: false,
  };
  private gameId: number | null = null;
  private playerName: string | null = null;
  private opponentName: string | null = null;

  public getState(): GameState {
    return { ...this.state };
  }

  public setPlayer(id: 0 | 1, playerName: string): void {
    this.state.playerId = id;
    this.playerName = playerName;
    this.updateTurnState();
  }

  public setGameId(id: number): void {
    this.gameId = id;
  }

  public getGameId(): number | null {
    return this.gameId;
  }

  public getPlayerId(): 0 | 1 | null {
    return this.state.playerId;
  }

  public setCurrentTurn(turn: 0 | 1): void {
    this.state.currentTurn = turn;
    this.updateTurnState();
  }

  private updateTurnState(): void {
    this.state.isMyTurn = this.state.playerId !== null && this.state.playerId === this.state.currentTurn;
  }

  public setOpponentName(name: string): void {
    this.opponentName = name;
  }

  public getPlayerName(): string | null {
    return this.playerName;
  }

  public getOpponentName(): string | null {
    return this.opponentName;
  }
}

