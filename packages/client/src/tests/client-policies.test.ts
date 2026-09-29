import { describe, expect, it } from 'vitest';
import { getDirectionPolicy } from '../ts/direction-policy';
import { parseInviteInput, parseInviteLink } from '../ts/invite-link';
import { createRosterPositions, createRosterView } from '../ts/roster-view';
import { getDefaultServerAddress, resolveServerBaseUrls } from '../ts/server-address';
import type { BattlefieldConfig } from '../ts/types/messages';

const battlefield = {
  width: 600,
  height: 300,
  gravity: 100,
  wind: 0,
  groundY: 280,
  castleW: 10,
  castleH: 10,
  castles: [
    { playerId: 0, left_x: 20, base_y: 280 },
    { playerId: 1, left_x: 280, base_y: 280 },
    { playerId: 2, left_x: 550, base_y: 280 }
  ],
  terrain: {
    version: 3,
    seed: 1,
    sampleWidth: 2,
    minY: 0,
    maxY: 280,
    hillCenter: 300,
    hillWidth: 100,
    hillHeight: 0
  }
} as BattlefieldConfig;

describe('client policies', () => {
  it('chooses the local or hosted default server address', () => {
    expect(getDefaultServerAddress(undefined, 'localhost')).toBe('http://localhost:3000');
    expect(getDefaultServerAddress(undefined, 'game.example.test')).toBe('https://superartillery-server-production.up.railway.app');
    expect(getDefaultServerAddress('https://api.example.test', 'localhost')).toBe('https://api.example.test');
  });

  it('resolves API and WebSocket origins from an address', () => {
    expect(resolveServerBaseUrls('https://api.example.test/path', 'http://localhost:3000')).toEqual({
      apiBaseUrl: 'https://api.example.test',
      wsBaseUrl: 'wss://api.example.test'
    });
    expect(resolveServerBaseUrls(' ', 'http://localhost:3000')).toEqual({
      apiBaseUrl: 'http://localhost:3000',
      wsBaseUrl: 'ws://localhost:3000'
    });
  });

  it('parses invite codes and optional server addresses from links', () => {
    expect(parseInviteInput(' https://game.test/?invite=AB%20CD ')).toBe('AB CD');
    expect(parseInviteLink('?invite=ABCD&server=https%3A%2F%2Fapi.test')).toEqual({
      inviteCode: 'ABCD',
      serverAddress: 'https://api.test'
    });
    expect(parseInviteLink('')).toEqual({ inviteCode: null, serverAddress: null });
  });

  it('shows a direction selector only for interior players', () => {
    expect(getDirectionPolicy(battlefield, 0)).toEqual({ visible: false, defaultDirection: 'Right' });
    expect(getDirectionPolicy(battlefield, 1)).toEqual({ visible: true });
    expect(getDirectionPolicy(battlefield, 2)).toEqual({ visible: false, defaultDirection: 'Left' });
    expect(getDirectionPolicy(null, 0)).toEqual({ visible: false });
  });

  it('builds roster labels and positions while retaining temporarily defeated players', () => {
    const players = [
      { playerId: 0, name: 'Alice', active: false, connected: true },
      { playerId: 1, name: 'Bob', active: true, connected: true }
    ];
    expect(createRosterView(players, [0])).toEqual([
      { playerId: 0, name: 'Alice', active: true },
      { playerId: 1, name: 'Bob', active: true }
    ]);
    expect(createRosterPositions(players, playerId => ({ x: playerId * 10, y: 4 }))).toEqual(new Map([
      [0, { x: 0, y: 4 }],
      [1, { x: 10, y: 4 }]
    ]));
  });
});