// Canvas rendering
import type { Projectile } from './types/game';
import type { BattlefieldConfig } from './types/messages';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private groundY = 140;
  private castleWidth = 10;
  private castleHeight = 10;
  private castleLeftByPlayerId: Record<0 | 1, number> = { 0: 20, 1: 260 };
  private activeCastlePlayerId: 0 | 1 | null = null;

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
    this.ctx.strokeStyle = '#654321';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.groundY);
    this.ctx.lineTo(this.canvas.width, this.groundY);
    this.ctx.stroke();
  }

  public drawCastle(leftX: number, isActive: boolean = false): void {
    if (isActive) {
      const padding = 3;
      this.ctx.strokeStyle = '#ffd700';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(
        leftX - padding,
        this.groundY - this.castleHeight - padding,
        this.castleWidth + padding * 2,
        this.castleHeight + padding * 2
      );
    }

    this.ctx.fillStyle = '#808080';
    this.ctx.fillRect(
      leftX,
      this.groundY - this.castleHeight,
      this.castleWidth,
      this.castleHeight
    );
  }

  public applyBattlefield(battlefield: BattlefieldConfig): void {
    this.canvas.width = battlefield.canvasWidth;
    this.canvas.height = battlefield.canvasHeight;
    this.groundY = battlefield.groundY;
    this.castleWidth = battlefield.castleWidth;
    this.castleHeight = battlefield.castleHeight;

    battlefield.castles.forEach((castle) => {
      this.castleLeftByPlayerId[castle.playerId] = castle.left_x;
    });

    this.render(null);
  }

  public getGroundY(): number {
    return this.groundY;
  }

  public getCastleTopY(): number {
    return this.groundY - this.castleHeight;
  }

  public getCanvasWidth(): number {
    return this.canvas.width;
  }

  public getCastleMuzzleX(playerId: 0 | 1): number {
    return this.castleLeftByPlayerId[playerId] + this.castleWidth / 2;
  }

  /**
   * Highlight the castle of the player whose turn it is (null clears the highlight)
   */
  public setActiveTurn(playerId: 0 | 1 | null): void {
    this.activeCastlePlayerId = playerId;
  }

  public drawProjectile(projectile: Projectile): void {
    this.ctx.fillStyle = '#FF0000';
    this.ctx.beginPath();
    this.ctx.arc(projectile.x, projectile.y, 2, 0, Math.PI * 2);
    this.ctx.fill();
  }

  public drawTrajectory(trajectory: Array<{ x: number; y: number }>): void {
    if (trajectory.length < 2) return;

    this.ctx.strokeStyle = '#FFA500';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([2, 2]); // Dashed line
    this.ctx.beginPath();
    this.ctx.moveTo(trajectory[0].x, trajectory[0].y);
    
    for (let i = 1; i < trajectory.length; i++) {
      this.ctx.lineTo(trajectory[i].x, trajectory[i].y);
    }
    
    this.ctx.stroke();
    this.ctx.setLineDash([]); // Reset to solid line
  }

  public render(projectile: Projectile | null, trajectory: Array<{ x: number; y: number }> = []): void {
    this.clear();
    this.drawGround();
    this.drawCastle(this.castleLeftByPlayerId[0], this.activeCastlePlayerId === 0);
    this.drawCastle(this.castleLeftByPlayerId[1], this.activeCastlePlayerId === 1);

    // Draw trajectory first (so it appears behind the projectile)
    if (trajectory.length > 0) {
      this.drawTrajectory(trajectory);
    }

    if (projectile) {
      this.drawProjectile(projectile);
    }
  }
}
