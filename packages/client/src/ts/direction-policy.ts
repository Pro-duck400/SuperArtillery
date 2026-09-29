import type { BattlefieldConfig } from './types/messages';

export interface DirectionPolicy {
  visible: boolean;
  defaultDirection?: 'Left' | 'Right';
}

export function getDirectionPolicy(
  battlefield: BattlefieldConfig | null,
  playerId: number | null
): DirectionPolicy {
  if (!battlefield || playerId === null || battlefield.castles.length === 0) {
    return { visible: false };
  }
  const leftmostPlayerId = battlefield.castles[0]!.playerId;
  const rightmostPlayerId = battlefield.castles[battlefield.castles.length - 1]!.playerId;
  if (playerId === leftmostPlayerId) return { visible: false, defaultDirection: 'Right' };
  if (playerId === rightmostPlayerId) return { visible: false, defaultDirection: 'Left' };
  return { visible: true };
}