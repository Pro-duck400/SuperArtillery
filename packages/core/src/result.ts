export class GameError extends Error {
  public readonly code: string;

  constructor(
    code: string,
    message: string
  ) {
    super(message);
    this.name = 'GameError';
    this.code = code;
  }
}

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: GameError };

export function success<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function failure<T = never>(code: string, message: string): Result<T> {
  return { ok: false, error: new GameError(code, message) };
}