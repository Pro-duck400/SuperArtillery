export interface PendingVisualTurn {
  playerId: number;
  isMyTurn: boolean;
}

export class PendingPresentationQueue {
  private visualTurn: PendingVisualTurn | null = null;
  private gameOver = false;
  private defeatedPlayerIds: number[] = [];
  private hitName: string | null = null;
  private ripPlayerIds: number[] = [];

  public reset(): void {
    this.visualTurn = null;
    this.gameOver = false;
    this.defeatedPlayerIds = [];
    this.hitName = null;
    this.ripPlayerIds = [];
  }

  public queueTurn(turn: PendingVisualTurn): void {
    this.visualTurn = turn;
  }

  public takeTurn(): PendingVisualTurn | null {
    const turn = this.visualTurn;
    this.visualTurn = null;
    return turn;
  }

  public hasPendingTurn(): boolean {
    return this.visualTurn !== null;
  }

  public clearTurn(): void {
    this.visualTurn = null;
  }

  public queueGameOver(defeatedPlayerIds: number[]): void {
    this.gameOver = true;
    this.defeatedPlayerIds = [...defeatedPlayerIds];
  }

  public takeGameOver(): boolean {
    const gameOver = this.gameOver;
    this.gameOver = false;
    return gameOver;
  }

  public queuePlayerHit(playerId: number, playerName: string): void {
    this.hitName = playerName;
    this.defeatedPlayerIds.push(playerId);
    this.ripPlayerIds.push(playerId);
  }

  public takeDefeatedPlayerIds(): number[] {
    const playerIds = this.defeatedPlayerIds;
    this.defeatedPlayerIds = [];
    return playerIds;
  }

  public isDefeated(playerId: number): boolean {
    return this.defeatedPlayerIds.includes(playerId);
  }

  public get pendingHitName(): string | null {
    return this.hitName;
  }

  public clearHitName(): void {
    this.hitName = null;
  }

  public hasPendingRip(): boolean {
    return this.ripPlayerIds.length > 0;
  }

  public takeRipPlayerIds(): number[] {
    const playerIds = this.ripPlayerIds;
    this.ripPlayerIds = [];
    return playerIds;
  }
}