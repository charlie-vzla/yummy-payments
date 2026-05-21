import { config } from 'dotenv';

config();

export const env = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL ?? '',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  apiKey: process.env.API_KEY ?? 'your-api-key',
  paymentProviderMaxRetries: parseInt(process.env.PAYMENT_PROVIDER_MAX_RETRIES ?? '3', 10),
  idempotencyLockTtlSeconds: parseInt(process.env.IDEMPOTENCY_LOCK_TTL_SECONDS ?? '30', 10),
  idempotencyRecordTtlSeconds: parseInt(process.env.IDEMPOTENCY_RECORD_TTL_SECONDS ?? '86400', 10),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  logPretty: process.env.LOG_PRETTY === 'true',
  logDestination: process.env.LOG_DESTINATION ?? 'stdout',
  logFile: process.env.LOG_FILE ?? '/var/log/yummy-payments/app.log',
  maxAmount: process.env.MAX_AMOUNT ?? 100_000
};

export function validateEnv(): void {
  if (!env.databaseUrl) {
    throw new Error('Missing required environment variable: DATABASE_URL');
  }
}
