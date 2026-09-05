// Manages all DOM interactions and UI state
import type { ShotHistoryEntry } from './game';

export class UIManager {
  // DOM elements
  private registrationPanel: HTMLDivElement;
  private registrationFields: HTMLDivElement;
  private registrationActions: HTMLDivElement;
  private gamePanel: HTMLDivElement;
  private playerNameInput: HTMLInputElement;
  private serverAddressInput: HTMLInputElement;
  private serverAddressToggle: HTMLButtonElement;
  private serverAddressOptions: HTMLSpanElement;
  private serverAddressLabel: HTMLLabelElement;
  private actionButton: HTMLButtonElement;
  private inviteInput: HTMLInputElement;
  private inviteInputLabel: HTMLLabelElement;
  private registrationError: HTMLDivElement;
  private inviteInfoEl: HTMLDivElement;
  private inviteCodeTextEl: HTMLSpanElement;
  private inviteUrlTextEl: HTMLSpanElement;
  private copyInviteCodeButton: HTMLButtonElement;
  private copyInviteUrlButton: HTMLButtonElement;
  private messageEl: HTMLDivElement;
  private shotHistoryRowsEl: HTMLTableSectionElement;
  private angleInput: HTMLInputElement;
  private velocityInput: HTMLInputElement;
  private fireButton: HTMLButtonElement;
  private defaultServerAddress: string;
  private creatingGame = false;

  // Event callbacks
  private onCreateGameCallback: ((name: string, serverAddress: string) => void) | null = null;
  private onJoinGameCallback: ((inviteCode: string, name: string, serverAddress: string) => void) | null = null;
  private onFireCallback: ((angle: number, velocity: number) => void) | null = null;

  constructor(defaultServerAddress: string) {
    this.defaultServerAddress = defaultServerAddress;
    // Get DOM elements
    this.registrationPanel = document.getElementById('registrationPanel') as HTMLDivElement;
    this.registrationFields = document.getElementById('registrationFields') as HTMLDivElement;
    this.registrationActions = document.getElementById('registrationActions') as HTMLDivElement;
    this.gamePanel = document.getElementById('gamePanel') as HTMLDivElement;
    this.playerNameInput = document.getElementById('playerNameInput') as HTMLInputElement;
    this.serverAddressInput = document.getElementById('serverAddressInput') as HTMLInputElement;
    this.serverAddressToggle = document.getElementById('serverAddressToggle') as HTMLButtonElement;
    this.serverAddressOptions = document.getElementById('serverAddressOptions') as HTMLSpanElement;
    this.serverAddressLabel = this.serverAddressInput.closest('label') as HTMLLabelElement;
    this.actionButton = document.getElementById('actionButton') as HTMLButtonElement;
    this.inviteInput = document.getElementById('inviteInput') as HTMLInputElement;
    this.inviteInputLabel = document.getElementById('inviteInputLabel') as HTMLLabelElement;
    this.registrationError = document.getElementById('registrationError') as HTMLDivElement;
    this.inviteInfoEl = document.getElementById('inviteInfo') as HTMLDivElement;
    this.inviteCodeTextEl = document.getElementById('inviteCodeText') as HTMLSpanElement;
    this.inviteUrlTextEl = document.getElementById('inviteUrlText') as HTMLSpanElement;
    this.copyInviteCodeButton = document.getElementById('copyInviteCodeButton') as HTMLButtonElement;
    this.copyInviteUrlButton = document.getElementById('copyInviteUrlButton') as HTMLButtonElement;
    this.messageEl = document.getElementById('message') as HTMLDivElement;
    this.shotHistoryRowsEl = document.getElementById('shotHistoryRows') as HTMLTableSectionElement;
    this.angleInput = document.getElementById('angleInput') as HTMLInputElement;
    this.velocityInput = document.getElementById('velocityInput') as HTMLInputElement;
    this.fireButton = document.getElementById('fireButton') as HTMLButtonElement;
    this.serverAddressInput.value = defaultServerAddress;
    this.updateActionButton();

    this.setupEventListeners();
    this.playerNameInput.focus();
  }

  /**
   * Set up DOM event listeners
   */
  private setupEventListeners(): void {
    const setOptionsExpanded = (expanded: boolean): void => {
      this.serverAddressOptions.hidden = !expanded;
      this.serverAddressToggle.setAttribute('aria-expanded', String(expanded));
      this.serverAddressInput.setAttribute('aria-expanded', String(expanded));
    };

    this.serverAddressToggle.addEventListener('click', () => {
      setOptionsExpanded(this.serverAddressOptions.hidden === true);
    });

    this.serverAddressOptions.querySelectorAll<HTMLButtonElement>('[role="option"]').forEach((option) => {
      option.addEventListener('click', () => {
        this.serverAddressInput.value = option.dataset.serverAddress || '';
        setOptionsExpanded(false);
      });
    });

    const validateInputs = (): { playerName: string; serverAddress: string } | null => {
      const playerName = this.playerNameInput.value.trim();
      const serverAddress = this.serverAddressInput.value.trim() || this.defaultServerAddress;

      if (!playerName) {
        this.registrationError.textContent = 'Please enter your name';
        return null;
      }

      if (playerName.length < 2) {
        this.registrationError.textContent = 'Name must be at least 2 characters';
        return null;
      }

      try {
        const parsedUrl = new URL(serverAddress);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
          this.registrationError.textContent = 'Server address must start with http:// or https://';
          return null;
        }
      } catch {
        this.registrationError.textContent = 'Please enter a valid server address, e.g. http://localhost:3000';
        return null;
      }

      this.registrationError.textContent = '';
      return { playerName, serverAddress };
    };

    this.actionButton.addEventListener('click', () => {
      const valid = validateInputs();
      if (!valid) {
        return;
      }

      const inviteCode = this.inviteInput.value.trim();
      if (inviteCode) {
        if (!/^[A-Za-z0-9]{4}$/.test(inviteCode)) {
          this.registrationError.textContent = 'Enter a 4-character invite code';
          return;
        }

        if (this.onJoinGameCallback) {
          this.registrationError.textContent = '';
          this.onJoinGameCallback(inviteCode, valid.playerName, valid.serverAddress);
        }
      } else if (this.onCreateGameCallback) {
        this.onCreateGameCallback(valid.playerName, valid.serverAddress);
      }
    });

    this.inviteInput.addEventListener('input', () => {
      this.updateActionButton();
    });

    this.playerNameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.actionButton.click();
      }
    });

    this.inviteInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.actionButton.click();
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

  // changed playerId parameter from 0 | 1 to string as it causes an error in main when called
  public setPlayerNames(playerId: number, playerName: string, opponentName: string): void {
    const leftNameEl = document.getElementById('playerNameLeft');
    const rightNameEl = document.getElementById('playerNameRight');

    if (playerId === 0) {
        if (leftNameEl) {
            leftNameEl.textContent = playerName;
            leftNameEl.classList.add('player-name-connected');
        }
        if (rightNameEl) {
            rightNameEl.textContent = opponentName;
            rightNameEl.classList.add('player-name-connected');
        }
    } else {
        if (leftNameEl) {
            leftNameEl.textContent = opponentName;
            leftNameEl.classList.add('player-name-connected');
        }
        if (rightNameEl) {
            rightNameEl.textContent = playerName;
            rightNameEl.classList.add('player-name-connected');
        }
    }
  }


  /**
   * Register callback for creating a new private game
   */
  public onCreateGame(callback: (name: string, serverAddress: string) => void): void {
    this.onCreateGameCallback = callback;
  }

  /**
   * Register callback for joining an existing game via invite token or code
   */
  public onJoinGame(callback: (inviteCode: string, name: string, serverAddress: string) => void): void {
    this.onJoinGameCallback = callback;
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
    this.creatingGame = !this.hasInviteCode();
    if (this.creatingGame) {
      this.registrationFields.style.display = 'none';
      this.inviteInputLabel.style.display = 'none';
      this.registrationActions.classList.add('registration-actions-pending');
    }
    this.actionButton.disabled = true;
    this.actionButton.textContent = this.hasInviteCode() ? 'Joining...' : 'Creating...';
  }

  /**
   * Show registration error
   */
  public showRegistrationError(error: string): void {
    this.registrationError.textContent = error;
    if (this.creatingGame) {
      this.registrationFields.style.display = '';
      this.inviteInputLabel.style.display = '';
      this.registrationActions.classList.remove('registration-actions-pending');
    }
    this.creatingGame = false;
    this.actionButton.disabled = false;
    this.updateActionButton();
  }

  public showInviteInfo(code: string, inviteUrl: string): void {
    this.inviteInfoEl.style.display = 'block';
    this.inviteCodeTextEl.textContent = code;
    this.inviteUrlTextEl.textContent = inviteUrl;

    this.wireCopyButton(this.copyInviteCodeButton, code);
    this.wireCopyButton(this.copyInviteUrlButton, inviteUrl);
  }

  public hideInviteInfo(): void {
    this.inviteInfoEl.style.display = 'none';
    this.inviteCodeTextEl.textContent = '';
    this.inviteUrlTextEl.textContent = '';
    this.copyInviteCodeButton.onclick = null;
    this.copyInviteUrlButton.onclick = null;
  }

  public setServerAddress(serverAddress: string): void {
    this.serverAddressInput.value = serverAddress;
  }

  /**
   * Wire a button to copy the given text to the clipboard, with brief "Copied!" feedback.
   */
  private wireCopyButton(button: HTMLButtonElement, textToCopy: string): void {
    const defaultLabel = '📋 Copy';
    button.textContent = defaultLabel;
    button.onclick = () => {
      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          button.textContent = '✅ Copied!';
          setTimeout(() => {
            button.textContent = defaultLabel;
          }, 1500);
        })
        .catch(() => {
          button.textContent = 'Copy failed';
        });
    };
  }

  /**
   * Configure the lobby for a player arriving via an invite link/code: only the
   * name field and Join button are relevant, so hide Create Game and the
   * invite code/link input (pre-filled internally) to avoid confusing the user.
   */
  public enterJoinOnlyMode(inviteCode: string): void {
    this.inviteInput.value = inviteCode;
    this.serverAddressLabel.style.display = 'none';
    this.serverAddressInput.disabled = true;
    this.serverAddressToggle.disabled = true;
    this.inviteInputLabel.style.display = 'none';
    this.updateActionButton();
    this.playerNameInput.focus();
  }

  private hasInviteCode(): boolean {
    return this.inviteInput.value.trim().length > 0;
  }

  private updateActionButton(): void {
    this.actionButton.textContent = this.hasInviteCode()
      ? 'Join with Invite'
      : 'Create Private Game';
  }

  /**
   * Switch from registration to game panel
   */
  public showGamePanel(): void {
    this.registrationPanel.style.display = 'none';
    this.gamePanel.style.display = 'block';
  }

  /**
   * Update message text
   */
  public setMessage(text: string): void {
    this.messageEl.textContent = text;
  }

  public renderShotHistory(history: ShotHistoryEntry[]): void {
    this.shotHistoryRowsEl.replaceChildren();

    const angleRow = document.createElement('tr');
    const velocityRow = document.createElement('tr');
    const angleLabel = document.createElement('th');
    const velocityLabel = document.createElement('th');

    angleLabel.scope = 'row';
    angleLabel.textContent = 'Angle';
    velocityLabel.scope = 'row';
    velocityLabel.textContent = 'Velocity';
    angleRow.appendChild(angleLabel);
    velocityRow.appendChild(velocityLabel);

    for (let index = 0; index < 4; index += 1) {
      const shot = history[index];
      const angleCell = document.createElement('td');
      const velocityCell = document.createElement('td');
      const angleText = shot ? `${shot.angle}°` : '—';
      const velocityText = shot ? String(shot.velocity) : '—';

      angleCell.textContent = angleText;
      velocityCell.textContent = velocityText;
      angleCell.setAttribute('aria-label', `Angle ${angleText}`);
      velocityCell.setAttribute('aria-label', `Velocity ${velocityText}`);
      angleRow.appendChild(angleCell);
      velocityRow.appendChild(velocityCell);
    }

    this.shotHistoryRowsEl.append(angleRow, velocityRow);
  }

  /**
   * Update UI based on turn state and highlight current player's name
   * @param isMyTurn Whether it's this client's turn
   */
  public updateTurnUI(currentTurn: 0 | 1, isMyTurn: boolean): void {
    this.fireButton.disabled = !isMyTurn;
    if (isMyTurn) {
      this.angleInput.disabled = false;
      this.velocityInput.disabled = false;
    } else {
      this.angleInput.disabled = true;
      this.velocityInput.disabled = true;
    }

    // Highlight only the player whose turn it is
      const leftNameEl = document.getElementById('playerNameLeft');
      const rightNameEl = document.getElementById('playerNameRight');

      // Remove the active class from both
      leftNameEl?.classList.remove('player-name-active-turn');
      rightNameEl?.classList.remove('player-name-active-turn');

      // Add the active class to the current player's name
      if (currentTurn === 0) {
        leftNameEl?.classList.add('player-name-active-turn');
      } else {
        rightNameEl?.classList.add('player-name-active-turn');
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
  public showGameOver(won: boolean, playerName: string, opponentName: string): void {
    this.messageEl.textContent = won
      ? `🎉 ${playerName} won! ${opponentName} lost.`
      : `😔 ${playerName} lost. ${opponentName} won!`;
    this.fireButton.disabled = true;
  }
}
