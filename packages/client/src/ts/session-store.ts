export interface GameSession {
  gameId: string;
  sessionToken: string;
  playerName: string;
  hotSeat?: boolean;
  players?: Array<{ playerId: number; playerName: string; sessionToken: string }>;
}

const SESSION_STORAGE_KEY = 'gameSession';

export class SessionStore {
  private session: GameSession | null = null;
  private readonly storage: Storage;

  constructor(storage: Storage = sessionStorage) {
    this.storage = storage;
    const stored = this.storage.getItem(SESSION_STORAGE_KEY);
    if (!stored) return;
    try {
      this.session = JSON.parse(stored) as GameSession;
      console.log(`Restored game session: ${this.session.gameId}`);
    } catch (error) {
      console.error('Failed to restore session:', error);
      this.storage.removeItem(SESSION_STORAGE_KEY);
    }
  }

  public get(): GameSession | null {
    return this.session;
  }

  public set(session: GameSession | null): void {
    this.session = session;
    if (session) this.storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    else this.storage.removeItem(SESSION_STORAGE_KEY);
  }

  public hasSession(): boolean {
    return this.session !== null;
  }
}