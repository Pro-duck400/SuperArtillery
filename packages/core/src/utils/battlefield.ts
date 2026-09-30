import type { Battlefield } from '../contract/messages';

export const TERRAIN_VERSION = 6;

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
  const castles = playerIds.map((playerId, index) => ({
    playerId,
    left_x: 15 + index * ((width - 30 - 10) / (count - 1)),
    base_y: 0
  }));
  // Width + jitter stay below 0.42 spacing so gap hills never reach a castle footprint.
  const gapHills = castles.slice(0, -1).map(castle => ({
    hillCenter: castle.left_x + 5 + castleSpacing * (0.5 + randomBetween(random, -0.08, 0.08)),
    hillWidth: castleSpacing * randomBetween(random, 0.28, 0.38),
    hillHeight: randomBetween(random, 55, 130)
  }));
  const mainHillIndex = Math.floor((gapHills.length - 1) / 2);
  const castlePadWidth = castleSpacing * 0.26;
  const lowCastleParity = random() < 0.5 ? 0 : 1;
  const castlePads = castles.map((castle, index) => ({
    hillCenter: castle.left_x + 5,
    hillWidth: castlePadWidth,
    hillHeight: index % 2 === lowCastleParity
      ? -randomBetween(random, 30, 50)
      : randomBetween(random, 0, 50)
  }));
  const bumps = castles.slice(0, -1).flatMap((castle, index) => {
    const gapStart = castle.left_x + 10;
    const gapEnd = castles[index + 1]!.left_x;
    return Array.from({ length: Math.floor(randomBetween(random, 0, 3)) }, () => {
      const bumpWidth = randomBetween(random, 10, 25);
      const sign = random() < 0.5 ? -1 : 1;
      return {
        hillCenter: randomBetween(random, gapStart + bumpWidth, gapEnd - bumpWidth),
        hillWidth: bumpWidth,
        hillHeight: sign * randomBetween(random, 6, 18)
      };
    });
  });
  const mainHill = gapHills[mainHillIndex]!;

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
      hillCenter: mainHill.hillCenter,
      hillWidth: mainHill.hillWidth,
      hillHeight: mainHill.hillHeight,
      leftY: 0,
      rightY: 0,
      extraHills: [
        ...gapHills.filter((_, index) => index !== mainHillIndex),
        ...castlePads,
        ...bumps
      ]
    }
  };

  battlefield.terrain.leftY = battlefield.terrain.maxY - randomBetween(random, 18, 22);
  battlefield.terrain.rightY = battlefield.terrain.maxY - randomBetween(random, 18, 22);

  for (const castle of battlefield.castles) {
    castle.base_y = getTerrainY(battlefield, castle.left_x + battlefield.castleW / 2);
  }

  // Guarantee each gap hill blocks the direct line of sight between neighbouring castles.
  gapHills.forEach((gapHill, index) => {
    const leftCastle = castles[index]!;
    const rightCastle = castles[index + 1]!;
    const midpoint = (leftCastle.left_x + rightCastle.left_x + battlefield.castleW) / 2;
    const lineOfSightY = (leftCastle.base_y + rightCastle.base_y) / 2 - battlefield.castleH;
    const deficit = getTerrainY(battlefield, midpoint) - (lineOfSightY - 25);
    if (deficit <= 0) {
      return;
    }
    gapHill.hillHeight += deficit / hillContribution(midpoint, gapHill.hillCenter, gapHill.hillWidth, 1);
    if (index === mainHillIndex) {
      battlefield.terrain.hillHeight = gapHill.hillHeight;
    }
  });

  return battlefield;
}