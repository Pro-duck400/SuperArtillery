import { describe, expect, it } from 'vitest';
import type { GameMessage } from '../contract/messages';
import type { PlayerConnection } from '../ports/player-connection';
import { GameEngine } from './gameEngine';
import { InMemoryGameRepository } from './gameRepository';
import { createBattlefield } from '../utils/battlefield';

function createConnection(messages: GameMessage[]): PlayerConnection {
  return {
    isOpen: () => true,
    send: message => messages.push(message),
    close: () => {}
  };
}

function flattenBattlefield(seed: number, playerIds: number[]) {
  const battlefield = createBattlefield(seed, playerIds);
  battlefield.terrain.hillHeight = 0;
  battlefield.terrain.leftY = battlefield.groundY;
  battlefield.terrain.rightY = battlefield.groundY;
  battlefield.castles.forEach(castle => { castle.base_y = battlefield.groundY; });
  return battlefield;
}

describe('GameEngine', () => {
  it('creates a local game and starts it through the PlayerConnection port', () => {
    const engine = new GameEngine();
    const created = engine.createLocalGame(['Alice', 'Bob', 'Charlie']);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const messages: GameMessage[] = [];
    const connected = engine.connect(created.value.gameId, created.value.players[0]!.playerToken, createConnection(messages));
    expect(connected).toEqual({ ok: true, value: { playerId: 0 } });
    expect(messages.map(message => message.type)).toEqual(['game_start', 'turn_change']);
    expect(engine.getGameStatus(created.value.gameId, created.value.players[0]!.playerToken)).toMatchObject({
      ok: true,
      value: { status: 'active', playersConnected: 3, required: 3 }
    });
    engine.shutdown();
  });

  it('returns domain errors for invalid operations without transport status codes', () => {
    const engine = new GameEngine();
    expect(engine.createLocalGame(['', 'Bob'])).toMatchObject({
      ok: false,
      error: { code: 'INVALID_PLAYER_NAME' }
    });
    expect(engine.connect('missing', 'token', createConnection([]))).toMatchObject({
      ok: false,
      error: { code: 'GAME_NOT_FOUND' }
    });
    engine.shutdown();
  });

  it('broadcasts shot and turn-change messages and advances the active turn', () => {
    const engine = new GameEngine();
    const created = engine.createLocalGame(['Alice', 'Bob']);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const messages: GameMessage[] = [];
    engine.connect(created.value.gameId, created.value.players[0]!.playerToken, createConnection(messages));

    const fired = engine.fire(created.value.gameId, created.value.players[0]!.playerToken, 45, 30);
    expect(fired).toEqual({ ok: true, value: { success: true } });
    expect(messages.slice(-2).map(message => message.type)).toEqual(['shot', 'turn_change']);
    expect(engine.getGameStatus(created.value.gameId, created.value.players[0]!.playerToken)).toMatchObject({
      ok: true,
      value: { status: 'active' }
    });
    engine.shutdown();
  });

  it('starts a rematch once every local player has answered', () => {
    const games = new InMemoryGameRepository();
    const engine = new GameEngine({ games });
    const created = engine.createLocalGame(['Alice', 'Bob']);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const messages: GameMessage[] = [];
    const connection = createConnection(messages);
    engine.connect(created.value.gameId, created.value.players[0]!.playerToken, connection);
    const game = games.get(created.value.gameId)!;
    game.status = 'finished';
    game.gameFinishedAt = 100;

    const waiting = engine.requestRematch(created.value.gameId, created.value.players[0]!.playerToken);
    expect(waiting).toMatchObject({ ok: true, value: { answered: 1, roundStarted: false } });
    const started = engine.requestRematch(created.value.gameId, created.value.players[1]!.playerToken);
    expect(started).toMatchObject({ ok: true, value: { answered: 2, roundStarted: true } });
    expect(game.status).toBe('active');
    expect(game.round).toBe(2);
    expect(messages.slice(-3).map(message => message.type)).toEqual(['rematch_status', 'game_start', 'turn_change']);
    engine.shutdown();
  });

  it('creates an internet game with a path-preserving invitation URL and player slots', () => {
    const engine = new GameEngine();
    const created = engine.createGame(' Alice ', 'https://example.test/play/app', 'https://api.example.test', 3);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.playerCount).toBe(3);
    expect(created.value.inviteUrl).toContain('/play/app/?');
    expect(created.value.inviteUrl).toContain('server=https%3A%2F%2Fapi.example.test');
    expect(created.value.inviteUrl).toContain(`invite=${created.value.inviteCode}`);
    engine.shutdown();
  });

  it('generates unique opaque game IDs, invite codes, and player tokens', () => {
    const engine = new GameEngine();
    const created = Array.from({ length: 12 }, (_, index) => engine.createGame(`Player${index}`));
    expect(created.every(result => result.ok)).toBe(true);
    const values = created.flatMap(result => result.ok ? [result.value] : []);
    expect(new Set(values.map(value => value.gameId)).size).toBe(values.length);
    expect(new Set(values.map(value => value.inviteCode)).size).toBe(values.length);
    expect(new Set(values.map(value => value.playerToken)).size).toBe(values.length);
    expect(values.every(value => value.inviteCode.length === 4 && /^[A-Z1-9]+$/.test(value.inviteCode))).toBe(true);
    engine.shutdown();
  });

  it('rejects internet and local games outside the supported player-count range', () => {
    const engine = new GameEngine();
    expect(engine.createGame('Alice', undefined, undefined, 1)).toMatchObject({ ok: false, error: { code: 'INVALID_PLAYER_COUNT' } });
    expect(engine.createGame('Alice', undefined, undefined, 10)).toMatchObject({ ok: false, error: { code: 'INVALID_PLAYER_COUNT' } });
    expect(engine.createLocalGame(['Alice'])).toMatchObject({ ok: false, error: { code: 'INVALID_PLAYER_COUNT' } });
    expect(engine.createLocalGame(Array.from({ length: 10 }, (_, index) => `Player${index}`))).toMatchObject({ ok: false, error: { code: 'INVALID_PLAYER_COUNT' } });
    engine.shutdown();
  });

  it('allocates multiple invited players and rejects invite reuse', () => {
    const engine = new GameEngine();
    const created = engine.createGame('Alice', 'https://example.test', 'https://api.example.test', 3);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const first = engine.acceptInvitation(created.value.inviteCode, 'Bob');
    const second = engine.acceptInvitation(created.value.inviteCode, 'Charlie');
    const reused = engine.acceptInvitation(created.value.inviteCode, 'Dana');
    expect(first).toMatchObject({ ok: true, value: { playerId: 1 } });
    expect(second).toMatchObject({ ok: true, value: { playerId: 2 } });
    expect(reused).toMatchObject({ ok: false, error: { code: 'LOBBY_FULL' } });
    engine.shutdown();
  });

  it('rejects unknown invitations and invalid names', () => {
    const engine = new GameEngine();
    expect(engine.acceptInvitation('NOPE', 'Bob')).toMatchObject({ ok: false, error: { code: 'INVALID_INVITATION' } });
    expect(engine.acceptInvitation(undefined, 'Bob')).toMatchObject({ ok: false, error: { code: 'MISSING_INVITE' } });
    expect(engine.createGame('!Alice')).toMatchObject({ ok: false, error: { code: 'INVALID_PLAYER_NAME' } });
    expect(engine.createLocalGame(['Alice', 'x'.repeat(16)])).toMatchObject({ ok: false, error: { code: 'INVALID_PLAYER_NAME' } });
    engine.shutdown();
  });

  it('expires invitations and removes expired games through the injected scheduler', () => {
    const games = new InMemoryGameRepository();
    let now = 100;
    let cleanup: (() => void) | undefined;
    const engine = new GameEngine({
      games,
      clock: { now: () => now },
      timerScheduler: {
        setInterval: callback => { cleanup = callback; return 1; },
        clearInterval: () => {}
      }
    });
    const created = engine.createGame('Alice');
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    now += 30 * 60 * 1000 + 1;
    expect(engine.acceptInvitation(created.value.inviteCode, 'Bob')).toMatchObject({
      ok: false,
      error: { code: 'INVITATION_EXPIRED' }
    });
    cleanup?.();
    expect(games.size).toBe(0);
    engine.shutdown();
  });

  it('waits for every invited player, then broadcasts a full multi-player roster', () => {
    const engine = new GameEngine();
    const created = engine.createGame('Alice', 'https://example.test', 'https://api.example.test', 3);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const bob = engine.acceptInvitation(created.value.inviteCode, 'Bob');
    const charlie = engine.acceptInvitation(created.value.inviteCode, 'Charlie');
    expect(bob.ok && charlie.ok).toBe(true);
    if (!bob.ok || !charlie.ok) return;
    const messages: GameMessage[][] = [[], [], []];
    const players = [created.value.playerToken, bob.value.playerToken, charlie.value.playerToken];
    players.forEach((token, index) => engine.connect(created.value.gameId, token, createConnection(messages[index]!)));
    expect(messages.map(batch => batch.filter(message => message.type === 'game_start').length)).toEqual([1, 1, 1]);
    const startMessage = messages[0]!.find(message => message.type === 'game_start');
    expect(startMessage?.type === 'game_start' ? startMessage.players.map(player => player.name) : []).toEqual(['Alice', 'Bob', 'Charlie']);
    engine.shutdown();
  });

  it('allows the creator to skip waiting slots after two players connect', () => {
    const engine = new GameEngine();
    const created = engine.createGame('Alice', 'https://example.test', 'https://api.example.test', 3);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const bob = engine.acceptInvitation(created.value.inviteCode, 'Bob');
    expect(bob.ok).toBe(true);
    if (!bob.ok) return;
    engine.connect(created.value.gameId, created.value.playerToken, createConnection([]));
    engine.connect(created.value.gameId, bob.value.playerToken, createConnection([]));
    expect(engine.skipWaiting(created.value.gameId, created.value.playerToken)).toMatchObject({
      ok: true,
      value: { started: true, playersConnected: 2, slots: [{ playerId: 0, status: 'ready' }, { playerId: 1, status: 'ready' }] }
    });
    engine.shutdown();
  });

  it('scopes session tokens to a game and supports status before connecting', () => {
    const engine = new GameEngine();
    const first = engine.createGame('Alice');
    const second = engine.createGame('Carol');
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(engine.getPlayerIdFromToken(first.value.gameId, first.value.playerToken)).toBe(0);
    expect(engine.getPlayerIdFromToken(second.value.gameId, first.value.playerToken)).toBeNull();
    expect(engine.getPlayerIdFromToken(first.value.gameId, 'invalid')).toBeNull();
    expect(engine.fire(first.value.gameId, second.value.playerToken, 45, 30)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_SESSION_TOKEN' }
    });
    expect(engine.getGameStatus(first.value.gameId, first.value.playerToken)).toMatchObject({
      ok: true,
      value: { status: 'pending', playersConnected: 0 }
    });
    engine.shutdown();
  });

  it('creates two empty invitation slots and issues a distinct token to the invited player', () => {
    const engine = new GameEngine();
    const created = engine.createGame('Alice');
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const accepted = engine.acceptInvitation(created.value.inviteCode, 'Bob');
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.value.playerToken).not.toBe(created.value.playerToken);
    expect(accepted.value.playerId).toBe(1);
    expect(engine.getGameStatus(created.value.gameId, created.value.playerToken)).toMatchObject({
      ok: true,
      value: { slots: [{ playerId: 0, name: 'Alice' }, { playerId: 1, name: 'Bob' }] }
    });
    engine.shutdown();
  });

  it('expires pending and active network games when their controlling player disconnects', () => {
    const engine = new GameEngine();
    const pending = engine.createGame('Alice');
    expect(pending.ok).toBe(true);
    if (!pending.ok) return;
    const pendingConnection = createConnection([]);
    engine.connect(pending.value.gameId, pending.value.playerToken, pendingConnection);
    engine.disconnect(pending.value.gameId, 0, pendingConnection);
    expect(engine.getGameStatus(pending.value.gameId, pending.value.playerToken)).toMatchObject({
      ok: true,
      value: { status: 'expired' }
    });
    expect(engine.acceptInvitation(pending.value.inviteCode, 'Bob')).toMatchObject({
      ok: false,
      error: { code: 'GAME_UNAVAILABLE' }
    });

    const active = engine.createGame('Carol');
    expect(active.ok).toBe(true);
    if (!active.ok) return;
    const invited = engine.acceptInvitation(active.value.inviteCode, 'Dana');
    expect(invited.ok).toBe(true);
    if (!invited.ok) return;
    const creatorConnection = createConnection([]);
    const invitedConnection = createConnection([]);
    engine.connect(active.value.gameId, active.value.playerToken, creatorConnection);
    engine.connect(active.value.gameId, invited.value.playerToken, invitedConnection);
    engine.disconnect(active.value.gameId, 1, invitedConnection);
    expect(engine.getGameStatus(active.value.gameId, active.value.playerToken)).toMatchObject({
      ok: true,
      value: { status: 'finished' }
    });
    engine.shutdown();
  });

  it('rejects unknown games and invalid session tokens when connecting', () => {
    const engine = new GameEngine();
    expect(engine.connect('unknown', 'token', createConnection([]))).toMatchObject({ ok: false, error: { code: 'GAME_NOT_FOUND' } });
    const created = engine.createGame('Alice');
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(engine.connect(created.value.gameId, 'invalid', createConnection([]))).toMatchObject({ ok: false, error: { code: 'INVALID_SESSION_TOKEN' } });
    engine.shutdown();
  });

  it('ignores a stale connection closing after a replacement connects', () => {
    const engine = new GameEngine();
    const created = engine.createGame('Alice');
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const bob = engine.acceptInvitation(created.value.inviteCode, 'Bob');
    expect(bob.ok).toBe(true);
    if (!bob.ok) return;
    const firstConnection = createConnection([]);
    const replacement = createConnection([]);
    const otherPlayer = createConnection([]);
    engine.connect(created.value.gameId, created.value.playerToken, firstConnection);
    engine.connect(created.value.gameId, created.value.playerToken, replacement);
    engine.connect(created.value.gameId, bob.value.playerToken, otherPlayer);
    engine.disconnect(created.value.gameId, 0, firstConnection);
    expect(engine.getGameStatus(created.value.gameId, created.value.playerToken)).toMatchObject({
      ok: true,
      value: { status: 'active', playersConnected: 2 }
    });
    engine.shutdown();
  });

  it('validates authenticated turns, angle and velocity before broadcasting', () => {
    const engine = new GameEngine();
    const created = engine.createLocalGame(['Alice', 'Bob']);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const messages: GameMessage[] = [];
    engine.connect(created.value.gameId, created.value.players[0]!.playerToken, createConnection(messages));
    expect(engine.fire(created.value.gameId, created.value.players[1]!.playerToken, 45, 30)).toMatchObject({ ok: false, error: { code: 'NOT_YOUR_TURN' } });
    expect(engine.fire(created.value.gameId, created.value.players[0]!.playerToken, 100, 30)).toMatchObject({ ok: false, error: { code: 'INVALID_ANGLE' } });
    expect(engine.fire(created.value.gameId, created.value.players[0]!.playerToken, 45, 20)).toMatchObject({ ok: false, error: { code: 'INVALID_VELOCITY' } });
    expect(engine.fire(created.value.gameId, 'invalid', 45, 30)).toMatchObject({ ok: false, error: { code: 'INVALID_SESSION_TOKEN' } });
    expect(messages.map(message => message.type)).toEqual(['game_start', 'turn_change']);
    engine.shutdown();
  });

  it('broadcasts game over and identifies the last surviving player', () => {
    const games = new InMemoryGameRepository();
    const engine = new GameEngine({ games });
    const created = engine.createLocalGame(['Alice', 'Bob']);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const messages: GameMessage[] = [];
    engine.connect(created.value.gameId, created.value.players[0]!.playerToken, createConnection(messages));
    const game = games.get(created.value.gameId)!;
    game.battlefield = flattenBattlefield(1, [0, 1]);
    expect(engine.fire(created.value.gameId, created.value.players[0]!.playerToken, 0, 900)).toEqual({
      ok: true,
      value: { success: true }
    });
    expect(messages.at(-1)).toMatchObject({ type: 'game_over', winnerId: 0 });
    expect(game.status).toBe('finished');
    engine.shutdown();
  });

  it('ends a hot-seat match when its single device disconnects', () => {
    const games = new InMemoryGameRepository();
    const engine = new GameEngine({ games });
    const created = engine.createLocalGame(['Alice', 'Bob']);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const connection = createConnection([]);
    engine.connect(created.value.gameId, created.value.players[0]!.playerToken, connection);
    engine.disconnect(created.value.gameId, 0, connection);
    expect(games.get(created.value.gameId)?.status).toBe('finished');
    engine.shutdown();
  });

  it('starts a nine-player hot-seat match from a single connected device', () => {
    const engine = new GameEngine();
    const created = engine.createLocalGame(Array.from({ length: 9 }, (_, index) => `Player${index}`));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const messages: GameMessage[] = [];
    engine.connect(created.value.gameId, created.value.players[0]!.playerToken, createConnection(messages));
    const start = messages.find(message => message.type === 'game_start');
    expect(start?.type === 'game_start' ? start.players : []).toHaveLength(9);
    expect(engine.getGameStatus(created.value.gameId, created.value.players[8]!.playerToken)).toMatchObject({
      ok: true,
      value: { status: 'active', playersConnected: 9, required: 9 }
    });
    engine.shutdown();
  });

  it('alternates authenticated turns between the local players', () => {
    const engine = new GameEngine();
    const created = engine.createLocalGame(['Alice', 'Bob']);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const messages: GameMessage[] = [];
    engine.connect(created.value.gameId, created.value.players[0]!.playerToken, createConnection(messages));
    expect(engine.fire(created.value.gameId, created.value.players[0]!.playerToken, 45, 30).ok).toBe(true);
    expect(engine.fire(created.value.gameId, created.value.players[1]!.playerToken, 45, 30).ok).toBe(true);
    expect(engine.getGameStatus(created.value.gameId, created.value.players[0]!.playerToken)).toMatchObject({
      ok: true,
      value: { status: 'active' }
    });
    expect(messages.filter(message => message.type === 'turn_change').at(-1)).toMatchObject({ turnId: 0 });
    engine.shutdown();
  });

  it('retains final rematch answers in the broadcast and counts device rematches', () => {
    const games = new InMemoryGameRepository();
    const engine = new GameEngine({ games });
    const created = engine.createLocalGame(['Alice', 'Bob']);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const messages: GameMessage[] = [];
    engine.connect(created.value.gameId, created.value.players[0]!.playerToken, createConnection(messages));
    const game = games.get(created.value.gameId)!;
    game.status = 'finished';
    game.gameFinishedAt = 100;
    engine.requestRematch(created.value.gameId, created.value.players[0]!.playerToken);
    const result = engine.requestRematch(created.value.gameId, created.value.players[1]!.playerToken);
    expect(result).toMatchObject({ ok: true, value: { roundStarted: true } });
    const finalStatus = messages.filter(message => message.type === 'rematch_status').at(-1);
    expect(finalStatus).toMatchObject({
      players: [{ answer: 'play_again' }, { answer: 'play_again' }]
    });
    expect(engine.getStats().totals.device.rematches).toBe(1);
    engine.shutdown();
  });

  it('counts only pending games that still have invitations outstanding', () => {
    const engine = new GameEngine();
    const created = engine.createGame('Alice', 'https://example.test', 'https://api.example.test', 3);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    engine.acceptInvitation(created.value.inviteCode, 'Bob');
    expect(engine.getStats()).toMatchObject({ games: 1, invites: 1, totals: { internet: { games: 1 } } });
    engine.shutdown();
  });

  it('reports current game counts and invitation totals', () => {
    const engine = new GameEngine();
    const first = engine.createGame('Alice');
    const second = engine.createGame('Bob');
    expect(first.ok && second.ok).toBe(true);
    expect(engine.getStats()).toMatchObject({ games: 2, invites: 2 });
    engine.shutdown();
  });

  it('enforces the maximum active-game capacity', () => {
    const engine = new GameEngine();
    for (let index = 0; index < 100; index += 1) engine.createGame(`Player${index}`);
    expect(engine.createGame('LastPlayer')).toMatchObject({ ok: false, error: { code: 'MAX_GAMES_REACHED' } });
    expect(engine.getStats().maxReached).toBe(true);
    engine.shutdown();
  });
});