// REST API client

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Register a player with the server
   * @param name Player name
   * @returns playerId (0 or 1) if successful
   */
  public async register(name: string): Promise<{ playerId: 0 | 1 }> {
    const response = await fetch(`${this.baseUrl}/api/v1/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || 'Registration failed');
    }

    return response.json();
  }

  /**
   * Fire a shot
   * @param gameId Game ID
   * @param playerId Player ID (0 or 1)
   * @param angle Angle in degrees (0-360)
   * @param velocity Velocity (must be positive)
   */
  public async fire(gameId: number, playerId: 0 | 1, angle: number, velocity: number): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/v1/fire`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ gameId, playerId, angle, velocity }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || 'Fire action failed');
    }
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }
}
