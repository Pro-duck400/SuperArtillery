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
      const response = await fetch(`${serverAddress.replace(/\/$/, '')}/api/v1/health`);
      const duration = Math.round(performance.now() - startedAt);
      if (checkId !== this.checkId) return;
      if (!response.ok) throw new Error(`Server returned HTTP ${response.status}`);
      const health = await response.json() as { version?: string; coreVersion?: string; contractVersion?: string };
      this.elements.serverHealthStatus.classList.remove('error');
      this.elements.serverHealthMessage.textContent = `Server v${health.version ?? 'unknown'} | Core v${health.coreVersion ?? 'unknown'} | Contract v${health.contractVersion ?? 'unknown'} | Response time: ${duration}ms`;
    } catch (error) {
      if (checkId !== this.checkId) return;
      this.elements.serverHealthStatus.classList.add('error');
      this.elements.serverHealthMessage.textContent = error instanceof Error ? error.message : 'Unable to reach server';
    }
  }
}