export interface UIElements {
  registrationPanel: HTMLDivElement;
  serverRow: HTMLDivElement;
  lobbyModeRow: HTMLDivElement;
  joinGameRow: HTMLDivElement;
  createGameRow: HTMLDivElement;
  internetGameRow: HTMLDivElement;
  lobbyModeToggle: HTMLButtonElement;
  createModeToggle: HTMLButtonElement;
  lobbyModeOptions: HTMLSpanElement;
  createModeOptions: HTMLSpanElement;
  joinPlayerNameInput: HTMLInputElement;
  joinGameButton: HTMLButtonElement;
  gamePanel: HTMLDivElement;
  windLabel: HTMLDivElement;
  playerNameInput: HTMLInputElement;
  playerCountInput: HTMLInputElement;
  serverAddressInput: HTMLInputElement;
  serverAddressToggle: HTMLButtonElement;
  serverAddressOptions: HTMLSpanElement;
  serverHealthButton: HTMLAnchorElement;
  serverHealthStatus: HTMLDivElement;
  serverHealthMessage: HTMLSpanElement;
  actionButton: HTMLButtonElement;
  hotSeatPanel: HTMLDivElement | null;
  startHotSeatButton: HTMLButtonElement | null;
  hotSeatPlayersList: HTMLOListElement | null;
  addHotSeatPlayerButton: HTMLButtonElement | null;
  inviteInput: HTMLInputElement;
  inviteInputLabel: HTMLLabelElement;
  registrationError: HTMLDivElement;
  lobbyStatus: HTMLDivElement;
  lobbySlots: HTMLOListElement;
  skipWaitingButton: HTMLButtonElement;
  playerNameRoster: HTMLDivElement | null;
  inviteInfoEl: HTMLDivElement;
  inviteCodeTextEl: HTMLSpanElement;
  inviteUrlTextEl: HTMLSpanElement;
  copyInviteCodeButton: HTMLButtonElement;
  copyInviteUrlButton: HTMLButtonElement;
  messageEl: HTMLDivElement;
  shotHistoryRowsEl: HTMLTableSectionElement;
  angleInput: HTMLInputElement;
  velocityInput: HTMLInputElement;
  directionInput: HTMLSelectElement | null;
  directionField: HTMLLabelElement | null;
  fireButton: HTMLButtonElement;
  rematchButton: HTMLButtonElement;
  rematchControls: HTMLDivElement | null;
  rematchPlayers: HTMLOListElement | null;
  playAgainButton: HTMLButtonElement | null;
  hadEnoughButton: HTMLButtonElement | null;
}

export function collectUIElements(document: Document): UIElements {
  const required = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
  const optional = <T extends HTMLElement>(id: string): T | null => document.getElementById(id) as T | null;
  return {
    registrationPanel: required('registrationPanel'),
    serverRow: required('serverRow'),
    lobbyModeRow: required('lobbyModeRow'),
    joinGameRow: required('joinGameRow'),
    createGameRow: required('createGameRow'),
    internetGameRow: required('internetGameRow'),
    lobbyModeToggle: required('lobbyModeToggle'),
    createModeToggle: required('createModeToggle'),
    lobbyModeOptions: required('lobbyModeOptions'),
    createModeOptions: required('createModeOptions'),
    joinPlayerNameInput: required('joinPlayerNameInput'),
    joinGameButton: required('joinGameButton'),
    gamePanel: required('gamePanel'),
    windLabel: required('windLabel'),
    playerNameInput: required('playerNameInput'),
    playerCountInput: required('playerCountInput'),
    serverAddressInput: required('serverAddressInput'),
    serverAddressToggle: required('serverAddressToggle'),
    serverAddressOptions: required('serverAddressOptions'),
    serverHealthButton: required('serverHealthButton'),
    serverHealthStatus: required('serverHealthStatus'),
    serverHealthMessage: required('serverHealthMessage'),
    actionButton: required('actionButton'),
    hotSeatPanel: optional('hotSeatPanel'),
    startHotSeatButton: optional('startHotSeatButton'),
    hotSeatPlayersList: optional('hotSeatPlayersList'),
    addHotSeatPlayerButton: optional('addHotSeatPlayerButton'),
    inviteInput: required('inviteInput'),
    inviteInputLabel: required('inviteInputLabel'),
    registrationError: required('registrationError'),
    lobbyStatus: required('lobbyStatus'),
    lobbySlots: required('lobbySlots'),
    skipWaitingButton: required('skipWaitingButton'),
    playerNameRoster: optional('playerNameRoster'),
    inviteInfoEl: required('inviteInfo'),
    inviteCodeTextEl: required('inviteCodeText'),
    inviteUrlTextEl: required('inviteUrlText'),
    copyInviteCodeButton: required('copyInviteCodeButton'),
    copyInviteUrlButton: required('copyInviteUrlButton'),
    messageEl: required('message'),
    shotHistoryRowsEl: required('shotHistoryRows'),
    angleInput: required('angleInput'),
    velocityInput: required('velocityInput'),
    directionInput: optional('directionInput'),
    directionField: optional('directionField'),
    fireButton: required('fireButton'),
    rematchButton: required('rematchButton'),
    rematchControls: optional('rematchControls'),
    rematchPlayers: optional('rematchPlayers'),
    playAgainButton: optional('playAgainButton'),
    hadEnoughButton: optional('hadEnoughButton')
  };
}