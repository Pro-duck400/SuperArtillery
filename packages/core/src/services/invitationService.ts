import type { AcceptInvitationResponse, CreateGameResponse, PrivateGame } from '../types/private-game';
import { TokenService } from './tokenService';
import type { GameRepository } from './gameRepository';
import { GAME_CONFIG } from './gameConfig';
import { GAME_ERROR_CODES, GAME_ERROR_MESSAGES } from './gameErrors';

export type InvitationResult<T> = T | { error: string; code: string };

export class InvitationService {
  private readonly games: GameRepository;
  private readonly defaultClientOrigin: string;

  constructor(
    games: GameRepository,
    defaultClientOrigin: string
  ) {
    this.games = games;
    this.defaultClientOrigin = defaultClientOrigin;
  }

  public createGame(
    playerName: string,
    clientOrigin: string,
    serverOrigin: string = 'http://localhost:3000',
    now: number = Date.now(),
    playerCount: number = 2
  ): InvitationResult<CreateGameResponse> {
    const normalizedName = TokenService.normalizeName(playerName);
    if (!normalizedName) return this.error('INVALID_PLAYER_NAME');
    if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount > 9) return this.error('INVALID_PLAYER_COUNT');

    const gameId = TokenService.generateGameId();
    const sessionToken = TokenService.generateSessionToken();
    const inviteCode = this.generateUniqueInviteCode();
    const expiresAt = now + GAME_CONFIG.invitationTtlMs;
    const game: PrivateGame = {
      id: gameId,
      status: 'pending',
      createdAt: now,
      expiresAt,
      lastActivityAt: now,
      invitation: { inviteCode, inviteCodeHash: TokenService.hashToken(inviteCode), expiresAt, accepted: false },
      playerCount,
      lobbySlots: [],
      initiator: { name: normalizedName, sessionTokenHash: TokenService.hashToken(sessionToken), connection: null },
      invited: { name: null, sessionTokenHash: '', connection: null },
      currentTurn: 0,
      gameStarted: false,
      round: 1,
      frags: Array.from({ length: playerCount }, () => 0),
      rematchReady: [false, false]
    };

    game.lobbySlots = [
      { playerId: 0, session: game.initiator, status: 'waiting', active: true, eliminated: false },
      ...Array.from({ length: playerCount - 1 }, (_, index) => ({
        playerId: index + 1,
        session: index === 0 ? game.invited : { name: null, sessionTokenHash: '', connection: null },
        status: 'waiting' as const,
        active: true,
        eliminated: false
      }))
    ];
    this.games.set(game);

    return {
      gameId,
      playerToken: sessionToken,
      inviteUrl: this.createInviteUrl(clientOrigin || this.defaultClientOrigin, inviteCode, serverOrigin),
      inviteCode,
      playerCount
    };
  }

  public acceptInvitation(inviteCode: string | undefined, playerName: string, now: number = Date.now()): InvitationResult<AcceptInvitationResponse> {
    const normalizedName = TokenService.normalizeName(playerName);
    if (!normalizedName) return this.error('INVALID_PLAYER_NAME');
    if (!inviteCode) return this.error('MISSING_INVITE');
    const game = this.findGame(inviteCode);
    if (!game) return this.error('INVALID_INVITATION');
    if (game.invitation.expiresAt < now) {
      game.status = 'expired';
      return this.error('INVITATION_EXPIRED');
    }
    if (game.status !== 'pending') return this.error('GAME_UNAVAILABLE');
    const slot = game.lobbySlots.find(candidate => candidate.session.name === null && candidate.status === 'waiting');
    if (!slot) return this.error(game.playerCount === 2 ? 'INVITATION_ALREADY_ACCEPTED' : 'LOBBY_FULL');

    const sessionToken = TokenService.generateSessionToken();
    game.invitation.accepted = true;
    slot.session.name = normalizedName;
    slot.session.sessionTokenHash = TokenService.hashToken(sessionToken);
    if (slot.playerId === 1) game.invited = slot.session;
    return { gameId: game.id, playerToken: sessionToken, playerId: slot.playerId };
  }

  private findGame(inviteCode: string): PrivateGame | undefined {
    const codeHash = TokenService.hashToken(inviteCode.toUpperCase());
    return Array.from(this.games.values()).find(game => game.invitation.inviteCodeHash === codeHash);
  }

  private generateUniqueInviteCode(): string {
    for (let attempt = 0; attempt < 10; attempt++) {
      const inviteCode = TokenService.generateInviteCode();
      const codeHash = TokenService.hashToken(inviteCode);
      if (!Array.from(this.games.values()).some(game => game.invitation.inviteCodeHash === codeHash)) return inviteCode;
    }
    throw new Error('Unable to generate a unique invite code');
  }

  private createInviteUrl(base: string, inviteCode: string, serverOrigin: string): string {
    const hashIndex = base.indexOf('#');
    const fragment = hashIndex >= 0 ? base.slice(hashIndex) : '';
    const withoutFragment = hashIndex >= 0 ? base.slice(0, hashIndex) : base;
    const queryIndex = withoutFragment.indexOf('?');
    const path = queryIndex >= 0 ? withoutFragment.slice(0, queryIndex) : withoutFragment;
    const query = queryIndex >= 0 ? withoutFragment.slice(queryIndex + 1) : '';
    const normalizedPath = path.endsWith('/') ? path : `${path}/`;
    const retainedParams = query.split('&').filter(Boolean).filter(pair => {
      const rawKey = pair.split('=', 1)[0] ?? '';
      let key = rawKey;
      try { key = decodeURIComponent(rawKey.replace(/\+/g, ' ')); } catch { /* Keep malformed query text unchanged. */ }
      return key !== 'server' && key !== 'invite';
    });
    retainedParams.push(`server=${encodeURIComponent(serverOrigin)}`, `invite=${encodeURIComponent(inviteCode)}`);
    return `${normalizedPath}?${retainedParams.join('&')}${fragment}`;
  }

  private error(code: keyof typeof GAME_ERROR_CODES): { error: string; code: string } {
    return { error: GAME_ERROR_MESSAGES[code], code: GAME_ERROR_CODES[code] };
  }
}