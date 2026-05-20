export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Payment not found') {
    super(404, message, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class NotImplementedError extends AppError {
  constructor(message = 'Not implemented') {
    super(501, message, 'NOT_IMPLEMENTED');
    this.name = 'NotImplementedError';
  }
}
