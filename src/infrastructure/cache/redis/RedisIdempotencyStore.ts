import Redis from 'ioredis';
import { IdempotencyStorePort } from '../../../domain/ports/IdempotencyStorePort';

const LOCK_PREFIX = 'idempotency:lock:';
const RECORD_PREFIX = 'idempotency:record:';

export class RedisIdempotencyStore implements IdempotencyStorePort {
  constructor(private readonly redis: Redis) {}

  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(`${RECORD_PREFIX}${key}`);
    return result === 1;
  }

  async register(key: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(`${RECORD_PREFIX}${key}`, '1', 'EX', ttlSeconds);
  }

  /**
   * Try to acquire a lock for the given key. Will only return true if no pre existing key exists. This is to avoid race conditions.
   * @param key - The key to acquire the lock for.
   * @param ttlSeconds - The time to live for the lock.
   * @returns Promise<boolean> - True if the lock was acquired, false if it was not.
   */
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
