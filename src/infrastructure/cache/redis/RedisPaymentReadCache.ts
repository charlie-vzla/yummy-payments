import Redis from 'ioredis';
import { GetPaymentResponseDto } from '../../../application/dtos/GetPaymentResponseDto';
import { PaymentReadCachePort } from '../../../application/ports/PaymentReadCachePort';

const CACHE_PREFIX = 'payment:get:';
const CACHE_TTL_SECONDS = 86_400;

export class RedisPaymentReadCache implements PaymentReadCachePort {
  constructor(private readonly redis: Redis) {}

  async get(orderId: string): Promise<GetPaymentResponseDto | null> {
    const raw = await this.redis.get(`${CACHE_PREFIX}${orderId}`);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as GetPaymentResponseDto;
  }

  async set(orderId: string, value: GetPaymentResponseDto): Promise<void> {
    await this.redis.set(
      `${CACHE_PREFIX}${orderId}`,
      JSON.stringify(value),
      'EX',
      CACHE_TTL_SECONDS,
    );
  }
}
