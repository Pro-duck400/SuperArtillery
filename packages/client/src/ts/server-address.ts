const BUILT_IN_DEFAULT = 'http://localhost:3000';
const PRODUCTION_DEFAULT = 'https://superartillery-server-production.up.railway.app';

export function getDefaultServerAddress(envUrl: string | undefined, hostname: string): string {
  if (envUrl) return envUrl;
  if (!hostname || hostname === 'localhost' || hostname.startsWith('127.')) return BUILT_IN_DEFAULT;
  return PRODUCTION_DEFAULT;
}

export function resolveServerBaseUrls(serverAddress: string, defaultAddress: string): { apiBaseUrl: string; wsBaseUrl: string } {
  const chosen = (serverAddress && serverAddress.trim()) || defaultAddress;
  const parsedUrl = new URL(chosen);
  const wsProtocol = parsedUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  return {
    apiBaseUrl: parsedUrl.origin,
    wsBaseUrl: `${wsProtocol}//${parsedUrl.host}`
  };
}