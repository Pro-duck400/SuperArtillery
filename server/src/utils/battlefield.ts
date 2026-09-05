import type { Battlefield } from '../types/messages';

export const TERRAIN_VERSION = 2;

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

export function createBattlefield(seed: number = Math.floor(Math.random() * 0x100000000)): Battlefield {
  const random = createRandom(seed);
  const terrainVariationRoll = random();
  const hillHeight = terrainVariationRoll < 1 / 3
    ? 0
    : terrainVariationRoll < 2 / 3
      ? randomBetween(random, 1, 65)
      : randomBetween(random, -65, -1);
  const battlefield: Battlefield = {
    canvasWidth: 280,
    canvasHeight: 160,
    gravity: 100,
    wind: randomBetween(random, -50, 50),
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
      minY: 0,
      maxY: 140,
      hillCenter: randomBetween(random, 135, 145),
      hillWidth: randomBetween(random, 45, 65),
      hillHeight,
      leftY: 0,
      rightY: 0
    }
  };

  battlefield.terrain.leftY = randomBetween(random, 75, battlefield.terrain.maxY);
  battlefield.terrain.rightY = randomBetween(random, 75, battlefield.terrain.maxY);

  for (const castle of battlefield.castles) {
    castle.base_y = getTerrainY(battlefield, castle.left_x + battlefield.castleWidth / 2);
  }

  return battlefield;
}
