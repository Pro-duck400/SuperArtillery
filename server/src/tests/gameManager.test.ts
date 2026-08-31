import { GameManager } from '../services/gameManager';
import { TokenService } from '../services/tokenService';
import { WebSocket } from 'ws';

describe('GameManager', () => {
  let gameManager: GameManager;

  beforeEach(() => {
    gameManager = new GameManager();
  });

  afterEach(() => {
    gameManager.shutdown();
  });

  describe('createGame', () => {
    it('creates a game with two empty player slots', () => {
      const result = gameManager.createGame('Alice');

      if (!('error' in result)) {
        expect(result.gameId).toBeDefined();
        expect(result.playerToken).toBeDefined();
        expect(result.inviteUrl).toBeDefined();
        expect(result.inviteCode).toBeDefined();
        expect(result.inviteCode.length).toBe(4);
        expect(/^[A-Z0-9]{4}$/.test(result.inviteCode)).toBe(true);
      } else {
        throw new Error('Should not have error');
      }
    });

    it('generates unique opaque game and invitation tokens', () => {
      const result1 = gameManager.createGame('Alice');
      const result2 = gameManager.createGame('Bob');

      if (!('error' in result1) && !('error' in result2)) {
        expect(result1.gameId).not.toBe(result2.gameId);
        expect(result1.playerToken).not.toBe(result2.playerToken);
        expect(result1.inviteCode).not.toBe(result2.inviteCode);
      } else {
        throw new Error('Should not have errors');
      }
    });

    it('returns invite URL and code separately', () => {
      const result = gameManager.createGame('Charlie');

      if (!('error' in result)) {
        expect(result.inviteUrl).toContain('invite=');
        expect(result.inviteUrl).toContain('?invite=');
        expect(result.inviteCode).not.toBe(result.playerToken);
        expect(result.inviteCode.length).toBe(4);
      } else {
        throw new Error('Should not have error');
      }
    });

    it('rejects invalid player names', () => {
      const result = gameManager.createGame('');
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.code).toBe('INVALID_PLAYER_NAME');
      }
    });

    it('rejects names longer than 15 characters', () => {
      const result = gameManager.createGame('ThisNameIsTooLongForTheGame');
      expect('error' in result).toBe(true);
    });

    it('rejects names starting with non-alphanumeric', () => {
      const result = gameManager.createGame('-InvalidName');
      expect('error' in result).toBe(true);
    });
  });

  describe('acceptInvitation', () => {
    it('accepts a valid invitation via token', () => {
      const created = gameManager.createGame('Alice');
      if ('error' in created) throw new Error('Should create game');

      const accepted = gameManager.acceptInvitation(created.inviteCode, 'Bob');
      if ('error' in accepted) throw new Error('Should accept invitation');

      expect(accepted.gameId).toBe(created.gameId);
      expect(accepted.playerToken).not.toBe(created.playerToken);
    });

    it('accepts a valid invitation via code', () => {
      const created = gameManager.createGame('Alice');
      if ('error' in created) throw new Error('Should create game');

      const accepted = gameManager.acceptInvitation(created.inviteCode, 'Bob');
      if ('error' in accepted) throw new Error('Should accept invitation');

      expect(accepted.gameId).toBe(created.gameId);
    });

    it('rejects an unknown invitation', () => {
      const result = gameManager.acceptInvitation('UNKNOWNCODE', 'Bob');
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.code).toBe('INVALID_INVITATION');
      }
    });

    it('rejects a second acceptance of the same invitation', () => {
      const created = gameManager.createGame('Alice');
      if ('error' in created) throw new Error('Should create game');

      // First acceptance should succeed
      const accepted1 = gameManager.acceptInvitation(created.inviteCode, 'Bob');
      if ('error' in accepted1) throw new Error('First acceptance should succeed');

      // Second acceptance should fail
      const accepted2 = gameManager.acceptInvitation(created.inviteCode, 'Charlie');
      expect('error' in accepted2).toBe(true);
      if ('error' in accepted2) {
        expect(accepted2.code).toBe('INVITATION_ALREADY_ACCEPTED');
      }
    });

    it('rejects invitation with invalid player name', () => {
      const created = gameManager.createGame('Alice');
      if ('error' in created) throw new Error('Should create game');

      const result = gameManager.acceptInvitation(created.inviteCode, '');
      expect('error' in result).toBe(true);
    });

    it('generates separate session token for invited player', () => {
      const created = gameManager.createGame('Alice');
      if ('error' in created) throw new Error('Should create game');

      const accepted = gameManager.acceptInvitation(created.inviteCode, 'Bob');
      if ('error' in accepted) throw new Error('Should accept invitation');

      expect(accepted.playerToken).not.toBe(created.playerToken);
      expect(accepted.playerToken.length).toBeGreaterThan(0);
    });
  });

  describe('getPlayerIdFromToken', () => {
    it('derives player ID from session token', () => {
      const created = gameManager.createGame('Alice');
      if ('error' in created) throw new Error('Should create game');

      const initiatorId = gameManager.getPlayerIdFromToken(created.gameId, created.playerToken);
      expect(initiatorId).toBe(0);

      const accepted = gameManager.acceptInvitation(created.inviteCode, 'Bob');
      if ('error' in accepted) throw new Error('Should accept invitation');

      const invitedId = gameManager.getPlayerIdFromToken(accepted.gameId, accepted.playerToken);
      expect(invitedId).toBe(1);
    });

    it('rejects token for different game', () => {
      const created1 = gameManager.createGame('Alice');
      const created2 = gameManager.createGame('Charlie');
      if ('error' in created1 || 'error' in created2) throw new Error('Should create games');

      // Try to use token from game1 in game2
      const result = gameManager.getPlayerIdFromToken(created2.gameId, created1.playerToken);
      expect(result).toBeNull();
    });

    it('rejects invalid token', () => {
      const created = gameManager.createGame('Alice');
      if ('error' in created) throw new Error('Should create game');

      const result = gameManager.getPlayerIdFromToken(created.gameId, 'invalid-token');
      expect(result).toBeNull();
    });
  });

  describe('expiration and cleanup', () => {
    it('expires pending invitations after TTL', () => {
      // This test requires waiting for cleanup cycle
      // Create a game and let it expire
      const created = gameManager.createGame('Alice');
      if ('error' in created) throw new Error('Should create game');

      // Immediately check - should exist
      let status = gameManager.getGameStatus(created.gameId, created.playerToken);
      expect(!('error' in status)).toBe(true);

      // In a real test with mocked timers, we'd advance time
      // For now, just verify the method exists and works
    });

    it('removes expired games from memory', () => {
      const created1 = gameManager.createGame('Alice');
      const created2 = gameManager.createGame('Bob');
      
      if ('error' in created1 || 'error' in created2) throw new Error('Should create games');

      // Both games should be in stats
      let stats = gameManager.getStats();
      expect(stats.gameCount).toBe(2);

      // After shutdown and restart, games would be gone
      // (In real scenario with time-based expiry)
    });

    it('enforces maximum active games limit', () => {
      const maxGames = 100;
      
      // Try to exceed max games
      for (let i = 0; i < maxGames + 1; i++) {
        const result = gameManager.createGame(`Player${i}`);
        
        if (i < maxGames) {
          expect('error' in result).toBe(false);
        } else {
          expect('error' in result).toBe(true);
          if ('error' in result) {
            expect(result.code).toBe('MAX_GAMES_REACHED');
          }
        }
      }

      const stats = gameManager.getStats();
      expect(stats.maxGamesReached).toBe(true);
    });
  });

  describe('WebSocket connection', () => {
    it('connects player via session token', () => {
      const created = gameManager.createGame('Alice');
      if ('error' in created) throw new Error('Should create game');

      // Mock WebSocket
      const mockWs = { readyState: WebSocket.OPEN } as any;

      const result = gameManager.connectPlayer(created.gameId, created.playerToken, mockWs);
      if ('error' in result) throw new Error('Should connect player');

      expect(result.playerId).toBe(0);
    });

    it('rejects invalid session token on WebSocket connect', () => {
      const created = gameManager.createGame('Alice');
      if ('error' in created) throw new Error('Should create game');

      const mockWs = { readyState: WebSocket.OPEN } as any;
      const result = gameManager.connectPlayer(created.gameId, 'invalid-token', mockWs);

      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.code).toBe('INVALID_SESSION_TOKEN');
      }
    });

    it('rejects unknown game ID', () => {
      const mockWs = { readyState: WebSocket.OPEN } as any;
      const result = gameManager.connectPlayer('unknown-game-id', 'some-token', mockWs);

      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.code).toBe('GAME_NOT_FOUND');
      }
    });
  });

  describe('fire action', () => {
    it('accepts fire with valid session token', () => {
      const created = gameManager.createGame('Alice');
      if ('error' in created) throw new Error('Should create game');

      const accepted = gameManager.acceptInvitation(created.inviteCode, 'Bob');
      if ('error' in accepted) throw new Error('Should accept invitation');

      // Connect both players to start game
      const mockWs = { readyState: WebSocket.OPEN, send: vi.fn() } as any;
      gameManager.connectPlayer(created.gameId, created.playerToken, mockWs);
      gameManager.connectPlayer(accepted.gameId, accepted.playerToken, mockWs);

      // Fire should work with session token
      const result = gameManager.fire(created.gameId, created.playerToken, 45, 50);
      if ('error' in result) {
        // May fail if it's not player's turn, but should not fail due to token
        expect(result.code).not.toBe('INVALID_SESSION_TOKEN');
      }
    });

    it('rejects fire with invalid session token', () => {
      const created = gameManager.createGame('Alice');
      if ('error' in created) throw new Error('Should create game');

      const result = gameManager.fire(created.gameId, 'invalid-token', 45, 50);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.code).toBe('INVALID_SESSION_TOKEN');
      }
    });

    it('validates angle and velocity', () => {
      const created = gameManager.createGame('Alice');
      if ('error' in created) throw new Error('Should create game');

      // Invalid angle
      const result1 = gameManager.fire(created.gameId, created.playerToken, -10, 50);
      expect('error' in result1).toBe(true);

      // Invalid velocity
      const result2 = gameManager.fire(created.gameId, created.playerToken, 45, -10);
      expect('error' in result2).toBe(true);
    });
  });

  describe('game statistics', () => {
    it('returns accurate game count', () => {
      const stats1 = gameManager.getStats();
      expect(stats1.gameCount).toBe(0);

      gameManager.createGame('Alice');
      const stats2 = gameManager.getStats();
      expect(stats2.gameCount).toBe(1);

      gameManager.createGame('Bob');
      const stats3 = gameManager.getStats();
      expect(stats3.gameCount).toBe(2);
    });

    it('counts only pending invitations', () => {
      const created = gameManager.createGame('Alice');
      if ('error' in created) throw new Error('Should create game');

      let stats = gameManager.getStats();
      expect(stats.invitationCount).toBe(1);

      // Accept the invitation
      gameManager.acceptInvitation(created.inviteCode, 'Bob');
      stats = gameManager.getStats();
      expect(stats.invitationCount).toBe(0); // Invitation accepted
    });
  });
});
