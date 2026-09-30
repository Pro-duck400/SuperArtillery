export interface InviteLinkParams {
  inviteCode: string | null;
  serverAddress: string | null;
}

export function parseInviteInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const match = trimmed.match(/[?&]invite=([^&]+)/i);
  return match ? decodeURIComponent(match[1]!) : trimmed;
}

export function parseInviteLink(search: string): InviteLinkParams {
  const params = new URLSearchParams(search);
  return {
    inviteCode: params.get('invite'),
    serverAddress: params.get('server')
  };
}