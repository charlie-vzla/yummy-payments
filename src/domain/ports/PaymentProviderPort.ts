export interface ProviderChargeRequest {
  merchantId: string;
  amount: number;
  currency: string;
  paymentMethodToken: string;
  externalReference: string;
  idempotencyReference: string;
}

export type ProviderPaymentStatus = 'APPROVED' | 'REJECTED' | 'ERROR';

export interface ProviderChargeResponse {
  providerPaymentId: string;
  status: ProviderPaymentStatus;
  reasonCode: string | null;
}

export interface PaymentProviderPort {
  charge(request: ProviderChargeRequest): Promise<ProviderChargeResponse>;
}
