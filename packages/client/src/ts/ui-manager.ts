// Manages all DOM interactions and UI state
import type { ShotHistoryEntry } from './game';
import { collectUIElements, type UIElements } from './dom/elements';
import { RosterView } from './views/roster-view';
import { LobbyStatusView } from './views/lobby-status-view';
import { ServerHealthView } from './views/server-health-view';
import { HotSeatView } from './views/hot-seat-view';
import { GameView } from './views/game-view';
import { RematchView } from './views/rematch-view';
import { LobbyView, type CreateMode, type LobbyMode } from './views/lobby-view';

export interface LobbySlotView {
  playerId: number;
  name?: string;
  status: 'waiting' | 'ready' | 'skipped';
}

export class UIManager {
  // DOM elements
  declare private registrationPanel: UIElements['registrationPanel'];
  declare private serverRow: UIElements['serverRow'];
  declare private lobbyModeRow: UIElements['lobbyModeRow'];
  declare private joinGameRow: UIElements['joinGameRow'];
  declare private createGameRow: UIElements['createGameRow'];
  declare private internetGameRow: UIElements['internetGameRow'];
  declare private lobbyModeToggle: UIElements['lobbyModeToggle'];
  declare private createModeToggle: UIElements['createModeToggle'];
  declare private lobbyModeOptions: UIElements['lobbyModeOptions'];
  declare private createModeOptions: UIElements['createModeOptions'];
  declare private joinPlayerNameInput: UIElements['joinPlayerNameInput'];
  declare private joinGameButton: UIElements['joinGameButton'];
  declare private gamePanel: UIElements['gamePanel'];
  declare private windLabel: UIElements['windLabel'];
  declare private playerNameInput: UIElements['playerNameInput'];
  declare private playerCountInput: UIElements['playerCountInput'];
  declare private serverAddressInput: UIElements['serverAddressInput'];
  declare private serverAddressToggle: UIElements['serverAddressToggle'];
  declare private serverAddressOptions: UIElements['serverAddressOptions'];
  declare private serverHealthButton: UIElements['serverHealthButton'];
  declare private serverHealthStatus: UIElements['serverHealthStatus'];
  declare private serverHealthMessage: UIElements['serverHealthMessage'];
  declare private actionButton: UIElements['actionButton'];
  declare private hotSeatPanel: UIElements['hotSeatPanel'];
  declare private startHotSeatButton: UIElements['startHotSeatButton'];
  declare private hotSeatPlayersList: UIElements['hotSeatPlayersList'];
  declare private addHotSeatPlayerButton: UIElements['addHotSeatPlayerButton'];
  declare private inviteInput: UIElements['inviteInput'];
  declare private inviteInputLabel: UIElements['inviteInputLabel'];
  declare private registrationError: UIElements['registrationError'];
  declare private lobbyStatus: UIElements['lobbyStatus'];
  declare private lobbySlots: UIElements['lobbySlots'];
  declare private skipWaitingButton: UIElements['skipWaitingButton'];
  declare private playerNameRoster: UIElements['playerNameRoster'];
  declare private inviteInfoEl: UIElements['inviteInfoEl'];
  declare private inviteCodeTextEl: UIElements['inviteCodeTextEl'];
  declare private inviteUrlTextEl: UIElements['inviteUrlTextEl'];
  declare private copyInviteCodeButton: UIElements['copyInviteCodeButton'];
  declare private copyInviteUrlButton: UIElements['copyInviteUrlButton'];
  declare private messageEl: UIElements['messageEl'];
  declare private shotHistoryRowsEl: UIElements['shotHistoryRowsEl'];
  declare private angleInput: UIElements['angleInput'];
  declare private velocityInput: UIElements['velocityInput'];
  declare private directionInput: UIElements['directionInput'];
  declare private directionField: UIElements['directionField'];
  declare private fireButton: UIElements['fireButton'];
  declare private rematchButton: UIElements['rematchButton'];
  declare private rematchControls: UIElements['rematchControls'];
  declare private rematchPlayers: UIElements['rematchPlayers'];
  declare private playAgainButton: UIElements['playAgainButton'];
  declare private hadEnoughButton: UIElements['hadEnoughButton'];
  private readonly rosterView: RosterView;
  private readonly lobbyStatusView: LobbyStatusView;
  private readonly serverHealthView: ServerHealthView;
  private readonly hotSeatView: HotSeatView;
  private readonly gameView: GameView;
  private readonly rematchView: RematchView;
  private readonly lobbyView: LobbyView;

  // Event callbacks
  private onCreateGameCallback: ((name: string, serverAddress: string) => void) | null = null;
  private onJoinGameCallback: ((inviteCode: string, name: string, serverAddress: string) => void) | null = null;
  private onHotSeatCallback: ((names: string[], serverAddress: string) => void) | null = null;
  private onFireCallback: ((angle: number, velocity: number, direction?: 'Left' | 'Right') => void) | null = null;
  private onRematchCallback: (() => void) | null = null;
  private onRematchAnswerCallback: ((answer: 'play_again' | 'had_enough') => void) | null = null;
  private onSkipWaitingCallback: (() => void) | null = null;

  constructor(defaultServerAddress: string) {
    const elements = collectUIElements(document);
    Object.assign(this, elements);
    this.rosterView = new RosterView(elements, document);
    this.lobbyStatusView = new LobbyStatusView(elements);
    this.serverHealthView = new ServerHealthView(elements);
    this.hotSeatView = new HotSeatView(elements, document);
    this.gameView = new GameView(elements, document);
    this.rematchView = new RematchView(elements, document);
    this.lobbyView = new LobbyView(elements, defaultServerAddress);
    this.hotSeatView.initialize();

    this.playerNameInput.maxLength = 15;
    this.joinPlayerNameInput.maxLength = 15;
    this.playerNameInput.addEventListener('input', () => {
      if (this.playerNameInput.value.length > 15) {
        this.playerNameInput.value = this.playerNameInput.value.slice(0, 15);
      }
    });

    this.angleInput.addEventListener('input', () => {
      this.angleInput.value = this.angleInput.value.slice(0, 2);
    });

    this.velocityInput.addEventListener('input', () => {
      this.velocityInput.value = this.velocityInput.value.slice(0, 3);
    });

    this.setupEventListeners();
    void this.serverHealthView.check(defaultServerAddress);
    this.playerNameInput.focus();
  }

  /**
   * Set up DOM event listeners
   */
  private setupEventListeners(): void {
    const setListboxOpen = (toggle: HTMLButtonElement, options: HTMLSpanElement, open: boolean): void => {
      options.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
    };

    this.lobbyModeToggle.addEventListener('click', () => {
      setListboxOpen(this.lobbyModeToggle, this.lobbyModeOptions, this.lobbyModeOptions.hidden === true);
    });
    this.createModeToggle.addEventListener('click', () => {
      setListboxOpen(this.createModeToggle, this.createModeOptions, this.createModeOptions.hidden === true);
    });

    this.lobbyModeOptions.querySelectorAll<HTMLButtonElement>('[role="option"]').forEach((option) => {
      option.addEventListener('click', () => {
        const mode: LobbyMode = option.dataset.mode?.toLowerCase() === 'join' ? 'join' : 'create';
        this.lobbyView.setLobbyMode(mode);
        setListboxOpen(this.lobbyModeToggle, this.lobbyModeOptions, false);
      });
    });

    this.createModeOptions.querySelectorAll<HTMLButtonElement>('[role="option"]').forEach((option) => {
      option.addEventListener('click', () => {
        const mode: CreateMode = option.dataset.mode === 'device' ? 'device' : 'internet';
        this.lobbyView.setCreateMode(mode);
        setListboxOpen(this.createModeToggle, this.createModeOptions, false);
      });
    });

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
        const serverAddress = option.dataset.serverAddress || '';
        this.lobbyView.setServerAddress(serverAddress);
        setOptionsExpanded(false);
        void this.serverHealthView.check(serverAddress);
      });
    });

    this.serverHealthButton.addEventListener('click', (event) => {
      event.preventDefault();
      const serverAddress = this.lobbyView.getServerAddress();
      void this.serverHealthView.check(serverAddress);
    });

    const submitCreate = (): void => {
      const playerName = this.playerNameInput.value.trim();
      const serverAddress = this.lobbyView.getServerAddress();
      if (!this.lobbyView.validateName(playerName) || !this.lobbyView.validateServer(serverAddress)) return;
      const playerCount = this.lobbyView.getPlayerCount();
      if (playerCount === null) return;
      this.lobbyView.clearRegistrationError();
      this.onCreateGameCallback?.(playerName, serverAddress);
    };

    const submitJoin = (): void => {
      const playerName = this.joinPlayerNameInput.value.trim();
      const inviteCode = this.inviteInput.value.trim();
      const serverAddress = this.lobbyView.getServerAddress();
      if (!this.lobbyView.validateName(playerName) || !this.lobbyView.validateServer(serverAddress)) return;
      if (!/^[A-Za-z0-9]{4}$/.test(inviteCode)) {
        this.registrationError.textContent = 'Enter a 4-character invite code';
        return;
      }
      this.lobbyView.clearRegistrationError();
      this.onJoinGameCallback?.(inviteCode, playerName, serverAddress);
    };

    this.actionButton.addEventListener('click', submitCreate);
    this.joinGameButton.addEventListener('click', submitJoin);

    [this.playerNameInput, this.joinPlayerNameInput, this.inviteInput].forEach((input) => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          (this.lobbyView.getLobbyMode() === 'join' ? this.joinGameButton : this.actionButton).click();
        }
      });
    });

    // Fire button
    this.fireButton.addEventListener('click', () => {
      const angle = Number(this.angleInput.value);
      const velocity = Number(this.velocityInput.value);

      if (!Number.isInteger(angle) || !Number.isInteger(velocity)) {
        this.messageEl.textContent = 'Invalid input';
        return;
      }

      if (angle < 0 || angle > 99) {
        this.messageEl.textContent = 'Angle must be between 0 and 99';
        return;
      }

      if (velocity < 30 || velocity > 999) {
        this.messageEl.textContent = 'Velocity must be between 30 and 999';
        return;
      }

      if (this.onFireCallback) {
        if (this.directionField && !this.directionField.hidden) {
          const direction = this.directionInput?.value === 'Right' ? 'Right' : 'Left';
          this.onFireCallback(angle, velocity, direction);
        } else {
          this.onFireCallback(angle, velocity);
        }
      }
    });

    this.rematchButton?.addEventListener('click', () => this.onRematchCallback?.());
    this.playAgainButton?.addEventListener('click', () => this.onRematchAnswerCallback?.('play_again'));
    this.hadEnoughButton?.addEventListener('click', () => this.onRematchAnswerCallback?.('had_enough'));

    this.skipWaitingButton?.addEventListener('click', () => this.onSkipWaitingCallback?.());

    this.addHotSeatPlayerButton?.addEventListener('click', () => this.hotSeatView.addPlayerRow());

    this.startHotSeatButton?.addEventListener('click', () => {
      const names = this.hotSeatView.getPlayerNames();
      const serverAddress = this.lobbyView.getServerAddress();
      if (!names.every(name => this.lobbyView.validateName(name))) return;
      this.lobbyView.clearRegistrationError();
      this.onHotSeatCallback?.(names, serverAddress);
    });

    this.velocityInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.fireButton.click();
      }
    });
  }

  // changed playerId parameter from 0 | 1 to string as it causes an error in main when called
  public setPlayerNames(
    playerId: number,
    playerName: string,
    opponentName: string,
    positions?: { left: { x: number; y: number }; right: { x: number; y: number } }
  ): void {
    this.rosterView.setPlayerNames(playerId, playerName, opponentName, positions);
  }

  public setRosterNames(
    players: Array<{ playerId: number; name: string; active: boolean }>,
    positions: Map<number, { x: number; y: number }>
  ): void {
    this.rosterView.setRosterNames(players, positions);
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

  public onHotSeat(callback: (names: string[], serverAddress: string) => void): void {
    this.onHotSeatCallback = callback;
  }


  /**
   * Register callback for fire event
   */
  public onFire(callback: (angle: number, velocity: number, direction?: 'Left' | 'Right') => void): void {
    this.onFireCallback = callback;
  }

  public setDirectionVisible(visible: boolean): void {
    if (this.directionField) this.directionField.hidden = !visible;
  }

  public setDirectionDefault(direction: 'Left' | 'Right'): void {
    if (this.directionInput) this.directionInput.value = direction;
  }

  public getDirection(): 'Left' | 'Right' {
    return this.directionInput?.value === 'Right' ? 'Right' : 'Left';
  }

  public onRematch(callback: () => void): void {
    this.onRematchCallback = callback;
  }

  public onRematchAnswer(callback: (answer: 'play_again' | 'had_enough') => void): void {
    this.onRematchAnswerCallback = callback;
  }

  public renderRematchStatus(players: Array<{ playerId: number; playerName: string; answer?: 'play_again' | 'had_enough' | 'not_sure' }>): void {
    this.rematchView.renderStatus(players);
  }

  public onSkipWaiting(callback: () => void): void {
    this.onSkipWaitingCallback = callback;
  }

  public getPlayerCount(): number | null {
    return this.lobbyView.getPlayerCount();
  }

  public showLobbyStatus(slots: LobbySlotView[], canSkipWaiting: boolean): void {
    this.lobbyStatusView.show(slots, canSkipWaiting);
  }

  public hideLobbyStatus(): void {
    this.lobbyStatusView.hide();
  }

  /**
   * Show registration in progress
   */
  public showRegistering(): void {
    this.lobbyView.showRegistering();
  }

  /**
   * Show registration error
   */
  public showRegistrationError(error: string): void {
    this.lobbyView.showRegistrationError(error);
  }

  public showInviteInfo(code: string, inviteUrl: string): void {
    this.lobbyView.showInviteInfo(code, inviteUrl);
  }

  public hideInviteInfo(): void {
    this.lobbyView.hideInviteInfo();
  }

  public setServerAddress(serverAddress: string): void {
    this.lobbyView.setServerAddress(serverAddress);
  }

  /**
   * Configure the lobby for a player arriving via an invite link/code: only the
   * name field and Join button are relevant, so hide Create Game and the
   * invite code/link input (pre-filled internally) to avoid confusing the user.
   */
  public enterJoinOnlyMode(inviteCode: string): void {
    this.lobbyView.enterJoinOnlyMode(inviteCode);
  }

  /**
   * Switch from registration to game panel
   */
  public showGamePanel(): void {
    this.gameView.showPanel();
  }

  /**
   * Update message text
   */
  public setMessage(text: string): void {
    this.gameView.setMessage(text);
  }

  public setWindLabel(wind: number): void {
    this.gameView.setWindLabel(wind);
  }

  public renderShotHistory(history: ShotHistoryEntry[]): void {
    this.gameView.renderShotHistory(history);
  }

  /**
   * Update UI based on turn state and highlight current player's name
   * @param isMyTurn Whether it's this client's turn
   */
  public updateTurnUI(currentTurn: number, isMyTurn: boolean): void {
    this.gameView.updateTurnUI(currentTurn, isMyTurn);
  }

  public setShotInputs(shot: ShotHistoryEntry | undefined): void {
    this.gameView.setShotInputs(shot);
  }

  /**
   * Disable fire button (e.g., while firing or game over)
   */
  public disableFireButton(): void {
    this.gameView.disableFireButton();
  }

  /**
   * Show game over message
   */
  public showGameOver(winnerName: string): void;
  public showGameOver(won: boolean, playerName: string, opponentName: string): void;
  public showGameOver(winnerOrWon: string | boolean, playerName?: string, opponentName?: string): void {
    if (typeof winnerOrWon === 'string') this.rematchView.showGameOver(winnerOrWon);
    else this.rematchView.showGameOver(winnerOrWon, playerName ?? '', opponentName ?? '');
  }

  public setRematchWaiting(playersReady: number): void {
    this.rematchView.setWaiting(playersReady);
  }

  public setRematchAnswerSubmitted(): void {
    this.rematchView.setAnswerSubmitted();
  }

  public showRematchAvailable(): void {
    this.rematchView.showAvailable();
  }

  public prepareForNewRound(): void {
    this.rematchView.prepareForNewRound();
  }
}
