import { Order as PrismaOrder } from '@prisma/client';
import { Order } from '../../../domain/models/Order';
import { PaymentStatus } from '../../../domain/models/PaymentStatus';

export function toDomainOrder(record: PrismaOrder): Order {
  return {
    id: record.id,
    merchantId: record.merchantId,
    amount: record.amount,
    orderId: record.orderId,
    status: record.status as PaymentStatus,
    reasonCode: record.reasonCode,
    reason: record.reason,
    reference: record.reference,
    providerPaymentId: record.providerPaymentId,
    currency: record.currency,
    idempotencyValue: record.idempotencyValue,
    retries: record.retries,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
