import type { UIElements } from '../dom/elements';

export class HotSeatView {
  private readonly elements: UIElements;
  private readonly document: Document;

  constructor(elements: UIElements, document: Document) {
    this.elements = elements;
    this.document = document;
  }

  public initialize(): void {
    if (!this.elements.hotSeatPlayersList) return;
    this.elements.hotSeatPlayersList.replaceChildren();
    this.addPlayerRow();
    this.addPlayerRow();
  }

  public getPlayerNames(): string[] {
    return this.getPlayerInputs().map(input => input.value.trim());
  }

  public addPlayerRow(): void {
    const list = this.elements.hotSeatPlayersList;
    if (!list) return;
    const players = this.getPlayerInputs();
    if (players.length >= 9) return;

    const item = this.document.createElement('li');
    const input = this.document.createElement('input');
    input.type = 'text';
    input.maxLength = 15;
    input.placeholder = `Player ${players.length + 1} name`;
    item.appendChild(input);

    const removeButton = this.document.createElement('button');
    removeButton.type = 'button';
    removeButton.textContent = '✕';
    removeButton.setAttribute('aria-label', 'Remove player');
    removeButton.addEventListener('click', () => this.removePlayerRow(item));
    item.appendChild(removeButton);
    list.appendChild(item);
    this.updateControls();
  }

  private getPlayerInputs(): HTMLInputElement[] {
    return this.elements.hotSeatPlayersList
      ? Array.from(this.elements.hotSeatPlayersList.querySelectorAll<HTMLInputElement>('input[type="text"]'))
      : [];
  }

  private removePlayerRow(item: HTMLLIElement): void {
    if (this.getPlayerInputs().length <= 2) return;
    item.remove();
    this.updateControls();
  }

  private updateControls(): void {
    const list = this.elements.hotSeatPlayersList;
    if (!list) return;
    const count = this.getPlayerInputs().length;
    if (this.elements.addHotSeatPlayerButton) this.elements.addHotSeatPlayerButton.disabled = count >= 9;
    list.querySelectorAll<HTMLButtonElement>('li button').forEach(button => {
      button.disabled = count <= 2;
    });
  }
}