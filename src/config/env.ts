import { config } from 'dotenv';

config();

export const env = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL ?? '',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  apiKey: process.env.API_KEY ?? 'your-api-key',
  merchantId: process.env.MERCHANT_ID ?? 'merchant-default',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  logPretty: process.env.LOG_PRETTY === 'true',
  logDestination: process.env.LOG_DESTINATION ?? 'stdout',
  logFile: process.env.LOG_FILE ?? '/var/log/yummy-payments/app.log',
};

export function validateEnv(): void {
  if (!env.databaseUrl) {
    throw new Error('Missing required environment variable: DATABASE_URL');
  }
}
