import type { Battlefield } from '../types/messages';

export function createBattlefield(): Battlefield {
  return {
    canvasWidth: 280,
    canvasHeight: 160,
    gravity: 100,
    groundY: 140,
    castleWidth: 10,
    castleHeight: 10,
    castles: [
      { playerId: 0, left_x: 20 },
      { playerId: 1, left_x: 250 }
    ]
  };
}
