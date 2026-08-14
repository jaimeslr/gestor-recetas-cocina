export class AppError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: unknown;

  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function notFound(message = 'Recurso no encontrado'): AppError {
  return new AppError('not_found', message, 404);
}

export function unauthorized(message = 'Sesión requerida'): AppError {
  return new AppError('unauthorized', message, 401);
}

export function forbidden(message = 'Acceso denegado'): AppError {
  return new AppError('forbidden', message, 403);
}

export function conflict(message: string, details?: unknown): AppError {
  return new AppError('conflict', message, 409, details);
}

export function invalid(message: string, details?: unknown): AppError {
  return new AppError('invalid', message, 422, details);
}
