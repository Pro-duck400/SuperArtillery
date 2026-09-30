import { encodeBase64 } from '../crypto/base64';
import { randomBytes, randomUuid } from '../crypto/random';
import { sha256Hex } from '../crypto/sha256';

export class TokenService {
  public static readonly INVITE_CODE_LENGTH = 4;

  static generateGameId(): string {
    return randomUuid();
  }

  static generateSessionToken(): string {
    return encodeBase64(randomBytes(32));
  }

  static generateInviteCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';
    const charBytes = randomBytes(TokenService.INVITE_CODE_LENGTH);
    let code = '';
    for (let index = 0; index < TokenService.INVITE_CODE_LENGTH; index++) {
      code += chars[charBytes[index]! % chars.length];
    }
    return code;
  }

  static hashToken(token: string): string {
    return sha256Hex(token);
  }

  static verifyToken(plainToken: string, storedHash: string): boolean {
    const plainHash = TokenService.hashToken(plainToken);
    if (plainHash.length !== storedHash.length) return false;
    let result = 0;
    for (let index = 0; index < plainHash.length; index++) {
      result |= plainHash.charCodeAt(index) ^ storedHash.charCodeAt(index);
    }
    return result === 0;
  }

  static validatePlayerName(name: string): { isValid: boolean; error?: string } {
    if (!name || typeof name !== 'string') return { isValid: false, error: 'Player name is required' };
    const trimmed = name.trim();
    if (trimmed.length === 0) return { isValid: false, error: 'Player name cannot be empty' };
    if (trimmed.length > 15) return { isValid: false, error: 'Player name must be 15 characters or less' };
    if (!/^[a-zA-Z0-9]$/.test(trimmed[0]!)) {
      return { isValid: false, error: 'Player name must start with a letter or number' };
    }
    return { isValid: true };
  }

  static normalizeName(name: string): string | null {
    return TokenService.validatePlayerName(name).isValid ? name.trim() : null;
  }
}