// REST API client (placeholder for future sprints)

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  // Future: implement REST API calls
  // - POST /api/lobby/join
  // - GET /api/players/:id/stats
  // - etc.
  
  public getBaseUrl(): string {
    return this.baseUrl;
  }
}
