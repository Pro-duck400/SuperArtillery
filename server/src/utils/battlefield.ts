import type { Battlefield } from '../types/messages';

export const TERRAIN_VERSION = 1;

function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function randomBetween(random: () => number, min: number, max: number): number {
  return min + random() * (max - min);
}

export function getTerrainY(battlefield: Battlefield, x: number): number {
  const { minY, maxY, hillCenter, hillWidth, hillHeight } = battlefield.terrain;
  const distance = (x - hillCenter) / hillWidth;
  const hill = Math.abs(distance) <= 1
    ? hillHeight * (1 + Math.cos(distance * Math.PI)) / 2
    : 0;
  return Math.min(maxY, Math.max(minY, maxY - hill));
}

export function createBattlefield(seed: number = Math.floor(Math.random() * 0x100000000)): Battlefield {
  const random = createRandom(seed);
  const battlefield: Battlefield = {
    canvasWidth: 280,
    canvasHeight: 160,
    gravity: 100,
    groundY: 140,
    castleWidth: 10,
    castleHeight: 10,
    castles: [
      { playerId: 0, left_x: randomBetween(random, 15, 70), base_y: 0 },
      { playerId: 1, left_x: randomBetween(random, 210, 265), base_y: 0 }
    ],
    terrain: {
      version: TERRAIN_VERSION,
      seed: seed >>> 0,
      sampleWidth: 2,
      minY: 75,
      maxY: 140,
      hillCenter: randomBetween(random, 135, 145),
      hillWidth: randomBetween(random, 45, 65),
      hillHeight: randomBetween(random, 35, 65)
    }
  };

  for (const castle of battlefield.castles) {
    castle.base_y = getTerrainY(battlefield, castle.left_x + battlefield.castleWidth / 2);
  }

  return battlefield;
}
