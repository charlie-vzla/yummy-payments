import { ProviderPaymentStatus } from '../../domain/ports/PaymentProviderPort';

export const MOCK_PROVIDER_ERROR_AMOUNT = 999_900;
export const MOCK_PROVIDER_APPROVED_MAX_AMOUNT = 100_000;

export const MOCK_REASON_INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS';
export const MOCK_REASON_PROVIDER_INTERNAL_ERROR = 'PROVIDER_INTERNAL_ERROR';

export interface MockProviderOutcome {
  status: ProviderPaymentStatus;
  reasonCode: string | null;
}

/**
 * Resolves mock payment provider outcome from amount in centavos.
 * Priority: 999900 ERROR → >100000 REJECTED → else APPROVED.
 * @see docs/REFERENCIA-SERVICIOS-EXTERNOS.md
 */
export function resolveMockProviderOutcome(amount: number): MockProviderOutcome {
  if (amount === MOCK_PROVIDER_ERROR_AMOUNT) {
    return {
      status: 'ERROR',
      reasonCode: MOCK_REASON_PROVIDER_INTERNAL_ERROR,
    };
  }

  if (amount > MOCK_PROVIDER_APPROVED_MAX_AMOUNT) {
    return {
      status: 'REJECTED',
      reasonCode: MOCK_REASON_INSUFFICIENT_FUNDS,
    };
  }

  return {
    status: 'APPROVED',
    reasonCode: null,
  };
}
