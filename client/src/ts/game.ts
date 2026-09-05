// Game state and turn management
import type { GameState } from './types/game';
import type { BattlefieldConfig } from './types/messages';

export interface ShotHistoryEntry {
  angle: number;
  velocity: number;
}

export class Game {
  private state: GameState = {
    playerId: null,
    currentTurn: 0,
    isMyTurn: false,
  };
  private gameId: string | null = null;
  private battlefield: BattlefieldConfig | null = null;
  private playerName: string | null = null;
  private opponentName: string | null = null;
  private shotHistory: ShotHistoryEntry[] = [];

  public getState(): GameState {
    return { ...this.state };
  }

  public setPlayer(id: 0 | 1, playerName: string): void {
    this.state.playerId = id;
    this.playerName = playerName;
    this.updateTurnState();
  }

  public setGameId(id: string): void {
    this.gameId = id;
  }

  public getGameId(): string | null {
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

  public setOpponentName(name: string): void {
    this.opponentName = name;
  }

  public getPlayerName(): string | null {
    return this.playerName;
  }

  public getOpponentName(): string | null {
    return this.opponentName;
  }

  public addShotToHistory(angle: number, velocity: number): void {
    this.shotHistory = [{ angle, velocity }, ...this.shotHistory].slice(0, 4);
  }

  public getShotHistory(): ShotHistoryEntry[] {
    return this.shotHistory.map((shot) => ({ ...shot }));
  }

  public resetShotHistory(): void {
    this.shotHistory = [];
  }
}

