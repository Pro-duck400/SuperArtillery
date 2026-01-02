import { WebSocket } from 'ws';
import { GameStartMessage, FireMessage, GameOverMessage } from '../types/messages';

/**
 * Ultra-minimal game manager for MVP
 * Handles a single game with exactly 2 players
 */
export class GameManager {
  private players: (WebSocket | null)[] = [null, null];
  private currentTurn: 0 | 1 = 0;

  /**
   * Add a player to the game
   * @returns Player ID (0 or 1) or null if game is full
   */
  addPlayer(ws: WebSocket): number | null {
    // Find first empty slot
    for (let i = 0; i < 2; i++) {
      if (this.players[i] === null) {
        this.players[i] = ws;
        console.log(`Player ${i} connected`);

        // If both players are now connected, start the game
        if (this.isFull()) {
          this.startGame();
        }

        return i;
      }
    }
    return null; // Game is full
  }

  /**
   * Remove a player from the game
   */
  removePlayer(ws: WebSocket): void {
    const index = this.players.indexOf(ws);
    if (index !== -1) {
      this.players[index] = null;
      console.log(`Player ${index} disconnected`);

      // If a player disconnects, end the game
      this.endGame();
    }
  }

  /**
   * Check if both player slots are filled
   */
  private isFull(): boolean {
    return this.players[0] !== null && this.players[1] !== null;
  }

  /**
   * Start the game when both players are connected
   */
  private startGame(): void {
    console.log('Game starting with 2 players!');
    this.currentTurn = 0; // Player 0 goes first

    // Send game_start message to both players
    this.players.forEach((player, index) => {
      if (player) {
        const message: GameStartMessage = {
          type: 'game_start',
          playerId: index as 0 | 1,
          turn: this.currentTurn,
        };
        player.send(JSON.stringify(message));
      }
    });
  }

  /**
   * Handle fire message from a player
   */
  handleFire(message: FireMessage): void {
    console.log(`Fire: angle=${message.angle}, velocity=${message.velocity}`);

    // Relay the fire message to both players
    this.broadcast(message);

    // Switch turn
    this.currentTurn = this.currentTurn === 0 ? 1 : 0;
  }

  /**
   * Handle game over message
   */
  handleGameOver(message: GameOverMessage): void {
    console.log(`Game over! Winner: Player ${message.winner}`);

    // Broadcast game over to both players
    this.broadcast(message);

    // Reset game state
    this.reset();
  }

  /**
   * Broadcast a message to all connected players
   */
  private broadcast(message: any): void {
    const messageStr = JSON.stringify(message);
    this.players.forEach((player) => {
      if (player && player.readyState === WebSocket.OPEN) {
        player.send(messageStr);
      }
    });
  }

  /**
   * End the game (on disconnect or error)
   */
  private endGame(): void {
    console.log('Game ended');
    this.reset();
  }

  /**
   * Reset game state for a new game
   */
  private reset(): void {
    this.players = [null, null];
    this.currentTurn = 0;
  }

  /**
   * Get current player count
   */
  getPlayerCount(): number {
    return this.players.filter(p => p !== null).length;
  }
}
