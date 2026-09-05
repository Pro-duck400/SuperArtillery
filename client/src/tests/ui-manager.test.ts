import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UIManager } from '../ts/ui-manager';

describe('UIManager private game flow', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="app">
        <div id="registrationPanel" style="display: block;">
          <div id="registrationFields">
            <input id="playerNameInput" value="" />
            <label id="serverAddressLabel"><span class="server-address-combobox">
              <input id="serverAddressInput" value="" role="combobox" aria-controls="serverAddressOptions" aria-expanded="false" />
              <button type="button" id="serverAddressToggle" aria-label="Show server address options" aria-expanded="false">&#9662;</button>
              <span id="serverAddressOptions" role="listbox" hidden>
                <button type="button" role="option" data-server-address="https://superartillery-server-production.up.railway.app">https://superartillery-server-production.up.railway.app</button>
                <button type="button" role="option" data-server-address="http://localhost:3000">http://localhost:3000</button>
              </span>
            </span></label>
          </div>
          <div id="registrationActions">
            <label id="inviteInputLabel"><input id="inviteInput" value="" /></label>
            <button id="actionButton">Create Private Game</button>
          </div>
          <div id="registrationError"></div>
          <div id="inviteInfo">
            <span id="inviteCodeText"></span>
            <button id="copyInviteCodeButton"></button>
            <span id="inviteUrlText"></span>
            <button id="copyInviteUrlButton"></button>
          </div>
        </div>
        <div id="gamePanel" style="display: none;">
          <canvas id="gameCanvas" width="280" height="160"></canvas>
          <div id="playerNamesRow">
            <div id="playerNameLeft"></div>
            <div id="playerNameRight"></div>
          </div>
          <div id="controls">
            <input id="angleInput" value="45" />
            <input id="velocityInput" value="150" />
            <button id="fireButton" disabled>Fire!</button>
          </div>
          <section id="shotHistory">
            <h2 id="shotHistoryTitle">Your last four shots</h2>
            <table><tbody id="shotHistoryRows"></tbody></table>
          </section>
          <div id="message"></div>
        </div>
      </div>
    `;
  });

  it('provides editable server address choices', () => {
    new UIManager('https://superartillery-server-production.up.railway.app');
    const serverInput = document.getElementById('serverAddressInput') as HTMLInputElement;
    const toggle = document.getElementById('serverAddressToggle') as HTMLButtonElement;
    const options = document.querySelectorAll<HTMLButtonElement>('[role="option"]');

    expect(serverInput.value).toBe('https://superartillery-server-production.up.railway.app');
    toggle.click();
    expect(document.getElementById('serverAddressOptions')?.hidden).toBe(false);
    expect(Array.from(options).map((option) => option.dataset.serverAddress)).toEqual([
      'https://superartillery-server-production.up.railway.app',
      'http://localhost:3000'
    ]);

    options[1].click();
    expect(serverInput.value).toBe('http://localhost:3000');
  });

  it('allows creating a private game from the lobby', () => {
    const ui = new UIManager('http://localhost:3000');
    const createSpy = vi.fn();
    ui.onCreateGame(createSpy);

    const nameInput = document.getElementById('playerNameInput') as HTMLInputElement;
    const serverInput = document.getElementById('serverAddressInput') as HTMLInputElement;
    const button = document.getElementById('actionButton') as HTMLButtonElement;

    nameInput.value = 'Alice';
    serverInput.value = 'http://localhost:3000';
    button.click();

    expect(createSpy).toHaveBeenCalledWith('Alice', 'http://localhost:3000');
  });

  it('changes to join mode when an invite code is entered', () => {
    const ui = new UIManager('http://localhost:3000');
    const joinSpy = vi.fn();
    ui.onJoinGame(joinSpy);

    const nameInput = document.getElementById('playerNameInput') as HTMLInputElement;
    const serverInput = document.getElementById('serverAddressInput') as HTMLInputElement;
    const inviteInput = document.getElementById('inviteInput') as HTMLInputElement;
    const actionButton = document.getElementById('actionButton') as HTMLButtonElement;
    const error = document.getElementById('registrationError') as HTMLDivElement;

    nameInput.value = 'Bob';
    serverInput.value = 'http://localhost:3000';
    expect(actionButton.textContent).toBe('Create Private Game');

    inviteInput.value = 'ABCD';
    inviteInput.dispatchEvent(new Event('input'));
    expect(actionButton.textContent).toBe('Join with Invite');

    inviteInput.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter' }));
    expect(joinSpy).toHaveBeenCalledWith('ABCD', 'Bob', 'http://localhost:3000');
    expect(error.textContent).toBe('');
  });

  it('enables joining only for populated invite-code input and hides server selection for invite links', () => {
    const ui = new UIManager('http://localhost:3000');
    const actionButton = document.getElementById('actionButton') as HTMLButtonElement;
    const inviteInput = document.getElementById('inviteInput') as HTMLInputElement;
    const serverLabel = document.getElementById('serverAddressLabel') as HTMLLabelElement;

    expect(actionButton.textContent).toBe('Create Private Game');
    inviteInput.value = 'https://example.com/?invite=ABCD';
    inviteInput.dispatchEvent(new Event('input'));
    expect(actionButton.textContent).toBe('Join with Invite');
    inviteInput.value = 'ABCD';
    inviteInput.dispatchEvent(new Event('input'));
    expect(actionButton.textContent).toBe('Join with Invite');

    ui.setServerAddress('https://api.example.com');
    ui.enterJoinOnlyMode('ABCD');
    expect(serverLabel.style.display).toBe('none');
    expect((document.getElementById('serverAddressInput') as HTMLInputElement).disabled).toBe(true);
  });

  it('shows invite details after creation', () => {
    const ui = new UIManager('http://localhost:3000');
    const inviteInfo = document.getElementById('inviteInfo') as HTMLDivElement;

    ui.showInviteInfo('ABCD', 'https://example.com/?invite=token');

    expect(inviteInfo.style.display).toBe('block');
    expect(inviteInfo.textContent).toContain('ABCD');
    expect(inviteInfo.textContent).toContain('https://example.com/?invite=token');
  });

  it('hides lobby inputs while creating and restores them after an error', () => {
    const ui = new UIManager('http://localhost:3000');
    const fields = document.getElementById('registrationFields') as HTMLDivElement;
    const inviteLabel = document.getElementById('inviteInputLabel') as HTMLLabelElement;
    const actionButton = document.getElementById('actionButton') as HTMLButtonElement;

    ui.showRegistering();

    expect(fields.style.display).toBe('none');
    expect(inviteLabel.style.display).toBe('none');
    expect(actionButton.disabled).toBe(true);
    expect(actionButton.textContent).toBe('Creating...');

    ui.showRegistrationError('Server unavailable');

    expect(fields.style.display).toBe('');
    expect(inviteLabel.style.display).toBe('');
    expect(actionButton.disabled).toBe(false);
    expect(actionButton.textContent).toBe('Create Private Game');
  });

  it('copies the invite URL to the clipboard when the copy button is clicked', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const ui = new UIManager('http://localhost:3000');
    ui.showInviteInfo('ABCD', 'https://example.com/?invite=token');

    const copyButton = document.getElementById('copyInviteUrlButton') as HTMLButtonElement;
    copyButton.click();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith('https://example.com/?invite=token');
  });

  it('hides invite details after a connection timeout', () => {
    const ui = new UIManager('http://localhost:3000');
    const inviteInfo = document.getElementById('inviteInfo') as HTMLDivElement;
    const codeButton = document.getElementById('copyInviteCodeButton') as HTMLButtonElement;
    const urlButton = document.getElementById('copyInviteUrlButton') as HTMLButtonElement;

    ui.showInviteInfo('ABCD', 'https://example.com/?invite=ABCD');
    ui.hideInviteInfo();

    expect(inviteInfo.style.display).toBe('none');
    expect(codeButton.onclick).toBeNull();
    expect(urlButton.onclick).toBeNull();
  });

  it('updates player names and turn state correctly', () => {
    const ui = new UIManager('http://localhost:3000');
    const left = document.getElementById('playerNameLeft') as HTMLDivElement;
    const right = document.getElementById('playerNameRight') as HTMLDivElement;

    ui.setPlayerNames(0, 'Alice', 'Bob');
    expect(left.textContent).toBe('Alice');
    expect(right.textContent).toBe('Bob');

    ui.updateTurnUI(0, true);
    expect(left.classList.contains('player-name-active-turn')).toBe(true);

    ui.updateTurnUI(1, false);
    expect(right.classList.contains('player-name-active-turn')).toBe(true);
  });

  it('shows both player names in the game over message', () => {
    const ui = new UIManager('http://localhost:3000');
    const message = document.getElementById('message') as HTMLDivElement;
    const fireButton = document.getElementById('fireButton') as HTMLButtonElement;

    ui.showGameOver(false, 'Alex', 'Bob');
    expect(message.textContent).toBe('😔 Alex lost. Bob won!');
    expect(fireButton.disabled).toBe(true);

    ui.showGameOver(true, 'Alex', 'Bob');
    expect(message.textContent).toBe('🎉 Alex won! Bob lost.');
  });

  it('renders angle and velocity as rows with newest-first history columns', () => {
    const ui = new UIManager('http://localhost:3000');

    ui.renderShotHistory([
      { angle: 45, velocity: 150 },
      { angle: 30, velocity: 120 }
    ]);

    const rows = document.querySelectorAll('#shotHistoryRows tr');
    expect(rows).toHaveLength(2);
    expect(Array.from(rows[0].querySelectorAll('th, td')).map((cell) => cell.textContent)).toEqual([
      'Angle', '45°', '30°', '—', '—'
    ]);
    expect(Array.from(rows[1].querySelectorAll('th, td')).map((cell) => cell.textContent)).toEqual([
      'Velocity', '150', '120', '—', '—'
    ]);
  });
});
