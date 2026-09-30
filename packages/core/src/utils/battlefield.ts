import type { Battlefield } from '../contract/messages';

export const TERRAIN_VERSION = 5;

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

function hillContribution(x: number, hillCenter: number, hillWidth: number, hillHeight: number): number {
  const distance = (x - hillCenter) / hillWidth;
  return Math.abs(distance) <= 1
    ? hillHeight * (1 + Math.cos(distance * Math.PI)) / 2
    : 0;
}

export function getTerrainY(battlefield: Battlefield, x: number): number {
  const { minY, maxY, hillCenter, hillWidth, hillHeight, extraHills } = battlefield.terrain;
  const leftY = battlefield.terrain.leftY ?? maxY;
  const rightY = battlefield.terrain.rightY ?? maxY;
  const distance = (x - hillCenter) / hillWidth;
  const baselineY = x < hillCenter - hillWidth
    ? leftY
    : x > hillCenter + hillWidth
      ? rightY
      : leftY + (rightY - leftY) * ((distance + 1) / 2);
  const hill = hillContribution(x, hillCenter, hillWidth, hillHeight) +
    (extraHills ?? []).reduce(
      (total, extraHill) => total + hillContribution(x, extraHill.hillCenter, extraHill.hillWidth, extraHill.hillHeight),
      0
    );
  return Math.min(maxY, Math.max(minY, baselineY - hill));
}

export function createBattlefield(
  seed: number = Math.floor(Math.random() * 0x100000000),
  playerIds: number[]
): Battlefield {
  const count = Math.max(2, Math.min(9, playerIds.length));
  const width = count === 2 ? 420 : 260 + count * 160;
  const height = 240 + (count - 2) * 20;

  const random = createRandom(seed);
  const castleSpacing = (width - 40) / (count - 1);
  const hillWidth = castleSpacing * 0.42;
  const castles = playerIds.map((playerId, index) => ({
    playerId,
    left_x: 15 + index * ((width - 30 - 10) / (count - 1)),
    base_y: 0
  }));
  const hillHeights = Array.from({ length: count - 1 }, () => randomBetween(random, 85, 100));
  const gapHills = castles.slice(0, -1).map((castle, index) => ({
    hillCenter: castle.left_x + 5 + castleSpacing / 2,
    hillWidth,
    hillHeight: hillHeights[index]!
  }));
  const mainHillIndex = Math.floor((gapHills.length - 1) / 2);
  const mainHill = gapHills[mainHillIndex]!;
  const hillCenter = mainHill.hillCenter;
  const hillHeight = mainHill.hillHeight;
  const castleDepressionWidth = castleSpacing * 0.26;
  const extraHills = [
    ...gapHills.filter((_, index) => index !== mainHillIndex),
    ...castles.flatMap((castle, index) => index % 2 === 1
      ? [{ hillCenter: castle.left_x + 5, hillWidth: castleDepressionWidth, hillHeight: -40 }]
      : [])
  ];

  const battlefield: Battlefield = {
    width,
    height,
    gravity: 100,
    wind: randomBetween(random, -50, 50),
    groundY: height - 20,
    castleW: 10,
    castleH: 10,
    castles,
    terrain: {
      version: TERRAIN_VERSION,
      seed: seed >>> 0,
      sampleWidth: 2,
      minY: 0,
      maxY: height - 20,
      hillCenter,
      hillWidth,
      hillHeight,
      leftY: 0,
      rightY: 0,
      extraHills
    }
  };

  battlefield.terrain.leftY = battlefield.terrain.maxY - randomBetween(random, 18, 22);
  battlefield.terrain.rightY = battlefield.terrain.maxY - randomBetween(random, 18, 22);

  for (const castle of battlefield.castles) {
    castle.base_y = getTerrainY(battlefield, castle.left_x + battlefield.castleW / 2);
  }

  return battlefield;
}