import { MockPaymentProvider } from './MockPaymentProvider';

const baseRequest = {
  merchantId: 'merchant-123',
  currency: 'USD',
  paymentMethodToken: 'tok_test',
  externalReference: 'order-ref-1',
  idempotencyReference: 'idem-1',
};

describe('MockPaymentProvider', () => {
  const provider = new MockPaymentProvider();

  it.each([
    [50_000, 'APPROVED', null],
    [100_000, 'APPROVED', null],
    [100_001, 'REJECTED', 'INSUFFICIENT_FUNDS'],
    [999_900, 'ERROR', 'PROVIDER_INTERNAL_ERROR'],
  ])(
    'charge amount %i returns status %s',
    async (amount, expectedStatus, expectedReasonCode) => {
      const response = await provider.charge({ ...baseRequest, amount });

      expect(response.status).toBe(expectedStatus);
      expect(response.reasonCode).toBe(expectedReasonCode);
      expect(response.providerPaymentId).toMatch(/^pp_[0-9a-f-]{36}$/i);
    },
  );
});
