// Canvas rendering
import type { Projectile } from './types/game';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private readonly GROUND_Y = 140;
  private readonly CASTLE_WIDTH = 10;
  private readonly CASTLE_HEIGHT = 10;

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
    this.ctx.moveTo(0, this.GROUND_Y);
    this.ctx.lineTo(this.canvas.width, this.GROUND_Y);
    this.ctx.stroke();
  }

  public drawCastle(x: number): void {
    this.ctx.fillStyle = '#808080';
    this.ctx.fillRect(
      x - this.CASTLE_WIDTH / 2,
      this.GROUND_Y - this.CASTLE_HEIGHT,
      this.CASTLE_WIDTH,
      this.CASTLE_HEIGHT
    );
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
    this.drawCastle(20); // Player 1
    this.drawCastle(260); // Player 2

    // Draw trajectory first (so it appears behind the projectile)
    if (trajectory.length > 0) {
      this.drawTrajectory(trajectory);
    }

    if (projectile) {
      this.drawProjectile(projectile);
    }
  }
}
