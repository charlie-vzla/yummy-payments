import { randomUUID } from 'crypto';
import {
  PaymentProviderPort,
  ProviderChargeRequest,
  ProviderChargeResponse,
} from '../../domain/ports/PaymentProviderPort';
import { resolveMockProviderOutcome } from './mockProviderRules';

export class MockPaymentProvider implements PaymentProviderPort {
  async charge(request: ProviderChargeRequest): Promise<ProviderChargeResponse> {
    const { status, reasonCode } = resolveMockProviderOutcome(request.amount);

    return {
      providerPaymentId: `pp_${randomUUID()}`,
      status,
      reasonCode,
    };
  }
}
