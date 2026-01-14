// Manages all DOM interactions and UI state
export class UIManager {
  // DOM elements
  private registrationPanel: HTMLDivElement;
  private gamePanel: HTMLDivElement;
  private playerNameInput: HTMLInputElement;
  private registerButton: HTMLButtonElement;
  private registrationError: HTMLDivElement;
  private statusEl: HTMLDivElement;
  private messageEl: HTMLDivElement;
  private angleInput: HTMLInputElement;
  private velocityInput: HTMLInputElement;
  private fireButton: HTMLButtonElement;

  // Event callbacks
  private onRegisterCallback: ((name: string) => void) | null = null;
  private onFireCallback: ((angle: number, velocity: number) => void) | null = null;

  constructor() {
    // Get DOM elements
    this.registrationPanel = document.getElementById('registrationPanel') as HTMLDivElement;
    this.gamePanel = document.getElementById('gamePanel') as HTMLDivElement;
    this.playerNameInput = document.getElementById('playerNameInput') as HTMLInputElement;
    this.registerButton = document.getElementById('registerButton') as HTMLButtonElement;
    this.registrationError = document.getElementById('registrationError') as HTMLDivElement;
    this.statusEl = document.getElementById('status') as HTMLDivElement;
    this.messageEl = document.getElementById('message') as HTMLDivElement;
    this.angleInput = document.getElementById('angleInput') as HTMLInputElement;
    this.velocityInput = document.getElementById('velocityInput') as HTMLInputElement;
    this.fireButton = document.getElementById('fireButton') as HTMLButtonElement;

    this.setupEventListeners();
    this.playerNameInput.focus();
  }

  /**
   * Set up DOM event listeners
   */
  private setupEventListeners(): void {
    // Register button
    this.registerButton.addEventListener('click', () => {
      const playerName = this.playerNameInput.value.trim();
      
      if (!playerName) {
        this.registrationError.textContent = 'Please enter your name';
        return;
      }

      if (playerName.length < 2) {
        this.registrationError.textContent = 'Name must be at least 2 characters';
        return;
      }

      if (this.onRegisterCallback) {
        this.registrationError.textContent = '';
        this.onRegisterCallback(playerName);
      }
    });

    // Enter key in name input
    this.playerNameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.registerButton.click();
      }
    });

    // Fire button
    this.fireButton.addEventListener('click', () => {
      const angle = parseInt(this.angleInput.value, 10);
      const velocity = parseInt(this.velocityInput.value, 10);

      if (isNaN(angle) || isNaN(velocity)) {
        this.messageEl.textContent = 'Invalid input';
        return;
      }

      if (angle < 0 || angle > 360) {
        this.messageEl.textContent = 'Angle must be between 0 and 360';
        return;
      }

      if (velocity <= 0) {
        this.messageEl.textContent = 'Velocity must be positive';
        return;
      }

      if (this.onFireCallback) {
        this.onFireCallback(angle, velocity);
      }
    });
  }

  /**
   * Register callback for registration event
   */
  public onRegister(callback: (name: string) => void): void {
    this.onRegisterCallback = callback;
  }

  /**
   * Register callback for fire event
   */
  public onFire(callback: (angle: number, velocity: number) => void): void {
    this.onFireCallback = callback;
  }

  /**
   * Show registration in progress
   */
  public showRegistering(): void {
    this.registerButton.disabled = true;
    this.registerButton.textContent = 'Registering...';
  }

  /**
   * Show registration error
   */
  public showRegistrationError(error: string): void {
    this.registrationError.textContent = error;
    this.registerButton.disabled = false;
    this.registerButton.textContent = 'Join Game';
  }

  /**
   * Switch from registration to game panel
   */
  public showGamePanel(playerId: number): void {
    this.registrationPanel.style.display = 'none';
    this.gamePanel.style.display = 'block';
    this.statusEl.textContent = `Registered as Player ${playerId + 1}`;
  }

  /**
   * Update status text
   */
  public setStatus(text: string): void {
    this.statusEl.textContent = text;
  }

  /**
   * Update message text
   */
  public setMessage(text: string): void {
    this.messageEl.textContent = text;
  }

  /**
   * Update UI based on turn state
   */
  public updateTurnUI(isMyTurn: boolean): void {
    this.fireButton.disabled = !isMyTurn;
    
    if (isMyTurn) {
      this.statusEl.textContent = 'Your Turn';
      this.angleInput.disabled = false;
      this.velocityInput.disabled = false;
    } else {
      this.statusEl.textContent = "Opponent's Turn";
      this.angleInput.disabled = true;
      this.velocityInput.disabled = true;
    }
  }

  /**
   * Disable fire button (e.g., while firing or game over)
   */
  public disableFireButton(): void {
    this.fireButton.disabled = true;
  }

  /**
   * Show game over message
   */
  public showGameOver(won: boolean): void {
    this.messageEl.textContent = won ? '🎉 You won!' : '😔 You lost';
    this.fireButton.disabled = true;
  }
}
