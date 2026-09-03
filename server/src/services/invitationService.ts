import type {
  AcceptInvitationResponse,
  CreateGameResponse,
  PrivateGame
} from '../types/private-game';
import { TokenService } from './tokenService';
import type { GameRepository } from './gameRepository';
import { GAME_CONFIG } from './gameConfig';
import { GAME_ERROR_CODES, GAME_ERROR_MESSAGES } from './gameErrors';

export type InvitationResult<T> = T | { error: string; code: string };

export class InvitationService {
  constructor(
    private readonly games: GameRepository,
    private readonly defaultClientOrigin: string
  ) {}

  public createGame(
    playerName: string,
    clientOrigin: string,
    now: number = Date.now()
  ): InvitationResult<CreateGameResponse> {
    const normalizedName = TokenService.normalizeName(playerName);
    if (!normalizedName) {
      return this.error('INVALID_PLAYER_NAME');
    }

    const gameId = TokenService.generateGameId();
    const sessionToken = TokenService.generateSessionToken();
    const inviteToken = TokenService.generateInviteToken();
    const inviteCode = TokenService.generateInviteCode();
    const expiresAt = now + GAME_CONFIG.invitationTtlMs;

    const game: PrivateGame = {
      id: gameId,
      status: 'pending',
      createdAt: now,
      expiresAt,
      lastActivityAt: now,
      invitation: {
        invitationTokenHash: TokenService.hashToken(inviteToken),
        inviteCode,
        inviteCodeHash: TokenService.hashToken(inviteCode),
        expiresAt,
        accepted: false
      },
      initiator: {
        name: normalizedName,
        sessionTokenHash: TokenService.hashToken(sessionToken),
        websocket: null
      },
      invited: {
        name: null,
        sessionTokenHash: '',
        websocket: null
      },
      currentTurn: 0,
      gameStarted: false
    };

    this.games.set(game);

    return {
      gameId,
      playerToken: sessionToken,
      inviteUrl: this.createInviteUrl(clientOrigin || this.defaultClientOrigin, inviteToken),
      inviteCode
    };
  }

  public acceptInvitation(
    inviteTokenOrCode: string | undefined,
    playerName: string,
    now: number = Date.now()
  ): InvitationResult<AcceptInvitationResponse> {
    const normalizedName = TokenService.normalizeName(playerName);
    if (!normalizedName) {
      return this.error('INVALID_PLAYER_NAME');
    }

    if (!inviteTokenOrCode) {
      return this.error('MISSING_INVITE');
    }

    const game = this.findGame(inviteTokenOrCode);
    if (!game) {
      return this.error('INVALID_INVITATION');
    }

    if (game.invitation.accepted) {
      return this.error('INVITATION_ALREADY_ACCEPTED');
    }

    if (game.invitation.expiresAt < now) {
      game.status = 'expired';
      return this.error('INVITATION_EXPIRED');
    }

    if (game.status !== 'pending') {
      return this.error('GAME_UNAVAILABLE');
    }

    const sessionToken = TokenService.generateSessionToken();
    game.invitation.accepted = true;
    game.invited.name = normalizedName;
    game.invited.sessionTokenHash = TokenService.hashToken(sessionToken);

    return {
      gameId: game.id,
      playerToken: sessionToken
    };
  }

  private findGame(inviteTokenOrCode: string): PrivateGame | undefined {
    const tokenHash = TokenService.hashToken(
      inviteTokenOrCode.length === TokenService.INVITE_CODE_LENGTH
        ? inviteTokenOrCode.toUpperCase()
        : inviteTokenOrCode
    );
    return Array.from(this.games.values()).find(game =>
      inviteTokenOrCode.length === TokenService.INVITE_CODE_LENGTH
        ? game.invitation.inviteCodeHash === tokenHash
        : game.invitation.invitationTokenHash === tokenHash
    );
  }

  private createInviteUrl(base: string, inviteToken: string): string {
    try {
      const url = new URL(base);
      if (!url.pathname.endsWith('/')) {
        url.pathname = `${url.pathname}/`;
      }
      url.search = `invite=${encodeURIComponent(inviteToken)}`;
      return url.toString();
    } catch {
      return `${base.endsWith('/') ? base : `${base}/`}?invite=${encodeURIComponent(inviteToken)}`;
    }
  }

  private error(code: keyof typeof GAME_ERROR_CODES): { error: string; code: string } {
    return {
      error: GAME_ERROR_MESSAGES[code],
      code: GAME_ERROR_CODES[code]
    };
  }
}
