import type { BattlefieldConfig } from './types/messages';

export class Terrain {
  public static getY(battlefield: BattlefieldConfig, x: number): number {
    const { minY, maxY, hillCenter, hillWidth, hillHeight } = battlefield.terrain;
    const leftY = battlefield.terrain.leftY ?? maxY;
    const rightY = battlefield.terrain.rightY ?? maxY;
    const distance = (x - hillCenter) / hillWidth;
    const baselineY = x < hillCenter - hillWidth
      ? leftY
      : x > hillCenter + hillWidth
        ? rightY
        : leftY + (rightY - leftY) * ((distance + 1) / 2);
    const hill = Math.abs(distance) <= 1
      ? hillHeight * (1 + Math.cos(distance * Math.PI)) / 2
      : 0;
    return Math.min(maxY, Math.max(minY, baselineY - hill));
  }

  public static generateFlat(width: number, height: number): number[] {
    const terrain = new Array<number>(Math.floor(width / 2));
    terrain.fill(height);
    return terrain;
  }
}
