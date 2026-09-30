import type { UIElements } from '../dom/elements';
import type { LobbySlotView } from '../ui-manager';

export class LobbyStatusView {
  private readonly elements: UIElements;

  constructor(elements: UIElements) {
    this.elements = elements;
  }

  public show(slots: LobbySlotView[], canSkipWaiting: boolean): void {
    const { lobbyStatus, lobbySlots, skipWaitingButton } = this.elements;
    if (!lobbyStatus || !lobbySlots || !skipWaitingButton) return;
    lobbyStatus.hidden = false;
    lobbySlots.replaceChildren();
    slots.forEach(slot => {
      const item = document.createElement('li');
      item.textContent = slot.status === 'waiting'
        ? ' ⏳'
        : slot.status === 'skipped'
          ? ' 🚫'
          : `${slot.name ?? 'Player'} ✅`;
      lobbySlots.appendChild(item);
    });
    skipWaitingButton.hidden = !canSkipWaiting;
    skipWaitingButton.disabled = !canSkipWaiting;
  }

  public hide(): void {
    const { lobbyStatus, skipWaitingButton } = this.elements;
    if (!lobbyStatus || !skipWaitingButton) return;
    lobbyStatus.hidden = true;
    skipWaitingButton.hidden = true;
  }
}