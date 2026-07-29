// Game state and turn management
import type { GameState } from './types/game';
import type { BattlefieldConfig } from './types/messages';

export class Game {
  private state: GameState = {
    playerId: null,
    currentTurn: 0,
    isMyTurn: false,
  };
  private gameId: number | null = null;
  private battlefield: BattlefieldConfig | null = null;

  public getState(): GameState {
    return { ...this.state };
  }

  public setPlayerId(id: 0 | 1): void {
    this.state.playerId = id;
    this.updateTurnState();
  }

  public setGameId(id: number): void {
    this.gameId = id;
  }

  public getGameId(): number | null {
    return this.gameId;
  }

  public setBattlefield(battlefield: BattlefieldConfig): void {
    this.battlefield = battlefield;
  }

  public getBattlefield(): BattlefieldConfig | null {
    return this.battlefield;
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
}
