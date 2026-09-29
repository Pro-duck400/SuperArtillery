import type { ShotHistoryEntry } from '../game';
import type { UIElements } from '../dom/elements';

export class GameView {
  private readonly elements: UIElements;
  private readonly document: Document;

  constructor(elements: UIElements, document: Document) {
    this.elements = elements;
    this.document = document;
  }

  public showPanel(): void {
    this.elements.registrationPanel.style.display = 'none';
    this.elements.gamePanel.style.display = 'block';
  }

  public setMessage(text: string): void {
    this.elements.messageEl.textContent = text;
  }

  public setWindLabel(wind: number): void {
    this.elements.windLabel.textContent = `wind: ${Math.ceil(wind)}`;
  }

  public renderShotHistory(history: ShotHistoryEntry[]): void {
    const rows = this.elements.shotHistoryRowsEl;
    rows.replaceChildren();
    const angleRow = this.document.createElement('tr');
    const velocityRow = this.document.createElement('tr');
    const angleLabel = this.document.createElement('th');
    const velocityLabel = this.document.createElement('th');
    angleLabel.scope = 'row';
    angleLabel.textContent = 'Angle';
    velocityLabel.scope = 'row';
    velocityLabel.textContent = 'Velocity';
    angleRow.appendChild(angleLabel);
    velocityRow.appendChild(velocityLabel);

    for (let index = 0; index < 4; index += 1) {
      const shot = history[index];
      const angleCell = this.document.createElement('td');
      const velocityCell = this.document.createElement('td');
      const angleText = shot ? `${shot.direction === 'Left' ? '↖️' : ''}${shot.angle}°${shot.direction === 'Right' ? '↗️' : ''}` : '—';
      const velocityText = shot ? String(shot.velocity) : '—';
      angleCell.textContent = angleText;
      velocityCell.textContent = velocityText;
      angleCell.setAttribute('aria-label', `Angle ${angleText}`);
      velocityCell.setAttribute('aria-label', `Velocity ${velocityText}`);
      angleRow.appendChild(angleCell);
      velocityRow.appendChild(velocityCell);
    }
    rows.append(angleRow, velocityRow);
  }

  public updateTurnUI(currentTurn: number, isMyTurn: boolean): void {
    const { fireButton, directionInput, angleInput, velocityInput, playerNameRoster } = this.elements;
    fireButton.disabled = !isMyTurn;
    if (directionInput) directionInput.disabled = !isMyTurn;
    angleInput.disabled = !isMyTurn;
    velocityInput.disabled = !isMyTurn;
    if (playerNameRoster) {
      playerNameRoster.querySelectorAll<HTMLElement>('[data-player-id]').forEach(element => {
        element.classList.toggle('player-name-active-turn', element.dataset.playerId === String(currentTurn));
      });
      if (isMyTurn) angleInput.focus();
      return;
    }
    const leftNameElement = this.document.getElementById('playerNameLeft');
    const rightNameElement = this.document.getElementById('playerNameRight');
    leftNameElement?.classList.remove('player-name-active-turn');
    rightNameElement?.classList.remove('player-name-active-turn');
    if (currentTurn === 0) leftNameElement?.classList.add('player-name-active-turn');
    else rightNameElement?.classList.add('player-name-active-turn');
    if (isMyTurn) angleInput.focus();
  }

  public setShotInputs(shot: ShotHistoryEntry | undefined): void {
    this.elements.angleInput.value = String(shot?.angle ?? 45);
    this.elements.velocityInput.value = String(shot?.velocity ?? 150);
    if (this.elements.directionInput && shot?.direction) this.elements.directionInput.value = shot.direction;
  }

  public disableFireButton(): void {
    this.elements.fireButton.disabled = true;
  }
}