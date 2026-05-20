import Redis from 'ioredis';
import { IdempotencyStorePort } from '../../../domain/ports/IdempotencyStorePort';

const LOCK_PREFIX = 'idempotency:lock:';

export class RedisIdempotencyStore implements IdempotencyStorePort {
  constructor(private readonly redis: Redis) {}

  async tryAcquire(key: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.redis.set(
      `${LOCK_PREFIX}${key}`,
      '1',
      'EX',
      ttlSeconds,
      'NX',
    );
    return result === 'OK';
  }

  async release(key: string): Promise<void> {
    await this.redis.del(`${LOCK_PREFIX}${key}`);
  }
}
