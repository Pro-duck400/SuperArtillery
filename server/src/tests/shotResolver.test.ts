import { describe, expect, it } from 'vitest';
import { createBattlefield } from '../utils/battlefield';
import { calculateCastleHitTime } from '../utils/shotResolver';

function createFlatBattlefield() {
  const battlefield = createBattlefield(1);
  battlefield.terrain.hillHeight = 0;
  battlefield.terrain.leftY = battlefield.groundY;
  battlefield.terrain.rightY = battlefield.groundY;
  battlefield.castles[0].base_y = battlefield.groundY;
  battlefield.castles[1].base_y = battlefield.groundY;
  return battlefield;
}

describe('calculateCastleHitTime', () => {
  it('resolves a hit using the canonical battlefield', () => {
    const battlefield = createFlatBattlefield();

    const hitTime = calculateCastleHitTime(battlefield, 0, 0, 550);

    expect(hitTime).not.toBeNull();
    expect(hitTime).toBeGreaterThan(0);
  });

  it('keeps player one firing toward the left castle', () => {
    const battlefield = createFlatBattlefield();

    const hitTime = calculateCastleHitTime(battlefield, 1, 0, 550);

    expect(hitTime).not.toBeNull();
    expect(hitTime).toBeGreaterThan(0);
  });

  it('returns no collision for a projectile that falls short', () => {
    const battlefield = createFlatBattlefield();

    const hitTime = calculateCastleHitTime(battlefield, 0, 45, 10);

    expect(hitTime).toBeNull();
  });
});
