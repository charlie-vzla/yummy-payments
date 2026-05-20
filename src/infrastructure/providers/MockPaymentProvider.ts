import {
  PaymentProviderPort,
  ProviderChargeRequest,
  ProviderChargeResponse,
} from '../../domain/ports/PaymentProviderPort';
import { NotImplementedError } from '../../shared/errors/AppError';

export class MockPaymentProvider implements PaymentProviderPort {
  async charge(_request: ProviderChargeRequest): Promise<ProviderChargeResponse> {
    throw new NotImplementedError(
      'Mock payment provider rules will be implemented in a follow-up',
    );
  }
}
