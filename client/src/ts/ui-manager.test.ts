import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UIManager } from './ui-manager';

describe('UIManager private game flow', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="app">
        <div id="registrationPanel" style="display: block;">
          <input id="playerNameInput" value="" />
          <input id="serverAddressInput" value="" />
          <button id="registerButton">Create Private Game</button>
          <button id="joinGameButton">Join with Invite</button>
          <input id="inviteInput" value="" />
          <div id="registrationError"></div>
          <div id="inviteInfo"></div>
        </div>
        <div id="gamePanel" style="display: none;">
          <div id="status"></div>
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
          <div id="message"></div>
        </div>
      </div>
    `;
  });

  it('allows creating a private game from the lobby', () => {
    const ui = new UIManager('http://localhost:3000');
    const createSpy = vi.fn();
    ui.onCreateGame(createSpy);

    const nameInput = document.getElementById('playerNameInput') as HTMLInputElement;
    const serverInput = document.getElementById('serverAddressInput') as HTMLInputElement;
    const button = document.getElementById('registerButton') as HTMLButtonElement;

    nameInput.value = 'Alice';
    serverInput.value = 'http://localhost:3000';
    button.click();

    expect(createSpy).toHaveBeenCalledWith('Alice', 'http://localhost:3000');
  });

  it('requires an invite code before joining a game', () => {
    const ui = new UIManager('http://localhost:3000');
    const joinSpy = vi.fn();
    ui.onJoinGame(joinSpy);

    const nameInput = document.getElementById('playerNameInput') as HTMLInputElement;
    const serverInput = document.getElementById('serverAddressInput') as HTMLInputElement;
    const joinButton = document.getElementById('joinGameButton') as HTMLButtonElement;
    const error = document.getElementById('registrationError') as HTMLDivElement;

    nameInput.value = 'Bob';
    serverInput.value = 'http://localhost:3000';
    joinButton.click();

    expect(joinSpy).not.toHaveBeenCalled();
    expect(error.textContent).toContain('Enter an invite code');
  });

  it('shows invite details after creation', () => {
    const ui = new UIManager('http://localhost:3000');
    const inviteInfo = document.getElementById('inviteInfo') as HTMLDivElement;

    ui.showInviteInfo('ABC123', 'https://example.com/?invite=token');

    expect(inviteInfo.style.display).toBe('block');
    expect(inviteInfo.textContent).toContain('ABC123');
    expect(inviteInfo.textContent).toContain('https://example.com/?invite=token');
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
});
