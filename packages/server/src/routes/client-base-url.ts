import type { Request } from 'express';

export function getClientBaseUrl(req: Request): string | undefined {
  const referer = req.headers.referer;
  if (typeof referer === 'string' && referer) {
    try {
      const url = new URL(referer);
      const pathname = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
      return `${url.origin}${pathname}`;
    } catch {
      // Ignore malformed referer values and try Origin instead.
    }
  }

  const origin = req.headers.origin;
  return typeof origin === 'string' && origin ? origin : undefined;
}