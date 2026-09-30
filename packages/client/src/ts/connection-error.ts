export function handleGameConnectionFailure(
  error: unknown,
  fallbackMessage: string,
  hideInviteInfo: () => void,
  showRegistrationError: (message: string) => void
): string {
  if (error instanceof Error && error.message === 'Game connection timeout') hideInviteInfo();
  const message = error instanceof Error ? error.message : fallbackMessage;
  showRegistrationError(message);
  return message;
}