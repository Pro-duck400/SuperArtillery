// WebSocket client for real-time game communication
import type { GameMessage } from '../types/messages';

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private messageHandlers: Array<(message: GameMessage) => void> = [];
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as GameMessage;
          this.messageHandlers.forEach((handler) => handler(message));
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
      };
    });
  }

  public send(message: GameMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected');
    }
  }

  public onMessage(handler: (message: GameMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
