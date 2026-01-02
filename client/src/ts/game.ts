// Game state and turn management
import type { GameState } from './types/game';

export class Game {
  private state: GameState = {
    playerId: 0,
    currentTurn: 0,
    isMyTurn: false,
  };

  public getState(): GameState {
    return { ...this.state };
  }

  public setPlayerId(id: 0 | 1): void {
    this.state.playerId = id;
    this.updateTurnState();
  }

  public setCurrentTurn(turn: 0 | 1): void {
    this.state.currentTurn = turn;
    this.updateTurnState();
  }

  private updateTurnState(): void {
    this.state.isMyTurn = this.state.playerId === this.state.currentTurn;
  }
}
