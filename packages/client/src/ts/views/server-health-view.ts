import type { UIElements } from '../dom/elements';

export class ServerHealthView {
  private readonly elements: UIElements;
  private checkId = 0;

  constructor(elements: UIElements) {
    this.elements = elements;
  }

  public async check(serverAddress: string): Promise<void> {
    const checkId = ++this.checkId;
    this.elements.serverHealthStatus.classList.remove('error');
    this.elements.serverHealthMessage.textContent = 'Checking server...';
    const startedAt = performance.now();
    try {
      const baseUrl = serverAddress.replace(/\/$/, '');
      const [healthResponse, versionResponse] = await Promise.all([
        fetch(`${baseUrl}/api/v1/health`),
        fetch(`${baseUrl}/api/v1/version`)
      ]);
      const duration = Math.round(performance.now() - startedAt);
      if (checkId !== this.checkId) return;
      if (!healthResponse.ok) throw new Error(`Server returned HTTP ${healthResponse.status}`);
      if (!versionResponse.ok) throw new Error(`Version endpoint returned HTTP ${versionResponse.status}`);
      const [health, version] = await Promise.all([
        healthResponse.json() as Promise<{ status?: string }>,
        versionResponse.json() as Promise<{ serverVersion?: string; coreVersion?: string; contractVersion?: string }>
      ]);
      this.elements.serverHealthStatus.classList.remove('error');
      this.elements.serverHealthMessage.textContent = `${health.status === 'degraded' ? 'Server degraded' : 'Server ready'} | Server v${version.serverVersion ?? 'unknown'} | Core v${version.coreVersion ?? 'unknown'} | Contract v${version.contractVersion ?? 'unknown'} | Response time: ${duration}ms`;
    } catch (error) {
      if (checkId !== this.checkId) return;
      this.elements.serverHealthStatus.classList.add('error');
      this.elements.serverHealthMessage.textContent = error instanceof Error ? error.message : 'Unable to reach server';
    }
  }
}