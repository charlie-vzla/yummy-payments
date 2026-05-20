import { OrderRepositoryPort } from '../../../domain/ports/OrderRepositoryPort';
import { Order } from '../../../domain/models/Order';
import { prisma } from './client';
import { toDomainOrder } from './mappers';

export class PrismaOrderRepository implements OrderRepositoryPort {
  async findByOrderId(orderId: string): Promise<Order | null> {
    const record = await prisma.order.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
    return record ? toDomainOrder(record) : null;
  }

  async findByOrderIdAndAmount(orderId: string, amount: number): Promise<Order | null> {
    const record = await prisma.order.findUnique({
      where: {
        orderId_amount: { orderId, amount },
      },
    });
    return record ? toDomainOrder(record) : null;
  }

  async findByIdempotencyValue(idempotencyValue: string): Promise<Order | null> {
    const record = await prisma.order.findUnique({
      where: { idempotencyValue },
    });
    return record ? toDomainOrder(record) : null;
  }

  async create(
    order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Order> {
    const record = await prisma.order.create({
      data: {
        merchantId: order.merchantId,
        amount: order.amount,
        orderId: order.orderId,
        status: order.status,
        reasonCode: order.reasonCode,
        reason: order.reason,
        reference: order.reference,
        providerPaymentId: order.providerPaymentId,
        currency: order.currency,
        idempotencyValue: order.idempotencyValue,
        retries: order.retries,
      },
    });
    return toDomainOrder(record);
  }

  async update(order: Order): Promise<Order> {
    const record = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: order.status,
        reasonCode: order.reasonCode,
        reason: order.reason,
        reference: order.reference,
        providerPaymentId: order.providerPaymentId,
        retries: order.retries,
      },
    });
    return toDomainOrder(record);
  }
}
