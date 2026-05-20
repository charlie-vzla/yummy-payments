import express, { Express } from 'express';
import pinoHttp from 'pino-http';
import { randomUUID } from 'crypto';
import type { Logger as PinoLogger } from 'pino';
import { PaymentService } from '../../application/services/PaymentService';
import { LoggerPort } from '../../shared/logging/LoggerPort';
import { apiKeyMiddleware } from './middleware/apiKey.middleware';
import { createErrorHandler } from './middleware/errorHandler.middleware';
import { createPaymentsRouter } from './routes/payments.routes';

export function createApp(
  paymentService: PaymentService,
  logger: LoggerPort,
  pinoInstance: PinoLogger,
): Express {
  const app = express();

  app.use(
    pinoHttp({
      logger: pinoInstance,
      autoLogging: {
        ignore: (req) => req.url === '/health',
      },
      genReqId: (req, res) => {
        const existing = req.headers['x-request-id'];
        const requestId =
          typeof existing === 'string' ? existing : Array.isArray(existing) ? existing[0] : undefined;
        const id = requestId ?? randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      serializers: {
        req: (req) => ({
          id: req.id,
          method: req.method,
          url: req.url,
        }),
        res: (res) => ({
          statusCode: res.statusCode,
        }),
      },
      customProps: (req) => ({
        requestId: req.id,
      }),
    }),
  );

  app.use(express.json());
  app.use(apiKeyMiddleware);

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/payments', createPaymentsRouter(paymentService));

  app.use(createErrorHandler(logger));

  return app;
}
