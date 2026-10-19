import type {
  AcceptInvitationRequest,
  AcceptInvitationResponse,
  CreateGameRequest,
  CreateGameResponse,
  FireRequest,
  GameStatusResponse,
  HealthResponse,
  LobbySlotResponse,
  RematchAnswer,
  RematchRequest,
  RematchResponse,
  ShotDirection,
  SkipWaitingResponse,
  StatusResponse,
  VersionResponse
} from '@superartillery/core';

export type {
  AcceptInvitationRequest,
  AcceptInvitationResponse,
  CreateGameRequest,
  CreateGameResponse,
  ErrorResponse,
  FireRequest,
  GameStatusResponse,
  HealthResponse,
  LobbySlotResponse,
  RematchAnswer,
  RematchRequest,
  RematchResponse,
  ShotDirection,
  SkipWaitingResponse,
  StatusResponse,
  VersionResponse
} from '@superartillery/core';

// REST API client for SuperArtillery private games
export type LobbySlot = LobbySlotResponse;

export class ApiClient {
  private baseUrl: string;
  private readonly REQUEST_TIMEOUT_MS = 5000;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Health check with retry logic
   * Retries with delays: 0, 1, 2, 5 seconds
   */
  public async healthCheckWithRetry(): Promise<HealthResponse> {
    const delays = [0, 1000, 2000, 5000];
    let lastError: Error | null = null;

    for (let i = 0; i < delays.length; i++) {
      if (i > 0) {
        await this.delay(delays[i]);
      }

      try {
        return await this.healthCheck();
      } catch (error) {
        lastError = error as Error;
        console.log(
          `Health check attempt ${i + 1}/${delays.length} failed: ${
            lastError.message
          }`
        );
      }
    }

    throw lastError || new Error('Health check failed after all retries');
  }

  /**
   * Single health check request
   */
  public async healthCheck(): Promise<HealthResponse> {
    const response = await this.fetchWithTimeout(`${this.baseUrl}/api/v1/health`, {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error('Server is not responding');
    }

    return response.json();
  }

  /**
   * Fetch comprehensive server statistics
   */
  public async getStatus(): Promise<StatusResponse> {
    const response = await this.fetchWithTimeout(`${this.baseUrl}/api/v1/status`, {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error('Failed to retrieve server status');
    }

    return response.json();
  }

  public async getVersion(): Promise<VersionResponse> {
    const response = await this.fetchWithTimeout(`${this.baseUrl}/api/v1/version`, {
      method: 'GET'
    });
    if (!response.ok) throw new Error('Failed to retrieve server version');
    return response.json();
  }

  /**
   * Create a new private game
   */
  public async createGame(playerName: string, clientUrl: string, playerCount: number = 2): Promise<CreateGameResponse> {
    const body = { name: playerName, clientUrl, playerCount } satisfies CreateGameRequest;
    const response = await this.fetchWithTimeout(`${this.baseUrl}/api/v1/games`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(
        await this.extractErrorMessage(response, 'Failed to create game')
      );
    }

    return response.json();
  }

  /**
   * Accept an invitation
   */
  public async acceptInvitation(
    inviteCode: string,
    playerName: string
  ): Promise<AcceptInvitationResponse> {
    const body = { inviteCode, name: playerName } satisfies AcceptInvitationRequest;

    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/api/v1/invitations/accept`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      throw new Error(
        await this.extractErrorMessage(response, 'Failed to accept invitation')
      );
    }

    return response.json();
  }

  /**
   * Get game status
   */
  public async getGameStatus(
    gameId: string,
    sessionToken: string
  ): Promise<GameStatusResponse> {
    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/api/v1/games/${gameId}/status?sessionToken=${encodeURIComponent(
        sessionToken
      )}`,
      {
        method: 'GET'
      }
    );

    if (!response.ok) {
      throw new Error(
        await this.extractErrorMessage(response, 'Failed to get game status')
      );
    }

    return response.json();
  }

  public async skipWaiting(gameId: string, sessionToken: string): Promise<SkipWaitingResponse> {
    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/api/v1/games/${gameId}/skip-waiting?sessionToken=${encodeURIComponent(sessionToken)}`,
      { method: 'POST' }
    );
    if (!response.ok) {
      throw new Error(await this.extractErrorMessage(response, 'Unable to skip waiting players'));
    }
    return response.json();
  }

  /**
   * Fire a shot (updated for session tokens)
   */
  public async fire(
    gameId: string,
    sessionToken: string,
    angle: number,
    velocity: number,
    direction?: ShotDirection
  ): Promise<void> {
    const body = { gameId, angle, velocity, ...(direction ? { direction } : {}) } satisfies FireRequest;
    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/api/v1/fire?sessionToken=${encodeURIComponent(sessionToken)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      throw new Error(await this.extractErrorMessage(response, 'Fire action failed'));
    }
  }

  public async requestRematch(gameId: string, sessionToken: string, answer: RematchAnswer): Promise<RematchResponse> {
    const body = { answer } satisfies RematchRequest;
    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/api/v1/games/${gameId}/rematch?sessionToken=${encodeURIComponent(sessionToken)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      throw new Error(await this.extractErrorMessage(response, 'Rematch request failed'));
    }

    return response.json();
  }

  /**
   * Fetch with timeout
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT_MS);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Extract error message from response
   */
  private async extractErrorMessage(
    response: Response,
    fallback: string
  ): Promise<string> {
    try {
      const errorBody = (await response.json()) as {
        details?: string;
        message?: string;
      };
      if (typeof errorBody.message === 'string' && errorBody.message.trim() !== '') {
        return errorBody.message;
      }
      if (typeof errorBody.details === 'string' && errorBody.details.trim() !== '') {
        return errorBody.details;
      }
    } catch {
      // Ignore parse failures and fall back to status text/fallback
    }

    return response.statusText || fallback;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }
}
