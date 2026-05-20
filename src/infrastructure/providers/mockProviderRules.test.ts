import {
  MOCK_PROVIDER_APPROVED_MAX_AMOUNT,
  MOCK_PROVIDER_ERROR_AMOUNT,
  MOCK_REASON_INSUFFICIENT_FUNDS,
  MOCK_REASON_PROVIDER_INTERNAL_ERROR,
  resolveMockProviderOutcome,
} from './mockProviderRules';

describe('resolveMockProviderOutcome', () => {
  it.each([
    [50_000, 'APPROVED', null],
    [MOCK_PROVIDER_APPROVED_MAX_AMOUNT, 'APPROVED', null],
    [MOCK_PROVIDER_APPROVED_MAX_AMOUNT + 1, 'REJECTED', MOCK_REASON_INSUFFICIENT_FUNDS],
    [500_000, 'REJECTED', MOCK_REASON_INSUFFICIENT_FUNDS],
    [MOCK_PROVIDER_ERROR_AMOUNT, 'ERROR', MOCK_REASON_PROVIDER_INTERNAL_ERROR],
  ])('amount %i → status %s, reasonCode %s', (amount, status, reasonCode) => {
    expect(resolveMockProviderOutcome(amount)).toEqual({ status, reasonCode });
  });

  it('prioritizes ERROR for 999900 over REJECTED (>100000)', () => {
    expect(MOCK_PROVIDER_ERROR_AMOUNT).toBeGreaterThan(MOCK_PROVIDER_APPROVED_MAX_AMOUNT);
    const outcome = resolveMockProviderOutcome(MOCK_PROVIDER_ERROR_AMOUNT);
    expect(outcome.status).toBe('ERROR');
    expect(outcome.reasonCode).toBe(MOCK_REASON_PROVIDER_INTERNAL_ERROR);
  });
});
