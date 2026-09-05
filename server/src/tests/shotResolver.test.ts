import { describe, expect, it } from 'vitest';
import { createBattlefield } from '../utils/battlefield';
import { checkCastleCollision } from '../utils/physics';
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

  it('requires the projectile to enter the central 80 percent of the castle', () => {
    const centerHit = checkCastleCollision(
      0, 95, 100, 0, 0, 0, 100, 10, 10, 100
    );
    const borderMiss = checkCastleCollision(
      0, 90, 100, 0, 0, 0, 100, 10, 10, 100
    );

    expect(centerHit).not.toBeNull();
    expect(borderMiss).toBeNull();
  });

  it('does not count a corner touch as a castle hit', () => {
    const cornerTouch = checkCastleCollision(
      0, 90, 100, 0, 0, 0, 100, 10, 10, 100
    );

    expect(cornerTouch).toBeNull();
  });
});
