import { Request, Response, NextFunction } from 'express';

export function apiKeyMiddleware(req: Request, _res: Response, next: NextFunction): void {
  req.apiKey = req.header('X-Api-Key') ?? undefined;
  next();
}
