import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../shared/errors/AppError';
import { LoggerPort } from '../../../shared/logging/LoggerPort';
import { ZodError } from 'zod';

export function createErrorHandler(logger: LoggerPort) {
  return function errorHandler(
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
  ): void {
    if (err instanceof AppError) {
      if (err.statusCode >= 500) {
        logger.error({ err: { message: err.message, code: err.code } }, 'application_error');
      }

      res.status(err.statusCode).json({
        error: err.code ?? 'ERROR',
        message: err.message,
      });
    } else if (err instanceof ZodError) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: err.errors.map((e) => e.message).join('; '),
      });
    } else {
      logger.error(
        {
          err:
            err instanceof Error
              ? { message: err.message, name: err.name, stack: err.stack }
              : { message: 'Unknown error' },
        },
        'unhandled_error',
      );

      res.status(500).json({
        error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        });
    }
  };
}
