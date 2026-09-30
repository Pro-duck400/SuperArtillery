import { describe, expect, it } from 'vitest';
import { createBattlefield, getTerrainY } from './battlefield';

describe('battlefield generation', () => {
  it('reproduces the same battlefield for the same seed', () => {
    expect(createBattlefield(12345, [1, 2, 3])).toEqual(createBattlefield(12345, [1, 2, 3]));
  });

  it('places castles on opposite sides and on the terrain surface', () => {
    const battlefield = createBattlefield(12345, [1, 2, 3]);
    expect(battlefield.castles[0]!.left_x).toBeGreaterThanOrEqual(15);
    expect(battlefield.castles[0]!.left_x).toBeLessThanOrEqual(80);
    expect(battlefield.castles[1]!.left_x).toBeGreaterThanOrEqual(340);
    expect(battlefield.castles[1]!.left_x).toBeLessThanOrEqual(405);
    for (const castle of battlefield.castles) {
      expect(castle.base_y).toBe(getTerrainY(battlefield, castle.left_x + battlefield.castleW / 2));
    }
  });

  it('generates bounded terrain between the castles', () => {
    const battlefield = createBattlefield(12345, [1, 2, 3]);
    const terrainY = getTerrainY(battlefield, battlefield.terrain.hillCenter);
    expect(terrainY).toBeLessThanOrEqual(battlefield.terrain.maxY);
    expect(terrainY).toBeGreaterThanOrEqual(battlefield.terrain.minY);
  });

  it('generates deterministic wind within the supported range', () => {
    const first = createBattlefield(12345, [1, 2, 3]);
    const second = createBattlefield(12345, [1, 2, 3]);
    expect(first.wind).toBe(second.wind);
    expect(first.wind).toBeGreaterThanOrEqual(-50);
    expect(first.wind).toBeLessThanOrEqual(50);
  });

  it('generates independent side elevations and bounded middle terrain', () => {
    const first = createBattlefield(12345, [1, 2, 3]);
    const second = createBattlefield(54321, [1, 2, 3]);
    expect(first.terrain.leftY).not.toBe(first.terrain.rightY);
    expect(first.terrain.leftY).not.toBe(second.terrain.leftY);
    expect(first.terrain.leftY).toBeGreaterThanOrEqual(first.terrain.maxY - 22);
    expect(first.terrain.leftY).toBeLessThanOrEqual(first.terrain.maxY - 18);
    expect(first.terrain.rightY).toBeGreaterThanOrEqual(first.terrain.maxY - 22);
    expect(first.terrain.rightY).toBeLessThanOrEqual(first.terrain.maxY - 18);
    expect(first.terrain.hillHeight).toBeGreaterThanOrEqual(55);
    expect(first.terrain.hillHeight).toBeLessThanOrEqual(first.terrain.maxY);
    expect(getTerrainY(first, 0)).toBeGreaterThanOrEqual(first.terrain.minY);
    expect(getTerrainY(first, 0)).toBeLessThanOrEqual(first.terrain.maxY);
    expect(getTerrainY(first, first.width)).toBeGreaterThanOrEqual(first.terrain.minY);
    expect(getTerrainY(first, first.width)).toBeLessThanOrEqual(first.terrain.maxY);
  });

  it('keeps neighboring castles at distinct elevations and terrain close to the bottom', () => {
    for (let playerCount = 2; playerCount <= 9; playerCount += 1) {
      const playerIds = Array.from({ length: playerCount }, (_, playerId) => playerId);
      for (let seedIndex = 0; seedIndex < 100; seedIndex += 1) {
        const battlefield = createBattlefield((seedIndex * 1_000_003 + playerCount) >>> 0, playerIds);
        const castleGrounds = battlefield.castles.map(castle => castle.base_y);
        for (let index = 1; index < castleGrounds.length; index += 1) {
          expect(Math.abs(castleGrounds[index]! - castleGrounds[index - 1]!)).toBeGreaterThan(10);
          const leftCastle = battlefield.castles[index - 1]!;
          const rightCastle = battlefield.castles[index]!;
          const midpoint = (leftCastle.left_x + rightCastle.left_x + battlefield.castleW) / 2;
          const lineOfSightY = ((leftCastle.base_y - battlefield.castleH) + (rightCastle.base_y - battlefield.castleH)) / 2;
          expect(getTerrainY(battlefield, midpoint)).toBeLessThan(lineOfSightY - 20);
        }

        let lowestGroundY = 0;
        for (let x = 0; x <= battlefield.width; x += battlefield.terrain.sampleWidth) {
          lowestGroundY = Math.max(lowestGroundY, getTerrainY(battlefield, x));
        }
        expect(battlefield.terrain.maxY - lowestGroundY).toBeLessThanOrEqual(20);
      }
    }
  });

  it('generates a positive central hill with varied heights across seeds', () => {
    const samples = Array.from({ length: 300 }, (_, index) => createBattlefield((index * 1_000_003 + 1) >>> 0, [1, 2, 3]));
    const hillHeights = samples.map(({ terrain }) => terrain.hillHeight);
    expect(hillHeights.every(height => height >= 55)).toBe(true);
    expect(Math.max(...hillHeights) - Math.min(...hillHeights)).toBeGreaterThan(50);
    expect(new Set(hillHeights).size).toBeGreaterThan(100);
  });

  it('varies gap hill heights, widths and castle elevations within one battlefield', () => {
    const battlefield = createBattlefield(12345, [1, 2, 3, 4, 5]);
    const gapHills = [battlefield.terrain, ...battlefield.terrain.extraHills!.slice(0, 3)];
    expect(new Set(gapHills.map(hill => Math.round(hill.hillHeight))).size).toBe(4);
    expect(new Set(gapHills.map(hill => Math.round(hill.hillWidth))).size).toBeGreaterThan(1);
    expect(new Set(battlefield.castles.map(castle => Math.round(castle.base_y))).size).toBeGreaterThan(2);
  });
});