import Redis from 'ioredis';
import { createApp } from './infrastructure/http/app';
import { env, validateEnv } from './config/env';
import { PaymentService } from './application/services/PaymentService';
import { PrismaOrderRepository } from './infrastructure/persistence/prisma/PrismaOrderRepository';
import { RedisIdempotencyStore } from './infrastructure/cache/redis/RedisIdempotencyStore';
import { RedisPaymentReadCache } from './infrastructure/cache/redis/RedisPaymentReadCache';
import { MockPaymentProvider } from './infrastructure/providers/MockPaymentProvider';
import { prisma } from './infrastructure/persistence/prisma/client';
import { createLogger } from './shared/logging/createLogger';

async function main(): Promise<void> {
  validateEnv();

  const { logger, pino: pinoInstance } = createLogger();

  const orderRepository = new PrismaOrderRepository();
  const paymentProvider = new MockPaymentProvider();
  const redis = new Redis(env.redisUrl);
  const idempotencyStore = new RedisIdempotencyStore(redis);
  const paymentReadCache = new RedisPaymentReadCache(redis);

  const paymentService = new PaymentService(
    orderRepository,
    paymentProvider,
    idempotencyStore,
    paymentReadCache,
    logger,
  );

  const app = createApp(paymentService, logger, pinoInstance);

  const server = app.listen(env.port, () => {
    logger.info({ port: env.port }, 'payment_orchestrator_started');
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'payment_orchestrator_shutting_down');
    server.close();
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((error) => {
  const { logger } = createLogger();
  logger.error(
    {
      err:
        error instanceof Error
          ? { message: error.message, name: error.name, stack: error.stack }
          : { message: 'Unknown error' },
    },
    'payment_orchestrator_start_failed',
  );
  process.exit(1);
});
