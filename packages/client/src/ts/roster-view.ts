import type { PlayerState } from './types/messages';

export interface RosterViewPlayer {
  playerId: number;
  name: string;
  active: boolean;
}

export function createRosterView(
  players: PlayerState[],
  temporarilyActivePlayerIds: readonly number[] = []
): RosterViewPlayer[] {
  return players.map(player => ({
    playerId: player.playerId,
    name: player.name,
    active: player.active || temporarilyActivePlayerIds.includes(player.playerId)
  }));
}

export function createRosterPositions<T>(
  players: Array<{ playerId: number }>,
  getPosition: (playerId: number) => T
): Map<number, T> {
  return new Map(players.map(player => [player.playerId, getPosition(player.playerId)]));
}