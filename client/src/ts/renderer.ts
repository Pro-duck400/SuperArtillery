// Canvas rendering
import type { Projectile } from './types/game';
import type { BattlefieldConfig } from './types/messages';
import { Terrain } from './terrain';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private groundY = 140;
  private castleWidth = 10;
  private castleHeight = 10;
  private battlefield: BattlefieldConfig | null = null;
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
    if (!this.battlefield) return;

    this.ctx.fillStyle = '#4CAF50';
    this.ctx.strokeStyle = '#4CAF50';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(0, Terrain.getY(this.battlefield, 0));
    for (let x = this.battlefield.terrain.sampleWidth; x <= this.canvas.width; x += this.battlefield.terrain.sampleWidth) {
      this.ctx.lineTo(x, Terrain.getY(this.battlefield, x));
    }
    this.ctx.lineTo(this.canvas.width, this.canvas.height);
    this.ctx.lineTo(0, this.canvas.height);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.beginPath();
    this.ctx.moveTo(0, Terrain.getY(this.battlefield, 0));
    for (let x = this.battlefield.terrain.sampleWidth; x <= this.canvas.width; x += this.battlefield.terrain.sampleWidth) {
      this.ctx.lineTo(x, Terrain.getY(this.battlefield, x));
    }
    this.ctx.stroke();
  }

  public drawWind(): void {
    if (!this.battlefield || this.battlefield.wind === 0) return;

    const centerX = this.canvas.width / 2;
    const y = 14;
    const direction = Math.sign(this.battlefield.wind);
    const length = Math.min(45, Math.abs(this.battlefield.wind));
    const endX = centerX + direction * length;

    this.ctx.save();
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(centerX - direction * length, y);
    this.ctx.lineTo(endX, y);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(endX, y);
    this.ctx.lineTo(endX - direction * 6, y - 4);
    this.ctx.lineTo(endX - direction * 6, y + 4);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();
  }

  public drawCastle(leftX: number, isActive: boolean = false): void {
    this.ctx.fillStyle = isActive ? '#ffd700' : '#808080';
    this.ctx.fillRect(
      leftX,
      this.getCastleBaseY(leftX) - this.castleHeight,
      this.castleWidth,
      this.castleHeight
    );
  }

  public applyBattlefield(battlefield: BattlefieldConfig): void {
    this.battlefield = battlefield;
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

  public getTerrainY(x: number): number {
    return this.battlefield ? Terrain.getY(this.battlefield, x) : this.groundY;
  }

  private getCastleBaseY(leftX: number): number {
    const castle = this.battlefield?.castles.find((item) => item.left_x === leftX);
    return castle?.base_y ?? this.groundY;
  }

  public getCastleTopY(playerId?: 0 | 1): number {
    if (playerId !== undefined) {
      const castle = this.battlefield?.castles.find((item) => item.playerId === playerId);
      if (castle) return castle.base_y - this.castleHeight;
    }
    return this.groundY - this.castleHeight;
  }

  public getCanvasWidth(): number {
    return this.canvas.width;
  }

  public getCastleMuzzleX(playerId: 0 | 1): number {
    return this.castleLeftByPlayerId[playerId] + this.castleWidth / 2;
  }

  public getCastleLabelPosition(playerId: 0 | 1): { x: number; y: number } {
    const castle = this.battlefield?.castles.find((item) => item.playerId === playerId);
    if (!castle) {
      return { x: this.getCastleMuzzleX(playerId), y: this.groundY };
    }

    return {
      x: castle.left_x + this.castleWidth / 2,
      y: castle.base_y + 4
    };
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
    this.drawWind();
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
