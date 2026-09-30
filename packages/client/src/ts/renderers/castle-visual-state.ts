const CASTLE_EMOJIS = [
  '🏰', '🏯', '🏛️', '🛖', '🏚️', '🏠', '🏡', '🏦', '🏫', '🗼', '⛪', '🕌', '🛕', '🕍', '🎪', '🏭'
] as const;

export class CastleVisualState {
  private glyphs: Record<number, string> = { 0: '🏰', 1: '🏯' };
  private activePlayerId: number | null = null;
  private readonly defeatedPlayerIds = new Set<number>();
  private readonly ripPlayerIds = new Set<number>();

  public assignGlyphs(playerIds: number[]): void {
    const pool = [...CASTLE_EMOJIS];
    const glyphs: Record<number, string> = {};
    for (let index = pool.length - 1; index > 0; index--) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [pool[index], pool[swapIndex]] = [pool[swapIndex]!, pool[index]!];
    }
    playerIds.forEach((playerId, index) => { glyphs[playerId] = pool[index]!; });
    this.glyphs = glyphs;
  }

  public resetDefeats(): void {
    this.defeatedPlayerIds.clear();
    this.ripPlayerIds.clear();
  }

  public setActivePlayer(playerId: number | null): void {
    this.activePlayerId = playerId;
  }

  public setDefeatedPlayers(playerIds: number[]): void {
    playerIds.forEach(playerId => this.defeatedPlayerIds.add(playerId));
  }

  public setSingleDefeatedPlayer(playerId: number | null): void {
    this.defeatedPlayerIds.clear();
    if (playerId !== null) this.defeatedPlayerIds.add(playerId);
  }

  public setRIPPlayers(playerIds: number[]): void {
    playerIds.forEach(playerId => this.ripPlayerIds.add(playerId));
  }

  public glyphFor(playerId: number): string {
    if (this.ripPlayerIds.has(playerId)) return '🪦';
    if (this.defeatedPlayerIds.has(playerId)) return '💥';
    return this.glyphs[playerId] ?? (playerId === 0 ? '🏰' : '🏯');
  }

  public isActive(playerId: number): boolean {
    return this.activePlayerId === playerId;
  }

  public getCastleGlyphs(): Record<number, string> {
    return this.glyphs;
  }
}