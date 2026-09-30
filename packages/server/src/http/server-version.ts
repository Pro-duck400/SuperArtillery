import { readFileSync } from 'fs';
import { join } from 'path';

export function getServerVersion(): string {
  if (process.env.VERSION) return process.env.VERSION;
  try {
    const packageJson = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8')) as { version?: unknown };
    return typeof packageJson.version === 'string' ? packageJson.version : 'dev';
  } catch {
    return 'dev';
  }
}