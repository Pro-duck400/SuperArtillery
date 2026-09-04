import type { Battlefield } from '../types/messages';
import { getTerrainY } from './battlefield';
import { calculateVelocityComponents, checkCastleCollision, checkTerrainCollision } from './physics';

export function calculateCastleHitTime(
  battlefield: Battlefield,
  playerId: 0 | 1,
  angle: number,
  velocity: number
): number | null {
  const targetPlayerId = playerId === 0 ? 1 : 0;
  const targetCastle = battlefield.castles[targetPlayerId];
  const firingCastle = battlefield.castles[playerId];
  const adjustedAngle = playerId === 1 ? 180 - angle : angle;
  const { vx, vy } = calculateVelocityComponents(adjustedAngle, velocity);
  const x0 = firingCastle.left_x + battlefield.castleWidth / 2;
  const y0 = firingCastle.base_y - battlefield.castleHeight;

  const castleHitTime = checkCastleCollision(
    x0,
    y0,
    vx,
    vy,
    battlefield.gravity,
    battlefield.wind,
    targetCastle.left_x + battlefield.castleWidth / 2,
    battlefield.castleWidth,
    battlefield.castleHeight,
    targetCastle.base_y
  );
  const terrainHitTime = checkTerrainCollision(
    x0,
    y0,
    vx,
    vy,
    battlefield.gravity,
    battlefield.wind,
    (x) => getTerrainY(battlefield, x),
    battlefield.canvasWidth
  );

  if (castleHitTime === null) return null;
  if (terrainHitTime !== null && terrainHitTime < castleHitTime) return null;
  return castleHitTime;
}
