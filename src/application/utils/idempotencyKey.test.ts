import { buildIdempotencyKey } from './idempotencyKey';

describe('buildIdempotencyKey', () => {
  it('returns deterministic sha256 hex for orderId and amount', () => {
    const keyA = buildIdempotencyKey('order-1', 50_000);
    const keyB = buildIdempotencyKey('order-1', 50_000);
    const keyC = buildIdempotencyKey('order-1', 50_001);

    expect(keyA).toBe(keyB);
    expect(keyA).not.toBe(keyC);
    expect(keyA).toMatch(/^[a-f0-9]{64}$/);
  });
});
