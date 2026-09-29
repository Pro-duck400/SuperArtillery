import type { BattlefieldConfig } from '../types/messages';

export class WindRenderer {
  public draw(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, battlefield: BattlefieldConfig): void {
    if (battlefield.wind === 0) return;
    const centerX = canvas.width / 2;
    const y = 14;
    const direction = Math.sign(battlefield.wind);
    const length = Math.min(45, Math.abs(battlefield.wind));
    const endX = centerX + direction * length;

    context.save();
    context.strokeStyle = '#ffffff';
    context.fillStyle = '#ffffff';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(centerX - direction * length, y);
    context.lineTo(endX, y);
    context.stroke();
    context.beginPath();
    context.moveTo(endX, y);
    context.lineTo(endX, y);
    context.lineTo(endX - direction * 6, y - 4);
    context.lineTo(endX - direction * 6, y + 4);
    context.closePath();
    context.fill();
    context.restore();
  }
}