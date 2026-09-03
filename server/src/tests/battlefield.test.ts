import { describe, expect, it } from 'vitest';
import { createBattlefield, getTerrainY } from '../utils/battlefield';

describe('battlefield generation', () => {
  it('reproduces the same battlefield for the same seed', () => {
    expect(createBattlefield(12345)).toEqual(createBattlefield(12345));
  });

  it('places castles on opposite sides and on the terrain surface', () => {
    const battlefield = createBattlefield(12345);

    expect(battlefield.castles[0].left_x).toBeGreaterThanOrEqual(15);
    expect(battlefield.castles[0].left_x).toBeLessThanOrEqual(70);
    expect(battlefield.castles[1].left_x).toBeGreaterThanOrEqual(210);
    expect(battlefield.castles[1].left_x).toBeLessThanOrEqual(265);

    for (const castle of battlefield.castles) {
      expect(castle.base_y).toBe(
        getTerrainY(battlefield, castle.left_x + battlefield.castleWidth / 2)
      );
    }
  });

  it('generates a hill between the castles', () => {
    const battlefield = createBattlefield(12345);
    const terrainY = getTerrainY(battlefield, battlefield.terrain.hillCenter);

    expect(terrainY).toBeLessThan(battlefield.terrain.maxY);
    expect(terrainY).toBeGreaterThanOrEqual(battlefield.terrain.minY);
  });
});
