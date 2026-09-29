import { getTerrainY } from '@superartillery/core';
import type { BattlefieldConfig } from '../types/messages';

export class TerrainRenderer {
  public draw(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, battlefield: BattlefieldConfig): void {
    context.fillStyle = '#4CAF50';
    context.strokeStyle = '#4CAF50';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(0, getTerrainY(battlefield, 0));
    for (let x = battlefield.terrain.sampleWidth; x <= canvas.width; x += battlefield.terrain.sampleWidth) {
      context.lineTo(x, getTerrainY(battlefield, x));
    }
    context.lineTo(canvas.width, canvas.height);
    context.lineTo(0, canvas.height);
    context.closePath();
    context.fill();

    context.beginPath();
    context.moveTo(0, getTerrainY(battlefield, 0));
    for (let x = battlefield.terrain.sampleWidth; x <= canvas.width; x += battlefield.terrain.sampleWidth) {
      context.lineTo(x, getTerrainY(battlefield, x));
    }
    context.stroke();
  }
}