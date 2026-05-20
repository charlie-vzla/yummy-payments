import { createHash } from 'crypto';

export function buildIdempotencyKey(orderId: string, amount: number): string {
  return createHash('sha256').update(`${orderId}:${amount}`).digest('hex');
}
