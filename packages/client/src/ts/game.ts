// Game state and turn management
import type { GameState } from './types/game';
import type { BattlefieldConfig } from './types/messages';
import type { PlayerState } from './types/messages';
import type { ShotDirection } from '@superartillery/core';

const SHOT_HISTORY_LIMIT = 4;
export const PLAYER_SHOT_HISTORY_LIMIT = 5;
const MAX_PLAYER_SHOT_HISTORY_DURING_ANIMATION = PLAYER_SHOT_HISTORY_LIMIT + 1;

export interface ShotHistoryEntry {
  angle: number;
  velocity: number;
  playerId?: number;
  direction?: ShotDirection;
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
  private hotSeat = false;
  private shotHistory: ShotHistoryEntry[] = [];
  private shotHistoryByPlayer = new Map<number, ShotHistoryEntry[]>();
  private players = new Map<number, PlayerState>();

  public getState(): GameState {
    return { ...this.state };
  }

  public setPlayer(id: number, playerName: string): void {
    this.state.playerId = id;
    this.playerName = playerName;
    this.updateTurnState();
  }

  public setHotSeat(enabled: boolean): void {
    this.hotSeat = enabled;
    this.updateTurnState();
  }

  public isHotSeat(): boolean {
    return this.hotSeat;
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

  public getPlayerId(): number | null {
    return this.state.playerId;
  }

  public setCurrentTurn(turn: number): void {
    this.state.currentTurn = turn;
    this.updateTurnState();
  }

  private updateTurnState(): void {
    this.state.isMyTurn = this.hotSeat || (this.state.playerId !== null && this.state.playerId === this.state.currentTurn);
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

  public addShotToHistory(angle: number, velocity: number, playerId?: number, direction?: ShotDirection): void {
    const shot = {
      angle,
      velocity,
      ...(playerId === undefined ? {} : { playerId }),
      ...(direction ? { direction } : {})
    };
    if (playerId === undefined) {
      this.shotHistory = [shot, ...this.shotHistory].slice(0, SHOT_HISTORY_LIMIT);
      return;
    }

    const history = this.shotHistoryByPlayer.get(playerId) ?? [];
    this.shotHistoryByPlayer.set(
      playerId,
      [shot, ...history].slice(0, MAX_PLAYER_SHOT_HISTORY_DURING_ANIMATION)
    );

    if (this.hotSeat) {
      this.shotHistory = [shot, ...this.shotHistory].slice(0, SHOT_HISTORY_LIMIT);
    } else if (playerId === this.state.playerId) {
      this.shotHistory = [{
        angle,
        velocity,
        ...(direction ? { direction } : {})
      }, ...this.shotHistory].slice(0, SHOT_HISTORY_LIMIT);
    }
  }

  public completeShotHistoryForPlayer(playerId: number): void {
    const history = this.shotHistoryByPlayer.get(playerId);
    if (history) {
      this.shotHistoryByPlayer.set(playerId, history.slice(0, PLAYER_SHOT_HISTORY_LIMIT));
    }
  }

  public getShotHistory(): ShotHistoryEntry[] {
    return this.shotHistory.map((shot) => ({ ...shot }));
  }

  public getShotHistoryForPlayer(playerId: number): ShotHistoryEntry[] {
    return (this.shotHistoryByPlayer.get(playerId) ?? []).map((shot) => ({ ...shot }));
  }

  public setPlayers(players: PlayerState[]): void {
    this.players = new Map(players.map(player => [player.playerId, { ...player }]));
    const localPlayer = this.state.playerId === null ? undefined : this.players.get(this.state.playerId);
    if (localPlayer) this.playerName = localPlayer.name;
  }

  public getPlayers(): PlayerState[] {
    return Array.from(this.players.values()).map(player => ({ ...player }));
  }

  public resetShotHistory(): void {
    this.shotHistory = [];
    this.shotHistoryByPlayer.clear();
  }
}
