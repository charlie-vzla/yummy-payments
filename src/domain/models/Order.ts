import { PaymentStatus } from './PaymentStatus';

export interface Order {
  id: string;
  merchantId: string;
  amount: number;
  orderId: string;
  status: PaymentStatus;
  reasonCode: string | null;
  reason: string | null;
  reference: string | null;
  providerPaymentId: string | null;
  currency: string;
  idempotencyValue: string;
  retries: number;
  createdAt: Date;
  updatedAt: Date;
}
