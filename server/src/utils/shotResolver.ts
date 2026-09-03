import type { Battlefield } from '../types/messages';
import { calculateVelocityComponents, checkCastleCollision } from './physics';

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
  const y0 = battlefield.groundY - battlefield.castleHeight;

  return checkCastleCollision(
    x0,
    y0,
    vx,
    vy,
    battlefield.gravity,
    targetCastle.left_x + battlefield.castleWidth / 2,
    battlefield.castleWidth,
    battlefield.castleHeight,
    battlefield.groundY
  );
}
