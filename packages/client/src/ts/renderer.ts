// Canvas rendering
import type { Projectile } from './types/game';
import type { BattlefieldConfig } from './types/messages';
import { getTerrainY } from '@superartillery/core';
import type { HistoricalTrajectory, TrajectoryPoint } from './trajectory';
import { CastleRenderer } from './renderers/castle-renderer';
import { CastleVisualState } from './renderers/castle-visual-state';
import { TerrainRenderer } from './renderers/terrain-renderer';
import { TrajectoryRenderer } from './renderers/trajectory-renderer';
import { WindRenderer } from './renderers/wind-renderer';

export interface RenderState {
  projectile: Projectile | null;
  activeTrajectory: TrajectoryPoint[];
  historicalTrajectories: HistoricalTrajectory[];
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private groundY = 140;
  private castleWidth = 10;
  private castleHeight = 10;
  private battlefield: BattlefieldConfig | null = null;
  private castleLeftByPlayerId: Record<number, number> = { 0: 20, 1: 260 };
  private readonly castleVisualState = new CastleVisualState();
  private readonly castleRenderer = new CastleRenderer();
  private readonly terrainRenderer = new TerrainRenderer();
  private readonly trajectoryRenderer = new TrajectoryRenderer();
  private readonly windRenderer = new WindRenderer();

  public get castleGlyphs(): Record<number, string> {
    return this.castleVisualState.getCastleGlyphs();
  }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not get 2D context from canvas');
    }
    this.ctx = context;
  }

  public clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  public drawGround(): void {
    if (!this.battlefield) return;
    this.terrainRenderer.draw(this.ctx, this.canvas, this.battlefield);
  }

  public drawWind(): void {
    if (!this.battlefield) return;
    this.windRenderer.draw(this.ctx, this.canvas, this.battlefield);
  }

  public drawCastle(playerId: number, leftX: number, isActive: boolean = false): void {
    const baseY = this.getCastleBaseY(leftX);
    this.castleRenderer.draw(
      this.ctx,
      this.castleVisualState.glyphFor(playerId),
      leftX,
      baseY,
      this.castleHeight,
      isActive
    );
  }

  public applyBattlefield(battlefield: BattlefieldConfig): void {
    this.battlefield = battlefield;
    this.canvas.width = battlefield.width;
    this.canvas.height = battlefield.height;
    this.groundY = battlefield.groundY;
    this.castleWidth = battlefield.castleW;
    this.castleHeight = battlefield.castleH;
    this.castleVisualState.resetDefeats();
    this.castleVisualState.assignGlyphs(battlefield.castles.map((castle) => castle.playerId));

    battlefield.castles.forEach((castle) => {
      this.castleLeftByPlayerId[castle.playerId] = castle.left_x;
    });

    this.render({ projectile: null, activeTrajectory: [], historicalTrajectories: [] });
  }

  public getGroundY(): number {
    return this.groundY;
  }

  public getTerrainY(x: number): number {
    return this.battlefield ? getTerrainY(this.battlefield, x) : this.groundY;
  }

  private getCastleBaseY(leftX: number): number {
    const castle = this.battlefield?.castles.find((item) => item.left_x === leftX);
    return castle?.base_y ?? this.groundY;
  }

  public getCastleTopY(playerId?: number): number {
    if (playerId !== undefined) {
      const castle = this.battlefield?.castles.find((item) => item.playerId === playerId);
      if (castle) return castle.base_y - this.castleHeight;
    }
    return this.groundY - this.castleHeight;
  }

  public getCanvasWidth(): number {
    return this.canvas.width;
  }

  public getCastleMuzzleX(playerId: number): number {
    return this.castleLeftByPlayerId[playerId] + this.castleWidth / 2;
  }

  public getCastleLabelPosition(playerId: number): { x: number; y: number } {
    const castle = this.battlefield?.castles.find((item) => item.playerId === playerId);
    const bufferX = castle ? castle.left_x + this.castleWidth / 2 : this.getCastleMuzzleX(playerId);
    const bufferY = castle ? castle.base_y + 4 : this.groundY;

    // The canvas is drawn at a fixed buffer size but can be scaled down by CSS
    // (max-width: 100%; height: auto), so labels must convert to displayed CSS pixels.
    const scaleX = this.canvas.width ? this.canvas.clientWidth / this.canvas.width : 1;
    const scaleY = this.canvas.height ? this.canvas.clientHeight / this.canvas.height : 1;

    return {
      x: bufferX * (scaleX || 1),
      y: bufferY * (scaleY || 1)
    };
  }

  /**
   * Highlight the castle of the player whose turn it is (null clears the highlight)
   */
  public setActiveTurn(playerId: number | null): void {
    this.castleVisualState.setActivePlayer(playerId);
  }

  public setDefeatedPlayer(playerId: 0 | 1 | null): void {
    this.castleVisualState.setSingleDefeatedPlayer(playerId);
  }

  public setDefeatedPlayers(playerIds: number[]): void {
    this.castleVisualState.setDefeatedPlayers(playerIds);
  }

  public setRIPPlayers(playerIds: number[]): void {
    this.castleVisualState.setRIPPlayers(playerIds);
  }

  public drawProjectile(projectile: Projectile): void {
    this.ctx.fillStyle = '#FF0000';
    this.ctx.beginPath();
    this.ctx.arc(projectile.x, projectile.y, 2, 0, Math.PI * 2);
    this.ctx.fill();
  }

  public drawActiveTrajectory(trajectory: TrajectoryPoint[]): void {
    this.trajectoryRenderer.drawActive(this.ctx, trajectory);
  }

  private drawHistoricalTrajectories(trajectories: HistoricalTrajectory[]): void {
    this.trajectoryRenderer.drawHistorical(this.ctx, trajectories);
  }

  public render(state: RenderState): void {
    this.clear();
    this.drawWind();
    this.drawGround();
    for (const castle of this.battlefield?.castles ?? []) {
      this.drawCastle(castle.playerId, castle.left_x, this.castleVisualState.isActive(castle.playerId));
    }
    this.drawHistoricalTrajectories(state.historicalTrajectories);

    // Draw trajectory first (so it appears behind the projectile)
    if (state.activeTrajectory.length > 0) {
      this.drawActiveTrajectory(state.activeTrajectory);
    }

    if (state.projectile) {
      this.drawProjectile(state.projectile);
    }
  }
}
