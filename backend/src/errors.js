export class AppError extends Error {
  constructor(code, message, status = 400, details) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function notFound(message = 'Recurso no encontrado') {
  return new AppError('not_found', message, 404);
}

export function unauthorized(message = 'Sesión requerida') {
  return new AppError('unauthorized', message, 401);
}

export function forbidden(message = 'Acceso denegado') {
  return new AppError('forbidden', message, 403);
}

export function conflict(message, details) {
  return new AppError('conflict', message, 409, details);
}

export function invalid(message, details) {
  return new AppError('invalid', message, 422, details);
}
