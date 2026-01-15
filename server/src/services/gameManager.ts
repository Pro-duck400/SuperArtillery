import { WebSocket } from 'ws';
import { GameStartMessage, TurnChangeMessage, GameOverMessage } from '../types/messages';

/**
 * Ultra-minimal game manager for MVP
 * Handles a single game with exactly 2 players
 */
export class GameManager {
  private playerNames: (string | null)[] = [null, null];
  private playerConnections: (WebSocket | null)[] = [null, null];
  private currentTurn: 0 | 1 = 0;
  private gameStarted: boolean = false;
  private gameId: number = 1; // MVP: single game instance

  /**
   * Register a player with a name (HTTP endpoint)
   * @returns Object with playerId (0 or 1) or error information
   */
  registerPlayer(name: string): { success: true; playerId: 0 | 1 } | { success: false; error: string; statusCode: number } {
    // Validate name is provided
    if (!name || name.trim() === '') {
      return { success: false, error: 'Name is required', statusCode: 400 };
    }

    // Check if name is already taken
    if (this.playerNames.includes(name)) {
      return { success: false, error: `Player ${name} already registered`, statusCode: 409 };
    }

    // Check if server is full (both slots taken)
    if (this.playerNames[0] !== null && this.playerNames[1] !== null) {
      return { success: false, error: 'Server is full', statusCode: 403 };
    }

    // Find first empty slot
    for (let i = 0; i < 2; i++) {
      if (this.playerNames[i] === null) {
        this.playerNames[i] = name;
        console.log(`Player ${i} (${name}) registered`);
        return { success: true, playerId: i as 0 | 1 };
      }
    }

    // Should never reach here, but just in case
    return { success: false, error: 'Server is full', statusCode: 403 };
  }

  /**
   * Connect a WebSocket for a registered player
   * @returns true if connection successful, false otherwise
   */
  connectPlayer(playerId: 0 | 1, ws: WebSocket): boolean {
    // Verify player is registered
    if (this.playerNames[playerId] === null) {
      console.log(`Player ${playerId} not registered`);
      return false;
    }

    // Connect the WebSocket
    this.playerConnections[playerId] = ws;
    console.log(`Player ${playerId} (${this.playerNames[playerId]}) connected via WebSocket`);

    // If both players are now connected, start the game
    if (this.areBothConnected() && !this.gameStarted) {
      this.startGame();
    }

    return true;
  }

  /**
   * Disconnect a player's WebSocket
   */
  disconnectPlayer(ws: WebSocket): void {
    const index = this.playerConnections.indexOf(ws);
    if (index !== -1) {
      this.playerConnections[index] = null;
      console.log(`Player ${index} (${this.playerNames[index]}) disconnected`);

      // If a player disconnects, end the game
      this.endGame();
    }
  }

  /**
   * Check if both players are connected via WebSocket
   */
  private areBothConnected(): boolean {
    return this.playerConnections[0] !== null && this.playerConnections[1] !== null;
  }

  /**
   * Start the game when both players are connected
   */
  private startGame(): void {
    console.log(`Game starting with 2 players: ${this.playerNames[0]} vs ${this.playerNames[1]}!`);
    this.gameStarted = true;
    this.currentTurn = 0; // Player 0 goes first

    // Send game_start message to both players
    const gameStartMessage: GameStartMessage = {
      type: 'game_start',
      gameId: this.gameId,
    };
    this.broadcast(gameStartMessage);

    // Send turn_change message to indicate initial turn
    const turnMessage: TurnChangeMessage = {
      type: 'turn_change',
      playerId_turn: this.currentTurn,
    };
    this.broadcast(turnMessage);
  }

  /**
   * Handle game over message
   */
  handleGameOver(message: GameOverMessage): void {
    console.log(`Game over! Winner: Player ${message.playerId_winner}`);

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
    this.playerConnections.forEach((connection, index) => {
      if (connection && connection.readyState === WebSocket.OPEN) {
        console.log(`📤 Broadcasting to Player ${index} (${this.playerNames[index]}):`, messageStr);
        connection.send(messageStr);
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
    this.playerConnections = [null, null];
    this.playerNames = [null, null];
    this.currentTurn = 0;
    this.gameStarted = false;
  }

  /**
   * Get count of registered players
   */
  getPlayerCount(): number {
    return this.playerNames.filter(p => p !== null).length;
  }

  /**
   * Get player name by ID
   */
  getPlayerName(playerId: 0 | 1): string | null {
    return this.playerNames[playerId];
  }

  /**
   * Get current game ID
   */
  getGameId(): number {
    return this.gameId;
  }

  /**
   * Handle fire action from HTTP endpoint
   * @returns success or error with status code
   */
  fire(
    gameId: number,
    playerId: 0 | 1,
    angle: number,
    velocity: number
  ): { success: true } | { success: false; error: string; statusCode: number } {

    if (gameId !== this.gameId || !this.gameStarted) {
      return {
        success: false,
        error: `GameId ${gameId} is unknown.`,
        statusCode: 400
      };
    }

    if (playerId !== 0 && playerId !== 1) {
      return {
        success: false,
        error: `PlayerId ${playerId} is unknown.`,
        statusCode: 400
      };
    }

    if (playerId !== this.currentTurn) {
      return {
        success: false,
        error: 'Player should wait for its turn to fire.',
        statusCode: 400
      };
    }

    if (angle < 0 || angle > 360) {
      return {
        success: false,
        error: 'The angle should be within 0-360 degrees.',
        statusCode: 400
      };
    }

    if (velocity <= 0) {
      return {
        success: false,
        error: 'The velocity should be positive.',
        statusCode: 400
      };
    }

    this.broadcast({
      type: 'shot',
      playerId,
      angle,
      velocity
    });

    this.currentTurn = this.currentTurn === 0 ? 1 : 0;

    this.broadcast({
      type: 'turn_change',
      playerId_turn: this.currentTurn
    });

    return { success: true };
  }
}
