export function formatUptime(uptimeSeconds: number): string {
  const totalMilliseconds = Math.floor(uptimeSeconds * 1000);
  const days = Math.floor(totalMilliseconds / 86400000);
  const hours = Math.floor(totalMilliseconds / 3600000) % 24;
  const minutes = Math.floor(totalMilliseconds / 60000) % 60;
  const seconds = Math.floor(totalMilliseconds / 1000) % 60;
  const milliseconds = totalMilliseconds % 1000;

  return `${days}.${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}