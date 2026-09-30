import type { UIElements } from '../dom/elements';

export class RematchView {
  private readonly elements: UIElements;
  private readonly document: Document;

  constructor(elements: UIElements, document: Document) {
    this.elements = elements;
    this.document = document;
  }

  public renderStatus(players: Array<{ playerId: number; playerName: string; answer?: 'play_again' | 'had_enough' | 'not_sure' }>): void {
    const list = this.elements.rematchPlayers;
    if (!list) return;
    list.replaceChildren();
    players.forEach(player => {
      const item = this.document.createElement('li');
      item.textContent = `${player.playerName} ${player.answer === 'play_again' ? ' ✅' : player.answer === 'had_enough' ? ' ❌' : ' ❔'}`;
      list.appendChild(item);
    });
  }

  public showGameOver(winnerName: string): void;
  public showGameOver(won: boolean, playerName: string, opponentName: string): void;
  public showGameOver(winnerOrWon: string | boolean, playerName?: string, opponentName?: string): void {
    this.elements.messageEl.textContent = typeof winnerOrWon === 'string'
      ? `🎉 ${winnerOrWon} won!`
      : winnerOrWon
        ? `🎉 ${playerName} won! ${opponentName} lost.`
        : `😔 ${playerName} lost. ${opponentName} won!`;
    this.elements.fireButton.disabled = true;
    this.setControlsVisible(true);
    if (this.elements.rematchButton) {
      this.elements.rematchButton.disabled = false;
      this.elements.rematchButton.textContent = 'Play again';
      if (this.elements.playAgainButton) this.elements.playAgainButton.disabled = false;
      if (this.elements.hadEnoughButton) this.elements.hadEnoughButton.disabled = false;
    }
    if (this.elements.playAgainButton) this.elements.playAgainButton.disabled = false;
    if (this.elements.hadEnoughButton) this.elements.hadEnoughButton.disabled = false;
  }

  public setWaiting(playersReady: number): void {
    if (this.elements.rematchControls) this.elements.rematchControls.hidden = false;
    if (this.elements.rematchButton) {
      this.elements.rematchButton.style.display = 'inline-block';
      this.elements.rematchButton.disabled = true;
      this.elements.rematchButton.textContent = `Waiting (${playersReady})`;
    }
  }

  public setAnswerSubmitted(): void {
    if (this.elements.playAgainButton) this.elements.playAgainButton.disabled = true;
    if (this.elements.hadEnoughButton) this.elements.hadEnoughButton.disabled = true;
  }

  public showAvailable(): void {
    if (this.elements.rematchControls) this.elements.rematchControls.hidden = false;
    if (this.elements.playAgainButton) this.elements.playAgainButton.disabled = false;
    if (this.elements.hadEnoughButton) this.elements.hadEnoughButton.disabled = false;
  }

  public prepareForNewRound(): void {
    this.setControlsVisible(false);
    if (this.elements.rematchControls) this.elements.rematchControls.hidden = true;
    this.elements.rematchPlayers?.replaceChildren();
    if (this.elements.rematchButton) {
      this.elements.rematchButton.style.display = 'none';
      this.elements.rematchButton.disabled = true;
    }
  }

  private setControlsVisible(visible: boolean): void {
    const controls = this.document.getElementById('controls') as HTMLDivElement | null;
    if (!controls) return;
    const angleField = this.elements.angleInput.closest('label');
    const velocityField = this.elements.velocityInput.closest('label');
    if (angleField) angleField.style.display = visible ? 'none' : '';
    if (velocityField) velocityField.style.display = visible ? 'none' : '';
    if (this.elements.directionField) this.elements.directionField.style.display = visible ? 'none' : '';
    this.elements.fireButton.style.display = visible ? 'none' : '';
    if (this.elements.rematchControls) this.elements.rematchControls.hidden = !visible;
    if (this.elements.rematchButton) {
      this.elements.rematchButton.style.display = visible ? 'inline-block' : 'none';
      this.elements.rematchButton.disabled = !visible;
      if (visible) this.elements.rematchButton.textContent = 'Play again';
    }
  }
}