import type { UIElements } from '../dom/elements';

export class RosterView {
  private readonly elements: UIElements;
  private readonly document: Document;

  constructor(elements: UIElements, document: Document) {
    this.elements = elements;
    this.document = document;
  }

  public setPlayerNames(
    playerId: number,
    playerName: string,
    opponentName: string,
    positions?: { left: { x: number; y: number }; right: { x: number; y: number } }
  ): void {
    const leftNameElement = this.document.getElementById('playerNameLeft');
    const rightNameElement = this.document.getElementById('playerNameRight');
    if (positions) {
      this.position(leftNameElement, positions.left);
      this.position(rightNameElement, positions.right);
    }
    const leftName = playerId === 0 ? playerName : opponentName;
    const rightName = playerId === 0 ? opponentName : playerName;
    if (leftNameElement) {
      leftNameElement.textContent = leftName;
      leftNameElement.classList.add('player-name-connected');
    }
    if (rightNameElement) {
      rightNameElement.textContent = rightName;
      rightNameElement.classList.add('player-name-connected');
    }
  }

  public setRosterNames(
    players: Array<{ playerId: number; name: string; active: boolean }>,
    positions: Map<number, { x: number; y: number }>
  ): void {
    const roster = this.elements.playerNameRoster;
    if (!roster) return;
    roster.replaceChildren();
    players.forEach(player => {
      const element = this.document.createElement('div');
      element.className = 'player-name-overlay player-name-connected';
      element.dataset.playerId = String(player.playerId);
      element.textContent = player.name;
      if (!player.active) element.classList.add('player-name-eliminated');
      this.position(element, positions.get(player.playerId) ?? { x: 0, y: 0 });
      roster.appendChild(element);
    });
  }

  private position(element: HTMLElement | null, position: { x: number; y: number }): void {
    if (!element) return;
    element.style.left = `${position.x}px`;
    element.style.top = `${position.y}px`;
  }
}