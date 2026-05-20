import pino from 'pino';
import { env } from '../../config/env';
import { LoggerPort } from './LoggerPort';
import { PinoLoggerAdapter } from './PinoLoggerAdapter';

const REDACT_PATHS = [
  'paymentMethodToken',
  'req.headers["x-api-key"]',
  'req.headers.authorization',
  'headers["x-api-key"]',
  'headers.authorization',
  'body.paymentMethodToken',
];

export interface LoggerBundle {
  logger: LoggerPort;
  pino: pino.Logger;
}

export function createLogger(): LoggerBundle {
  const baseOptions: pino.LoggerOptions = {
    level: env.logLevel,
    redact: {
      paths: REDACT_PATHS,
      censor: '[REDACTED]',
    },
  };

  let instance: pino.Logger;

  if (env.logPretty) {
    instance = pino({
      ...baseOptions,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true },
      },
    });
  } else if (env.logDestination === 'file' && env.logFile) {
    instance = pino(baseOptions, pino.destination({ dest: env.logFile, mkdir: true }));
  } else {
    instance = pino(baseOptions);
  }

  return {
    logger: new PinoLoggerAdapter(instance),
    pino: instance,
  };
}
