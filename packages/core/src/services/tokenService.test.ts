import { describe, expect, it } from 'vitest';
import { TokenService } from './tokenService';

describe('TokenService', () => {
  it('generates unique UUID game IDs and high-entropy session tokens', () => {
    const gameId = TokenService.generateGameId();
    expect(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(gameId)).toBe(true);
    expect(TokenService.generateGameId()).not.toBe(gameId);
    const token = TokenService.generateSessionToken();
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(TokenService.generateSessionToken()).not.toBe(token);
  });

  it('generates typeable invite codes from uppercase letters and non-zero digits', () => {
    const codes = new Set(Array.from({ length: 100 }, () => TokenService.generateInviteCode()));
    expect(codes.size).toBe(100);
    expect([...codes].every(code => /^[A-Z1-9]{4}$/.test(code))).toBe(true);
  });

  it('hashes tokens consistently and verifies matching values', () => {
    const hash = TokenService.hashToken('test-token');
    expect(TokenService.hashToken('test-token')).toBe(hash);
    expect(/^[a-f0-9]{64}$/.test(hash)).toBe(true);
    expect(TokenService.verifyToken('test-token', hash)).toBe(true);
    expect(TokenService.verifyToken('different-token', hash)).toBe(false);
    expect(TokenService.verifyToken('', hash)).toBe(false);
  });

  it('validates and normalizes player names', () => {
    expect(TokenService.validatePlayerName('Alice').isValid).toBe(true);
    expect(TokenService.validatePlayerName('My Player').isValid).toBe(true);
    expect(TokenService.validatePlayerName('').isValid).toBe(false);
    expect(TokenService.validatePlayerName('!Alice').isValid).toBe(false);
    expect(TokenService.validatePlayerName('ThisNameIsTooLong').isValid).toBe(false);
    expect(TokenService.validatePlayerName(null as unknown as string).isValid).toBe(false);
    expect(TokenService.normalizeName('  Alice  ')).toBe('Alice');
    expect(TokenService.normalizeName('')).toBeNull();
  });
});