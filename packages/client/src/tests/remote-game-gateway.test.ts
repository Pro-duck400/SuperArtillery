import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONTRACT_VERSION } from '@superartillery/core';
import type { GameMessage } from '../ts/types/messages';
import { RemoteGameGateway } from '../ts/network/remote-game-gateway';

class MockWebSocket {
  public static instances: MockWebSocket[] = [];
  public onopen: ((event: Event) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public closed = false;
  public readonly url: string;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  public open(): void {
    this.onopen?.(new Event('open'));
  }

  public sendMessage(message: unknown): void {
    this.onmessage?.({ data: JSON.stringify(message) } as MessageEvent);
  }

  public close(): void {
    this.closed = true;
    this.onclose?.(new CloseEvent('close'));
  }
}

describe('RemoteGameGateway', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    MockWebSocket.instances = [];
  });

  it('opens the versioned socket and forwards pushed game messages', async () => {
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);
    const gateway = new RemoteGameGateway('https://api.example.test', 'wss://api.example.test');
    const onMessage = vi.fn<(message: GameMessage) => void>();
    gateway.onMessage(onMessage);

    const connecting = gateway.connect('game id', 'session token');
    const socket = MockWebSocket.instances[0]!;
    expect(socket.url).toBe(
      `wss://api.example.test?gameId=game%20id&sessionToken=session%20token&contractVersion=${encodeURIComponent(CONTRACT_VERSION)}`
    );
    socket.open();
    await connecting;

    const shot: GameMessage = { type: 'shot', playerId: 1, angle: 45, velocity: 100, direction: 'Left' };
    socket.sendMessage(shot);
    expect(onMessage).toHaveBeenCalledWith(shot);

    gateway.disconnect();
    expect(socket.closed).toBe(true);
  });

  it('wakes the server with health and validates the contract through the version endpoint', async () => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      const isVersionRequest = String(input).endsWith('/api/v1/version');
      return {
        ok: true,
        json: async () => isVersionRequest
          ? { serverVersion: '1.5.0', coreVersion: '1.0.0', contractVersion: CONTRACT_VERSION }
          : { status: 'ok', timestamp: new Date().toISOString(), uptime: '0.00:00:01.000' }
      } as Response;
    });
    vi.stubGlobal('fetch', fetchSpy);
    const gateway = new RemoteGameGateway('https://api.example.test', 'wss://api.example.test');

    await gateway.healthCheckWithRetry();

    expect(fetchSpy.mock.calls.map(([url]) => String(url))).toEqual([
      'https://api.example.test/api/v1/health',
      'https://api.example.test/api/v1/version'
    ]);
  });

  it('rejects remote operations when the server contract version differs', async () => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      const isVersionRequest = String(input).endsWith('/api/v1/version');
      return {
        ok: true,
        json: async () => isVersionRequest
          ? { serverVersion: '1.5.0', coreVersion: '1.0.0', contractVersion: '1.9.0' }
          : { status: 'ok', timestamp: new Date().toISOString(), uptime: '0.00:00:01.000' }
      } as Response;
    });
    vi.stubGlobal('fetch', fetchSpy);
    const gateway = new RemoteGameGateway('https://api.example.test', 'wss://api.example.test');

    await expect(gateway.healthCheckWithRetry()).rejects.toThrow(/API contract mismatch/);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});