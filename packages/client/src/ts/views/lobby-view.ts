import type { UIElements } from '../dom/elements';

export type LobbyMode = 'create' | 'join';
export type CreateMode = 'internet' | 'device';

export class LobbyView {
  private readonly elements: UIElements;
  private readonly defaultServerAddress: string;
  private lobbyMode: LobbyMode = 'create';
  private createMode: CreateMode = 'internet';
  private joinOnlyMode = false;
  private creatingGame = false;

  constructor(elements: UIElements, defaultServerAddress: string) {
    this.elements = elements;
    this.defaultServerAddress = defaultServerAddress;
    elements.serverAddressInput.value = defaultServerAddress;
    elements.lobbyModeToggle.textContent = 'Create';
    this.updateVisibility();
  }

  public getLobbyMode(): LobbyMode {
    return this.lobbyMode;
  }

  public getCreateMode(): CreateMode {
    return this.createMode;
  }

  public getServerAddress(): string {
    return this.elements.serverAddressInput.value.trim() || this.defaultServerAddress;
  }

  public setLobbyMode(mode: LobbyMode): void {
    this.lobbyMode = mode;
    this.elements.lobbyModeToggle.textContent = mode === 'join' ? 'Join' : 'Create';
    this.updateVisibility();
  }

  public setCreateMode(mode: CreateMode): void {
    this.createMode = mode;
    this.elements.createModeToggle.textContent = mode === 'device' ? 'on this device' : 'over Internet';
    this.updateVisibility();
  }

  public clearRegistrationError(): void {
    this.elements.registrationError.textContent = '';
  }

  public validateName(name: string): boolean {
    if (!name) {
      this.elements.registrationError.textContent = 'Please enter your name';
      return false;
    }
    if (name.length < 2) {
      this.elements.registrationError.textContent = 'Name must be at least 2 characters';
      return false;
    }
    if (name.length > 15) {
      this.elements.registrationError.textContent = 'Name must be 15 characters or less';
      return false;
    }
    return true;
  }

  public validateServer(serverAddress: string): boolean {
    try {
      const parsedUrl = new URL(serverAddress);
      if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') return true;
    } catch {
      // Fall through to the shared validation message.
    }
    this.elements.registrationError.textContent = 'Please enter a valid server address, e.g. http://localhost:3000';
    return false;
  }

  public getPlayerCount(): number | null {
    const input = this.elements.playerCountInput;
    if (!input) return 2;
    const playerCount = Number(input.value);
    if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount > 9) {
      this.elements.registrationError.textContent = 'Players must be between 2 and 9';
      return null;
    }
    return playerCount;
  }

  public showRegistering(): void {
    this.creatingGame = this.lobbyMode === 'create';
    this.elements.actionButton.disabled = this.creatingGame && this.createMode === 'internet';
    this.elements.joinGameButton.disabled = !this.creatingGame;
    if (this.elements.hotSeatPanel) {
      const startingHotSeat = this.creatingGame && this.createMode === 'device';
      if (this.elements.startHotSeatButton) this.elements.startHotSeatButton.disabled = startingHotSeat;
      if (startingHotSeat) this.elements.startHotSeatButton!.textContent = 'Starting...';
    }
    if (this.creatingGame && this.createMode === 'internet') this.elements.actionButton.textContent = 'Creating...';
    if (this.lobbyMode === 'join') this.elements.joinGameButton.textContent = 'Joining...';
  }

  public showRegistrationError(error: string): void {
    this.elements.registrationError.textContent = error;
    this.creatingGame = false;
    this.elements.actionButton.disabled = false;
    this.elements.actionButton.textContent = 'Create Game';
    this.elements.joinGameButton.disabled = false;
    this.elements.joinGameButton.textContent = 'Join the game';
    if (this.elements.startHotSeatButton) {
      this.elements.startHotSeatButton.disabled = false;
      this.elements.startHotSeatButton.textContent = 'Start Hot Seat';
    }
    this.updateVisibility();
  }

  public showInviteInfo(code: string, inviteUrl: string): void {
    this.elements.inviteInfoEl.style.display = 'block';
    this.elements.inviteCodeTextEl.textContent = code;
    this.elements.inviteUrlTextEl.textContent = inviteUrl;
    this.wireCopyButton(this.elements.copyInviteCodeButton, code);
    this.wireCopyButton(this.elements.copyInviteUrlButton, inviteUrl);
  }

  public hideInviteInfo(): void {
    this.elements.inviteInfoEl.style.display = 'none';
    this.elements.inviteCodeTextEl.textContent = '';
    this.elements.inviteUrlTextEl.textContent = '';
    this.elements.copyInviteCodeButton.onclick = null;
    this.elements.copyInviteUrlButton.onclick = null;
  }

  public setServerAddress(serverAddress: string): void {
    this.elements.serverAddressInput.value = serverAddress;
  }

  public enterJoinOnlyMode(inviteCode: string): void {
    this.joinOnlyMode = true;
    this.lobbyMode = 'join';
    this.elements.inviteInput.value = inviteCode;
    this.elements.serverRow.hidden = true;
    this.elements.lobbyModeRow.hidden = true;
    this.elements.createGameRow.hidden = true;
    this.elements.internetGameRow.hidden = true;
    if (this.elements.hotSeatPanel) this.elements.hotSeatPanel.hidden = true;
    this.elements.serverAddressInput.disabled = true;
    this.elements.serverAddressToggle.disabled = true;
    this.elements.inviteInputLabel.style.display = 'none';
    this.elements.joinGameRow.hidden = false;
    this.elements.joinPlayerNameInput.focus();
  }

  private wireCopyButton(button: HTMLButtonElement, textToCopy: string): void {
    const defaultLabel = '📋 Copy';
    button.textContent = defaultLabel;
    button.onclick = () => {
      navigator.clipboard.writeText(textToCopy)
        .then(() => {
          button.textContent = '✅ Copied!';
          setTimeout(() => { button.textContent = defaultLabel; }, 1500);
        })
        .catch(() => { button.textContent = 'Copy failed'; });
    };
  }

  private updateVisibility(): void {
    if (this.joinOnlyMode) return;
    const { serverRow, joinGameRow, createGameRow, internetGameRow, hotSeatPanel, lobbyModeOptions, createModeOptions } = this.elements;
    const joining = this.lobbyMode === 'join';
    serverRow.hidden = !joining && this.createMode === 'device';
    joinGameRow.hidden = !joining;
    createGameRow.hidden = joining;
    internetGameRow.hidden = joining || this.createMode !== 'internet';
    if (hotSeatPanel) hotSeatPanel.hidden = joining || this.createMode !== 'device';
    lobbyModeOptions.querySelectorAll<HTMLElement>('[role="option"]').forEach(option => {
      option.setAttribute('aria-selected', String(option.dataset.mode === this.lobbyMode));
    });
    createModeOptions.querySelectorAll<HTMLElement>('[role="option"]').forEach(option => {
      option.setAttribute('aria-selected', String(option.dataset.mode === this.createMode));
    });
  }
}